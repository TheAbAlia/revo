ALTER TABLE "jobs" ADD COLUMN "dedupe_key" varchar(200);--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_dedupe_key_unique" ON "jobs" USING btree ("dedupe_key");