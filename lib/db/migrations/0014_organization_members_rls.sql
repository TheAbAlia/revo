ALTER TABLE public.organization_members
ENABLE ROW LEVEL SECURITY;

CREATE POLICY organization_members_tenant_isolation
ON public.organization_members
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
