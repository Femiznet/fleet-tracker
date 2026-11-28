DROP FUNCTION IF EXISTS manual_dispatch_action(UUID, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS manual_dispatch_action(UUID, TEXT);

CREATE OR REPLACE FUNCTION manual_dispatch_action(
  p_movement_id UUID,
  p_action TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_movement movements%ROWTYPE;
  v_customer_geofence VARCHAR;
  v_trip_status trip_status;
BEGIN
  SELECT * INTO v_movement
  FROM movements
  WHERE id = p_movement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movement not found';
  END IF;

  IF v_movement.type != 'dispatch' OR v_movement.status != 'in_progress' THEN
    RAISE EXCEPTION 'Manual actions require an in-progress dispatch';
  END IF;

  IF v_movement.tracking_mode != 'manual' THEN
    RAISE EXCEPTION 'Manual actions are only available for manual dispatches';
  END IF;

  SELECT geofence_name INTO v_customer_geofence
  FROM customers
  WHERE id = v_movement.customer_id;

  IF NOT FOUND OR v_customer_geofence IS NULL OR NOT EXISTS (
    SELECT 1
    FROM geofence_zones
    WHERE type = 'customer'
      AND UPPER(TRIM(geofence_name)) = UPPER(TRIM(v_customer_geofence))
  ) THEN
    RAISE EXCEPTION 'Dispatch customer must have a geofence classified as a customer';
  END IF;

  IF p_action = 'arrived_customer' THEN
    SELECT status INTO v_trip_status
    FROM trips
    WHERE movement_id = p_movement_id
      AND direction = 'outbound'
    FOR UPDATE;

    IF NOT FOUND OR v_trip_status != 'in_transit' THEN
      RAISE EXCEPTION 'Outbound trip is not in transit';
    END IF;

    UPDATE trips
    SET status = 'arrived',
        arrived = TRUE,
        arrived_at = COALESCE(arrived_at, NOW())
    WHERE movement_id = p_movement_id
      AND direction = 'outbound';

    PERFORM set_config('app.manual_dispatch_location_update', 'true', TRUE);

    UPDATE trucks
    SET current_loc = v_customer_geofence,
        status = 'at_customer'
    WHERE id = v_movement.truck_id;

    PERFORM set_config('app.manual_dispatch_location_update', 'false', TRUE);

    UPDATE skids
    SET current_loc = v_customer_geofence,
        status = 'at_customer'
    WHERE id = v_movement.skid_id_out;

  ELSIF p_action = 'returning' THEN
    SELECT status INTO v_trip_status
    FROM trips
    WHERE movement_id = p_movement_id
      AND direction = 'outbound'
    FOR UPDATE;

    IF NOT FOUND OR v_trip_status != 'arrived' THEN
      RAISE EXCEPTION 'Truck must arrive at the customer before starting the return trip';
    END IF;

    IF EXISTS (
      SELECT 1 FROM trips
      WHERE movement_id = p_movement_id
        AND direction = 'inbound'
    ) THEN
      RAISE EXCEPTION 'Return trip has already been started';
    END IF;

    INSERT INTO trips (
      movement_id,
      status,
      direction,
      origin,
      destination,
      arrived
    ) VALUES (
      p_movement_id,
      'in_transit',
      'inbound',
      v_customer_geofence,
      'GASTECH PLANT',
      FALSE
    );

    UPDATE trucks
    SET status = 'in_transit'
    WHERE id = v_movement.truck_id;

  ELSE
    RAISE EXCEPTION 'Unsupported manual dispatch action: %', p_action;
  END IF;
END;
$$;
