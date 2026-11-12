import { kvs, WhereConditions } from '@forge/kvs';
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
import { pageViewers, userTeams, type GraphResult } from './graph';
import { ask, askJson } from './llm';

const CACHE_TTL_SECONDS = 60 * 60 * 6;
/** The last result per page (used by the byline title and list-open-decisions) is kept for 30 days, then deleted. */
const LATEST_TTL_SECONDS = 60 * 60 * 24 * 30;

interface Extraction {
  isDecision: boolean;
  status: 'draft' | 'in-review' | 'decided';
  subjects: { label: string; role?: 'changed' | 'replacement' | 'context'; searchTerms: string[] }[];
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
  /** True when the name comes from an Atlassian team rather than a project or space. */
  isTeam: boolean;
}

export async function analyzePage(
  pageId: string,
  opts: { force?: boolean; cloudId?: string } = {},
): Promise<Analysis> {
  const page = await getPage(pageId);
  const cacheKey = `analysis:${pageId}:${page.version}`;
  if (!opts.force) {
    const cached = (await kvs.get(cacheKey)) as Analysis | undefined;
    if (cached) return cached;
  }

  const extraction = await extract(page.title, page.text, page.labels);
  // Only what the decision changes affects other teams. Replacements and background widen the search with noise.
  const changed = extraction.subjects.filter((s) => (s.role ?? 'changed') === 'changed');
  extraction.subjects = changed.length ? changed : extraction.subjects;
  const terms = [...new Set(extraction.subjects.flatMap((s) => s.searchTerms))].slice(0, 8);

  const noGraph: GraphResult<Set<string>> = { ok: false, reason: 'no cloud id' };
  const [issues, pages, participants, viewers] = await Promise.all([
    searchJira(terms),
    searchPages(terms, pageId),
    getParticipants(pageId, page.authorId),
    opts.cloudId ? pageViewers(opts.cloudId, pageId) : Promise.resolve(noGraph),
  ]);
  if (!viewers.ok) console.log(`[graph] page viewers unavailable: ${viewers.reason}`);

  // Pages in the decision's own space (or a space of the same name) belong to the deciding team, not another one.
  const otherPages = page.spaceName ? pages.filter((p) => p.spaceName !== page.spaceName) : pages;
  const groups = await nameByAtlassianTeams(groupByTeam(issues, otherPages), page.authorId);
  const allSeats = await Promise.all(
    [...groups.values()].map((g) => toSeat(g, pageId, page.authorId, participants, viewers)),
  );
  const seats = await writeReasons(page.title, extraction.subjects.map((s) => s.label), allSeats);

  const analysis: Analysis = {
    pageId,
    pageTitle: page.title,
    pageStatus: extraction.status,
    isDecision: extraction.isDecision,
    subjects: extraction.subjects.map((s) => s.label),
    seats,
    analyzedAt: new Date().toISOString(),
    signals: {
      reading: viewers.ok ? 'graph' : 'unavailable',
      teams: [...groups.values()].some((g) => g.isTeam) ? 'graph' : 'projects',
    },
  };

  await kvs.set(cacheKey, analysis, { ttl: { value: CACHE_TTL_SECONDS, unit: 'SECONDS' } });
  await kvs.set(`latest:${pageId}`, analysis, { ttl: { value: LATEST_TTL_SECONDS, unit: 'SECONDS' } });
  return analysis;
}

/** The most recently analysed pages, newest first. Callers must check that the user can see each page. */
export async function recentAnalyses(limit = 20): Promise<Analysis[]> {
  const res = await kvs.query().where('key', WhereConditions.beginsWith('latest:')).limit(100).getMany<Analysis>();
  return res.results
    .map((r) => r.value)
    .filter((a) => a && a.isDecision)
    .sort((x, y) => y.analyzedAt.localeCompare(x.analyzedAt))
    .slice(0, limit);
}

export async function latestAnalysis(pageId: string): Promise<Analysis | undefined> {
  return (await kvs.get(`latest:${pageId}`)) as Analysis | undefined;
}

async function extract(title: string, text: string, labels: string[]): Promise<Extraction> {
  return askJson<Extraction>(
    `You read Confluence pages and find what a proposal or decision changes.
Return {"isDecision": boolean, "status": "draft" | "in-review" | "decided", "subjects": [{"label": string, "role": "changed" | "replacement" | "context", "searchTerms": string[]}]}.
- role is "changed" for the things the decision removes, alters, or schedules; "replacement" for what people move to instead; "context" for background.
- isDecision is true for proposals, RFCs, decision records, policy or process changes.
- subjects are the concrete things this decision changes: systems, APIs, products, processes, dates, policies. At most 4.
- Do not list motivations, costs, or background such as team capacity.
- Do not list the replacement or successor (for example the new version that clients move to) as its own subject. It is part of the change, not a separate thing that changes.
- label is a short name a reader would recognise, for example "Payments API v1".
- searchTerms are 1 to 3 exact phrases likely to appear in other Jira issues or pages about that subject. Prefer specific nouns over generic words.`,
    `Title: ${title}\nLabels: ${labels.join(', ') || 'none'}\n\n${text.slice(0, 12000)}`,
  );
}

function groupByTeam(issues: JiraHit[], pages: PageHit[]): Map<string, Group> {
  const groups = new Map<string, Group>();
  const get = (team: string, isTeam = false) => {
    const key = team.trim().toLowerCase();
    if (!groups.has(key))
      groups.set(key, {
        team: team.trim(),
        jira: [],
        service: [],
        pages: [],
        people: new Map(),
        assignees: new Set(),
        isTeam,
      });
    return groups.get(key)!;
  };
  const addPerson = (g: Group, accountId: string, name: string, weight: number) => {
    const cur = g.people.get(accountId);
    g.people.set(accountId, { name, weight: (cur?.weight ?? 0) + weight });
  };

  for (const issue of issues) {
    const isService = issue.projectType === 'service_desk';
    const g = get(issue.team ?? issue.projectName, Boolean(issue.team));
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

/**
 * Projects and spaces are a stand-in for teams. When the people doing that work share an Atlassian team in the
 * Teamwork Graph, the group takes the team's name, and groups that turn out to be the same team are merged.
 */
async function nameByAtlassianTeams(groups: Map<string, Group>, authorId: string): Promise<Map<string, Group>> {
  const renamed = await Promise.all(
    [...groups.values()].map(async (g) => {
      if (g.isTeam) return g;
      const people = [...g.people.entries()]
        .filter(([id]) => id !== authorId || g.assignees.has(id))
        .sort((a, b) => b[1].weight - a[1].weight)
        .slice(0, 3)
        .map(([id]) => id);
      if (people.length === 0) return g;
      const results = await Promise.all(people.map(userTeams));
      const counts = new Map<string, number>();
      results.forEach((r) => r.ok && new Set(r.value).forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
      const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      return best && best[1] * 2 >= people.length ? { ...g, team: best[0], isTeam: true } : g;
    }),
  );

  const merged = new Map<string, Group>();
  for (const g of renamed) {
    const key = g.team.toLowerCase();
    const cur = merged.get(key);
    if (!cur) {
      merged.set(key, g);
      continue;
    }
    cur.jira.push(...g.jira);
    cur.service.push(...g.service);
    cur.pages.push(...g.pages);
    g.assignees.forEach((id) => cur.assignees.add(id));
    g.people.forEach((p, id) => {
      const prev = cur.people.get(id);
      cur.people.set(id, { name: p.name, weight: (prev?.weight ?? 0) + p.weight });
    });
  }
  return merged;
}

async function toSeat(
  g: Group,
  pageId: string,
  authorId: string,
  participants: { commenters: Set<string>; editors: Set<string> },
  viewers: GraphResult<Set<string>>,
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

  // Teamwork Graph: someone from the team opened the page in the last 30 days.
  const read = viewers.ok && members.some((id) => viewers.value.has(id));

  let following = false;
  if (!commented && !read) {
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
    status: commented ? 'present' : read || following ? 'silent' : 'missing',
    reason: '',
    evidence,
    contacts,
    engagement: { viewed: commented || read, read, following, commented, author },
  };
}

/** One factual sentence per seat. Falls back to a plain summary if the model is unavailable. */
/**
 * Writes one reason per seat and drops seats whose work clearly has nothing to do with what the decision changes.
 * Text search can match a stray word, so this is the second filter. Teams that are already taking part stay.
 */
async function writeReasons(pageTitle: string, subjects: string[], seats: Seat[]): Promise<Seat[]> {
  const fallback = (s: Seat) =>
    s.evidence.map((e) => `${e.count} ${e.label}`).join(', ') + ' relate to this decision.';
  try {
    const result = await askJson<{ reasons: Record<string, string>; unrelated?: string[] }>(
      `You explain in one short sentence (max 22 words) how a team's existing work connects to a decision.
Say what the work is about, using the titles given. Use the exact total count. The titles are examples, not the full list.
Do not list issue keys or key ranges. Do not start with the team name. Do not claim consequences that the titles do not state. No names of individuals.
If none of a team's titles is about anything the decision changes (they only share a common word), put its seat id in "unrelated" instead of writing a reason. When in doubt, keep the team.
Return {"reasons": {"<seat id>": "<sentence>"}, "unrelated": ["<seat id>"]}.`,
      `Decision: ${pageTitle}\nWhat it changes: ${subjects.join(', ')}\n\n` +
        seats.map((s) => `Seat ${s.id} (${s.team}):\n${describeEvidence(s)}`).join('\n\n'),
    );
    const unrelated = new Set(result.unrelated ?? []);
    const kept = seats.filter((s) => !unrelated.has(s.id) || s.status === 'present');
    if (unrelated.size) console.log(`[reasons] left out as unrelated: ${seats.filter((s) => !kept.includes(s)).map((s) => s.team)}`);
    kept.forEach((s) => (s.reason = result.reasons[s.id] ?? fallback(s)));
    return kept;
  } catch {
    seats.forEach((s) => (s.reason = fallback(s)));
    return seats;
  }
}

export async function draftInvites(pageId: string, seatIds: string[]): Promise<InviteDraft[]> {
  const analysis = await latestAnalysis(pageId);
  if (!analysis) throw new Error('Run the analysis first.');
  const seats = analysis.seats.filter((s) => seatIds.includes(s.id));

  return Promise.all(
    seats.map(async (seat) => {
      // Teams that read the page but stayed quiet get a nudge, not an introduction to something they already know.
      const kind: InviteDraft['kind'] = seat.status === 'silent' ? 'nudge' : 'invite';
      const message = await ask(
        `${kind === 'nudge' ? NUDGE_PROMPT : INVITE_PROMPT}
It is posted as a comment on the decision page itself, so never include a link, a subject line, or a sign-off.
Start with the first names of the contacts, or the team name if there are none.
Name the team's work that connects to the decision, in everyday words, using the titles given. Use the exact total count. Do not list issue keys.
Treat the decision as proposed, not final. Never invent deadlines, consequences, or requirements. Do not say what the team must do. Plain text only, no markdown.`,
        `Decision page: ${analysis.pageTitle}
Team: ${seat.team}
Contacts: ${seat.contacts.map((c) => c.name).join(', ') || 'none'}
Their related work:
${describeEvidence(seat, kind === 'nudge' ? 2 : 5)}`,
        300,
      );
      return { seatId: seat.id, team: seat.team, kind, recipients: seat.contacts, message: cleanInvite(message) };
    }),
  );
}

const INVITE_PROMPT = `You write a short invitation (max 55 words, 2 or 3 sentences, one paragraph) asking a team that has not seen a proposed decision to give input.
Say what the decision is. End by asking them to comment on this page with anything the decision should take into account.`;

const NUDGE_PROMPT = `You write a short, warm nudge (max 40 words, exactly 2 sentences, one paragraph) to a team that has already read a proposed decision but has not commented.
Sentence 1: acknowledge that they have seen it ("you've seen the proposal") and name at most two pieces of their work that connect to it.
Sentence 2: one open question asking whether there is anything the decision should account for before it is final.
Never sound like surveillance: do not use "noticed", "we see", "tracking", "views", or "data".`;

export async function postInvites(pageId: string, drafts: InviteDraft[]): Promise<{ posted: number }> {
  const content: object[] = [
    paragraph([{ type: 'text', text: 'Empty Chair: input requested from teams this decision affects.', marks: [{ type: 'strong' }] }]),
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

/** Evidence as prompt text. Fewer examples keep short messages from turning into lists. */
function describeEvidence(seat: Seat, examples = 5): string {
  return seat.evidence
    .map((e) => `- ${e.count} ${e.label}, for example: ${e.items.slice(0, examples).map((i) => i.title).join('; ')}`)
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
