// Mirrors static/panel/src/types.ts. Keep both in sync.

export type SeatStatus = 'present' | 'silent' | 'missing';
export type EvidenceKind = 'jira' | 'service' | 'page' | 'goal';

export interface EvidenceItem {
  kind: EvidenceKind;
  key?: string;
  title: string;
  url?: string;
}

export interface EvidenceGroup {
  kind: EvidenceKind;
  count: number;
  label: string;
  items: EvidenceItem[];
}

export interface Contact {
  name: string;
  role?: string;
  accountId?: string;
}

export interface Seat {
  id: string;
  team: string;
  monogram: string;
  status: SeatStatus;
  reason: string;
  evidence: EvidenceGroup[];
  contacts: Contact[];
  engagement: { viewed: boolean; commented: boolean; author?: boolean };
}

export interface Analysis {
  pageId: string;
  pageTitle: string;
  pageStatus: 'draft' | 'in-review' | 'decided';
  isDecision: boolean;
  subjects: string[];
  seats: Seat[];
  analyzedAt: string;
}

export interface InviteDraft {
  seatId: string;
  team: string;
  recipients: Contact[];
  message: string;
}
