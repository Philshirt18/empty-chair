import type { Seat } from '../types';

interface Props {
  seats: Seat[];
  activeId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}

const SIZE = 360;
const C = SIZE / 2;
const TABLE_R = 96;
const ORBIT_R = 134;

/** Top-down view of a round table. Filled chairs are seated teams, outlined chairs are empty. */
export function RoundTable({ seats, activeId, onHover, onSelect }: Props) {
  const affected = seats.length;
  const empty = seats.filter((s) => s.status === 'missing').length;

  return (
    <svg
      className="table"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={`${affected} affected teams, ${empty} not at the table`}
    >
      <circle className="table__halo" cx={C} cy={C} r={ORBIT_R + 34} />
      <circle className="table__top" cx={C} cy={C} r={TABLE_R} />
      <circle className="table__inlay" cx={C} cy={C} r={TABLE_R - 14} />
      <text className="table__count" x={C} y={C + 6} textAnchor="middle">
        {affected}
      </text>
      <text className="table__caption" x={C} y={C + 30} textAnchor="middle">
        teams affected
      </text>

      {seats.map((seat, i) => {
        const angle = (360 / seats.length) * i - 90 + 360 / seats.length / 2;
        const rad = (angle * Math.PI) / 180;
        const x = C + ORBIT_R * Math.cos(rad);
        const y = C + ORBIT_R * Math.sin(rad);
        const isActive = activeId === seat.id;
        return (
          <g
            key={seat.id}
            className={`chair chair--${seat.status}${isActive ? ' is-active' : ''}`}
            style={{ animationDelay: `${120 + i * 90}ms` }}
            transform={`translate(${x} ${y})`}
            onMouseEnter={() => onHover(seat.id)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onSelect(seat.id)}
            tabIndex={0}
            role="button"
            aria-label={`${seat.team}: ${labelFor(seat)}`}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(seat.id)}
          >
            <g className="chair__body" transform={`rotate(${angle + 90})`}>
              <path className="chair__back" d="M -18 -22 Q 0 -33 18 -22" />
              <rect className="chair__seat" x={-20} y={-16} width={40} height={36} rx={12} />
            </g>
            <text className="chair__mono" y={4.5} textAnchor="middle">
              {seat.monogram}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function labelFor(seat: Seat): string {
  if (seat.status === 'present') return seat.engagement.author ? 'Author' : 'At the table';
  if (seat.status === 'silent') return 'Reading, not speaking';
  return 'Not at the table';
}
