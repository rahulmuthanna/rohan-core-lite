-- 003: units (one flat, e.g. RN-101). Money is stored in whole paise.

CREATE TABLE units (
  id                 bigint GENERATED ALWAYS AS IDENTITY,
  project_id         bigint      NOT NULL,
  unit_code          text        NOT NULL,
  unit_type          text        NOT NULL,
  area_sqft          integer     NOT NULL,
  listed_price_paise bigint      NOT NULL,
  status             text        NOT NULL DEFAULT 'AVAILABLE',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT units_pkey                  PRIMARY KEY (id),
  CONSTRAINT units_project_id_fkey       FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE RESTRICT,
  CONSTRAINT units_unit_code_key         UNIQUE (unit_code),
  CONSTRAINT units_unit_code_not_blank   CHECK (btrim(unit_code) <> ''),
  CONSTRAINT units_unit_type_check       CHECK (unit_type IN ('1 BHK', '2 BHK', '3 BHK')),
  CONSTRAINT units_area_sqft_positive    CHECK (area_sqft > 0),
  CONSTRAINT units_listed_price_positive CHECK (listed_price_paise > 0),
  CONSTRAINT units_status_check          CHECK (status IN ('AVAILABLE', 'BOOKED', 'SOLD'))
);

CREATE INDEX units_project_id_idx ON units (project_id);
CREATE INDEX units_status_idx     ON units (status);

CREATE TRIGGER units_set_updated_at
  BEFORE UPDATE ON units
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
