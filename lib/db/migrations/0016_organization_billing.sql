CREATE TABLE "organization_billing" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_product_id" text,
	"plan_name" varchar(50),
	"subscription_status" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_billing_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "organization_billing_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
ALTER TABLE "organization_billing" ADD CONSTRAINT "organization_billing_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "organization_billing_organization_unique" ON "organization_billing" USING btree ("organization_id");
--> statement-breakpoint
ALTER TABLE public.organization_billing
ENABLE ROW LEVEL SECURITY;

CREATE POLICY organization_billing_tenant_isolation
ON public.organization_billing
FOR ALL
USING (
  organization_id = nullif(
    current_setting('revo.organization_id', true),
    ''
  )::integer
)
WITH CHECK (
  organization_id = nullif(
    current_setting('revo.organization_id', true),
    ''
  )::integer
);

REVOKE ALL
ON TABLE public.organization_billing
FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.organization_billing
TO revo_api;

GRANT USAGE
ON SEQUENCE public.organization_billing_id_seq
TO revo_api;
