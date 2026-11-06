CREATE TABLE ai_provider_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    encrypted_api_key TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (provider, model)
);

CREATE OR REPLACE FUNCTION public.claim_whatsapp_updates()
RETURNS SETOF public.whatsapp_updates
LANGUAGE plpgsql
SECURITY DEFINER -- Ensures the automated system has permission to read/update the rows
AS $$
DECLARE
  active_count INTEGER;
  available_slots INTEGER;
BEGIN
  -- 1. Grab an explicit transaction-level advisory lock to serialize workers
  PERFORM pg_advisory_xact_lock(741852963);

  -- 2. See how many slots are currently being processed (Concurreny Limit = 2)
  SELECT COUNT(*) INTO active_count
  FROM public.whatsapp_updates
  WHERE processing_status = 'processing';

  available_slots := GREATEST(0, 2 - active_count);

  -- 3. If slots are open, grab pending rows and atomically mark them as 'processing'
  RETURN QUERY
  WITH candidates AS (
    SELECT id
    FROM public.whatsapp_updates
    WHERE processing_status = 'pending'
    ORDER BY received_at ASC
    FOR UPDATE SKIP LOCKED -- Skips rows currently locked by other transactions
    LIMIT available_slots
  )
  UPDATE public.whatsapp_updates AS updates
  SET
    processing_status = 'processing',
    processing_attempts = processing_attempts + 1,
    processing_started_at = NOW(),
    processing_error = NULL
  FROM candidates
  WHERE updates.id = candidates.id
  RETURNING updates.*;
END;
$$;

