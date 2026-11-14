-- 005: cost sheets. A priced offer for one unit and one customer.
-- This is the single frozen copy of the money. Rows are never updated.

CREATE TABLE cost_sheets (
  id                    bigint GENERATED ALWAYS AS IDENTITY,
  cost_sheet_number     text        NOT NULL DEFAULT next_document_number('CS', 'cost_sheet_number_seq'),
  unit_id               bigint      NOT NULL,
  customer_id           bigint      NOT NULL,
  listed_price_paise    bigint      NOT NULL,
  discount_bps          integer     NOT NULL,
  discount_amount_paise bigint      NOT NULL,
  final_price_paise     bigint      NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT cost_sheets_pkey                  PRIMARY KEY (id),
  CONSTRAINT cost_sheets_cost_sheet_number_key UNIQUE (cost_sheet_number),
  CONSTRAINT cost_sheets_unit_id_fkey          FOREIGN KEY (unit_id)     REFERENCES units (id)     ON DELETE RESTRICT,
  CONSTRAINT cost_sheets_customer_id_fkey      FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT,
  CONSTRAINT cost_sheets_listed_price_positive CHECK (listed_price_paise > 0),
  CONSTRAINT cost_sheets_discount_bps_range    CHECK (discount_bps BETWEEN 0 AND 200),
  -- Discount = listed price x bps / 10000, rounded to the nearest paise (halves round up).
  CONSTRAINT cost_sheets_discount_amount_check CHECK (discount_amount_paise = (listed_price_paise * discount_bps + 5000) / 10000),
  CONSTRAINT cost_sheets_final_price_check     CHECK (final_price_paise = listed_price_paise - discount_amount_paise)
);

CREATE INDEX cost_sheets_unit_id_idx     ON cost_sheets (unit_id);
CREATE INDEX cost_sheets_customer_id_idx ON cost_sheets (customer_id);

CREATE TRIGGER cost_sheets_forbid_update
  BEFORE UPDATE ON cost_sheets
  FOR EACH ROW EXECUTE FUNCTION forbid_update();
