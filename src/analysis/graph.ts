import api from '@forge/api';
import queryKeys from '../graph-queries.json';

// Teamwork Graph access. Forge apps may only run registered queries (see scripts/register-graph-queries.mjs).
// Every call reports whether the graph actually answered, so "no data" is never mistaken for "nobody".

const keys = queryKeys as Record<string, string | undefined>;

const QUERY = `query emptychair_customQuery($queryKey: String!, $queryParams: CypherRequestParams) {
  customQuery(queryKey: $queryKey, queryParams: $queryParams, first: 25) {
    edges { node { columns { key value { __typename
      ... on CypherQueryResultListNode { nodes { id data { __typename ... on AtlassianTeam { displayName } } } }
    } } } }
  }
}`;

export type GraphResult<T> = { ok: true; value: T } | { ok: false; reason: string };

interface ListNode {
  id: string;
  data?: { displayName?: string };
}

async function runList(key: string | undefined, queryParams: Record<string, string>): Promise<GraphResult<ListNode[]>> {
  if (!key) return { ok: false, reason: 'query not registered' };
  try {
    const res = await api.asUser().requestTeamworkGraph(QUERY, { queryKey: key, queryParams });
    const body = (await res.json()) as {
      data?: { customQuery?: { edges: { node: { columns: { value?: { nodes?: ListNode[] } }[] } }[] } | null };
      errors?: { message: string }[];
    };
    if (body.errors?.length || !body.data?.customQuery) {
      return { ok: false, reason: body.errors?.[0]?.message ?? `status ${res.status}` };
    }
    const nodes = body.data.customQuery.edges.flatMap((e) => e.node.columns.flatMap((c) => c.value?.nodes ?? []));
    return { ok: true, value: nodes };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

const accountIdFromAri = (ari: string) => ari.split('/').pop() ?? ari;

/** Account IDs of everyone who viewed the page in the last 30 days, as far as the current user may see. */
export async function pageViewers(cloudId: string, pageId: string): Promise<GraphResult<Set<string>>> {
  const res = await runList(keys.pageViewers, { pageAri: `ari:cloud:confluence:${cloudId}:page/${pageId}` });
  return res.ok ? { ok: true, value: new Set(res.value.map((n) => accountIdFromAri(n.id))) } : res;
}

/** Names of the Atlassian teams a person belongs to. */
export async function userTeams(accountId: string): Promise<GraphResult<string[]>> {
  const res = await runList(keys.userTeams, { userAri: `ari:cloud:identity::user/${accountId}` });
  return res.ok ? { ok: true, value: res.value.map((n) => n.data?.displayName).filter((n): n is string => Boolean(n)) } : res;
}
