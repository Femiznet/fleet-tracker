CREATE OR REPLACE FUNCTION handle_truck_location_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_skid_id_out UUID;
  v_customer_geofence VARCHAR;
BEGIN
  -- Only run when current_loc actually changes AND the truck is on an active trip
  IF NEW.current_loc IS DISTINCT FROM OLD.current_loc
     AND NEW.status IN ('in_transit', 'at_customer') THEN

    -- 1. Find the active dispatch movement and the customer's geofence name
    SELECT m.skid_id_out, c.geofence_name
    INTO v_skid_id_out, v_customer_geofence
    FROM movements m
    JOIN customers c ON c.id = m.customer_id
    WHERE m.truck_id = NEW.id
      AND m.type = 'dispatch'
      AND m.status = 'in_progress'
    LIMIT 1;

    -- 2. If an active dispatch exists, apply auto-status and skid sync
    IF FOUND THEN
      -- Check if truck arrived at the customer's geofence
      IF NEW.current_loc = v_customer_geofence THEN
        NEW.status := 'at_customer';
      -- If it was 'at_customer' and just left the geofence, switch back to 'in_transit'
      ELSIF OLD.status = 'at_customer' AND NEW.current_loc != v_customer_geofence THEN
        NEW.status := 'in_transit';
      END IF;

      -- Sync the outgoing skid's location to match the truck's live location
      -- (Only while the skid is still marked 'in_transit')
      IF v_skid_id_out IS NOT NULL THEN
        UPDATE skids
        SET current_loc = NEW.current_loc
        WHERE id = v_skid_id_out
          AND status = 'in_transit';
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
