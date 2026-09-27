ALTER TABLE "provider_connections" ADD COLUMN "status" varchar(30) DEFAULT 'connected' NOT NULL;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD COLUMN "last_error_at" timestamp;