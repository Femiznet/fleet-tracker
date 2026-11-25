CREATE TYPE "public"."skid_state" AS ENUM('empty', 'loading', 'loaded', 'on_hold');--> statement-breakpoint
DROP FUNCTION IF EXISTS create_dispatch(UUID, UUID, UUID, TEXT, BOOLEAN);--> statement-breakpoint
DROP FUNCTION IF EXISTS create_dispatch(UUID, UUID, UUID, TEXT);--> statement-breakpoint
DROP FUNCTION IF EXISTS create_dispatch(UUID, UUID, UUID, TEXT, tracking_mode);--> statement-breakpoint
DROP FUNCTION IF EXISTS complete_dispatch(UUID, UUID, TEXT, BOOLEAN);--> statement-breakpoint
DROP FUNCTION IF EXISTS complete_dispatch(UUID, UUID, TEXT);--> statement-breakpoint
ALTER TABLE "public"."skids" ADD COLUMN "state" "public"."skid_state" DEFAULT 'empty' NOT NULL;--> statement-breakpoint
ALTER TABLE "public"."skids" ADD COLUMN "is_for_washing" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "public"."skids"
SET
  "state" = CASE
    WHEN "bay_state" = 'on_hold' THEN 'on_hold'::"public"."skid_state"
    ELSE "fill_state"::text::"public"."skid_state"
  END,
  "is_for_washing" = (
    "bay_state" = 'washing'
    AND "fill_state" IN ('empty', 'loaded')
  );--> statement-breakpoint
ALTER TABLE "public"."skids" DROP COLUMN "fill_state";--> statement-breakpoint
ALTER TABLE "public"."skids" DROP COLUMN "bay_state";--> statement-breakpoint
DROP TYPE "public"."skid_fill_state";--> statement-breakpoint
DROP TYPE "public"."skid_bay_state";--> statement-breakpoint
ALTER TABLE "public"."skids"
  ADD CONSTRAINT "skids_is_for_washing_state_check"
  CHECK (NOT "is_for_washing" OR "state" IN ('empty', 'loaded'));

--> statement-breakpoint
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
--> statement-breakpoint
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
    SET state = 'empty'
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
--> statement-breakpoint
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
  SELECT status, state, current_loc
  INTO v_skid_status, v_skid_state, v_skid_loc
  FROM skids
  WHERE id = p_skid_id_out
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Outgoing skid not found';
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
--> statement-breakpoint
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
    SELECT status, current_loc
    INTO v_skid_status, v_skid_loc
    FROM skids
    WHERE id = p_skid_id_in
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Pickup skid not found';
    END IF;

    IF v_skid_status != 'at_customer' THEN
      RAISE EXCEPTION 'Skid must be at a customer site for pickup (Current status: %)', v_skid_status;
    END IF;

    IF NOT p_force_override AND TRIM(v_skid_loc) != TRIM(v_customer_geofence) THEN
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
    UPDATE skids
    SET status = 'in_transit',
        current_loc = v_truck_loc
    WHERE id = p_skid_id_in;
  END IF;

  RETURN v_movement_id;
END;
$$;
--> statement-breakpoint
DROP FUNCTION IF EXISTS manual_dispatch_action(UUID, TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION manual_dispatch_action(
  p_movement_id UUID,
  p_action TEXT,
  p_skid_id_in UUID DEFAULT NULL,
  p_note TEXT DEFAULT NULL
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
        arrived = TRUE
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

  ELSIF p_action = 'arrived_plant' THEN
    SELECT status INTO v_trip_status
    FROM trips
    WHERE movement_id = p_movement_id
      AND direction = 'inbound'
    FOR UPDATE;

    IF NOT FOUND OR v_trip_status != 'in_transit' THEN
      RAISE EXCEPTION 'Return trip is not in transit';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM geofence_zones
      WHERE type = 'plant'
        AND UPPER(TRIM(geofence_name)) = 'GASTECH PLANT'
    ) THEN
      RAISE EXCEPTION 'GASTECH PLANT must be classified as a plant geofence';
    END IF;

    PERFORM set_config('app.manual_dispatch_location_update', 'true', TRUE);

    UPDATE trucks
    SET current_loc = 'GASTECH PLANT'
    WHERE id = v_movement.truck_id;

    PERFORM set_config('app.manual_dispatch_location_update', 'false', TRUE);

    UPDATE trips
    SET status = 'arrived',
        arrived = TRUE
    WHERE movement_id = p_movement_id
      AND direction = 'inbound';

    PERFORM complete_dispatch(p_movement_id, p_skid_id_in, p_note);

  ELSE
    RAISE EXCEPTION 'Unsupported manual dispatch action: %', p_action;
  END IF;
END;
$$;
--> statement-breakpoint
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
--> statement-breakpoint
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
              arrived = TRUE
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
            arrived = TRUE
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
