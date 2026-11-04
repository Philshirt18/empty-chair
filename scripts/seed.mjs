// Creates the demo company in an Atlassian developer site. Safe to re-run: existing data is kept.
// Usage: node --env-file=.env scripts/seed.mjs
// .env needs ATLASSIAN_SITE, ATLASSIAN_EMAIL and ATLASSIAN_API_TOKEN.

const { ATLASSIAN_SITE: site, ATLASSIAN_EMAIL: email, ATLASSIAN_API_TOKEN: token } = process.env;
if (!site || !email || !token) {
  console.error('Missing ATLASSIAN_SITE, ATLASSIAN_EMAIL or ATLASSIAN_API_TOKEN in .env');
  process.exit(1);
}

const auth = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;

async function call(method, path, body) {
  const res = await fetch(`https://${site}${path}`, {
    method,
    headers: { Authorization: auth, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, data: text ? safeJson(text) : null };
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function must(method, path, body) {
  const res = await call(method, path, body);
  if (!res.ok) throw new Error(`${method} ${path} failed (${res.status}): ${JSON.stringify(res.data).slice(0, 400)}`);
  return res.data;
}

const KANBAN = 'com.pyxis.greenhopper.jira:gh-simplified-kanban-classic';
// Which service templates exist differs per site, so the first one that is accepted is used.
const SERVICE = [
  'com.atlassian.servicedesk:simplified-external-service-desk',
  'com.atlassian.servicedesk:simplified-general-service-desk-it',
  'com.atlassian.servicedesk:simplified-general-service-desk-business',
  'com.atlassian.servicedesk:simplified-internal-service-desk',
  'com.atlassian.servicedesk:simplified-it-service-management',
];

const projects = [
  {
    key: 'PLAT',
    name: 'Platform',
    template: KANBAN,
    type: 'software',
    assignToMe: true,
    issues: [
      'Remove Payments API v1 routes from gateway',
      'Add deprecation headers to Payments API v1',
      'Payments API v1 usage dashboard',
      'Migration guide from Payments API v1 to v2',
    ],
  },
  {
    key: 'ATL',
    name: 'Team Atlas',
    template: KANBAN,
    type: 'software',
    owner: 'Mira Okafor',
    issues: [
      'Checkout: retry failed Payments API v1 charges',
      'Refund flow still calls Payments API v1',
      'One-click checkout epic is built on Payments API v1',
      'Saved cards read from Payments API v1',
      'Payments API v1 timeout in checkout during peak',
      'Currency rounding bug in Payments API v1 response',
      'Partial capture on Payments API v1',
      'Gift cards depend on Payments API v1 webhooks',
      'Checkout load test against Payments API v1',
      'Fraud score passed through Payments API v1',
    ],
  },
  {
    key: 'HELP',
    name: 'Customer Support',
    template: SERVICE,
    type: 'service_desk',
    owner: 'Priya Raman',
    issues: [
      'Northwind: Payments API v1 webhook signature errors',
      'Contoso asks for Payments API v1 support timeline',
      'Fabrikam integration uses Payments API v1, need migration help',
      'Tailspin: is Payments API v1 being shut down?',
      'Adventure Works sees 500 errors on Payments API v1',
      'Litware needs Payments API v1 sandbox access',
      'Proseware: invoices missing after Payments API v1 call',
      'Wingtip asks how long Payments API v1 stays available',
    ],
  },
  {
    key: 'FINOPS',
    name: 'Finance Ops',
    template: KANBAN,
    type: 'software',
    owner: 'Tom Lindqvist',
    issues: [
      'Monthly invoice export reads the Payments API v1 export endpoint',
      'Reconcile settlements against the Payments API v1 report',
    ],
  },
  {
    key: 'SEC',
    name: 'Security',
    template: KANBAN,
    type: 'software',
    issues: ['API change review: Payments API v1 retirement', 'Rotate signing keys used by Payments API v1'],
  },
];

const spaces = [
  {
    key: 'ENG',
    name: 'Engineering',
    pages: [
      {
        title: 'RFC: Retire Payments API v1 on March 31',
        body: `<h2>Proposal</h2><p>Status: in review. We propose to shut down Payments API v1 on March 31. All clients migrate to Payments API v2, which supports idempotency keys and signed webhooks.</p>
<h2>Why</h2><p>Running two API versions costs the Platform team about a third of its capacity, and Payments API v1 cannot meet the new card network rules.</p>
<h2>Plan</h2><ul><li>Deprecation headers on Payments API v1 from January.</li><li>Migration guide published in February.</li><li>Shutdown on March 31.</li></ul>
<h2>Decision needed</h2><p>Approve the March 31 shutdown date for Payments API v1.</p>`,
      },
    ],
  },
  {
    key: 'FIN',
    name: 'Finance Ops',
    pages: [
      {
        title: 'Runbook: monthly invoice export',
        body: '<p>On the first working day of each month, pull all settled charges from the Payments API v1 export endpoint and load them into the ledger.</p>',
      },
      {
        title: 'Revenue reconciliation checklist',
        body: '<p>Compare ledger totals with the Payments API v1 settlement report. Investigate differences above 0.5 percent.</p>',
      },
    ],
  },
];

// Demo people are invited by hand (see README). Missing people are reported, not fatal.
const people = new Map();
async function findUser(name) {
  if (!people.has(name)) {
    const found = await must('GET', `/rest/api/3/user/search?query=${encodeURIComponent(name)}`);
    people.set(name, found.find((u) => u.accountType === 'atlassian' && u.displayName === name)?.accountId ?? null);
  }
  return people.get(name);
}

/** Gives every unassigned issue in the project to its owner, so the team has a face. */
async function assignOwner(p) {
  if (!p.owner) return;
  const ownerId = await findUser(p.owner);
  if (!ownerId) {
    console.log(`! ${p.name}: no user called ${p.owner} yet, issues stay unassigned`);
    return;
  }
  const open = await must('POST', '/rest/api/3/search/jql', {
    jql: `project = ${p.key} AND assignee IS EMPTY`,
    fields: ['summary'],
    maxResults: 100,
  });
  let done = 0;
  for (const issue of open.issues) {
    const res = await call('PUT', `/rest/api/3/issue/${issue.key}/assignee`, { accountId: ownerId });
    if (res.ok) done++;
    else console.log(`! ${issue.key}: could not assign to ${p.owner} (${res.status} ${JSON.stringify(res.data).slice(0, 160)})`);
  }
  if (done) console.log(`→ ${p.name}: ${done} issues assigned to ${p.owner}`);
}

async function seedProject(p, me) {
  const existing = await call('GET', `/rest/api/3/project/${p.key}`);
  if (existing.ok) {
    console.log(`= ${p.name}: project exists`);
    await assignOwner(p);
    return;
  }
  let created = null;
  for (const template of [p.template].flat()) {
    created = await call('POST', '/rest/api/3/project', {
      key: p.key,
      name: p.name,
      projectTypeKey: p.type,
      projectTemplateKey: template,
      leadAccountId: me,
      assigneeType: 'UNASSIGNED',
    });
    if (created.ok) break;
  }
  if (!created.ok) throw new Error(`Could not create ${p.name}: ${JSON.stringify(created.data).slice(0, 400)}`);
  const types = await must('GET', `/rest/api/3/issue/createmeta/${p.key}/issuetypes`);
  const list = types.issueTypes ?? types.values ?? [];
  const type = list.find((t) => !t.subtask && /task|request|incident/i.test(t.name)) ?? list.find((t) => !t.subtask);
  for (const summary of p.issues) {
    await must('POST', '/rest/api/3/issue', {
      fields: {
        project: { key: p.key },
        issuetype: { id: type.id },
        summary,
        ...(p.assignToMe ? { assignee: { accountId: me } } : {}),
      },
    });
  }
  console.log(`+ ${p.name}: ${p.issues.length} issues`);
  await assignOwner(p);
}

async function seedSpace(s) {
  let space = await call('GET', `/wiki/rest/api/space/${s.key}`);
  if (!space.ok) space = { data: await must('POST', '/wiki/rest/api/space', { key: s.key, name: s.name }) };
  for (const page of s.pages) {
    const found = await must(
      'GET',
      `/wiki/rest/api/content?spaceKey=${s.key}&title=${encodeURIComponent(page.title)}`,
    );
    if (found.results.length) {
      console.log(`= ${page.title}: exists, skipped`);
      continue;
    }
    const created = await must('POST', '/wiki/api/v2/pages', {
      spaceId: String(space.data.id),
      status: 'current',
      title: page.title,
      body: { representation: 'storage', value: page.body },
    });
    console.log(`+ ${page.title}: https://${site}/wiki${created._links.webui}`);
  }
}

const me = await must('GET', '/rest/api/3/myself');
console.log(`Seeding ${site} as ${me.displayName}\n`);
for (const p of projects) await seedProject(p, me.accountId);
for (const s of spaces) await seedSpace(s);
console.log('\nDone. Search indexing can take a few minutes. Open the RFC page and click Empty Chair.');
