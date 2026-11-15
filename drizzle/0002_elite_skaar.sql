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
ALTER TABLE "processed_messages" ADD CONSTRAINT "processed_messages_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processed_messages" ADD CONSTRAINT "processed_messages_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;