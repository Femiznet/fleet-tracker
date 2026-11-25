BEGIN;

INSERT INTO skids (
  skid_num,
  current_loc,
  status,
  state
) VALUES
  -- Loaded at the plant: eligible for live dispatch tests.
  ('0000', 'GASTECH PLANT', 'available', 'loaded'),
  ('0001', 'GASTECH PLANT', 'available', 'loaded'),
  -- Loaded offsite: use for manual dispatch tests.
  ('0002', 'TEST YARD', 'available', 'loaded'),
  -- Ineligible variants for dispatch validation tests.
  ('0003', 'GASTECH PLANT', 'available', 'empty'),
  ('0004', 'GASTECH PLANT', 'available', 'loading'),
  ('0005', 'GASTECH PLANT', 'maintenance', 'loaded')
ON CONFLICT (skid_num) DO NOTHING;

SELECT skid_num, current_loc, status, state
FROM skids
WHERE skid_num IN ('0000', '0001', '0002', '0003', '0004', '0005')
ORDER BY skid_num;

COMMIT;
