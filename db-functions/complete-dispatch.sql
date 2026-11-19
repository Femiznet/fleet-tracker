CREATE OR REPLACE FUNCTION complete_dispatch(
  p_movement_id UUID,
  p_skid_id_in UUID DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_force_override BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_movement movements%ROWTYPE;
  v_truck_loc VARCHAR;
  v_customer_geofence VARCHAR;
  v_skid_in_status skid_status;
  v_skid_in_loc VARCHAR;
  v_final_note TEXT;
BEGIN
  -- 1. Lock and fetch the movement
  SELECT * INTO v_movement
  FROM movements
  WHERE id = p_movement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movement not found';
  END IF;

  IF v_movement.type != 'dispatch' THEN
    RAISE EXCEPTION 'This function only completes dispatch movements';
  END IF;

  IF v_movement.status != 'in_progress' THEN
    RAISE EXCEPTION 'Movement is already %', v_movement.status;
  END IF;

  -- 2. Enforce Rule 2: Must have skid_id_in OR a non-empty note
  v_final_note := COALESCE(NULLIF(TRIM(p_note), ''), v_movement.note);

  IF p_skid_id_in IS NULL AND (v_final_note IS NULL OR TRIM(v_final_note) = '') THEN
    RAISE EXCEPTION 'A returned skid (skid_id_in) or a completion note is required';
  END IF;

  -- 3. Check if truck is physically back at GASTECH PLANT (unless overridden)
  SELECT current_loc INTO v_truck_loc
  FROM trucks
  WHERE id = v_movement.truck_id
  FOR UPDATE;

  IF NOT p_force_override AND v_truck_loc != 'GASTECH PLANT' THEN
    RAISE EXCEPTION 'Truck sensor location is currently %. Confirm truck is at GASTECH PLANT or use manual override.', v_truck_loc;
  END IF;

  IF p_force_override AND v_truck_loc != 'GASTECH PLANT' THEN
    v_final_note := TRIM(COALESCE(v_final_note, '') || ' [Manual Completion Override]');
  END IF;

  -- 4. Fetch the customer's geofence name
  SELECT geofence_name INTO v_customer_geofence
  FROM customers
  WHERE id = v_movement.customer_id;

  -- 5. Validate skid_id_in (if provided and different from skid_id_out)
  IF p_skid_id_in IS NOT NULL AND p_skid_id_in != v_movement.skid_id_out THEN
    SELECT status, current_loc
    INTO v_skid_in_status, v_skid_in_loc
    FROM skids
    WHERE id = p_skid_id_in
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Returned skid not found';
    END IF;

    IF v_skid_in_status != 'at_customer' THEN
      RAISE EXCEPTION 'Returned skid must be at a customer site (Current status: %, Location: %)', v_skid_in_status, v_skid_in_loc;
    END IF;

    -- Optional strict check: ensure the skid was actually at THIS customer's site
    IF NOT p_force_override AND v_skid_in_loc != v_customer_geofence THEN
      RAISE EXCEPTION 'Returned skid is recorded at %, not at this customer (%). Use manual override if transferred.', v_skid_in_loc, v_customer_geofence;
    END IF;
  END IF;

  -- 6. Update Skid Locations & Statuses
  IF p_skid_id_in IS NOT NULL AND p_skid_id_in = v_movement.skid_id_out THEN
    -- Scenario A: Truck returned with the exact same skid it left with
    UPDATE skids
    SET status = 'available',
        current_loc = 'GASTECH PLANT'
    WHERE id = v_movement.skid_id_out;
  ELSE
    -- Scenario B: Outgoing skid was dropped off at the customer
    UPDATE skids
    SET status = 'at_customer',
        current_loc = COALESCE(v_customer_geofence, 'AT CUSTOMER')
    WHERE id = v_movement.skid_id_out;

    -- Mark the returned skid available at GASTECH PLANT
    IF p_skid_id_in IS NOT NULL THEN
      UPDATE skids
      SET status = 'available',
          current_loc = 'GASTECH PLANT'
      WHERE id = p_skid_id_in;
    END IF;
  END IF;

  -- 7. Mark movement as completed and reset truck to available
  UPDATE movements
  SET status = 'completed',
      skid_id_in = p_skid_id_in,
      note = NULLIF(v_final_note, '')
  WHERE id = p_movement_id;

  UPDATE trucks
  SET status = 'available'
  WHERE id = v_movement.truck_id;
END;
$$;
