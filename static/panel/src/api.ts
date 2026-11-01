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
    return mockMode === 'seated' ? mockAllSeated : mockAnalysis;
  }
  // Temporary: Teamwork Graph availability check. Logs only, failures do not affect the panel.
  invoke('graphProbe', {}).catch(() => undefined);
  return invoke<Analysis>('analyze', { force });
}

export async function draftInvites(seatIds: string[]): Promise<InviteDraft[]> {
  if (isLocal) {
    await wait(1100);
    return mockInvites(seatIds);
  }
  return invoke<InviteDraft[]>('draftInvites', { seatIds });
}

export async function postInvites(drafts: InviteDraft[]): Promise<{ posted: number }> {
  if (isLocal) {
    await wait(700);
    return { posted: drafts.length };
  }
  return invoke<{ posted: number }>('postInvites', { drafts });
}
