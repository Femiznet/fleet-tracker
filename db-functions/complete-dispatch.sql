DROP FUNCTION IF EXISTS complete_dispatch(UUID, UUID, TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION complete_dispatch(
  p_movement_id UUID,
  p_skid_id_in UUID DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_movement movements%ROWTYPE;
  v_truck_loc VARCHAR;
  v_customer_geofence VARCHAR;
  v_skid_in_id UUID;
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

  IF v_movement.type NOT IN ('dispatch', 'pickup') THEN
    RAISE EXCEPTION 'This function only completes dispatch or pickup movements';
  END IF;

  IF v_movement.status != 'in_progress' THEN
    RAISE EXCEPTION 'Movement is already %', v_movement.status;
  END IF;

  -- Use newly passed skid_id_in, or fallback to one already set on create_pickup
  v_skid_in_id := COALESCE(p_skid_id_in, v_movement.skid_id_in);
  v_final_note := COALESCE(NULLIF(TRIM(p_note), ''), v_movement.note);

  -- 2. Enforce Rule 2: Must have skid_id_in OR a non-empty note
  IF v_skid_in_id IS NULL AND (v_final_note IS NULL OR TRIM(v_final_note) = '') THEN
    RAISE EXCEPTION 'A returned skid (skid_id_in) or a completion note is required';
  END IF;

  -- 3. Check if truck is physically back at GASTECH PLANT
  SELECT current_loc INTO v_truck_loc
  FROM trucks
  WHERE id = v_movement.truck_id
  FOR UPDATE;

  IF TRIM(v_truck_loc) != 'GASTECH PLANT' THEN
    RAISE EXCEPTION 'Truck must be at GASTECH PLANT to complete this movement (Current location: %)', v_truck_loc;
  END IF;

  -- 3B. For full roundtrip dispatches, require an inbound trip that has arrived
  IF v_movement.type = 'dispatch' THEN
    IF NOT EXISTS (
      SELECT 1 FROM trips
      WHERE movement_id = p_movement_id
        AND direction = 'inbound'
        AND status = 'arrived'
    ) THEN
      RAISE EXCEPTION 'Return trip has not arrived at GASTECH PLANT';
    END IF;
  END IF;

  -- 4. Fetch the customer's geofence name
  SELECT geofence_name INTO v_customer_geofence
  FROM customers
  WHERE id = v_movement.customer_id;

  -- 5. Validate skid_id_in (if provided and different from skid_id_out)
  IF v_skid_in_id IS NOT NULL AND (v_movement.skid_id_out IS NULL OR v_skid_in_id != v_movement.skid_id_out) THEN
    SELECT status, current_loc
    INTO v_skid_in_status, v_skid_in_loc
    FROM skids
    WHERE id = v_skid_in_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Returned skid not found';
    END IF;

    IF v_movement.type = 'dispatch' THEN
      -- For a roundtrip dispatch, a swapped return skid MUST be 'at_customer'
      IF v_skid_in_status != 'at_customer' THEN
        RAISE EXCEPTION 'Returned skid must be at a customer site (Current status: %, Location: %)', v_skid_in_status, v_skid_in_loc;
      END IF;
    ELSE
      -- For a pickup, allow 'at_customer' OR 'in_transit' (only if already attached to this pickup)
      IF v_skid_in_status NOT IN ('at_customer', 'in_transit') THEN
        RAISE EXCEPTION 'Returned skid must be at a customer site or in transit on this pickup (Current status: %, Location: %)', v_skid_in_status, v_skid_in_loc;
      END IF;

      IF v_skid_in_status = 'in_transit' AND v_movement.skid_id_in IS DISTINCT FROM v_skid_in_id THEN
        RAISE EXCEPTION 'Returned skid is currently in transit on another movement';
      END IF;
    END IF;

    IF v_skid_in_status = 'at_customer' AND TRIM(v_skid_in_loc) != TRIM(v_customer_geofence) THEN
      RAISE EXCEPTION 'Returned skid is recorded at %, not at this customer (%)', v_skid_in_loc, v_customer_geofence;
    END IF;
  END IF;


  -- 6. Update Skid Locations & Statuses
  IF v_movement.type = 'dispatch' THEN
    IF v_skid_in_id IS NOT NULL AND v_skid_in_id = v_movement.skid_id_out THEN
      UPDATE skids
      SET status = 'available',
          current_loc = 'GASTECH PLANT'
      WHERE id = v_movement.skid_id_out;
    ELSE
      UPDATE skids
      SET status = 'at_customer',
          current_loc = COALESCE(v_customer_geofence, 'AT CUSTOMER')
      WHERE id = v_movement.skid_id_out;

      IF v_skid_in_id IS NOT NULL THEN
        UPDATE skids
        SET status = 'available',
            current_loc = 'GASTECH PLANT'
        WHERE id = v_skid_in_id;
      END IF;
    END IF;
  ELSE
    -- Movement type is 'pickup': mark the picked-up skid available at GASTECH PLANT
    IF v_skid_in_id IS NOT NULL THEN
      UPDATE skids
      SET status = 'available',
          current_loc = 'GASTECH PLANT'
      WHERE id = v_skid_in_id;
    END IF;
  END IF;

  IF v_skid_in_id IS NOT NULL THEN
    UPDATE skids
    SET fill_state = 'empty'
    WHERE id = v_skid_in_id;
  END IF;

  -- 7. Close out any remaining in_transit trip legs
  UPDATE trips
  SET status = 'arrived',
      arrived = TRUE
  WHERE movement_id = p_movement_id
    AND status = 'in_transit';

  -- 8. Mark movement as completed and reset truck to available
  UPDATE movements
  SET status = 'completed',
      skid_id_in = v_skid_in_id,
      note = NULLIF(v_final_note, '')
  WHERE id = p_movement_id;

  UPDATE trucks
  SET status = 'available'
  WHERE id = v_movement.truck_id;
END;
$$;

