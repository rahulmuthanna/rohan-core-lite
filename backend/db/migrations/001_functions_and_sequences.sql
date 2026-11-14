-- 001: shared helper functions and document-number counters.
-- Everything here is used by the table migrations that follow.

-- Counters behind the human-readable document numbers.
CREATE SEQUENCE cost_sheet_number_seq AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE quotation_number_seq  AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE booking_number_seq    AS bigint START WITH 1 INCREMENT BY 1;

-- Builds numbers such as CS-2026-0001. The year is the current year in India.
-- Numbers are unique but not gapless (a rolled-back transaction skips a number).
CREATE FUNCTION next_document_number(prefix text, counter regclass)
RETURNS text
LANGUAGE sql
VOLATILE
AS $$
  SELECT prefix
         || '-' || to_char(now() AT TIME ZONE 'Asia/Kolkata', 'YYYY')
         || '-' || CASE WHEN s.n < 10000 THEN lpad(s.n::text, 4, '0') ELSE s.n::text END
  FROM (SELECT nextval(counter) AS n) AS s;
$$;

-- Keeps updated_at correct no matter which code path changes the row.
CREATE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Makes a table's rows frozen: any UPDATE fails.
CREATE FUNCTION forbid_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Rows in table "%" are frozen and cannot be updated', TG_TABLE_NAME;
END;
$$;
