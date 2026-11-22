CREATE OR REPLACE FUNCTION create_pickup(
  p_truck_id UUID,
  p_customer_id UUID,
  p_skid_id_in UUID DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_force_override BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_truck_status truck_status;
  v_truck_loc VARCHAR;
  v_customer_geofence VARCHAR;
  v_skid_status skid_status;
  v_skid_loc VARCHAR;
  v_track_skid_location BOOLEAN;
  v_final_note TEXT;
  v_movement_id UUID;
BEGIN
  -- 1. Lock and validate the truck
  SELECT status, current_loc
  INTO v_truck_status, v_truck_loc
  FROM trucks
  WHERE id = p_truck_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Truck not found';
  END IF;

  IF v_truck_status != 'available' THEN
    RAISE EXCEPTION 'Truck is not available for pickup (Current status: %)', v_truck_status;
  END IF;

  -- 2. Fetch customer geofence
  SELECT geofence_name INTO v_customer_geofence
  FROM customers
  WHERE id = p_customer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  IF NOT p_force_override AND TRIM(v_truck_loc) != TRIM(v_customer_geofence) THEN
    RAISE EXCEPTION 'Truck sensor location (%) does not match customer site (%). Use manual override if sensor is inaccurate.', v_truck_loc, v_customer_geofence;
  END IF;

  -- 3. Validate skid_id_in if already known at pickup time
  IF p_skid_id_in IS NOT NULL THEN
    SELECT status, current_loc, owner != 'customer' AND customer_id IS NULL
    INTO v_skid_status, v_skid_loc, v_track_skid_location
    FROM skids
    WHERE id = p_skid_id_in
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Pickup skid not found';
    END IF;

    IF v_skid_status != 'at_customer' THEN
      RAISE EXCEPTION 'Skid must be at a customer site for pickup (Current status: %)', v_skid_status;
    END IF;

    IF v_track_skid_location AND NOT p_force_override AND TRIM(v_skid_loc) != TRIM(v_customer_geofence) THEN
      RAISE EXCEPTION 'Skid is recorded at %, not at this customer (%)', v_skid_loc, v_customer_geofence;
    END IF;
  END IF;

  -- 4. Tag note if sensor override was used
  v_final_note := p_note;
  IF p_force_override AND TRIM(v_truck_loc) != TRIM(v_customer_geofence) THEN
    v_final_note := TRIM(COALESCE(p_note, '') || ' [Manual Pickup Sensor Override]');
  END IF;

  -- 5. Create the 'pickup' movement
  INSERT INTO movements (
    type,
    status,
    truck_id,
    customer_id,
    skid_id_in,
    note
  ) VALUES (
    'pickup',
    'in_progress',
    p_truck_id,
    p_customer_id,
    p_skid_id_in,
    NULLIF(v_final_note, '')
  )
  RETURNING id INTO v_movement_id;

  -- 6. Create the 'inbound' trip leg directly
  INSERT INTO trips (
    movement_id,
    status,
    direction,
    origin,
    destination,
    arrived
  ) VALUES (
    v_movement_id,
    'in_transit',
    'inbound',
    COALESCE(v_customer_geofence, 'CUSTOMER SITE'),
    'GASTECH PLANT',
    FALSE
  );

  -- 7. Mark truck (and skid, if provided) as 'in_transit'
  UPDATE trucks
  SET status = 'in_transit'
  WHERE id = p_truck_id;

  IF p_skid_id_in IS NOT NULL THEN
    IF v_track_skid_location THEN
      UPDATE skids
      SET status = 'in_transit',
          current_loc = v_truck_loc
      WHERE id = p_skid_id_in;
    ELSE
      UPDATE skids
      SET status = 'in_transit'
      WHERE id = p_skid_id_in;
    END IF;
  END IF;

  RETURN v_movement_id;
END;
$$;
