-- Remove the original blanket runtime grants.
REVOKE ALL PRIVILEGES ON ALL TABLES
IN SCHEMA public
FROM revo_api, revo_worker;

REVOKE ALL PRIVILEGES ON ALL SEQUENCES
IN SCHEMA public
FROM revo_api, revo_worker;

-- Fastify API.
GRANT SELECT, INSERT, UPDATE
ON TABLE public.users
TO revo_api;

GRANT SELECT, INSERT
ON TABLE public.organizations
TO revo_api;

GRANT INSERT
ON TABLE public.organization_members
TO revo_api;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.jobs
TO revo_api;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.provider_connections
TO revo_api;

GRANT SELECT, INSERT
ON TABLE public.locations
TO revo_api;

GRANT SELECT
ON TABLE public.reviews
TO revo_api;

GRANT SELECT, UPDATE
ON TABLE public.responses
TO revo_api;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.brand_voices
TO revo_api;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.automation_settings
TO revo_api;

GRANT USAGE
ON SEQUENCE public.users_id_seq
TO revo_api;

GRANT USAGE
ON SEQUENCE public.organizations_id_seq
TO revo_api;

GRANT USAGE
ON SEQUENCE public.organization_members_id_seq
TO revo_api;

GRANT USAGE
ON SEQUENCE public.jobs_id_seq
TO revo_api;

GRANT USAGE
ON SEQUENCE public.provider_connections_id_seq
TO revo_api;

GRANT USAGE
ON SEQUENCE public.locations_id_seq
TO revo_api;

GRANT USAGE
ON SEQUENCE public.brand_voices_id_seq
TO revo_api;

GRANT USAGE
ON SEQUENCE public.automation_settings_id_seq
TO revo_api;

-- Worker and scheduler.
GRANT SELECT, INSERT, UPDATE
ON TABLE public.jobs
TO revo_worker;

GRANT SELECT
ON TABLE public.automation_settings
TO revo_worker;

GRANT SELECT
ON TABLE public.brand_voices
TO revo_worker;

GRANT SELECT, UPDATE
ON TABLE public.provider_connections
TO revo_worker;

GRANT SELECT, UPDATE
ON TABLE public.locations
TO revo_worker;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.reviews
TO revo_worker;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.responses
TO revo_worker;

GRANT INSERT
ON TABLE public.ai_response_generations
TO revo_worker;

GRANT USAGE
ON SEQUENCE public.jobs_id_seq
TO revo_worker;

GRANT USAGE
ON SEQUENCE public.reviews_id_seq
TO revo_worker;

GRANT USAGE
ON SEQUENCE public.responses_id_seq
TO revo_worker;

GRANT USAGE
ON SEQUENCE public.ai_response_generations_id_seq
TO revo_worker;
