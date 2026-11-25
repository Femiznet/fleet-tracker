CREATE OR REPLACE FUNCTION handle_truck_location_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_movement_id UUID;
  v_movement_type movement_type;
  v_tracking_mode tracking_mode;
  v_active_skid_id UUID;
  v_customer_geofence VARCHAR;
BEGIN
  IF TRIM(NEW.current_loc) IS DISTINCT FROM TRIM(OLD.current_loc) THEN

    -- Find the active dispatch or pickup movement
    SELECT m.id, m.type, m.tracking_mode, COALESCE(m.skid_id_out, m.skid_id_in), c.geofence_name
    INTO v_movement_id, v_movement_type, v_tracking_mode, v_active_skid_id, v_customer_geofence
    FROM movements m
    JOIN customers c ON c.id = m.customer_id
    WHERE m.truck_id = NEW.id
      AND m.type IN ('dispatch', 'pickup')
      AND m.status = 'in_progress'
    LIMIT 1;

    IF FOUND AND v_tracking_mode = 'manual' THEN
      IF current_setting('app.manual_dispatch_location_update', TRUE) IS DISTINCT FROM 'true' THEN
        NEW.current_loc := OLD.current_loc;
      END IF;
      RETURN NEW;
    END IF;

    IF FOUND AND NEW.status IN ('in_transit', 'at_customer') THEN
      -- Outbound arrival & inbound creation only apply to full roundtrip dispatches
      IF v_movement_type = 'dispatch' THEN
        IF TRIM(NEW.current_loc) = TRIM(v_customer_geofence) THEN
          NEW.status := 'at_customer';

          UPDATE trips
          SET status = 'arrived',
              arrived = TRUE,
              arrived_at = COALESCE(arrived_at, NOW())
          WHERE movement_id = v_movement_id
            AND direction = 'outbound'
            AND status = 'in_transit';

        ELSIF OLD.status = 'at_customer' AND TRIM(NEW.current_loc) != TRIM(v_customer_geofence) THEN
          NEW.status := 'in_transit';

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
            v_customer_geofence,
            'GASTECH PLANT',
            FALSE
          )
          ON CONFLICT (movement_id, direction) DO NOTHING;
        END IF;
      END IF;

      -- Inbound arrival at GASTECH PLANT applies to BOTH 'dispatch' and 'pickup'
      IF TRIM(NEW.current_loc) = 'GASTECH PLANT' THEN
        UPDATE trips
        SET status = 'arrived',
            arrived = TRUE,
            arrived_at = COALESCE(arrived_at, NOW())
        WHERE movement_id = v_movement_id
          AND direction = 'inbound'
          AND status = 'in_transit';
      END IF;

      -- Record an outbound dispatch arrival on both the truck and its skid.
      IF v_active_skid_id IS NOT NULL THEN
        IF v_movement_type = 'dispatch'
          AND TRIM(NEW.current_loc) = TRIM(v_customer_geofence)
        THEN
          UPDATE skids
          SET current_loc = NEW.current_loc,
              status = 'at_customer'
          WHERE id = v_active_skid_id
            AND status = 'in_transit';
        ELSE
          UPDATE skids
          SET current_loc = NEW.current_loc
          WHERE id = v_active_skid_id
            AND status = 'in_transit';
        END IF;
      END IF;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;


-- Attach the trigger to the trucks table
DROP TRIGGER IF EXISTS trg_truck_location_update ON trucks;

CREATE TRIGGER trg_truck_location_update
BEFORE UPDATE OF current_loc ON trucks
FOR EACH ROW
EXECUTE FUNCTION handle_truck_location_update();
