-- Database self-check. Run inside a transaction that is ROLLED BACK afterwards.
-- Prints one "PASS" notice per check and raises an exception on the first failure.
-- Requires a freshly migrated and seeded database with no customers.

CREATE FUNCTION pg_temp.expect_true(label text, ok boolean)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS TRUE THEN
    RAISE NOTICE 'PASS  %', label;
  ELSE
    RAISE EXCEPTION 'FAIL  %', label;
  END IF;
END;
$$;

CREATE FUNCTION pg_temp.expect_constraint(label text, expected text, stmt text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  got text;
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS got = CONSTRAINT_NAME;
    IF got = expected THEN
      RAISE NOTICE 'PASS  %', label;
      RETURN;
    END IF;
    RAISE EXCEPTION 'FAIL  % (expected constraint "%", got "%": %)', label, expected, got, SQLERRM;
  END;
  RAISE EXCEPTION 'FAIL  % (statement succeeded but should have been rejected)', label;
END;
$$;

CREATE FUNCTION pg_temp.expect_frozen(label text, stmt text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%frozen and cannot be updated%' THEN
      RAISE NOTICE 'PASS  %', label;
      RETURN;
    END IF;
    RAISE EXCEPTION 'FAIL  % (unexpected error: %)', label, SQLERRM;
  END;
  RAISE EXCEPTION 'FAIL  % (update succeeded but the row should be frozen)', label;
END;
$$;

DO $$
DECLARE
  today_in_india date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  rn101      bigint;
  rc101      bigint;
  cust_a     bigint;
  cust_b     bigint;
  cs1        bigint;
  cs2        bigint;
  cs_unused  bigint;
  q1         bigint;
  q2         bigint;
  b1         bigint;
  m1         bigint;
  cs_number  text;
  q_number   text;
  b_number   text;
  q_row      quotations%ROWTYPE;
  before_ts  timestamptz;
BEGIN
  -- ---------- Seed data ----------
  PERFORM pg_temp.expect_true('seed: 4 projects', (SELECT count(*) = 4 FROM projects));
  PERFORM pg_temp.expect_true('seed: 12 units', (SELECT count(*) = 12 FROM units));
  PERFORM pg_temp.expect_true('seed: all 12 units AVAILABLE', (SELECT count(*) = 12 FROM units WHERE status = 'AVAILABLE'));
  PERFORM pg_temp.expect_true('seed: listed prices total 10260000000 paise', (SELECT sum(listed_price_paise)::bigint = 10260000000 FROM units));
  PERFORM pg_temp.expect_true('seed: RN-101 is 2 BHK, 1100 sq ft, 680000000 paise, Rohan Nest',
    (SELECT u.unit_type = '2 BHK' AND u.area_sqft = 1100 AND u.listed_price_paise = 680000000 AND p.name = 'Rohan Nest'
       FROM units u JOIN projects p ON p.id = u.project_id WHERE u.unit_code = 'RN-101'));
  PERFORM pg_temp.expect_true('seed: 3 units per project', (SELECT bool_and(c = 3) FROM (SELECT count(*) AS c FROM units GROUP BY project_id) t));

  SELECT id INTO rn101 FROM units WHERE unit_code = 'RN-101';
  SELECT id INTO rc101 FROM units WHERE unit_code = 'RC-101';

  -- ---------- Units ----------
  PERFORM pg_temp.expect_constraint('units: unit_type outside the list is rejected', 'units_unit_type_check',
    format('UPDATE units SET unit_type = %L WHERE id = %s', '4 BHK', rn101));
  PERFORM pg_temp.expect_constraint('units: status outside the list is rejected', 'units_status_check',
    format('UPDATE units SET status = %L WHERE id = %s', 'HOLD', rn101));
  PERFORM pg_temp.expect_constraint('units: zero price is rejected', 'units_listed_price_positive',
    format('UPDATE units SET listed_price_paise = 0 WHERE id = %s', rn101));
  PERFORM pg_temp.expect_constraint('units: duplicate unit_code is rejected', 'units_unit_code_key',
    format('INSERT INTO units (project_id, unit_code, unit_type, area_sqft, listed_price_paise) SELECT project_id, %L, %L, 900, 100 FROM units WHERE id = %s', 'RN-101', '2 BHK', rn101));

  -- ---------- Customers ----------
  INSERT INTO customers (full_name, mobile, email) VALUES ('Asha Verma', '9876543210', 'asha@example.com') RETURNING id INTO cust_a;
  INSERT INTO customers (full_name, mobile, email) VALUES ('Vikram Rao', '9123456780', 'vikram@example.com') RETURNING id INTO cust_b;
  PERFORM pg_temp.expect_constraint('customers: duplicate mobile is rejected', 'customers_mobile_key',
    $q$INSERT INTO customers (full_name, mobile, email) VALUES ('Someone Else', '9876543210', 'other@example.com')$q$);
  PERFORM pg_temp.expect_constraint('customers: 9-digit mobile is rejected', 'customers_mobile_format',
    $q$INSERT INTO customers (full_name, mobile, email) VALUES ('Short Mobile', '987654321', 'a@example.com')$q$);
  PERFORM pg_temp.expect_constraint('customers: mobile with letters is rejected', 'customers_mobile_format',
    $q$INSERT INTO customers (full_name, mobile, email) VALUES ('Letter Mobile', '98765abcde', 'a@example.com')$q$);
  PERFORM pg_temp.expect_constraint('customers: email without @ is rejected', 'customers_email_format',
    $q$INSERT INTO customers (full_name, mobile, email) VALUES ('Bad Email', '9000000001', 'not-an-email')$q$);
  PERFORM pg_temp.expect_constraint('customers: email with capitals is rejected', 'customers_email_format',
    $q$INSERT INTO customers (full_name, mobile, email) VALUES ('Caps Email', '9000000002', 'Caps@Example.com')$q$);
  PERFORM pg_temp.expect_constraint('customers: one-letter name is rejected', 'customers_full_name_length',
    $q$INSERT INTO customers (full_name, mobile, email) VALUES ('A', '9000000003', 'a@example.com')$q$);
  PERFORM pg_temp.expect_constraint('customers: name with outer spaces is rejected', 'customers_full_name_length',
    $q$INSERT INTO customers (full_name, mobile, email) VALUES ('  Padded Name ', '9000000004', 'a@example.com')$q$);

  -- ---------- Cost sheets (the assignment example: RN-101 at 1%) ----------
  INSERT INTO cost_sheets (unit_id, customer_id, listed_price_paise, discount_bps, discount_amount_paise, final_price_paise)
  VALUES (rn101, cust_a, 680000000, 100, 6800000, 673200000)
  RETURNING id, cost_sheet_number INTO cs1, cs_number;
  PERFORM pg_temp.expect_true('cost sheets: number looks like CS-YYYY-0001', cs_number ~ '^CS-[0-9]{4}-[0-9]{4,}$');

  PERFORM pg_temp.expect_constraint('cost sheets: discount above 2% is rejected', 'cost_sheets_discount_bps_range',
    format('INSERT INTO cost_sheets (unit_id, customer_id, listed_price_paise, discount_bps, discount_amount_paise, final_price_paise) VALUES (%s, %s, 680000000, 201, 13668000, 666332000)', rn101, cust_a));
  PERFORM pg_temp.expect_constraint('cost sheets: negative discount is rejected', 'cost_sheets_discount_bps_range',
    format('INSERT INTO cost_sheets (unit_id, customer_id, listed_price_paise, discount_bps, discount_amount_paise, final_price_paise) VALUES (%s, %s, 680000000, -1, -67999, 680067999)', rn101, cust_a));
  PERFORM pg_temp.expect_constraint('cost sheets: wrong discount amount is rejected', 'cost_sheets_discount_amount_check',
    format('INSERT INTO cost_sheets (unit_id, customer_id, listed_price_paise, discount_bps, discount_amount_paise, final_price_paise) VALUES (%s, %s, 680000000, 100, 6800001, 673199999)', rn101, cust_a));
  PERFORM pg_temp.expect_constraint('cost sheets: wrong final price is rejected', 'cost_sheets_final_price_check',
    format('INSERT INTO cost_sheets (unit_id, customer_id, listed_price_paise, discount_bps, discount_amount_paise, final_price_paise) VALUES (%s, %s, 680000000, 100, 6800000, 673200001)', rn101, cust_a));
  PERFORM pg_temp.expect_frozen('cost sheets: update is blocked',
    format('UPDATE cost_sheets SET discount_bps = 0, discount_amount_paise = 0, final_price_paise = 680000000 WHERE id = %s', cs1));

  -- Rounding: 10050 paise at 0.50% is 50.25 paise and is stored as 50; 10100 paise at 0.50% is 50.5 paise and must be stored as 51.
  INSERT INTO cost_sheets (unit_id, customer_id, listed_price_paise, discount_bps, discount_amount_paise, final_price_paise)
  VALUES (rn101, cust_a, 10050, 50, 50, 10000) RETURNING id INTO cs_unused;
  PERFORM pg_temp.expect_constraint('cost sheets: exact half paise must round up', 'cost_sheets_discount_amount_check',
    format('INSERT INTO cost_sheets (unit_id, customer_id, listed_price_paise, discount_bps, discount_amount_paise, final_price_paise) VALUES (%s, %s, 10100, 50, 50, 10050)', rn101, cust_a));

  -- Price change must not touch a saved cost sheet.
  SELECT updated_at INTO before_ts FROM units WHERE id = rn101;
  UPDATE units SET listed_price_paise = 700000000 WHERE id = rn101;
  PERFORM pg_temp.expect_true('units: price can be changed', (SELECT listed_price_paise = 700000000 FROM units WHERE id = rn101));
  PERFORM pg_temp.expect_true('cost sheets: keep their price after the unit price changes',
    (SELECT listed_price_paise = 680000000 AND discount_amount_paise = 6800000 AND final_price_paise = 673200000 FROM cost_sheets WHERE id = cs1));
  UPDATE units SET listed_price_paise = 680000000 WHERE id = rn101;

  -- Deleting an unused cost sheet is allowed.
  DELETE FROM cost_sheets WHERE id = cs_unused;
  PERFORM pg_temp.expect_true('cost sheets: one with no quotation can be deleted', NOT EXISTS (SELECT 1 FROM cost_sheets WHERE id = cs_unused));

  -- ---------- Quotations ----------
  INSERT INTO quotations (cost_sheet_id) VALUES (cs1) RETURNING id, quotation_number INTO q1, q_number;
  SELECT * INTO q_row FROM quotations WHERE id = q1;
  PERFORM pg_temp.expect_true('quotations: number looks like QT-YYYY-0001', q_number ~ '^QT-[0-9]{4}-[0-9]{4,}$');
  PERFORM pg_temp.expect_true('quotations: start as DRAFT', q_row.status = 'DRAFT');
  PERFORM pg_temp.expect_true('quotations: issue date defaults to today in India', q_row.issue_date = today_in_india);
  PERFORM pg_temp.expect_true('quotations: valid_until defaults to issue date + 7 days', q_row.valid_until = today_in_india + 7);

  PERFORM pg_temp.expect_constraint('quotations: EXPIRED cannot be stored', 'quotations_status_check',
    format('UPDATE quotations SET status = %L WHERE id = %s', 'EXPIRED', q1));
  PERFORM pg_temp.expect_constraint('quotations: validity other than 7 days is rejected', 'quotations_validity_check',
    format('INSERT INTO quotations (cost_sheet_id, issue_date, valid_until) VALUES (%s, DATE %L, DATE %L)', cs1, '2026-01-01', '2026-01-10'));
  PERFORM pg_temp.expect_constraint('cost sheets: one with a quotation cannot be deleted', 'quotations_cost_sheet_id_fkey',
    format('DELETE FROM cost_sheets WHERE id = %s', cs1));
  PERFORM pg_temp.expect_constraint('customers: one with a cost sheet cannot be deleted', 'cost_sheets_customer_id_fkey',
    format('DELETE FROM customers WHERE id = %s', cust_a));

  -- A back-dated quotation can be inserted (needed by automated tests for expiry).
  INSERT INTO quotations (cost_sheet_id, issue_date, valid_until) VALUES (cs1, DATE '2026-01-01', DATE '2026-01-08');
  PERFORM pg_temp.expect_true('quotations: a back-dated quotation can be stored', (SELECT count(*) = 1 FROM quotations WHERE issue_date = DATE '2026-01-01'));

  UPDATE quotations SET status = 'SENT' WHERE id = q1;
  UPDATE quotations SET status = 'ACCEPTED' WHERE id = q1;
  PERFORM pg_temp.expect_true('quotations: status can move to ACCEPTED', (SELECT status = 'ACCEPTED' FROM quotations WHERE id = q1));

  -- ---------- Bookings ----------
  INSERT INTO bookings (quotation_id, unit_id) VALUES (q1, rn101) RETURNING id, booking_number INTO b1, b_number;
  UPDATE units SET status = 'BOOKED' WHERE id = rn101;
  PERFORM pg_temp.expect_true('bookings: number looks like BK-YYYY-0001', b_number ~ '^BK-[0-9]{4}-[0-9]{4,}$');
  PERFORM pg_temp.expect_true('units: updated_at is maintained by the database', (SELECT updated_at >= before_ts FROM units WHERE id = rn101));

  -- A second customer with their own accepted quotation for the same unit.
  INSERT INTO cost_sheets (unit_id, customer_id, listed_price_paise, discount_bps, discount_amount_paise, final_price_paise)
  VALUES (rn101, cust_b, 680000000, 0, 0, 680000000) RETURNING id INTO cs2;
  INSERT INTO quotations (cost_sheet_id, status) VALUES (cs2, 'ACCEPTED') RETURNING id INTO q2;

  PERFORM pg_temp.expect_constraint('bookings: a second booking for the same unit is rejected', 'bookings_unit_id_key',
    format('INSERT INTO bookings (quotation_id, unit_id) VALUES (%s, %s)', q2, rn101));
  PERFORM pg_temp.expect_constraint('bookings: a second booking for the same quotation is rejected', 'bookings_quotation_id_key',
    format('INSERT INTO bookings (quotation_id, unit_id) VALUES (%s, %s)', q1, rc101));
  PERFORM pg_temp.expect_frozen('bookings: update is blocked',
    format('UPDATE bookings SET unit_id = %s WHERE id = %s', rc101, b1));

  -- ---------- Payment milestones (the assignment example) ----------
  INSERT INTO payment_milestones (booking_id, sequence_no, stage, percent, amount_due_paise) VALUES
    (b1, 1, 'BOOKING',    10,  67320000),
    (b1, 2, 'FOUNDATION', 20, 134640000),
    (b1, 3, 'STRUCTURE',  30, 201960000),
    (b1, 4, 'HANDOVER',   40, 269280000);
  PERFORM pg_temp.expect_true('milestones: the four amounts add up to the final price 673200000',
    (SELECT sum(amount_due_paise)::bigint = 673200000 FROM payment_milestones WHERE booking_id = b1));
  SELECT id INTO m1 FROM payment_milestones WHERE booking_id = b1 AND sequence_no = 1;

  PERFORM pg_temp.expect_constraint('milestones: a duplicate sequence number is rejected', 'payment_milestones_booking_sequence_key',
    format('INSERT INTO payment_milestones (booking_id, sequence_no, stage, percent, amount_due_paise) VALUES (%s, 1, %L, 10, 100)', b1, 'BOOKING'));
  PERFORM pg_temp.expect_constraint('milestones: stage must match its sequence number', 'payment_milestones_stage_plan_check',
    format('INSERT INTO payment_milestones (booking_id, sequence_no, stage, percent, amount_due_paise) SELECT id, 2, %L, 10, 100 FROM bookings WHERE id = %s', 'BOOKING', b1));
  PERFORM pg_temp.expect_constraint('milestones: percent must match its stage', 'payment_milestones_stage_plan_check',
    format('INSERT INTO payment_milestones (booking_id, sequence_no, stage, percent, amount_due_paise) VALUES (%s, 5, %L, 50, 100)', b1, 'HANDOVER'));
  PERFORM pg_temp.expect_frozen('milestones: update is blocked',
    format('UPDATE payment_milestones SET amount_due_paise = 1 WHERE id = %s', m1));

  -- ---------- Payments (the assignment example: 5,00,000 against Booking) ----------
  INSERT INTO payments (milestone_id, amount_paise, payment_date, payment_reference) VALUES (m1, 50000000, today_in_india, 'UTR1001');
  PERFORM pg_temp.expect_true('payments: Booking milestone balance is 17320000 paise (Rs 1,73,200)',
    (SELECT m.amount_due_paise - COALESCE(sum(p.amount_paise), 0)::bigint = 17320000
       FROM payment_milestones m LEFT JOIN payments p ON p.milestone_id = m.id WHERE m.id = m1 GROUP BY m.amount_due_paise));
  PERFORM pg_temp.expect_true('payments: overall outstanding is 623200000 paise (Rs 62,32,000)',
    (SELECT (SELECT sum(amount_due_paise) FROM payment_milestones WHERE booking_id = b1)::bigint
          - (SELECT COALESCE(sum(p.amount_paise), 0) FROM payments p JOIN payment_milestones m ON m.id = p.milestone_id WHERE m.booking_id = b1)::bigint
          = 623200000));

  PERFORM pg_temp.expect_constraint('payments: duplicate reference is rejected', 'payments_payment_reference_key',
    format('INSERT INTO payments (milestone_id, amount_paise, payment_date, payment_reference) VALUES (%s, 100, CURRENT_DATE, %L)', m1, 'UTR1001'));
  PERFORM pg_temp.expect_constraint('payments: lowercase reference is rejected', 'payments_payment_reference_format',
    format('INSERT INTO payments (milestone_id, amount_paise, payment_date, payment_reference) VALUES (%s, 100, CURRENT_DATE, %L)', m1, 'utr1002'));
  PERFORM pg_temp.expect_constraint('payments: blank reference is rejected', 'payments_payment_reference_format',
    format('INSERT INTO payments (milestone_id, amount_paise, payment_date, payment_reference) VALUES (%s, 100, CURRENT_DATE, %L)', m1, ''));
  PERFORM pg_temp.expect_constraint('payments: zero amount is rejected', 'payments_amount_positive',
    format('INSERT INTO payments (milestone_id, amount_paise, payment_date, payment_reference) VALUES (%s, 0, CURRENT_DATE, %L)', m1, 'UTR1003'));
  PERFORM pg_temp.expect_constraint('payments: negative amount is rejected', 'payments_amount_positive',
    format('INSERT INTO payments (milestone_id, amount_paise, payment_date, payment_reference) VALUES (%s, -100, CURRENT_DATE, %L)', m1, 'UTR1004'));
  PERFORM pg_temp.expect_frozen('payments: update is blocked',
    format('UPDATE payments SET amount_paise = 1 WHERE payment_reference = %L', 'UTR1001'));

  RAISE NOTICE 'ALL CHECKS PASSED';
END;
$$;
