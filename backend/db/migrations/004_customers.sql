-- 004: customers (buyers). Mobile is the unique identity of a customer.

CREATE TABLE customers (
  id         bigint GENERATED ALWAYS AS IDENTITY,
  full_name  text        NOT NULL,
  mobile     text        NOT NULL,
  email      text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT customers_pkey             PRIMARY KEY (id),
  CONSTRAINT customers_mobile_key       UNIQUE (mobile),
  CONSTRAINT customers_full_name_length CHECK (full_name = btrim(full_name) AND char_length(full_name) BETWEEN 2 AND 100),
  CONSTRAINT customers_mobile_format    CHECK (mobile ~ '^[0-9]{10}$'),
  CONSTRAINT customers_email_format     CHECK (
    email = lower(btrim(email))
    AND char_length(email) <= 254
    AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  )
);

CREATE TRIGGER customers_set_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
