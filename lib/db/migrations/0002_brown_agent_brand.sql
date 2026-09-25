DROP INDEX "responses_organization_review_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "responses_organization_review_unique" ON "responses" USING btree ("organization_id","review_id");