import api, { route } from '@forge/api';

// All reads run as the current user, so Empty Chair only ever sees what that user can see.

async function json<T>(res: Response | { ok: boolean; status: number; json(): Promise<unknown>; text(): Promise<string> }): Promise<T> {
  if (!res.ok) throw new Error(`Atlassian API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

export interface PageInfo {
  id: string;
  title: string;
  status: string;
  authorId: string;
  version: number;
  spaceId: string;
  /** Name of the page's own space. Pages there are the deciding team's context, not another team's work. */
  spaceName: string;
  text: string;
  labels: string[];
}

/**
 * Without a user grant, Confluence answers as an anonymous caller (403/404) instead of asking for consent.
 * Jira throws the authentication error that makes Atlassian show "Allow access", so it is called first
 * and its error is passed through untouched.
 */
export async function ensureUserAccess(): Promise<void> {
  await api.asUser().requestJira(route`/rest/api/3/myself`);
}

/** True when the current user can open the page. Used before showing stored results for it. */
export async function canSeePage(pageId: string): Promise<boolean> {
  const res = await api.asUser().requestConfluence(route`/wiki/api/v2/pages/${pageId}`);
  return res.ok;
}

export async function getPage(pageId: string): Promise<PageInfo> {
  const first = await api.asUser().requestConfluence(route`/wiki/api/v2/pages/${pageId}?body-format=storage`);
  const page = await json<{
    id: string;
    title: string;
    status: string;
    authorId: string;
    spaceId: string;
    version: { number: number };
    body: { storage: { value: string } };
  }>(first);

  const [labels, space] = await Promise.all([
    json<{ results: { name: string }[] }>(
      await api.asUser().requestConfluence(route`/wiki/api/v2/pages/${pageId}/labels`),
    ).catch(() => ({ results: [] })),
    json<{ name: string }>(await api.asUser().requestConfluence(route`/wiki/api/v2/spaces/${page.spaceId}`)).catch(
      () => ({ name: '' }),
    ),
  ]);

  return {
    id: page.id,
    title: page.title,
    status: page.status,
    authorId: page.authorId,
    version: page.version.number,
    spaceId: page.spaceId,
    spaceName: space.name,
    text: stripHtml(page.body.storage.value),
    labels: labels.results.map((l) => l.name),
  };
}

/** Everyone who wrote, edited, or commented on the page. */
export async function getParticipants(pageId: string, authorId: string) {
  const commenters = new Set<string>();
  const editors = new Set<string>([authorId]);

  const [footer, inline, versions] = await Promise.all([
    api.asUser().requestConfluence(route`/wiki/api/v2/pages/${pageId}/footer-comments?limit=100`),
    api.asUser().requestConfluence(route`/wiki/api/v2/pages/${pageId}/inline-comments?limit=100`),
    api.asUser().requestConfluence(route`/wiki/api/v2/pages/${pageId}/versions?limit=50`),
  ]);
  for (const res of [footer, inline]) {
    const body = await json<{ results: { version: { authorId: string } }[] }>(res).catch(() => ({ results: [] }));
    body.results.forEach((c) => commenters.add(c.version.authorId));
  }
  const v = await json<{ results: { authorId: string }[] }>(versions).catch(() => ({ results: [] }));
  v.results.forEach((r) => editors.add(r.authorId));

  return { commenters, editors };
}

export async function isWatching(pageId: string, accountId: string): Promise<boolean> {
  const res = await api
    .asUser()
    .requestConfluence(route`/wiki/rest/api/user/watch/content/${pageId}?accountId=${accountId}`);
  if (!res.ok) return false;
  const body = (await res.json()) as { watching?: boolean };
  return Boolean(body.watching);
}

export interface JiraHit {
  key: string;
  summary: string;
  projectKey: string;
  projectName: string;
  projectType: string;
  team?: string;
  assignee?: { accountId: string; name: string };
  reporter?: { accountId: string; name: string };
}

let teamFieldId: string | null | undefined;

async function findTeamField(): Promise<string | null> {
  if (teamFieldId !== undefined) return teamFieldId;
  const fields = await json<{ id: string; schema?: { custom?: string } }[]>(
    await api.asUser().requestJira(route`/rest/api/3/field`),
  ).catch(() => []);
  teamFieldId = fields.find((f) => f.schema?.custom?.endsWith(':atlassian-team'))?.id ?? null;
  return teamFieldId;
}

export async function searchJira(terms: string[]): Promise<JiraHit[]> {
  if (terms.length === 0) return [];
  const team = await findTeamField();
  const textClause = terms.map((t) => `text ~ "${escapeJql(t)}"`).join(' OR ');
  const body = {
    jql: `(${textClause}) AND statusCategory != Done ORDER BY updated DESC`,
    maxResults: 100,
    fields: ['summary', 'project', 'assignee', 'reporter', ...(team ? [team] : [])],
  };
  const res = await json<{
    issues: {
      key: string;
      fields: Record<string, any>;
    }[];
  }>(
    await api.asUser().requestJira(route`/rest/api/3/search/jql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    }),
  );

  return res.issues.map((issue) => {
    const f = issue.fields;
    const person = (u: any) => (u ? { accountId: u.accountId as string, name: u.displayName as string } : undefined);
    const teamValue = team ? f[team] : undefined;
    return {
      key: issue.key,
      summary: f.summary,
      projectKey: f.project.key,
      projectName: f.project.name,
      projectType: f.project.projectTypeKey,
      team: typeof teamValue === 'string' ? teamValue : teamValue?.name ?? teamValue?.title,
      assignee: person(f.assignee),
      reporter: person(f.reporter),
    };
  });
}

export interface PageHit {
  id: string;
  title: string;
  spaceName: string;
  creator?: { accountId: string; name: string };
}

export async function searchPages(terms: string[], excludeId: string): Promise<PageHit[]> {
  if (terms.length === 0) return [];
  const textClause = terms.map((t) => `text ~ "${escapeCql(t)}"`).join(' OR ');
  const cql = `type = page AND (${textClause}) AND id != ${excludeId}`;
  const res = await json<{
    results: {
      id: string;
      title: string;
      space?: { name: string };
      history?: { createdBy?: { accountId: string; displayName: string } };
    }[];
  }>(
    await api
      .asUser()
      .requestConfluence(route`/wiki/rest/api/content/search?cql=${cql}&limit=50&expand=space,history`),
  );
  return res.results.map((r) => ({
    id: r.id,
    title: r.title,
    spaceName: r.space?.name ?? 'Confluence',
    creator: r.history?.createdBy
      ? { accountId: r.history.createdBy.accountId, name: r.history.createdBy.displayName }
      : undefined,
  }));
}

export async function postFooterComment(pageId: string, adf: object) {
  return json(
    await api.asUser().requestConfluence(route`/wiki/api/v2/footer-comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        pageId,
        body: { representation: 'atlas_doc_format', value: JSON.stringify(adf) },
      }),
    }),
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

const escapeJql = (s: string) => s.replace(/["\\]/g, '');
const escapeCql = (s: string) => s.replace(/["\\]/g, '');
