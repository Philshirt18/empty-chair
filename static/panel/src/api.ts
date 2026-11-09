import type { Analysis, InviteDraft } from './types';
import { mockAllSeated, mockAnalysis, mockInvites } from './mock';

// Outside the Atlassian iframe there is no bridge, so the panel runs on demo data.
// The bridge throws on import when no host is present, so it is loaded lazily.
const isLocal = window.self === window.top;
const mockMode = new URLSearchParams(window.location.search).get('mock');

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const bridge = () => import('@forge/bridge');

async function invoke<T>(key: string, payload: Record<string, unknown>): Promise<T> {
  const { invoke } = await bridge();
  return invoke<T>(key, payload);
}

export async function enableTheme(): Promise<void> {
  if (isLocal) return;
  try {
    const { view } = await bridge();
    await view.theme.enable();
  } catch {
    // Theming is optional; the panel falls back to the light palette.
  }
}

export async function analyze(force = false): Promise<Analysis> {
  if (isLocal) {
    await wait(force ? 900 : 1400);
    if (mockMode === 'error') throw new Error('The analysis service did not respond.');
    if (mockMode === 'empty') return { ...mockAnalysis, seats: [] };
    return mockMode === 'seated' ? mockAllSeated : mockAnalysis;
  }
  return invoke<Analysis>('analyze', { force });
}

export async function draftInvites(seatIds: string[]): Promise<InviteDraft[]> {
  if (isLocal) {
    await wait(1100);
    return mockInvites(seatIds);
  }
  return invoke<InviteDraft[]>('draftInvites', { seatIds });
}

export interface DemoStep {
  id: string;
  label: string;
}

export interface DemoStepResult {
  ok: boolean;
  detail: string;
  pageId?: string;
}

export async function demoPlan(): Promise<DemoStep[]> {
  if (isLocal) {
    return [
      { id: 'space:ECATL', label: 'Team Atlas: 3 pages' },
      { id: 'space:ECHELP', label: 'Customer Support: 2 pages' },
      { id: 'space:ECFIN', label: 'Finance Ops: 2 pages' },
      { id: 'space:ECSEC', label: 'Security: 2 pages' },
      { id: 'space:ECENG', label: 'Engineering: 1 page' },
    ];
  }
  return invoke<DemoStep[]>('demoPlan', {});
}

export async function demoStep(id: string): Promise<DemoStepResult> {
  if (isLocal) {
    await wait(600);
    return { ok: true, detail: 'Created', pageId: id === 'space:ECENG' ? '98304' : undefined };
  }
  return invoke<DemoStepResult>('demoStep', { id });
}

/** Opens a Confluence page in the host product; the panel itself runs in a sandboxed iframe. */
export async function openPage(pageId: string): Promise<void> {
  if (isLocal) return;
  const { router } = await bridge();
  await router.navigate(`/wiki/spaces/ECENG/pages/${pageId}`);
}

export async function postInvites(drafts: InviteDraft[]): Promise<{ posted: number }> {
  if (isLocal) {
    await wait(700);
    return { posted: drafts.length };
  }
  return invoke<{ posted: number }>('postInvites', { drafts });
}
