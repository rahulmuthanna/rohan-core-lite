-- 008: payment milestones. Exactly four per booking, created with the booking.
-- sequence_no, stage and percent are fixed together: 1 BOOKING 10, 2 FOUNDATION 20,
-- 3 STRUCTURE 30, 4 HANDOVER 40. Rows are never updated.

CREATE TABLE payment_milestones (
  id               bigint GENERATED ALWAYS AS IDENTITY,
  booking_id       bigint      NOT NULL,
  sequence_no      smallint    NOT NULL,
  stage            text        NOT NULL,
  percent          smallint    NOT NULL,
  amount_due_paise bigint      NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT payment_milestones_pkey                    PRIMARY KEY (id),
  CONSTRAINT payment_milestones_booking_id_fkey         FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE RESTRICT,
  CONSTRAINT payment_milestones_booking_sequence_key    UNIQUE (booking_id, sequence_no),
  CONSTRAINT payment_milestones_stage_plan_check        CHECK (
    (sequence_no = 1 AND stage = 'BOOKING'    AND percent = 10) OR
    (sequence_no = 2 AND stage = 'FOUNDATION' AND percent = 20) OR
    (sequence_no = 3 AND stage = 'STRUCTURE'  AND percent = 30) OR
    (sequence_no = 4 AND stage = 'HANDOVER'   AND percent = 40)
  ),
  CONSTRAINT payment_milestones_amount_due_positive     CHECK (amount_due_paise > 0)
);

CREATE TRIGGER payment_milestones_forbid_update
  BEFORE UPDATE ON payment_milestones
  FOR EACH ROW EXECUTE FUNCTION forbid_update();
