-- 007: bookings. A confirmed sale created from exactly one quotation.
-- The UNIQUE rule on unit_id is the database-level guard against double booking.

CREATE TABLE bookings (
  id             bigint GENERATED ALWAYS AS IDENTITY,
  booking_number text        NOT NULL DEFAULT next_document_number('BK', 'booking_number_seq'),
  quotation_id   bigint      NOT NULL,
  unit_id        bigint      NOT NULL,
  booked_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT bookings_pkey               PRIMARY KEY (id),
  CONSTRAINT bookings_booking_number_key UNIQUE (booking_number),
  CONSTRAINT bookings_quotation_id_key   UNIQUE (quotation_id),
  CONSTRAINT bookings_unit_id_key        UNIQUE (unit_id),
  CONSTRAINT bookings_quotation_id_fkey  FOREIGN KEY (quotation_id) REFERENCES quotations (id) ON DELETE RESTRICT,
  CONSTRAINT bookings_unit_id_fkey       FOREIGN KEY (unit_id)      REFERENCES units (id)      ON DELETE RESTRICT
);

CREATE TRIGGER bookings_forbid_update
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION forbid_update();
