-- Seed data: 4 projects and 12 units from the assignment.
-- Safe to run many times: existing rows are left untouched.

INSERT INTO projects (name) VALUES
  ('Rohan Nest'),
  ('Rohan City'),
  ('Rohan Park'),
  ('Rohan Estate')
ON CONFLICT (name) DO NOTHING;

INSERT INTO units (project_id, unit_code, unit_type, area_sqft, listed_price_paise)
SELECT p.id, v.unit_code, v.unit_type, v.area_sqft, v.listed_price_paise
FROM (VALUES
  ('Rohan Nest',   'RN-101', '2 BHK', 1100,  680000000::bigint),
  ('Rohan Nest',   'RN-201', '3 BHK', 1450,  880000000::bigint),
  ('Rohan Nest',   'RN-301', '3 BHK', 1500,  920000000::bigint),
  ('Rohan City',   'RC-101', '1 BHK',  750,  450000000::bigint),
  ('Rohan City',   'RC-202', '2 BHK', 1150,  660000000::bigint),
  ('Rohan City',   'RC-303', '3 BHK', 1520,  910000000::bigint),
  ('Rohan Park',   'RP-102', '2 BHK', 1200,  750000000::bigint),
  ('Rohan Park',   'RP-204', '3 BHK', 1550,  980000000::bigint),
  ('Rohan Park',   'RP-305', '3 BHK', 1650, 1060000000::bigint),
  ('Rohan Estate', 'RE-101', '2 BHK', 1180,  790000000::bigint),
  ('Rohan Estate', 'RE-202', '3 BHK', 1500, 1020000000::bigint),
  ('Rohan Estate', 'RE-304', '3 BHK', 1750, 1160000000::bigint)
) AS v (project_name, unit_code, unit_type, area_sqft, listed_price_paise)
JOIN projects p ON p.name = v.project_name
ON CONFLICT (unit_code) DO NOTHING;
