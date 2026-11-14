-- 009: payments. One amount received against one milestone.
-- payment_reference is unique across the whole table. Rows are never updated.

CREATE TABLE payments (
  id                bigint GENERATED ALWAYS AS IDENTITY,
  milestone_id      bigint      NOT NULL,
  amount_paise      bigint      NOT NULL,
  payment_date      date        NOT NULL,
  payment_reference text        NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT payments_pkey                     PRIMARY KEY (id),
  CONSTRAINT payments_milestone_id_fkey        FOREIGN KEY (milestone_id) REFERENCES payment_milestones (id) ON DELETE RESTRICT,
  CONSTRAINT payments_payment_reference_key    UNIQUE (payment_reference),
  CONSTRAINT payments_amount_positive          CHECK (amount_paise > 0),
  CONSTRAINT payments_payment_reference_format CHECK (
    payment_reference = upper(btrim(payment_reference))
    AND char_length(payment_reference) BETWEEN 1 AND 50
  )
);

CREATE INDEX payments_milestone_id_idx ON payments (milestone_id);

CREATE TRIGGER payments_forbid_update
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION forbid_update();
