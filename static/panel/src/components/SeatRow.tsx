import type { Seat } from '../types';
import { labelFor } from './RoundTable';
import { Chevron, EvidenceIcon } from './Icons';

interface Props {
  seat: Seat;
  active: boolean;
  expanded: boolean;
  selected: boolean;
  onHover: (id: string | null) => void;
  onToggle: (id: string) => void;
  onSelectChange: (id: string, value: boolean) => void;
}

export function SeatRow({ seat, active, expanded, selected, onHover, onToggle, onSelectChange }: Props) {
  const invitable = seat.status !== 'present';
  return (
    <li
      id={`seat-${seat.id}`}
      className={`seat seat--${seat.status}${active ? ' is-active' : ''}`}
      onMouseEnter={() => onHover(seat.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="seat__head">
        <span className="seat__mono" aria-hidden="true">
          {seat.monogram}
        </span>
        <div className="seat__title">
          <div className="seat__name-row">
            <span className="seat__name">{seat.team}</span>
            <span className="seat__status">{labelFor(seat)}</span>
          </div>
          <p className="seat__reason">{seat.reason}</p>
          <div className="seat__evidence">
            {seat.evidence.map((g) => (
              <span key={g.kind + g.label} className="chip">
                <EvidenceIcon kind={g.kind} />
                <span className="chip__count">{g.count}</span> {g.label}
              </span>
            ))}
          </div>
        </div>
        <div className="seat__actions">
          {invitable && (
            <label className="check" title="Include in invites">
              <input
                type="checkbox"
                checked={selected}
                onChange={(e) => onSelectChange(seat.id, e.target.checked)}
              />
              <span>Invite</span>
            </label>
          )}
          <button
            className="icon-btn"
            aria-expanded={expanded}
            aria-label={expanded ? `Hide evidence for ${seat.team}` : `Show evidence for ${seat.team}`}
            onClick={() => onToggle(seat.id)}
          >
            <Chevron open={expanded} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="seat__detail">
          <div className="detail-col">
            <h4>Evidence</h4>
            <ul className="evidence">
              {seat.evidence.flatMap((g) =>
                g.items.map((item) => (
                  <li key={(item.key ?? '') + item.title}>
                    <EvidenceIcon kind={item.kind} />
                    {item.key && <span className="evidence__key">{item.key}</span>}
                    <span>{item.title}</span>
                  </li>
                )),
              )}
            </ul>
          </div>
          <div className="detail-col detail-col--narrow">
            <h4>Who to ask</h4>
            <ul className="contacts">
              {seat.contacts.map((c) => (
                <li key={c.name}>
                  <span className="avatar">{initials(c.name)}</span>
                  <span>
                    {c.name}
                    {c.role && <em>{c.role}</em>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </li>
  );
}

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');
}
