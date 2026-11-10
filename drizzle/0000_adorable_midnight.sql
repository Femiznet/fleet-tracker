CREATE TYPE "public"."customer_type" AS ENUM('waybill', 'meter', 'self-pick');--> statement-breakpoint
CREATE TYPE "public"."processing_status" AS ENUM('needs review', 'pending', 'failed', 'processed');--> statement-breakpoint
CREATE TABLE "ai_configuration" (
	"endpoint_url" varchar(500) NOT NULL,
	"provider" varchar(100) NOT NULL,
	"model" varchar(200) NOT NULL,
	"encrypted_api_key" text NOT NULL,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"customer_type" "customer_type",
	"is_active" boolean DEFAULT true,
	"relative_time" interval,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"cutoff_pressure" double precision
);
--> statement-breakpoint
CREATE TABLE "customer_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"raw_text" text NOT NULL,
	"processing_status" "processing_status",
	"review_text" text,
	"processed_text" json,
	"error_text" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "customer_updates" ADD CONSTRAINT "customer_updates_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;