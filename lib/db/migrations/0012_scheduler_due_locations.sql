CREATE OR REPLACE FUNCTION public.revo_due_provider_sync_locations(
  due_before timestamp without time zone
)
RETURNS TABLE (
  organization_id integer,
  location_id integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    l.organization_id,
    l.id
  FROM public.locations AS l
  INNER JOIN public.provider_connections AS pc
    ON pc.id = l.provider_connection_id
    AND pc.organization_id = l.organization_id
  WHERE l.provider IS NOT NULL
    AND l.external_id IS NOT NULL
    AND l.provider_connection_id IS NOT NULL
    AND pc.status = 'connected'
    AND (
      l.last_sync_attempt_at IS NULL
      OR l.last_sync_attempt_at <= due_before
    );
$$;

REVOKE ALL
ON FUNCTION public.revo_due_provider_sync_locations(
  timestamp without time zone
)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.revo_due_provider_sync_locations(
  timestamp without time zone
)
TO revo_worker;
