-- 006: quotations. A formal quote created from one cost sheet.
-- Money, unit and customer are read from the cost sheet, never copied.
-- "Expired" is NOT stored: a quotation is expired when today's date in India
-- is after valid_until and it has no booking.

CREATE TABLE quotations (
  id               bigint GENERATED ALWAYS AS IDENTITY,
  quotation_number text        NOT NULL DEFAULT next_document_number('QT', 'quotation_number_seq'),
  cost_sheet_id    bigint      NOT NULL,
  status           text        NOT NULL DEFAULT 'DRAFT',
  issue_date       date        NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata')::date),
  valid_until      date        NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata')::date + 7),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT quotations_pkey                 PRIMARY KEY (id),
  CONSTRAINT quotations_quotation_number_key UNIQUE (quotation_number),
  CONSTRAINT quotations_cost_sheet_id_fkey   FOREIGN KEY (cost_sheet_id) REFERENCES cost_sheets (id) ON DELETE RESTRICT,
  CONSTRAINT quotations_status_check         CHECK (status IN ('DRAFT', 'SENT', 'ACCEPTED')),
  CONSTRAINT quotations_validity_check       CHECK (valid_until = issue_date + 7)
);

CREATE INDEX quotations_cost_sheet_id_idx ON quotations (cost_sheet_id);
CREATE INDEX quotations_status_idx        ON quotations (status);

CREATE TRIGGER quotations_set_updated_at
  BEFORE UPDATE ON quotations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
