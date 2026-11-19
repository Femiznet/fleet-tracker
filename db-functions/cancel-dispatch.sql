CREATE OR REPLACE FUNCTION cancel_dispatch(
  p_movement_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_movement movements%ROWTYPE;
  v_truck_loc VARCHAR;
BEGIN
  -- 1. Lock and fetch the movement
  SELECT * INTO v_movement
  FROM movements
  WHERE id = p_movement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movement not found';
  END IF;

  IF v_movement.status != 'in_progress' THEN
    RAISE EXCEPTION 'Only in_progress movements can be cancelled (Current status: %)', v_movement.status;
  END IF;

  -- 2. Get truck's current location so the skid reflects where it actually is
  SELECT current_loc INTO v_truck_loc
  FROM trucks
  WHERE id = v_movement.truck_id
  FOR UPDATE;

  -- 3. Mark movement as cancelled
  UPDATE movements
  SET status = 'cancelled',
      note = COALESCE(NULLIF(TRIM(p_note), ''), note)
  WHERE id = p_movement_id;

  -- 4. Reset truck and outgoing skid back to available
  UPDATE trucks
  SET status = 'available'
  WHERE id = v_movement.truck_id;

  IF v_movement.skid_id_out IS NOT NULL THEN
    UPDATE skids
    SET status = 'available',
        current_loc = v_truck_loc
    WHERE id = v_movement.skid_id_out;
  END IF;
END;
$$;
