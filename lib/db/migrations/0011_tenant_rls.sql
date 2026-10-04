ALTER TABLE "automation_settings" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automation_settings_tenant_isolation"
ON "automation_settings"
FOR ALL
USING (
  "organization_id" = nullif(
    current_setting(
      'revo.organization_id',
      true
    ),
    ''
  )::integer
)
WITH CHECK (
  "organization_id" = nullif(
    current_setting(
      'revo.organization_id',
      true
    ),
    ''
  )::integer
);
--> statement-breakpoint
ALTER TABLE "provider_connections" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "provider_connections_tenant_isolation"
ON "provider_connections"
FOR ALL
USING (
  "organization_id" = nullif(
    current_setting(
      'revo.organization_id',
      true
    ),
    ''
  )::integer
)
WITH CHECK (
  "organization_id" = nullif(
    current_setting(
      'revo.organization_id',
      true
    ),
    ''
  )::integer
);
--> statement-breakpoint
ALTER TABLE "locations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "locations_tenant_isolation"
ON "locations"
FOR ALL
USING (
  "organization_id" = nullif(
    current_setting(
      'revo.organization_id',
      true
    ),
    ''
  )::integer
)
WITH CHECK (
  "organization_id" = nullif(
    current_setting(
      'revo.organization_id',
      true
    ),
    ''
  )::integer
);
--> statement-breakpoint
ALTER TABLE "brand_voices" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_voices_tenant_isolation"
ON "brand_voices"
FOR ALL
USING (
  "organization_id" = nullif(
    current_setting(
      'revo.organization_id',
      true
    ),
    ''
  )::integer
)
WITH CHECK (
  "organization_id" = nullif(
    current_setting(
      'revo.organization_id',
      true
    ),
    ''
  )::integer
);
--> statement-breakpoint
ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_tenant_isolation"
ON "reviews"
FOR ALL
USING (
  "organization_id" = nullif(
    current_setting(
      'revo.organization_id',
      true
    ),
    ''
  )::integer
)
WITH CHECK (
  "organization_id" = nullif(
    current_setting(
      'revo.organization_id',
      true
    ),
    ''
  )::integer
);
--> statement-breakpoint
ALTER TABLE "responses" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "responses_tenant_isolation"
ON "responses"
FOR ALL
USING (
  "organization_id" = nullif(
    current_setting(
      'revo.organization_id',
      true
    ),
    ''
  )::integer
)
WITH CHECK (
  "organization_id" = nullif(
    current_setting(
      'revo.organization_id',
      true
    ),
    ''
  )::integer
);
--> statement-breakpoint
ALTER TABLE "ai_response_generations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_response_generations_tenant_isolation"
ON "ai_response_generations"
FOR ALL
USING (
  "organization_id" = nullif(
    current_setting(
      'revo.organization_id',
      true
    ),
    ''
  )::integer
)
WITH CHECK (
  "organization_id" = nullif(
    current_setting(
      'revo.organization_id',
      true
    ),
    ''
  )::integer
);
