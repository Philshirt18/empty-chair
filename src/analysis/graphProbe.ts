import api from '@forge/api';

// Temporary: checks what the Teamwork Graph returns on this site. Results go to the app logs only.

const QUERY = `query emptyChair_probe($cypherQuery: String!, $params: CypherRequestParams) {
  cypherQuery(query: $cypherQuery, params: $params) {
    edges { node { columns { key value { __typename
      ... on CypherQueryResultListNode { nodes { id data { __typename } } }
    } } } }
  }
}`;

async function run(label: string, cypherQuery: string, params: Record<string, string>) {
  try {
    const res = await api.asUser().requestTeamworkGraph(QUERY, { cypherQuery, params });
    const text = await res.text();
    console.log(`[graph-probe] ${label} status=${res.status} body=${text.slice(0, 1500)}`);
  } catch (e) {
    console.log(`[graph-probe] ${label} threw ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function graphProbe(pageId: string, cloudId: string, accountId: string) {
  const userAri = `ari:cloud:identity::user/${accountId}`;
  const pageAri = `ari:cloud:confluence:${cloudId}:page/${pageId}`;

  try {
    const echo = await api.asUser().requestTeamworkGraph(`query { echo(myString: "Hello World!") }`);
    console.log(`[graph-probe] echo status=${echo.status} body=${(await echo.text()).slice(0, 500)}`);
  } catch (e) {
    console.log(`[graph-probe] echo threw ${e instanceof Error ? e.message : String(e)}`);
  }

  await run(
    'user-teams',
    'MATCH (user:AtlassianUser {ari: $id})-[:atlassian_user_is_in_atlassian_team]->(team:AtlassianTeam) RETURN collect(distinct team) as teams',
    { id: userAri },
  );
  await run(
    'user-viewed-pages',
    'MATCH (user:AtlassianUser {ari: $id})-[:atlassian_user_viewed_documents]->(page:ConfluencePage) RETURN collect(distinct page) as pages',
    { id: userAri },
  );
  await run(
    'page-viewers',
    'MATCH (user:AtlassianUser)-[:atlassian_user_viewed_documents]->(page:ConfluencePage {ari: $id}) RETURN collect(distinct user) as users',
    { id: pageAri },
  );
  return { done: true };
}
