CREATE TYPE "public"."customer_type" AS ENUM('waybill', 'meter', 'self-pick');--> statement-breakpoint
CREATE TYPE "public"."movement_status" AS ENUM('in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."movement_type" AS ENUM('dispatch', 'service', 'others');--> statement-breakpoint
CREATE TYPE "public"."processing_status" AS ENUM('needs review', 'pending', 'failed', 'processed');--> statement-breakpoint
CREATE TYPE "public"."direction" AS ENUM('outbound', 'inbound');--> statement-breakpoint
CREATE TYPE "public"."trip_status" AS ENUM('in_transit', 'arrived', 'cancelled');--> statement-breakpoint
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
	"id" serial PRIMARY KEY NOT NULL,
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
	"customer_id" uuid NOT NULL,
	"text" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now()
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
	"customer_station_id" uuid,
	"skid_id_out" uuid,
	"skid_id_in" uuid,
	"completed" boolean DEFAULT false NOT NULL,
	"note" text,
	CONSTRAINT "chk_dispatch_requires_skid_out" CHECK ("movements"."type" != 'dispatch' 
    OR "movements"."skid_id_out" IS NOT NULL),
	CONSTRAINT "chk_dispatch_requires_customer" CHECK ("movements"."type" != 'dispatch' 
    OR "movements"."customer_station_id" IS NOT NULL),
	CONSTRAINT "chk_completed_dispatch_requires_skid_in_or_note" CHECK ("movements"."type" != 'dispatch' 
    OR NOT "movements"."completed" 
    OR "movements"."skid_id_in" IS NOT NULL
    OR ("movements"."note" IS NOT NULL AND TRIM("movements"."note") != '')),
	CONSTRAINT "chk_others_or_service_requires_note" CHECK ("movements"."type" NOT IN ('others', 'service') OR ("movements"."note" IS NOT NULL AND TRIM("movements"."note") != ''))
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
	"slug_num" varchar(100) NOT NULL,
	"current_skid_loc" varchar(255) NOT NULL,
	"in_maintenance" boolean DEFAULT false NOT NULL,
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
	"slug_num" varchar(100) NOT NULL,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"current_loc" varchar(255) NOT NULL,
	"speed" integer NOT NULL,
	"in_maintenance" boolean DEFAULT false NOT NULL,
	CONSTRAINT "trucks_truck_num_unique" UNIQUE("truck_num"),
	CONSTRAINT "trucks_slug_num_unique" UNIQUE("slug_num")
);
--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_current_truck_trucks_truck_num_fk" FOREIGN KEY ("current_truck") REFERENCES "public"."trucks"("truck_num") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "motormates" ADD CONSTRAINT "motormates_current_driver_drivers_name_fk" FOREIGN KEY ("current_driver") REFERENCES "public"."drivers"("name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_truck_id_trucks_id_fk" FOREIGN KEY ("truck_id") REFERENCES "public"."trucks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_customer_station_id_customers_id_fk" FOREIGN KEY ("customer_station_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_skid_id_out_skids_id_fk" FOREIGN KEY ("skid_id_out") REFERENCES "public"."skids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_skid_id_in_skids_id_fk" FOREIGN KEY ("skid_id_in") REFERENCES "public"."skids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processed_messages" ADD CONSTRAINT "processed_messages_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processed_messages" ADD CONSTRAINT "processed_messages_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_movement_id_movements_id_fk" FOREIGN KEY ("movement_id") REFERENCES "public"."movements"("id") ON DELETE cascade ON UPDATE no action;