import type { MilestoneState, QuotationStatus, UnitStatus } from '../api/types';
import { MILESTONE_STATE_LABEL, QUOTATION_STATUS_LABEL, UNIT_STATUS_LABEL } from '../lib/format';

type Tone = 'good' | 'active' | 'waiting' | 'neutral' | 'bad';

const UNIT_TONE: Record<UnitStatus, Tone> = { AVAILABLE: 'good', BOOKED: 'waiting', SOLD: 'neutral' };
const QUOTATION_TONE: Record<QuotationStatus, Tone> = {
  DRAFT: 'neutral',
  SENT: 'active',
  ACCEPTED: 'good',
  EXPIRED: 'bad',
};
const MILESTONE_TONE: Record<MilestoneState, Tone> = { PENDING: 'neutral', PARTLY_PAID: 'waiting', PAID: 'good' };

function Tag({ tone, label }: { tone: Tone; label: string }) {
  return <span className={`tag tag-${tone}`}>{label}</span>;
}

// A status is always shown as a word. The colour only supports it.

export function UnitStatusTag({ status }: { status: UnitStatus }) {
  return <Tag tone={UNIT_TONE[status]} label={UNIT_STATUS_LABEL[status]} />;
}

export function QuotationStatusTag({ status }: { status: QuotationStatus }) {
  return <Tag tone={QUOTATION_TONE[status]} label={QUOTATION_STATUS_LABEL[status]} />;
}

export function MilestoneStateTag({ state }: { state: MilestoneState }) {
  return <Tag tone={MILESTONE_TONE[state]} label={MILESTONE_STATE_LABEL[state]} />;
}
