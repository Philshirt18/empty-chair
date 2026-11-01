import Resolver from '@forge/resolver';
import { analyzePage, draftInvites, latestAnalysis, postInvites } from './analysis/engine';
import { graphProbe } from './analysis/graphProbe';
import type { InviteDraft } from './types';

const r = new Resolver();

r.define('analyze', async ({ payload, context }) => {
  const pageId = context.extension.content.id as string;
  return analyzePage(pageId, { force: Boolean(payload?.force) });
});

r.define('draftInvites', async ({ payload, context }) => {
  return draftInvites(context.extension.content.id, payload.seatIds as string[]);
});

r.define('postInvites', async ({ payload, context }) => {
  return postInvites(context.extension.content.id, payload.drafts as InviteDraft[]);
});

// Temporary: Teamwork Graph availability check, see analysis/graphProbe.ts.
r.define('graphProbe', async ({ context }) => {
  return graphProbe(context.extension.content.id, context.cloudId, context.accountId);
});

export const resolver = r.getDefinitions();

/** Byline title: shows the number of empty chairs from the last analysis without re-running it. */
export async function bylineProps(_payload: unknown, context: { extension: { content: { id: string } } }) {
  const last = await latestAnalysis(context.extension.content.id);
  if (!last) return { title: 'Empty Chair', tooltip: 'Check who is affected by this page' };
  const empty = last.seats.filter((s) => s.status === 'missing').length;
  return {
    title: empty === 0 ? 'Everyone at the table' : `${empty} empty chair${empty === 1 ? '' : 's'}`,
    tooltip: 'See who is affected by this decision but not part of it',
  };
}

/** Rovo action and MCP tool: find-missing-stakeholders. */
export async function findMissingAction(payload: { pageId: string }) {
  const a = await analyzePage(String(payload.pageId));
  return {
    page: a.pageTitle,
    isDecision: a.isDecision,
    subjects: a.subjects,
    teams: a.seats.map((s) => ({
      team: s.team,
      status: s.status === 'missing' ? 'not at the table' : s.status === 'silent' ? 'following, not commenting' : 'at the table',
      why: s.reason,
      evidence: s.evidence.map((e) => `${e.count} ${e.label}`),
      contacts: s.contacts.map((c) => c.name),
    })),
  };
}

/** Rovo action and MCP tool: draft-stakeholder-invite. Returns text only. */
export async function draftInviteAction(payload: { pageId: string; team: string }) {
  const pageId = String(payload.pageId);
  const a = (await latestAnalysis(pageId)) ?? (await analyzePage(pageId));
  const seat = a.seats.find((s) => s.team.toLowerCase() === String(payload.team).toLowerCase());
  if (!seat) return { error: `No affected team called "${payload.team}" was found for this page.` };
  const [draft] = await draftInvites(pageId, [seat.id]);
  return { team: draft.team, to: draft.recipients.map((r) => r.name), message: draft.message };
}
