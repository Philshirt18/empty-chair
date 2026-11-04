import api from '@forge/api';
import queryKeys from '../graph-queries.json';

// Temporary: checks what the Teamwork Graph returns on this site. Results go to the app logs only.
// Queries are registered with scripts/register-graph-queries.mjs.

const QUERY = `query emptychair_probeQuery($queryKey: String!, $queryParams: CypherRequestParams) {
  customQuery(queryKey: $queryKey, queryParams: $queryParams, first: 25) {
    edges { node { columns { key value { __typename
      ... on CypherQueryResultListNode { nodes { id data { __typename } } }
      ... on CypherQueryResultNode { id data { __typename } }
    } } } }
  }
}`;

const keys = queryKeys as Record<string, string | undefined>;

async function run(label: string, key: string | undefined, queryParams: Record<string, string>) {
  if (!key) {
    console.log(`[graph-probe] ${label} skipped: query not registered`);
    return;
  }
  try {
    const res = await api.asUser().requestTeamworkGraph(QUERY, { queryKey: key, queryParams });
    console.log(`[graph-probe] ${label} status=${res.status} body=${(await res.text()).slice(0, 1500)}`);
  } catch (e) {
    console.log(`[graph-probe] ${label} threw ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function graphProbe(pageId: string, cloudId: string, accountId: string) {
  try {
    const echo = await api.asUser().requestTeamworkGraph(`query emptychair_echo { echo(myString: "Hello World!") }`);
    console.log(`[graph-probe] echo status=${echo.status} body=${(await echo.text()).slice(0, 500)}`);
  } catch (e) {
    console.log(`[graph-probe] echo threw ${e instanceof Error ? e.message : String(e)}`);
  }
  await run('user-teams', keys.userTeams, { userAri: `ari:cloud:identity::user/${accountId}` });
  await run('page-viewers', keys.pageViewers, { pageAri: `ari:cloud:confluence:${cloudId}:page/${pageId}` });
  return { done: true };
}
