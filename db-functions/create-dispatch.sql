CREATE OR REPLACE FUNCTION create_dispatch(
  p_truck_id UUID,
  p_customer_id UUID,
  p_skid_id_out UUID,
  p_note TEXT DEFAULT NULL,
  p_force_override BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_truck_status truck_status;
  v_truck_loc VARCHAR;
  v_skid_status skid_status;
  v_skid_loc VARCHAR;
  v_customer_geofence VARCHAR;
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
    RAISE EXCEPTION 'Truck is not available for dispatch (Current status: %)', v_truck_status;
  END IF;

  IF NOT p_force_override AND v_truck_loc != 'GASTECH PLANT' THEN
    RAISE EXCEPTION 'Truck sensor location must be GASTECH PLANT to dispatch (Current location: %). Use manual override if sensor is inaccurate.', v_truck_loc;
  END IF;

  -- 2. Lock and validate the outgoing skid
  SELECT status, current_loc
  INTO v_skid_status, v_skid_loc
  FROM skids
  WHERE id = p_skid_id_out
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Outgoing skid not found';
  END IF;

  IF v_skid_status != 'available' THEN
    RAISE EXCEPTION 'Skid is not available for dispatch (Current status: %)', v_skid_status;
  END IF;

  IF NOT p_force_override AND v_skid_loc != 'GASTECH PLANT' THEN
    RAISE EXCEPTION 'Skid location must be GASTECH PLANT to dispatch (Current location: %)', v_skid_loc;
  END IF;

  -- 3. Fetch customer geofence for the outbound trip destination
  SELECT geofence_name INTO v_customer_geofence
  FROM customers
  WHERE id = p_customer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  -- 4. Tag the note if a sensor override was used
  v_final_note := p_note;
  IF p_force_override AND (v_truck_loc != 'GASTECH PLANT' OR v_skid_loc != 'GASTECH PLANT') THEN
    v_final_note := TRIM(COALESCE(p_note, '') || ' [Manual Sensor Override]');
  END IF;

  -- 5. Create the parent movement record
  INSERT INTO movements (
    type,
    status,
    truck_id,
    customer_id,
    skid_id_out,
    note
  ) VALUES (
    'dispatch',
    'in_progress',
    p_truck_id,
    p_customer_id,
    p_skid_id_out,
    NULLIF(v_final_note, '')
  )
  RETURNING id INTO v_movement_id;

  -- 6. Automatically create the 'outbound' trip leg
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
    'outbound',
    'GASTECH PLANT',
    COALESCE(v_customer_geofence, 'CUSTOMER SITE'),
    FALSE
  );

  -- 7. Update truck and outgoing skid statuses to 'in_transit'
  UPDATE trucks
  SET status = 'in_transit'
  WHERE id = p_truck_id;

  UPDATE skids
  SET status = 'in_transit',
      current_loc = v_truck_loc
  WHERE id = p_skid_id_out;

  RETURN v_movement_id;
END;
$$;
