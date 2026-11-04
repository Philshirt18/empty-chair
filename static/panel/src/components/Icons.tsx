import type { EvidenceKind } from '../types';

const common = {
  width: 14,
  height: 14,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function EvidenceIcon({ kind }: { kind: EvidenceKind }) {
  switch (kind) {
    case 'jira':
      return (
        <svg {...common}>
          <rect x="2.5" y="2.5" width="11" height="11" rx="2.5" />
          <path d="M5.5 8.2l1.7 1.7 3.3-3.6" />
        </svg>
      );
    case 'service':
      return (
        <svg {...common}>
          <path d="M3 9V8a5 5 0 0110 0v1" />
          <rect x="2.5" y="8.5" width="2.5" height="4" rx="1" />
          <rect x="11" y="8.5" width="2.5" height="4" rx="1" />
        </svg>
      );
    case 'page':
      return (
        <svg {...common}>
          <path d="M4 2.5h5.5L12.5 5.5v8H4z" />
          <path d="M9.5 2.5v3h3M6 9h4.5M6 11h3" />
        </svg>
      );
    case 'goal':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5.5" />
          <circle cx="8" cy="8" r="2.5" />
        </svg>
      );
  }
}

export function ChairMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6.5Q12 2.5 18 6.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <rect x="5" y="9" width="14" height="12" rx="4" stroke="currentColor" strokeWidth="2" strokeDasharray="3 2.4" />
    </svg>
  );
}

export function GraphMark() {
  return (
    <svg {...common}>
      <circle cx="4" cy="4.5" r="1.8" />
      <circle cx="12" cy="4.5" r="1.8" />
      <circle cx="8" cy="12" r="1.8" />
      <path d="M5.6 5.4l1.6 4.8M10.4 5.4l-1.6 4.8M5.8 4.5h4.4" />
    </svg>
  );
}

export function Refresh() {
  return (
    <svg {...common}>
      <path d="M13 8a5 5 0 11-1.5-3.6M13 2.5v3h-3" />
    </svg>
  );
}

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg {...common} style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }}>
      <path d="M4.5 6.5L8 10l3.5-3.5" />
    </svg>
  );
}

export function ArrowLeft() {
  return (
    <svg {...common}>
      <path d="M12.5 8h-9M7 4.5L3.5 8 7 11.5" />
    </svg>
  );
}
