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

  SELECT current_loc INTO v_truck_loc
  FROM trucks
  WHERE id = v_movement.truck_id
  FOR UPDATE;

  UPDATE movements
  SET status = 'cancelled',
      note = COALESCE(NULLIF(TRIM(p_note), ''), note)
  WHERE id = p_movement_id;

  UPDATE trips
  SET status = 'cancelled'
  WHERE movement_id = p_movement_id
    AND status = 'in_transit';

  UPDATE trucks
  SET status = 'available'
  WHERE id = v_movement.truck_id;

  -- If dispatch was cancelled, reset outgoing skid to available at truck's location
  IF v_movement.type = 'dispatch' AND v_movement.skid_id_out IS NOT NULL THEN
    UPDATE skids
    SET status = 'available',
        current_loc = v_truck_loc
    WHERE id = v_movement.skid_id_out;
  END IF;

  -- If pickup was cancelled, return the skid back to 'at_customer' status
  IF v_movement.type = 'pickup' AND v_movement.skid_id_in IS NOT NULL THEN
    UPDATE skids
    SET status = 'at_customer',
        current_loc = v_truck_loc
    WHERE id = v_movement.skid_id_in;
  END IF;
END;
$$;
