DROP FUNCTION IF EXISTS create_dispatch(UUID, UUID, UUID, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS create_dispatch(UUID, UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION create_dispatch(
  p_truck_id UUID,
  p_customer_id UUID,
  p_skid_id_out UUID,
  p_note TEXT DEFAULT NULL,
  p_tracking_mode tracking_mode DEFAULT 'live'
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_truck_status truck_status;
  v_truck_loc VARCHAR;
  v_skid_status skid_status;
  v_skid_state skid_state;
  v_skid_loc VARCHAR;
  v_skid_customer_id UUID;
  v_customer_geofence VARCHAR;
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

  -- 2. Lock and validate the outgoing skid
  SELECT status, state, current_loc, customer_id
  INTO v_skid_status, v_skid_state, v_skid_loc, v_skid_customer_id
  FROM skids
  WHERE id = p_skid_id_out
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Outgoing skid not found';
  END IF;

  IF v_skid_customer_id IS NOT NULL THEN
    RAISE EXCEPTION 'Customer-owned skids are not eligible for company dispatch';
  END IF;

  -- 3. Prevent reuse of a truck or skid in another active dispatch
  IF EXISTS (
    SELECT 1
    FROM movements
    WHERE status = 'in_progress'
      AND type = 'dispatch'
      AND (
        truck_id = p_truck_id
        OR skid_id_out = p_skid_id_out
        OR skid_id_in = p_skid_id_out
      )
  ) THEN
    RAISE EXCEPTION 'Truck or skid is already assigned to an active dispatch';
  END IF;

  IF v_truck_status = 'maintenance' THEN
    RAISE EXCEPTION 'Truck is in maintenance';
  END IF;

  IF p_tracking_mode = 'live' AND NOT EXISTS (
    SELECT 1
    FROM geofence_zones
    WHERE type = 'plant'
      AND UPPER(TRIM(geofence_name)) = UPPER(TRIM(v_truck_loc))
  ) THEN
    RAISE EXCEPTION 'Truck must be at a geofence classified as a plant for live tracking (Current location: %)', v_truck_loc;
  END IF;

  IF v_skid_status = 'maintenance' THEN
    RAISE EXCEPTION 'Skid is in maintenance';
  END IF;

  IF v_skid_state != 'loaded' THEN
    RAISE EXCEPTION 'Skid must be loaded before dispatch (Current state: %)', v_skid_state;
  END IF;

  IF p_tracking_mode = 'live' AND NOT EXISTS (
    SELECT 1
    FROM geofence_zones
    WHERE type = 'plant'
      AND UPPER(TRIM(geofence_name)) = UPPER(TRIM(v_skid_loc))
  ) THEN
    RAISE EXCEPTION 'Skid must be at a geofence classified as a plant for live tracking (Current location: %)', v_skid_loc;
  END IF;

  -- 4. Fetch and validate the customer geofence for the outbound destination
  SELECT geofence_name INTO v_customer_geofence
  FROM customers
  WHERE id = p_customer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  IF v_customer_geofence IS NULL OR NOT EXISTS (
    SELECT 1
    FROM geofence_zones
    WHERE type = 'customer'
      AND UPPER(TRIM(geofence_name)) = UPPER(TRIM(v_customer_geofence))
  ) THEN
    RAISE EXCEPTION 'Customer geofence must be classified as a customer geofence';
  END IF;

  -- 5. Create the parent movement record
  INSERT INTO movements (
    type,
    status,
    tracking_mode,
    truck_id,
    customer_id,
    skid_id_out,
    note
  ) VALUES (
    'dispatch',
    'in_progress',
    p_tracking_mode,
    p_truck_id,
    p_customer_id,
    p_skid_id_out,
    NULLIF(p_note, '')
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

  IF p_tracking_mode = 'live' THEN
    UPDATE skids
    SET status = 'in_transit',
        current_loc = v_truck_loc
    WHERE id = p_skid_id_out;
  ELSE
    UPDATE skids
    SET status = 'in_transit'
    WHERE id = p_skid_id_out;
  END IF;

  RETURN v_movement_id;
END;
$$;
