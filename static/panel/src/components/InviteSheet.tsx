import { useState } from 'react';
import type { InviteDraft } from '../types';
import { ArrowLeft } from './Icons';

interface Props {
  drafts: InviteDraft[] | null;
  pageTitle: string;
  onBack: () => void;
  onPost: (drafts: InviteDraft[]) => Promise<void>;
}

export function InviteSheet({ drafts, pageTitle, onBack, onPost }: Props) {
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [posting, setPosting] = useState(false);

  const final = (drafts ?? []).map((d) => ({ ...d, message: edited[d.seatId] ?? d.message }));

  async function post() {
    setPosting(true);
    try {
      await onPost(final);
    } finally {
      setPosting(false);
      setConfirming(false);
    }
  }

  return (
    <section className="sheet" aria-label="Invitations">
      <header className="sheet__head">
        <button className="ghost-btn" onClick={onBack}>
          <ArrowLeft /> Back to the table
        </button>
        <span className="eyebrow">Invitations</span>
      </header>

      <h2 className="display display--sm">Pull up a chair.</h2>
      <p className="lede">
        One note per team, written from what Empty Chair found. Edit anything before it goes out. Nothing is sent
        until you confirm.
      </p>

      {!drafts && (
        <div className="drafting" role="status">
          <span className="pulse-dot" /> Writing invitations for {pageTitle}
        </div>
      )}

      {drafts && (
        <ol className="letters">
          {final.map((d) => (
            <li key={d.seatId} className="letter">
              <div className="letter__to">
                <span className="eyebrow">To</span> {d.team}
                <span className="letter__people">· {d.recipients.map((r) => r.name).join(', ')}</span>
              </div>
              <textarea
                className="letter__body"
                value={d.message}
                rows={4}
                onChange={(e) => setEdited((s) => ({ ...s, [d.seatId]: e.target.value }))}
              />
            </li>
          ))}
        </ol>
      )}

      {drafts && (
        <footer className="sheet__foot">
          {!confirming ? (
            <>
              <span className="foot-note">Posted as one page comment that mentions each contact.</span>
              <button className="primary-btn" onClick={() => setConfirming(true)}>
                Review and post
              </button>
            </>
          ) : (
            <>
              <span className="foot-note foot-note--strong">
                Post {final.length} invitation{final.length === 1 ? '' : 's'} as a comment on this page?
              </span>
              <button className="ghost-btn" onClick={() => setConfirming(false)} disabled={posting}>
                Cancel
              </button>
              <button className="primary-btn" onClick={post} disabled={posting}>
                {posting ? 'Posting…' : 'Post comment'}
              </button>
            </>
          )}
        </footer>
      )}
    </section>
  );
}
