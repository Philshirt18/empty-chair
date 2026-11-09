import api, { route } from '@forge/api';

// Creates a small fictional company so Empty Chair can be tried on an empty site.
// Each team gets its own Confluence space with pages that depend on the API the decision retires;
// Empty Chair groups related pages by space, so every space becomes a team at the table.
// Jira projects are not created here: that needs manage:jira-project, which users cannot grant to an app.
// Each step is one resolver call, so no single call runs into the Forge function timeout.
// Keys are prefixed with EC so existing spaces on the site are never touched.
// scripts/seed.mjs creates the richer version with Jira projects and real people for the demo video.

interface SpaceSpec {
  key: string;
  name: string;
  pages: { title: string; body: string; isDecision?: boolean }[];
}

const p = (text: string) => `<p>${text}</p>`;

const spaces: SpaceSpec[] = [
  {
    key: 'ECATL',
    name: 'Team Atlas',
    pages: [
      {
        title: 'Checkout architecture',
        body: p('Checkout charges cards through Payments API v1. Failed charges are retried three times against the Payments API v1 charge endpoint.') +
          p('Refunds and saved cards also read from Payments API v1.'),
      },
      {
        title: 'One-click checkout: technical plan',
        body: p('One-click checkout stores the card token from Payments API v1 and charges it without a second confirmation step.'),
      },
      {
        title: 'Gift cards: webhook handling',
        body: p('Gift card balances are updated from Payments API v1 webhooks. We do not verify signatures yet.'),
      },
    ],
  },
  {
    key: 'ECHELP',
    name: 'Customer Support',
    pages: [
      {
        title: 'Known issues: payments',
        body: p('Northwind and Adventure Works report webhook signature errors and 500 errors on Payments API v1.') +
          p('Contoso and Tailspin ask whether Payments API v1 is being shut down and when.'),
      },
      {
        title: 'Macro: questions about Payments API v1',
        body: p('Use this reply when a customer asks how long Payments API v1 will be supported.'),
      },
    ],
  },
  {
    key: 'ECFIN',
    name: 'Finance Ops',
    pages: [
      {
        title: 'Runbook: monthly invoice export',
        body: p('On the first working day of each month, pull all settled charges from the Payments API v1 export endpoint and load them into the ledger.'),
      },
      {
        title: 'Revenue reconciliation checklist',
        body: p('Compare ledger totals with the Payments API v1 settlement report. Investigate differences above 0.5 percent.'),
      },
    ],
  },
  {
    key: 'ECSEC',
    name: 'Security',
    pages: [
      {
        title: 'API change review: Payments API v1 retirement',
        body: p('Every change to a public API needs a security review. The retirement of Payments API v1 has not been reviewed yet.'),
      },
      {
        title: 'Key rotation schedule',
        body: p('The signing keys used by Payments API v1 are rotated every 90 days. The next rotation is due in February.'),
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
  return spaces.map((s) => ({
    id: `space:${s.key}`,
    label: `${s.name}: ${s.pages.length} ${s.pages.length === 1 ? 'page' : 'pages'}`,
  }));
}

export async function runDemoStep(id: string): Promise<DemoStepResult> {
  const [kind, key] = id.split(':');
  const spec = kind === 'space' ? spaces.find((s) => s.key === key) : undefined;
  if (!spec) return { ok: false, detail: 'Unknown step' };
  return seedSpace(spec);
}

async function confluence(method: string, path: ReturnType<typeof route>, body?: unknown) {
  const res = await api.asUser().requestConfluence(path, {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text.slice(0, 200) };
  }
  return { ok: res.ok, status: res.status, data };
}

function errorText(data: any): string {
  const messages = [...(data?.errorMessages ?? []), ...Object.values(data?.errors ?? {})];
  return (messages.join(' ') || data?.message || 'unknown error').slice(0, 200);
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
