import { kvs } from '@forge/kvs';
import type { Analysis, Contact, EvidenceGroup, InviteDraft, Seat } from '../types';
import {
  getPage,
  getParticipants,
  isWatching,
  postFooterComment,
  searchJira,
  searchPages,
  type JiraHit,
  type PageHit,
} from './atlassian';
import { cleanInvite } from './clean';
import { ask, askJson } from './llm';

const CACHE_TTL_SECONDS = 60 * 60 * 6;

interface Extraction {
  isDecision: boolean;
  status: 'draft' | 'in-review' | 'decided';
  subjects: { label: string; searchTerms: string[] }[];
}

/** Collected evidence for one team before it becomes a seat. */
interface Group {
  team: string;
  jira: JiraHit[];
  service: JiraHit[];
  pages: PageHit[];
  people: Map<string, { name: string; weight: number }>;
  /** People assigned to the team's work. Only this makes a decision's author a member of the team. */
  assignees: Set<string>;
}

export async function analyzePage(pageId: string, opts: { force?: boolean } = {}): Promise<Analysis> {
  const page = await getPage(pageId);
  const cacheKey = `analysis:${pageId}:${page.version}`;
  if (!opts.force) {
    const cached = (await kvs.get(cacheKey)) as Analysis | undefined;
    if (cached) return cached;
  }

  const extraction = await extract(page.title, page.text, page.labels);
  const terms = [...new Set(extraction.subjects.flatMap((s) => s.searchTerms))].slice(0, 8);

  const [issues, pages, participants] = await Promise.all([
    searchJira(terms),
    searchPages(terms, pageId),
    getParticipants(pageId, page.authorId),
  ]);

  const groups = groupByTeam(issues, pages);
  const seats = await Promise.all(
    [...groups.values()].map((g) => toSeat(g, pageId, page.authorId, participants)),
  );
  await writeReasons(page.title, seats);

  const analysis: Analysis = {
    pageId,
    pageTitle: page.title,
    pageStatus: extraction.status,
    isDecision: extraction.isDecision,
    subjects: extraction.subjects.map((s) => s.label),
    seats,
    analyzedAt: new Date().toISOString(),
  };

  await kvs.set(cacheKey, analysis, { ttl: { value: CACHE_TTL_SECONDS, unit: 'SECONDS' } });
  await kvs.set(`latest:${pageId}`, analysis);
  return analysis;
}

export async function latestAnalysis(pageId: string): Promise<Analysis | undefined> {
  return (await kvs.get(`latest:${pageId}`)) as Analysis | undefined;
}

async function extract(title: string, text: string, labels: string[]): Promise<Extraction> {
  return askJson<Extraction>(
    `You read Confluence pages and find what a proposal or decision changes.
Return {"isDecision": boolean, "status": "draft" | "in-review" | "decided", "subjects": [{"label": string, "searchTerms": string[]}]}.
- isDecision is true for proposals, RFCs, decision records, policy or process changes.
- subjects are the concrete things this decision changes: systems, APIs, products, processes, dates, policies. At most 4.
- Do not list motivations, costs, or background such as team capacity, and do not list the replacement unless it changes something for others.
- label is a short name a reader would recognise, for example "Payments API v1".
- searchTerms are 1 to 3 exact phrases likely to appear in other Jira issues or pages about that subject. Prefer specific nouns over generic words.`,
    `Title: ${title}\nLabels: ${labels.join(', ') || 'none'}\n\n${text.slice(0, 12000)}`,
  );
}

function groupByTeam(issues: JiraHit[], pages: PageHit[]): Map<string, Group> {
  const groups = new Map<string, Group>();
  const get = (team: string) => {
    const key = team.trim().toLowerCase();
    if (!groups.has(key))
      groups.set(key, { team: team.trim(), jira: [], service: [], pages: [], people: new Map(), assignees: new Set() });
    return groups.get(key)!;
  };
  const addPerson = (g: Group, accountId: string, name: string, weight: number) => {
    const cur = g.people.get(accountId);
    g.people.set(accountId, { name, weight: (cur?.weight ?? 0) + weight });
  };

  for (const issue of issues) {
    const isService = issue.projectType === 'service_desk';
    const g = get(issue.team ?? issue.projectName);
    (isService ? g.service : g.jira).push(issue);
    if (issue.assignee) {
      addPerson(g, issue.assignee.accountId, issue.assignee.name, 2);
      g.assignees.add(issue.assignee.accountId);
    }
    if (issue.reporter) addPerson(g, issue.reporter.accountId, issue.reporter.name, 1);
  }
  for (const page of pages) {
    const g = get(page.spaceName);
    g.pages.push(page);
    if (page.creator) addPerson(g, page.creator.accountId, page.creator.name, 1);
  }
  return groups;
}

async function toSeat(
  g: Group,
  pageId: string,
  authorId: string,
  participants: { commenters: Set<string>; editors: Set<string> },
): Promise<Seat> {
  // A decision's author often files tickets or pages for other teams. That alone must not seat those teams.
  const author = g.assignees.has(authorId);
  const members = [...g.people.keys()].filter((id) => id !== authorId || author);
  const commented = members.some((id) => participants.commenters.has(id) || participants.editors.has(id));

  const contacts: Contact[] = [...g.people.entries()]
    .filter(([id]) => members.includes(id))
    .sort((a, b) => b[1].weight - a[1].weight)
    .slice(0, 2)
    .map(([accountId, p]) => ({ accountId, name: p.name }));

  let following = false;
  if (!commented) {
    const checks = await Promise.all(contacts.map((c) => isWatching(pageId, c.accountId!)));
    following = checks.some(Boolean);
  }

  const evidence: EvidenceGroup[] = [];
  if (g.jira.length)
    evidence.push({
      kind: 'jira',
      count: g.jira.length,
      label: g.jira.length === 1 ? 'open issue' : 'open issues',
      items: g.jira.slice(0, 5).map((i) => ({ kind: 'jira', key: i.key, title: i.summary })),
    });
  if (g.service.length)
    evidence.push({
      kind: 'service',
      count: g.service.length,
      label: g.service.length === 1 ? 'customer request' : 'customer requests',
      items: g.service.slice(0, 5).map((i) => ({ kind: 'service', key: i.key, title: i.summary })),
    });
  if (g.pages.length)
    evidence.push({
      kind: 'page',
      count: g.pages.length,
      label: g.pages.length === 1 ? 'related page' : 'related pages',
      items: g.pages.slice(0, 5).map((p) => ({ kind: 'page', title: p.title })),
    });

  return {
    id: slug(g.team),
    team: g.team,
    monogram: monogram(g.team),
    status: commented ? 'present' : following ? 'silent' : 'missing',
    reason: '',
    evidence,
    contacts,
    engagement: { viewed: commented || following, commented, author },
  };
}

/** One factual sentence per seat. Falls back to a plain summary if the model is unavailable. */
async function writeReasons(pageTitle: string, seats: Seat[]) {
  const fallback = (s: Seat) =>
    s.evidence.map((e) => `${e.count} ${e.label}`).join(', ') + ' relate to this decision.';
  try {
    const result = await askJson<{ reasons: Record<string, string> }>(
      `You explain in one short sentence (max 22 words) how a team's existing work connects to a decision.
Say what the work is about, using the titles given. Use the exact total count. The titles are examples, not the full list.
Do not list issue keys or key ranges. Do not start with the team name. Do not claim consequences that the titles do not state. No names of individuals.
Return {"reasons": {"<seat id>": "<sentence>"}}.`,
      `Decision: ${pageTitle}\n\n` + seats.map((s) => `Seat ${s.id} (${s.team}):\n${describeEvidence(s)}`).join('\n\n'),
    );
    seats.forEach((s) => (s.reason = result.reasons[s.id] ?? fallback(s)));
  } catch {
    seats.forEach((s) => (s.reason = fallback(s)));
  }
}

export async function draftInvites(pageId: string, seatIds: string[]): Promise<InviteDraft[]> {
  const analysis = await latestAnalysis(pageId);
  if (!analysis) throw new Error('Run the analysis first.');
  const seats = analysis.seats.filter((s) => seatIds.includes(s.id));

  return Promise.all(
    seats.map(async (seat) => {
      const message = await ask(
        `You write a short invitation (max 55 words, 2 or 3 sentences, one paragraph) asking a team to give input on a proposed decision.
It is posted as a comment on the decision page itself, so never include a link, a subject line, or a sign-off.
Start with the first names of the contacts, or the team name if there are none.
Say what the decision is and name the team's work that connects to it, in everyday words, using the titles given. Use the exact total count. Do not list issue keys.
Treat the decision as proposed, not final. End by asking them to comment on this page with anything the decision should take into account.
Never invent deadlines, consequences, or requirements. Do not say what the team must do. Plain text only, no markdown.`,
        `Decision page: ${analysis.pageTitle}
Team: ${seat.team}
Contacts: ${seat.contacts.map((c) => c.name).join(', ') || 'none'}
Their related work:
${describeEvidence(seat)}`,
        300,
      );
      return { seatId: seat.id, team: seat.team, recipients: seat.contacts, message: cleanInvite(message) };
    }),
  );
}

export async function postInvites(pageId: string, drafts: InviteDraft[]): Promise<{ posted: number }> {
  const content: object[] = [
    paragraph([{ type: 'text', text: 'Empty Chair: these teams are affected by this decision and have not been part of it yet.', marks: [{ type: 'strong' }] }]),
  ];
  for (const d of drafts) {
    const mentions = d.recipients
      .filter((r) => r.accountId)
      .flatMap((r) => [{ type: 'mention', attrs: { id: r.accountId, text: `@${r.name}` } }, { type: 'text', text: ' ' }]);
    content.push(paragraph([{ type: 'text', text: `${d.team}: `, marks: [{ type: 'strong' }] }, ...mentions]));
    content.push(paragraph([{ type: 'text', text: d.message }]));
  }
  await postFooterComment(pageId, { type: 'doc', version: 1, content });
  return { posted: drafts.length };
}

function describeEvidence(seat: Seat): string {
  return seat.evidence
    .map((e) => `- ${e.count} ${e.label}, for example: ${e.items.map((i) => i.title).join('; ')}`)
    .join('\n');
}

function paragraph(content: object[]) {
  return { type: 'paragraph', content };
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function monogram(team: string) {
  const words = team.replace(/^team\s+/i, '').split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : words[0]?.slice(0, 2) ?? '?';
  return letters.toUpperCase();
}
