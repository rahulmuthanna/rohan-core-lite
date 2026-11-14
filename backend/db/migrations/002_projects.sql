-- 002: projects (e.g. Rohan Nest). One project has many units.

CREATE TABLE projects (
  id         bigint GENERATED ALWAYS AS IDENTITY,
  name       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT projects_pkey           PRIMARY KEY (id),
  CONSTRAINT projects_name_key       UNIQUE (name),
  CONSTRAINT projects_name_not_blank CHECK (btrim(name) <> '')
);
