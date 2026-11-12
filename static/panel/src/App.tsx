import { useEffect, useMemo, useState } from 'react';
import type { Analysis, InviteDraft, Seat } from './types';
import { analyze, draftInvites, postInvites } from './api';
import { mockAnalysis, mockInvites } from './mock';
import { RoundTable } from './components/RoundTable';
import { SeatRow } from './components/SeatRow';
import { InviteSheet } from './components/InviteSheet';
import { DemoSetup } from './components/DemoSetup';
import { ChairMark, GraphMark, Refresh } from './components/Icons';

type View = 'table' | 'invites' | 'demo';

const ORDER: Record<Seat['status'], number> = { missing: 0, silent: 1, present: 2 };
const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];

export default function App() {
  const [data, setData] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [view, setView] = useState<View>('table');
  const [drafts, setDrafts] = useState<InviteDraft[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  /** A fictional analysis that shows every state, for sites without enough real activity. Nothing is posted. */
  const [sample, setSample] = useState(false);

  async function load(force = false) {
    setError(null);
    if (force) setRefreshing(true);
    try {
      const result = await analyze(force);
      setData(result);
      setSelected(new Set(result.seats.filter((s) => s.status !== 'present').map((s) => s.id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const shown = sample ? mockAnalysis : data;
  const seats = useMemo(
    () => (shown ? [...shown.seats].sort((a, b) => ORDER[a.status] - ORDER[b.status]) : []),
    [shown],
  );

  function openSample() {
    setSample(true);
    setView('table');
    setExpanded(null);
    setSelected(new Set(mockAnalysis.seats.filter((s) => s.status !== 'present').map((s) => s.id)));
  }

  function closeSample() {
    setSample(false);
    setExpanded(null);
    if (data) setSelected(new Set(data.seats.filter((s) => s.status !== 'present').map((s) => s.id)));
  }
  const counts = useMemo(() => {
    const c = { present: 0, silent: 0, missing: 0 };
    seats.forEach((s) => c[s.status]++);
    return c;
  }, [seats]);

  function focusSeat(id: string) {
    setExpanded(id);
    document.getElementById(`seat-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function openInvites() {
    setDrafts(null);
    setView('invites');
    try {
      setDrafts(sample ? mockInvites([...selected]) : await draftInvites([...selected]));
    } catch {
      setView('table');
      setToast('Invitations could not be drafted. Try again in a moment.');
    }
  }

  async function post(final: InviteDraft[]) {
    if (sample) {
      setView('table');
      setToast('This is the sample. Nothing was posted.');
      return;
    }
    const { posted } = await postInvites(final);
    setView('table');
    setToast(`${posted} invitation${posted === 1 ? '' : 's'} posted to the page`);
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3800);
    return () => clearTimeout(t);
  }, [toast]);

  if (error) {
    return (
      <main className="shell">
        <Masthead />
        <div className="state">
          <h2 className="display display--sm">The table couldn't be set.</h2>
          <p className="lede">{error}</p>
          <button className="primary-btn" onClick={() => load(true)}>
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (!data || !shown) return <Loading />;

  if (view === 'demo') {
    return (
      <main className="shell">
        <DemoSetup onBack={() => setView('table')} />
      </main>
    );
  }

  if (view === 'invites') {
    return (
      <main className="shell">
        <InviteSheet
          drafts={drafts}
          pageTitle={shown.pageTitle}
          onBack={() => setView('table')}
          onPost={post}
        />
      </main>
    );
  }

  if (!sample && (data.isDecision === false || seats.length === 0)) {
    return (
      <main className="shell">
        <Masthead />
        <div className="state">
          <p className="eyebrow">{data.pageTitle}</p>
          <h2 className="display display--sm">
            {data.isDecision === false ? "This page doesn't read like a decision." : 'No affected work found yet.'}
          </h2>
          <p className="lede">
            {data.isDecision === false
              ? 'Empty Chair looks at proposals, RFCs, and decision records. Open one of those and check again.'
              : `Nothing in Jira or Confluence mentions ${data.subjects.join(', ') || 'what this page changes'}. Add specific system or process names to the page, then check again.`}
          </p>
          <div className="state__actions">
            <button className="primary-btn" onClick={() => load(true)}>
              Check again
            </button>
            <button className="ghost-btn" onClick={() => setView('demo')}>
              Try it with a demo company
            </button>
            <button className="ghost-btn" onClick={openSample}>
              See a sample analysis
            </button>
          </div>
        </div>
      </main>
    );
  }

  const allSeated = counts.missing === 0 && counts.silent === 0;

  return (
    <main className="shell">
      <Masthead
        right={
          sample ? (
            <button className="ghost-btn" onClick={closeSample}>
              Back to this page
            </button>
          ) : (
            <button className="ghost-btn" onClick={() => load(true)} disabled={refreshing}>
              <Refresh /> {refreshing ? 'Checking…' : `Checked ${timeAgo(data.analyzedAt)}`}
            </button>
          )
        }
      />

      {sample && (
        <p className="sample-note" role="note">
          <strong>Sample analysis.</strong> Fictional teams and issues, so you can see all three states: a team at the
          table, one that read the page in the Teamwork Graph but stayed quiet, and teams that have not joined. Drafting
          works; nothing is posted.
        </p>
      )}

      <section className="hero">
        <div className="hero__table">
          <RoundTable seats={shown.seats} activeId={hovered} onHover={setHovered} onSelect={focusSeat} />
          <Legend />
        </div>

        <div className="hero__copy">
          <p className="eyebrow">{shown.pageTitle}</p>
          {allSeated ? (
            <h1 className="display">Everyone affected is at the table.</h1>
          ) : (
            <h1 className="display">
              {WORDS[counts.missing] ?? counts.missing} {counts.missing === 1 ? 'team is' : 'teams are'} affected,{' '}
              <span className="display__accent">but not at the table.</span>
            </h1>
          )}
          <p className="lede">
            This decision touches {seats.length} teams. {counts.present} {counts.present === 1 ? 'is' : 'are'} in the
            conversation
            {counts.silent > 0 && `, ${counts.silent} ${counts.silent === 1 ? 'is' : 'are'} listening without a word`}
            {counts.missing > 0 && `, and ${counts.missing} ${counts.missing === 1 ? "hasn't" : "haven't"} joined yet`}.
          </p>

          <dl className="tally">
            <div>
              <dt>Seated</dt>
              <dd>{counts.present}</dd>
            </div>
            <div>
              <dt>Listening</dt>
              <dd>{counts.silent}</dd>
            </div>
            <div className="tally--empty">
              <dt>Empty</dt>
              <dd>{counts.missing}</dd>
            </div>
          </dl>

          {shown.signals?.reading === 'graph' && (
            <p className="source">
              <GraphMark /> Who read the page comes from the Teamwork Graph, last 30 days.
            </p>
          )}

          <div className="subjects">
            <span className="subjects__label">What this decision touches</span>
            <div>
              {shown.subjects.map((s) => (
                <span key={s} className="subject">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="roster" aria-label="Affected teams">
        <div className="roster__head">
          <h3>Around the table</h3>
          <span>Ordered by who's missing</span>
        </div>
        <ul className="seats">
          {seats.map((seat) => (
            <SeatRow
              key={seat.id}
              seat={seat}
              active={hovered === seat.id}
              expanded={expanded === seat.id}
              selected={selected.has(seat.id)}
              onHover={setHovered}
              onToggle={(id) => setExpanded((cur) => (cur === id ? null : id))}
              onSelectChange={(id, v) =>
                setSelected((cur) => {
                  const next = new Set(cur);
                  v ? next.add(id) : next.delete(id);
                  return next;
                })
              }
            />
          ))}
        </ul>
      </section>

      {!allSeated && (
        <footer className="dock">
          <span className="dock__text">
            {selected.size === 0
              ? 'Select the teams you want to invite'
              : `${selected.size} team${selected.size === 1 ? '' : 's'} selected`}
          </span>
          <button className="primary-btn" disabled={selected.size === 0} onClick={openInvites}>
            Draft invitations
          </button>
        </footer>
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </main>
  );
}

function Masthead({ right }: { right?: React.ReactNode }) {
  return (
    <header className="masthead">
      <div className="brand">
        <ChairMark />
        <span className="brand__name">Empty Chair</span>
        <span className="brand__tag">Decision check</span>
      </div>
      {right}
    </header>
  );
}

function Legend() {
  return (
    <ul className="legend">
      <li>
        <i className="legend__dot legend__dot--present" /> Seated
      </li>
      <li>
        <i className="legend__dot legend__dot--silent" /> Listening
      </li>
      <li>
        <i className="legend__dot legend__dot--missing" /> Empty
      </li>
    </ul>
  );
}

function Loading() {
  const steps = ['Reading the proposal', 'Following the work it touches', "Checking who's at the table"];
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 520);
    return () => clearInterval(t);
  }, []);
  return (
    <main className="shell">
      <Masthead />
      <div className="loading">
        <svg className="loading__table" viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="34" />
        </svg>
        <ol className="loading__steps" role="status">
          {steps.map((s, i) => (
            <li key={s} className={i < step ? 'is-done' : i === step ? 'is-current' : ''}>
              {s}
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}

function timeAgo(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return `${h} h ago`;
}
