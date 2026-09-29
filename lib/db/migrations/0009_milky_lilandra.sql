ALTER TABLE "locations" ADD COLUMN "last_sync_attempt_at" timestamp;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "last_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "last_sync_error" text;