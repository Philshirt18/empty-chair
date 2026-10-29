import type { Analysis, InviteDraft } from './types';

// Demo scenario used when the panel runs outside Atlassian (local preview).
export const mockAnalysis: Analysis = {
  pageId: '98304',
  pageTitle: 'RFC: Retire Payments API v1 on March 31',
  pageStatus: 'in-review',
  subjects: ['Payments API v1', 'March 31 shutdown', 'Webhook migration', 'Invoice export'],
  analyzedAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
  seats: [
    {
      id: 'platform',
      team: 'Platform',
      monogram: 'PL',
      status: 'present',
      reason: 'Owns the Payments API and wrote this proposal.',
      engagement: { viewed: true, commented: true, author: true },
      contacts: [{ name: 'Lena Brandt', role: 'Tech lead' }],
      evidence: [
        {
          kind: 'jira',
          count: 6,
          label: 'open issues',
          items: [
            { kind: 'jira', key: 'PLAT-412', title: 'Remove v1 routes from gateway' },
            { kind: 'jira', key: 'PLAT-415', title: 'v1 deprecation headers' },
          ],
        },
      ],
    },
    {
      id: 'atlas',
      team: 'Team Atlas',
      monogram: 'AT',
      status: 'missing',
      reason: 'The checkout service still calls v1 in 14 open issues. Nobody from the team has opened this page.',
      engagement: { viewed: false, commented: false },
      contacts: [
        { name: 'Jonas Weber', role: 'Engineering manager' },
        { name: 'Mira Okafor', role: 'Staff engineer' },
      ],
      evidence: [
        {
          kind: 'jira',
          count: 14,
          label: 'open issues use v1',
          items: [
            { kind: 'jira', key: 'ATL-88', title: 'Checkout: retry failed v1 charges' },
            { kind: 'jira', key: 'ATL-102', title: 'Refund flow on /v1/payments' },
            { kind: 'jira', key: 'ATL-117', title: 'Q2 epic: one-click checkout (built on v1)' },
          ],
        },
        {
          kind: 'goal',
          count: 1,
          label: 'goal at risk',
          items: [{ kind: 'goal', title: 'Q2: Launch one-click checkout' }],
        },
      ],
    },
    {
      id: 'support',
      team: 'Customer Support',
      monogram: 'CS',
      status: 'missing',
      reason: '37 open customer requests mention v1. Customers will need a heads-up before March 31.',
      engagement: { viewed: false, commented: false },
      contacts: [{ name: 'Priya Raman', role: 'Support lead' }],
      evidence: [
        {
          kind: 'service',
          count: 37,
          label: 'customer requests',
          items: [
            { kind: 'service', key: 'HELP-2041', title: 'Northwind: v1 webhook signature errors' },
            { kind: 'service', key: 'HELP-2093', title: 'Contoso asks for v1 support timeline' },
          ],
        },
        {
          kind: 'page',
          count: 1,
          label: 'help article',
          items: [{ kind: 'page', title: 'How to connect with the Payments API (v1)' }],
        },
      ],
    },
    {
      id: 'finance',
      team: 'Finance Ops',
      monogram: 'FO',
      status: 'missing',
      reason: 'The monthly invoice export runbook pulls data from a v1 endpoint.',
      engagement: { viewed: false, commented: false },
      contacts: [{ name: 'Tom Lindqvist', role: 'Finance systems' }],
      evidence: [
        {
          kind: 'page',
          count: 2,
          label: 'pages rely on v1',
          items: [
            { kind: 'page', title: 'Runbook: monthly invoice export' },
            { kind: 'page', title: 'Revenue reconciliation checklist' },
          ],
        },
      ],
    },
    {
      id: 'security',
      team: 'Security',
      monogram: 'SE',
      status: 'silent',
      reason: 'Reviews every API change. Aisha follows this page but has not commented.',
      engagement: { viewed: true, commented: false },
      contacts: [{ name: 'Aisha Khan', role: 'AppSec' }],
      evidence: [
        {
          kind: 'jira',
          count: 1,
          label: 'review ticket',
          items: [{ kind: 'jira', key: 'SEC-77', title: 'API change review: Payments' }],
        },
      ],
    },
    {
      id: 'mobile',
      team: 'Mobile',
      monogram: 'MO',
      status: 'present',
      reason: 'App releases 4.2 and 4.3 call the payments endpoints.',
      engagement: { viewed: true, commented: true },
      contacts: [{ name: 'Daniel Costa', role: 'Mobile lead' }],
      evidence: [
        {
          kind: 'jira',
          count: 3,
          label: 'open issues',
          items: [{ kind: 'jira', key: 'MOB-310', title: 'Switch SDK to Payments v2' }],
        },
      ],
    },
  ],
};

export const mockAllSeated: Analysis = {
  ...mockAnalysis,
  seats: mockAnalysis.seats.map((s) => ({
    ...s,
    status: 'present',
    engagement: { ...s.engagement, viewed: true, commented: true },
  })),
};

export function mockInvites(seatIds: string[]): InviteDraft[] {
  const texts: Record<string, string> = {
    atlas:
      'Hi Jonas and Mira, Platform plans to retire Payments API v1 on March 31. Checkout still uses v1 in 14 open issues, including the one-click checkout epic (ATL-117). Could one of you review the RFC this week and add what you need for the migration?',
    support:
      'Hi Priya, we plan to switch off Payments API v1 on March 31. 37 open customer requests mention v1, so customers will need a heads-up. Could you look at the RFC and tell us what support needs: timeline, wording, or a migration guide?',
    finance:
      'Hi Tom, the monthly invoice export runbook pulls data from a Payments v1 endpoint, which we plan to retire on March 31. Could you check the RFC so we can plan the switch before your next month-end close?',
    security:
      'Hi Aisha, thanks for reading the v1 retirement RFC. Before it is marked as decided, could you leave a short note on whether the v2 migration needs a security review?',
  };
  return seatIds
    .map((id) => mockAnalysis.seats.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .map((s) => ({ seatId: s.id, team: s.team, recipients: s.contacts, message: texts[s.id] ?? '' }));
}
