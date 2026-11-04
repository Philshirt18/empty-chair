// Registers the app's Teamwork Graph queries and writes their keys to src/graph-queries.json.
// Forge apps may only run registered ("persisted") Cypher queries. Re-running is safe:
// identical Cypher returns the existing key.
// Usage: node --env-file=.env scripts/register-graph-queries.mjs

import { readFileSync, writeFileSync } from 'node:fs';

const { ATLASSIAN_SITE: site, ATLASSIAN_EMAIL: email, ATLASSIAN_API_TOKEN: token } = process.env;
if (!site || !email || !token) {
  console.error('Missing ATLASSIAN_SITE, ATLASSIAN_EMAIL or ATLASSIAN_API_TOKEN in .env');
  process.exit(1);
}

const appUuid = readFileSync(new URL('../manifest.yml', import.meta.url), 'utf8').match(/app\/([0-9a-f-]{36})/)?.[1];
if (!appUuid) {
  console.error('No app id found in manifest.yml. Run forge register first.');
  process.exit(1);
}

const queries = {
  pageViewers: {
    cypher:
      'MATCH (page:ConfluencePage {ari: $pageAri})<-[:atlassian_user_viewed_documents]-(user:AtlassianUser) RETURN collect(distinct user) as users',
    paramsSchema: [{ name: 'pageAri', type: 'ARI', required: true }],
  },
  userTeams: {
    cypher:
      'MATCH (user:AtlassianUser {ari: $userAri})-[:atlassian_user_is_in_atlassian_team]->(team:AtlassianTeam) RETURN collect(distinct team) as teams',
    paramsSchema: [{ name: 'userAri', type: 'ARI', required: true }],
  },
};

const auth = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
const keys = {};

for (const [name, q] of Object.entries(queries)) {
  const res = await fetch(`https://${site}/gateway/api/twg/cypher-queries`, {
    method: 'POST',
    headers: { Authorization: auth, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId: `ari:cloud:ecosystem::app/${appUuid}`, name: `empty-chair-${name}`, ...q }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`✕ ${name}: ${res.status} ${text.slice(0, 400)}`);
    process.exitCode = 1;
    continue;
  }
  const body = JSON.parse(text);
  keys[name] = body.queryKey;
  console.log(`✔ ${name}: ${body.queryKey} (${body.status})`);
}

if (Object.keys(keys).length === Object.keys(queries).length) {
  writeFileSync(new URL('../src/graph-queries.json', import.meta.url), JSON.stringify(keys, null, 2) + '\n');
  console.log('\nWrote src/graph-queries.json. Wait about a minute before the queries can run.');
}
