-- Grants on tables
GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA public
TO service_role;

-- Grants on functions
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_updates() TO service_role;
