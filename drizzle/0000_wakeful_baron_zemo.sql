CREATE TYPE "public"."customer_type" AS ENUM('waybill', 'meter', 'self-pick');--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('update', 'dispatch');--> statement-breakpoint
CREATE TYPE "public"."movement_status" AS ENUM('in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."movement_type" AS ENUM('dispatch', 'service', 'others', 'pickup');--> statement-breakpoint
CREATE TYPE "public"."processing_status" AS ENUM('needs review', 'pending', 'failed', 'processed');--> statement-breakpoint
CREATE TYPE "public"."skid_bay_state" AS ENUM('idle', 'on_hold', 'washing');--> statement-breakpoint
CREATE TYPE "public"."skid_fill_state" AS ENUM('empty', 'loading', 'loaded');--> statement-breakpoint
CREATE TYPE "public"."skid_status" AS ENUM('available', 'in_transit', 'at_customer', 'maintenance');--> statement-breakpoint
CREATE TYPE "public"."direction" AS ENUM('outbound', 'inbound');--> statement-breakpoint
CREATE TYPE "public"."trip_status" AS ENUM('in_transit', 'arrived', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."truck_status" AS ENUM('available', 'in_transit', 'standby', 'at_customer', 'maintenance');--> statement-breakpoint
CREATE TABLE "ai_configurations" (
	"endpoint_url" varchar(500) NOT NULL,
	"provider" varchar(100) NOT NULL,
	"model" varchar(200) NOT NULL,
	"encrypted_api_key" text NOT NULL,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"geofence_name" varchar(100),
	"location" varchar(255),
	"customer_type" "customer_type",
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "customers_name_unique" UNIQUE("name"),
	CONSTRAINT "customers_geofence_name_unique" UNIQUE("geofence_name")
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(255),
	"current_truck" varchar(20),
	CONSTRAINT "drivers_name_unique" UNIQUE("name"),
	CONSTRAINT "drivers_phone_unique" UNIQUE("phone"),
	CONSTRAINT "drivers_current_truck_unique" UNIQUE("current_truck")
);
--> statement-breakpoint
CREATE TABLE "geofence_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"geofence_name" text,
	"center_lat" double precision,
	"center_lon" double precision,
	"radius_meters" double precision,
	"sample_points" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "geofence_zones_geofence_name_unique" UNIQUE("geofence_name")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"text" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"type" "message_type" NOT NULL,
	"is_processed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "messages_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "motormates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(255),
	"current_driver" varchar(255),
	CONSTRAINT "motormates_name_unique" UNIQUE("name"),
	CONSTRAINT "motormates_phone_unique" UNIQUE("phone"),
	CONSTRAINT "motormates_current_driver_unique" UNIQUE("current_driver")
);
--> statement-breakpoint
CREATE TABLE "movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "movement_type" NOT NULL,
	"status" "movement_status" DEFAULT 'in_progress' NOT NULL,
	"truck_id" uuid NOT NULL,
	"customer_id" uuid,
	"skid_id_out" uuid,
	"skid_id_in" uuid,
	"note" text,
	CONSTRAINT "chk_dispatch_requires_skid_out" CHECK ("movements"."type" != 'dispatch' OR "movements"."skid_id_out" IS NOT NULL),
	CONSTRAINT "chk_dispatch_requires_customer" CHECK ("movements"."type" != 'dispatch' OR "movements"."customer_id" IS NOT NULL),
	CONSTRAINT "chk_completed_dispatch_requires_skid_in_or_note" CHECK ("movements"."type" != 'dispatch' OR "movements"."status" != 'completed' OR "movements"."skid_id_in" IS NOT NULL OR ("movements"."note" IS NOT NULL AND TRIM("movements"."note") != '')),
	CONSTRAINT "chk_others_or_service_requires_note" CHECK ("movements"."type" NOT IN ('others', 'service') OR ("movements"."note" IS NOT NULL AND TRIM("movements"."note") != ''))
);
--> statement-breakpoint
CREATE TABLE "plant_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shift_date" timestamp DEFAULT now() NOT NULL,
	"officers_on_duty" varchar(255) NOT NULL,
	"metrics" jsonb NOT NULL,
	"fleet_snapshot" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processed_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"status" text NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"data" jsonb,
	"processed_at" timestamp DEFAULT now(),
	CONSTRAINT "processed_messages_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
CREATE TABLE "skids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skid_num" varchar(100) NOT NULL,
	"slug_num" varchar(100),
	"customer_id" uuid,
	"current_loc" varchar(255) DEFAULT 'pending' NOT NULL,
	"status" "skid_status" DEFAULT 'available' NOT NULL,
	"fill_state" "skid_fill_state" DEFAULT 'empty' NOT NULL,
	"bay_state" "skid_bay_state" DEFAULT 'idle' NOT NULL,
	"is_new" boolean DEFAULT false NOT NULL,
	CONSTRAINT "skids_skid_num_unique" UNIQUE("skid_num"),
	CONSTRAINT "skids_slug_num_unique" UNIQUE("slug_num")
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movement_id" uuid NOT NULL,
	"status" "trip_status" DEFAULT 'in_transit' NOT NULL,
	"direction" "direction" NOT NULL,
	"origin" varchar(255) NOT NULL,
	"destination" varchar(255) NOT NULL,
	"arrived" boolean DEFAULT false NOT NULL,
	CONSTRAINT "unq_movement_direction" UNIQUE("movement_id","direction")
);
--> statement-breakpoint
CREATE TABLE "trucks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"truck_num" varchar(100) NOT NULL,
	"slug_num" varchar(100),
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"current_loc" varchar(255) DEFAULT 'pending' NOT NULL,
	"speed" integer NOT NULL,
	"status" "truck_status" DEFAULT 'available' NOT NULL,
	CONSTRAINT "trucks_truck_num_unique" UNIQUE("truck_num"),
	CONSTRAINT "trucks_slug_num_unique" UNIQUE("slug_num")
);
--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_current_truck_trucks_truck_num_fk" FOREIGN KEY ("current_truck") REFERENCES "public"."trucks"("truck_num") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "motormates" ADD CONSTRAINT "motormates_current_driver_drivers_name_fk" FOREIGN KEY ("current_driver") REFERENCES "public"."drivers"("name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_truck_id_trucks_id_fk" FOREIGN KEY ("truck_id") REFERENCES "public"."trucks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_skid_id_out_skids_id_fk" FOREIGN KEY ("skid_id_out") REFERENCES "public"."skids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_skid_id_in_skids_id_fk" FOREIGN KEY ("skid_id_in") REFERENCES "public"."skids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processed_messages" ADD CONSTRAINT "processed_messages_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processed_messages" ADD CONSTRAINT "processed_messages_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skids" ADD CONSTRAINT "skids_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_movement_id_movements_id_fk" FOREIGN KEY ("movement_id") REFERENCES "public"."movements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unq_active_movement_per_truck" ON "movements" USING btree ("truck_id") WHERE "movements"."status" = 'in_progress';
--> statement-breakpoint
-- Function: cancel-dispatch.sql
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
-- Function: complete-dispatch.sql
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

  -- 3. Check if truck is physically back at GASTECH PLANT (unless overridden)
  SELECT current_loc INTO v_truck_loc
  FROM trucks
  WHERE id = v_movement.truck_id
  FOR UPDATE;

  IF NOT p_force_override AND TRIM(v_truck_loc) != 'GASTECH PLANT' THEN
    RAISE EXCEPTION 'Truck sensor location is currently %. Confirm truck is at GASTECH PLANT or use manual override.', v_truck_loc;
  END IF;

  IF p_force_override AND TRIM(v_truck_loc) != 'GASTECH PLANT' THEN
    v_final_note := TRIM(COALESCE(v_final_note, '') || ' [Manual Completion Override]');
  END IF;

  -- 3B. For full roundtrip dispatches, ensure the truck actually went out & started returning (unless overridden)
  IF v_movement.type = 'dispatch' AND NOT p_force_override THEN
    IF NOT EXISTS (
      SELECT 1 FROM trips
      WHERE movement_id = p_movement_id
        AND direction = 'inbound'
    ) THEN
      RAISE EXCEPTION 'Truck has not completed its outbound visit to the customer yet. Cancel the dispatch or use manual override.';
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

    IF NOT p_force_override AND v_skid_in_status = 'at_customer' AND TRIM(v_skid_in_loc) != TRIM(v_customer_geofence) THEN
      RAISE EXCEPTION 'Returned skid is recorded at %, not at this customer (%). Use manual override if transferred.', v_skid_in_loc, v_customer_geofence;
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
-- Function: create-dispatch.sql
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
--> statement-breakpoint
-- Function: create-pickup.sql
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
-- Function: sync_truck_telemetry.sql
CREATE OR REPLACE FUNCTION handle_truck_location_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_movement_id UUID;
  v_movement_type movement_type;
  v_active_skid_id UUID;
  v_customer_geofence VARCHAR;
BEGIN
  IF TRIM(NEW.current_loc) IS DISTINCT FROM TRIM(OLD.current_loc)
     AND NEW.status IN ('in_transit', 'at_customer') THEN

    -- Find the active dispatch or pickup movement
    SELECT m.id, m.type, COALESCE(m.skid_id_out, m.skid_id_in), c.geofence_name
    INTO v_movement_id, v_movement_type, v_active_skid_id, v_customer_geofence
    FROM movements m
    JOIN customers c ON c.id = m.customer_id
    WHERE m.truck_id = NEW.id
      AND m.type IN ('dispatch', 'pickup')
      AND m.status = 'in_progress'
    LIMIT 1;

    IF FOUND THEN
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

      -- Sync active skid location while in transit
      IF v_active_skid_id IS NOT NULL THEN
        UPDATE skids
        SET current_loc = NEW.current_loc
        WHERE id = v_active_skid_id
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
