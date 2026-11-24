DROP FUNCTION IF EXISTS switch_dispatch_tracking_mode(UUID, tracking_mode);

CREATE OR REPLACE FUNCTION switch_dispatch_tracking_mode(
  p_movement_id UUID,
  p_tracking_mode tracking_mode
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_movement movements%ROWTYPE;
  v_truck_loc VARCHAR;
  v_customer_geofence VARCHAR;
BEGIN
  SELECT * INTO v_movement
  FROM movements
  WHERE id = p_movement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movement not found';
  END IF;

  IF v_movement.type != 'dispatch' OR v_movement.status != 'in_progress' THEN
    RAISE EXCEPTION 'Tracking mode can only be changed on an in-progress dispatch';
  END IF;

  IF v_movement.tracking_mode = p_tracking_mode THEN
    RETURN;
  END IF;

  SELECT current_loc INTO v_truck_loc
  FROM trucks
  WHERE id = v_movement.truck_id
  FOR UPDATE;

  IF p_tracking_mode = 'live' THEN
    SELECT geofence_name INTO v_customer_geofence
    FROM customers
    WHERE id = v_movement.customer_id;

    IF EXISTS (
      SELECT 1
      FROM trips
      WHERE movement_id = p_movement_id
        AND direction = 'outbound'
        AND status = 'in_transit'
    ) AND UPPER(TRIM(v_truck_loc)) = UPPER(TRIM(v_customer_geofence)) THEN
      RAISE EXCEPTION 'Record the customer arrival manually before switching to live tracking';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM trips
      WHERE movement_id = p_movement_id
        AND direction = 'inbound'
        AND status = 'in_transit'
    ) AND UPPER(TRIM(v_truck_loc)) = 'GASTECH PLANT' THEN
      RAISE EXCEPTION 'Record the plant arrival manually before switching to live tracking';
    END IF;
  END IF;

  UPDATE movements
  SET tracking_mode = p_tracking_mode
  WHERE id = p_movement_id;
END;
$$;
