CREATE OR REPLACE FUNCTION public.revo_authenticated_context(
  authenticated_user_id integer
)
RETURNS TABLE (
  user_id integer,
  user_name text,
  user_email text,
  organization_id integer,
  organization_name text,
  membership_role text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    u.id,
    u.name,
    u.email,
    o.id,
    o.name,
    om.role
  FROM public.users AS u
  INNER JOIN public.organization_members AS om
    ON om.user_id = u.id
  INNER JOIN public.organizations AS o
    ON o.id = om.organization_id
  WHERE u.id = authenticated_user_id
    AND u.deleted_at IS NULL
  ORDER BY om.id ASC
  LIMIT 1;
$$;

REVOKE ALL
ON FUNCTION public.revo_authenticated_context(integer)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.revo_authenticated_context(integer)
TO revo_api;
