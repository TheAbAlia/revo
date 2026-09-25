CREATE TABLE "provider_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"provider" varchar(30) NOT NULL,
	"external_account_id" text NOT NULL,
	"refresh_token_encrypted" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "provider_connections_org_provider_account_unique" ON "provider_connections" USING btree ("organization_id","provider","external_account_id");--> statement-breakpoint
CREATE INDEX "provider_connections_organization_idx" ON "provider_connections" USING btree ("organization_id");