BEGIN;

INSERT INTO skids (
  skid_num,
  current_loc,
  status,
  fill_state,
  bay_state
) VALUES
  -- Loaded at the plant: eligible for live dispatch tests.
  ('0000', 'GASTECH PLANT', 'available', 'loaded', 'idle'),
  ('0001', 'GASTECH PLANT', 'available', 'loaded', 'idle'),
  -- Loaded offsite: use for manual dispatch tests.
  ('0002', 'TEST YARD', 'available', 'loaded', 'idle'),
  -- Ineligible variants for dispatch validation tests.
  ('0003', 'GASTECH PLANT', 'available', 'empty', 'idle'),
  ('0004', 'GASTECH PLANT', 'available', 'loading', 'idle'),
  ('0005', 'GASTECH PLANT', 'maintenance', 'loaded', 'idle')
ON CONFLICT (skid_num) DO NOTHING;

SELECT skid_num, current_loc, status, fill_state, bay_state
FROM skids
WHERE skid_num IN ('0000', '0001', '0002', '0003', '0004', '0005')
ORDER BY skid_num;

COMMIT;
