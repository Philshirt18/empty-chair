import { useState } from 'react';
import { demoPlan, demoStep, openPage, type DemoStep } from '../api';
import { ArrowLeft } from './Icons';

type State = 'idle' | 'running' | 'done';
type StepState = { status: 'pending' | 'running' | 'ok' | 'failed'; detail?: string };

interface Props {
  onBack: () => void;
}

/** Sets up a small fictional company so the app can be tried on an empty site. */
export function DemoSetup({ onBack }: Props) {
  const [state, setState] = useState<State>('idle');
  const [steps, setSteps] = useState<DemoStep[]>([]);
  const [progress, setProgress] = useState<Record<string, StepState>>({});
  const [pageId, setPageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setState('running');
    setError(null);
    try {
      const plan = await demoPlan();
      setSteps(plan);
      setProgress(Object.fromEntries(plan.map((s) => [s.id, { status: 'pending' }])));
      for (const step of plan) {
        setProgress((p) => ({ ...p, [step.id]: { status: 'running' } }));
        try {
          const result = await demoStep(step.id);
          if (result.pageId) setPageId(result.pageId);
          setProgress((p) => ({ ...p, [step.id]: { status: result.ok ? 'ok' : 'failed', detail: result.detail } }));
        } catch (e) {
          setProgress((p) => ({
            ...p,
            [step.id]: { status: 'failed', detail: e instanceof Error ? e.message : 'Failed' },
          }));
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The demo could not be set up.');
    }
    setState('done');
  }

  const failed = Object.values(progress).filter((p) => p.status === 'failed').length;

  return (
    <section className="sheet" aria-label="Demo company">
      <header className="sheet__head">
        <button className="ghost-btn" onClick={onBack} disabled={state === 'running'}>
          <ArrowLeft /> Back
        </button>
        <span className="eyebrow">Demo</span>
      </header>

      <h2 className="display display--sm">Set the table for a demo.</h2>
      <p className="lede">
        Creates a small fictional company in this site: five Jira projects, two Confluence spaces, and a decision page
        to retire an API. Everything uses keys starting with EC, so nothing that exists is changed.
      </p>

      {(state === 'idle' || (state === 'done' && failed > 0)) && (
        <button className="primary-btn" onClick={run}>
          {state === 'idle' ? 'Create demo company' : 'Try again'}
        </button>
      )}

      {steps.length > 0 && (
        <ol className="demo-steps">
          {steps.map((s) => {
            const p = progress[s.id] ?? { status: 'pending' };
            return (
              <li key={s.id} className={`demo-step demo-step--${p.status}`}>
                <span className="demo-step__mark" aria-hidden="true" />
                <span className="demo-step__label">{s.label}</span>
                {p.detail && <span className="demo-step__detail">{p.detail}</span>}
              </li>
            );
          })}
        </ol>
      )}

      {error && <p className="lede">{error}</p>}

      {state === 'done' && (
        <div className="demo-done">
          <p className="lede">
            {failed === 0
              ? 'Done. Search can take a minute or two to pick up new issues and pages.'
              : failed === steps.length
                ? 'Nothing could be created. If Atlassian asked for access, wait a minute and try again.'
                : `${failed} step${failed === 1 ? '' : 's'} could not be completed. The rest is ready.`}
          </p>
          {pageId && (
            <button className="primary-btn" onClick={() => openPage(pageId)}>
              Open the demo decision
            </button>
          )}
        </div>
      )}
    </section>
  );
}
