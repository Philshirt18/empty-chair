import Resolver from '@forge/resolver';
import { analyzePage, draftInvites, latestAnalysis, postInvites, recentAnalyses } from './analysis/engine';
import { demoPlan, runDemoStep } from './demo/setup';
import { canSeePage, ensureUserAccess } from './analysis/atlassian';
import type { InviteDraft } from './types';

const r = new Resolver();

r.define('analyze', async ({ payload, context }) => {
  const pageId = context.extension.content.id as string;
  await ensureUserAccess();
  return analyzePage(pageId, { force: Boolean(payload?.force), cloudId: context.cloudId });
});

r.define('draftInvites', async ({ payload, context }) => {
  return draftInvites(context.extension.content.id, payload.seatIds as string[]);
});

r.define('postInvites', async ({ payload, context }) => {
  return postInvites(context.extension.content.id, payload.drafts as InviteDraft[]);
});

// Demo company for trying the app on an empty site. The panel runs one step per call.
r.define('demoPlan', async () => demoPlan());

r.define('demoStep', async ({ payload, context }) => {
  await ensureUserAccess();
  return runDemoStep(String(payload.id));
});

export const resolver = r.getDefinitions();

/** Byline title: shows the number of empty chairs from the last analysis without re-running it. */
export async function bylineProps(payload: any, context: any) {
  // The page id arrives in different places depending on the Forge runtime version.
  const pageId: string | undefined =
    context?.extension?.content?.id ?? payload?.extension?.content?.id ?? payload?.context?.extension?.content?.id;
  if (!pageId) {
    console.log(`[byline] no page id; payload keys=${Object.keys(payload ?? {})} context keys=${Object.keys(context ?? {})}`);
    return { title: 'Empty Chair', tooltip: 'Check who is affected by this page' };
  }
  const last = await latestAnalysis(pageId);
  if (!last) return { title: 'Empty Chair', tooltip: 'Check who is affected by this page' };
  const empty = last.seats.filter((s) => s.status === 'missing').length;
  return {
    title: empty === 0 ? 'Everyone at the table' : `${empty} empty chair${empty === 1 ? '' : 's'}`,
    tooltip: 'See who is affected by this decision but not part of it',
  };
}

type ActionContext = { cloudId?: string; installContext?: string };

/**
 * Rovo and external MCP clients call actions with different context shapes. The Teamwork Graph needs the
 * site's cloud id, so it is taken from whichever field carries it, including the install context ARI.
 */
function cloudIdOf(payload: { context?: ActionContext }, context?: ActionContext): string | undefined {
  const direct = payload.context?.cloudId ?? context?.cloudId;
  if (direct) return direct;
  const ari = context?.installContext ?? payload.context?.installContext;
  return ari?.match(/site\/([0-9a-f-]{36})/)?.[1];
}

/** Rovo action and MCP tool: find-missing-stakeholders. */
export async function findMissingAction(payload: { pageId: string; context?: ActionContext }, context?: ActionContext) {
  const cloudId = cloudIdOf(payload, context);
  console.log(`[action] find-missing page=${payload.pageId} cloudId=${cloudId ? 'found' : 'missing'} contextKeys=${Object.keys(context ?? {})}`);
  const a = await analyzePage(String(payload.pageId), { cloudId });
  return {
    page: a.pageTitle,
    isDecision: a.isDecision,
    subjects: a.subjects,
    teams: a.seats.map((s) => ({
      team: s.team,
      status:
        s.status === 'missing'
          ? 'not at the table'
          : s.status === 'silent'
            ? s.engagement.read
              ? 'read the page, has not commented'
              : 'following the page, has not commented'
            : 'at the table',
      why: s.reason,
      evidence: s.evidence.map((e) => `${e.count} ${e.label}`),
      contacts: s.contacts.map((c) => c.name),
    })),
  };
}

/** Rovo action and MCP tool: draft-stakeholder-invite. Returns text only. */
export async function draftInviteAction(
  payload: { pageId: string; team: string; context?: ActionContext },
  context?: ActionContext,
) {
  const pageId = String(payload.pageId);
  const a = (await latestAnalysis(pageId)) ?? (await analyzePage(pageId, { cloudId: cloudIdOf(payload, context) }));
  const seat = a.seats.find((s) => s.team.toLowerCase() === String(payload.team).toLowerCase());
  if (!seat) return { error: `No affected team called "${payload.team}" was found for this page.` };
  const [draft] = await draftInvites(pageId, [seat.id]);
  return { team: draft.team, to: draft.recipients.map((r) => r.name), message: draft.message };
}

/**
 * Rovo action and MCP tool: list-open-decisions.
 * Lists decision pages Empty Chair has checked, with how many affected teams are not at the table.
 * Results are stored per page, so each page is re-checked against the current user's access first.
 */
export async function listDecisionsAction() {
  const recent = await recentAnalyses(20);
  const visible = (await Promise.all(recent.map(async (a) => ((await canSeePage(a.pageId)) ? a : null)))).filter(
    (a): a is NonNullable<typeof a> => a !== null,
  );
  if (visible.length === 0) {
    return { decisions: [], note: 'No decision pages have been checked yet. Open a decision page and run Empty Chair once.' };
  }
  return {
    decisions: visible.map((a) => ({
      pageId: a.pageId,
      page: a.pageTitle,
      checked: a.analyzedAt,
      notAtTheTable: a.seats.filter((s) => s.status === 'missing').map((s) => s.team),
      readButQuiet: a.seats.filter((s) => s.status === 'silent').map((s) => s.team),
      atTheTable: a.seats.filter((s) => s.status === 'present').map((s) => s.team),
    })),
    note: 'Results are from the last time each page was checked. Call find-missing-stakeholders with a pageId for a fresh check.',
  };
}
