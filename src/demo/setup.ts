import api, { route } from '@forge/api';

// Creates a small fictional company so Empty Chair can be tried on an empty site.
// Each step is one resolver call, so no single call runs into the Forge function timeout.
// Keys are prefixed with EC so existing projects and spaces on the site are never touched.
// The same company, with real people, is created by scripts/seed.mjs for the demo video.

const KANBAN = 'com.pyxis.greenhopper.jira:gh-simplified-kanban-classic';
const SERVICE = [
  'com.atlassian.servicedesk:simplified-external-service-desk',
  'com.atlassian.servicedesk:simplified-general-service-desk-it',
  'com.atlassian.servicedesk:simplified-internal-service-desk',
];

interface ProjectSpec {
  key: string;
  name: string;
  service?: boolean;
  /** Issues go to the person setting up the demo, which makes this the author's own team. */
  assignToMe?: boolean;
  issues: string[];
}

interface SpaceSpec {
  key: string;
  name: string;
  pages: { title: string; body: string; isDecision?: boolean }[];
}

const projects: ProjectSpec[] = [
  {
    key: 'ECPLAT',
    name: 'Platform',
    assignToMe: true,
    issues: [
      'Remove Payments API v1 routes from gateway',
      'Add deprecation headers to Payments API v1',
      'Payments API v1 usage dashboard',
      'Migration guide from Payments API v1 to v2',
    ],
  },
  {
    key: 'ECATL',
    name: 'Team Atlas',
    issues: [
      'Checkout: retry failed Payments API v1 charges',
      'Refund flow still calls Payments API v1',
      'One-click checkout epic is built on Payments API v1',
      'Saved cards read from Payments API v1',
      'Payments API v1 timeout in checkout during peak',
      'Gift cards depend on Payments API v1 webhooks',
    ],
  },
  {
    key: 'ECHELP',
    name: 'Customer Support',
    service: true,
    issues: [
      'Northwind: Payments API v1 webhook signature errors',
      'Contoso asks for Payments API v1 support timeline',
      'Fabrikam integration uses Payments API v1, need migration help',
      'Tailspin: is Payments API v1 being shut down?',
      'Adventure Works sees 500 errors on Payments API v1',
    ],
  },
  {
    key: 'ECFIN',
    name: 'Finance Ops',
    issues: [
      'Monthly invoice export reads the Payments API v1 export endpoint',
      'Reconcile settlements against the Payments API v1 report',
    ],
  },
  {
    key: 'ECSEC',
    name: 'Security',
    issues: ['API change review: Payments API v1 retirement', 'Rotate signing keys used by Payments API v1'],
  },
];

const spaces: SpaceSpec[] = [
  {
    key: 'ECFIN',
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
  {
    key: 'ECENG',
    name: 'Engineering',
    pages: [
      {
        title: 'RFC: Retire Payments API v1 on March 31',
        isDecision: true,
        body: `<h2>Proposal</h2><p>Status: in review. We propose to shut down Payments API v1 on March 31. All clients migrate to Payments API v2, which supports idempotency keys and signed webhooks.</p>
<h2>Why</h2><p>Running two API versions costs the Platform team about a third of its capacity, and Payments API v1 cannot meet the new card network rules.</p>
<h2>Plan</h2><ul><li>Deprecation headers on Payments API v1 from January.</li><li>Migration guide published in February.</li><li>Shutdown on March 31.</li></ul>
<h2>Decision needed</h2><p>Approve the March 31 shutdown date for Payments API v1.</p>`,
      },
    ],
  },
];

export interface DemoStep {
  id: string;
  label: string;
}

export interface DemoStepResult {
  ok: boolean;
  detail: string;
  /** Set on the step that creates the decision page. */
  pageId?: string;
}

export function demoPlan(): DemoStep[] {
  return [
    ...projects.map((p) => ({ id: `project:${p.key}`, label: `${p.name}: ${p.issues.length} ${p.service ? 'requests' : 'issues'}` })),
    ...spaces.map((s) => ({ id: `space:${s.key}`, label: `${s.name}: ${s.pages.length} ${s.pages.length === 1 ? 'page' : 'pages'}` })),
  ];
}

export async function runDemoStep(id: string, accountId: string): Promise<DemoStepResult> {
  const [kind, key] = id.split(':');
  if (kind === 'project') {
    const spec = projects.find((p) => p.key === key);
    if (!spec) return { ok: false, detail: 'Unknown step' };
    return seedProject(spec, accountId);
  }
  if (kind === 'space') {
    const spec = spaces.find((s) => s.key === key);
    if (!spec) return { ok: false, detail: 'Unknown step' };
    return seedSpace(spec);
  }
  return { ok: false, detail: 'Unknown step' };
}

async function jira(method: string, path: ReturnType<typeof route>, body?: unknown) {
  const res = await api.asUser().requestJira(path, {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, data: text ? JSON.parse(text) : null };
}

async function confluence(method: string, path: ReturnType<typeof route>, body?: unknown) {
  const res = await api.asUser().requestConfluence(path, {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, data: text ? JSON.parse(text) : null };
}

function errorText(data: any): string {
  const messages = [...(data?.errorMessages ?? []), ...Object.values(data?.errors ?? {})];
  return (messages.join(' ') || data?.message || 'unknown error').slice(0, 200);
}

async function seedProject(spec: ProjectSpec, accountId: string): Promise<DemoStepResult> {
  const existing = await jira('GET', route`/rest/api/3/project/${spec.key}`);
  if (existing.ok) return { ok: true, detail: 'Already there' };

  // Service projects need Jira Service Management. Without it, the team gets a regular project instead.
  const templates = spec.service ? [...SERVICE, KANBAN] : [KANBAN];
  // Project names are unique in Jira. If the site already has a "Platform", the demo one becomes "Platform (demo)".
  let created = null;
  attempts: for (const name of [spec.name, `${spec.name} (demo)`]) {
    for (const template of templates) {
      const service = template !== KANBAN;
      created = await jira('POST', route`/rest/api/3/project`, {
        key: spec.key,
        name,
        projectTypeKey: service ? 'service_desk' : 'software',
        projectTemplateKey: template,
        leadAccountId: accountId,
        assigneeType: 'UNASSIGNED',
      });
      if (created.ok) break attempts;
      if (/name/i.test(errorText(created.data))) continue attempts;
    }
  }
  if (!created?.ok) return { ok: false, detail: `Project not created: ${errorText(created?.data)}` };

  const meta = await jira('GET', route`/rest/api/3/issue/createmeta/${spec.key}/issuetypes`);
  const types: { id: string; name: string; subtask: boolean }[] = meta.data?.issueTypes ?? meta.data?.values ?? [];
  const type = types.find((t) => !t.subtask && /task|request|incident/i.test(t.name)) ?? types.find((t) => !t.subtask);
  if (!type) return { ok: false, detail: 'Project created, but no issue type found' };

  const bulk = await jira('POST', route`/rest/api/3/issue/bulk`, {
    issueUpdates: spec.issues.map((summary) => ({
      fields: {
        project: { key: spec.key },
        issuetype: { id: type.id },
        summary,
        ...(spec.assignToMe ? { assignee: { accountId } } : {}),
      },
    })),
  });
  const made = bulk.data?.issues?.length ?? 0;
  if (made === 0) return { ok: false, detail: `Issues not created: ${errorText(bulk.data)}` };
  return { ok: true, detail: `${made} created` };
}

async function seedSpace(spec: SpaceSpec): Promise<DemoStepResult> {
  let space = await confluence('GET', route`/wiki/rest/api/space/${spec.key}`);
  if (!space.ok) {
    space = await confluence('POST', route`/wiki/rest/api/space`, { key: spec.key, name: spec.name });
    if (!space.ok) return { ok: false, detail: `Space not created: ${errorText(space.data)}` };
  }

  let decisionPageId: string | undefined;
  let made = 0;
  for (const page of spec.pages) {
    const found = await confluence('GET', route`/wiki/rest/api/content?spaceKey=${spec.key}&title=${page.title}`);
    let id: string | undefined = found.data?.results?.[0]?.id;
    if (!id) {
      const created = await confluence('POST', route`/wiki/api/v2/pages`, {
        spaceId: String(space.data.id),
        status: 'current',
        title: page.title,
        body: { representation: 'storage', value: page.body },
      });
      if (!created.ok) return { ok: false, detail: `Page not created: ${errorText(created.data)}` };
      id = created.data.id;
      made++;
    }
    if (page.isDecision) decisionPageId = id;
  }
  return { ok: true, detail: made ? `${made} created` : 'Already there', pageId: decisionPageId };
}
