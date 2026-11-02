CREATE TABLE whatsapp_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    group_name TEXT,
    sender TEXT,
    notification_title TEXT,
    message TEXT NOT NULL,

    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_whatsapp_updates_received_at
ON whatsapp_updates (received_at DESC);

CREATE INDEX idx_whatsapp_updates_processed
ON whatsapp_updates (processed);

ALTER TABLE public.whatsapp_updates
ADD COLUMN processing_status TEXT NOT NULL DEFAULT 'pending'
CHECK (
  processing_status IN (
    'pending',
    'processing',
    'completed',
    'needs_review',
    'failed'
  )
),
ADD COLUMN extracted_data JSONB,
ADD COLUMN needs_review BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN review_reason TEXT,
ADD COLUMN processing_attempts INTEGER NOT NULL DEFAULT 0,
ADD COLUMN processing_error TEXT,
ADD COLUMN processing_started_at TIMESTAMPTZ,
ADD COLUMN processed_at TIMESTAMPTZ;

CREATE INDEX idx_whatsapp_updates_pending
ON public.whatsapp_updates (received_at ASC)
WHERE processing_status = 'pending';

CREATE OR REPLACE FUNCTION public.claim_whatsapp_updates()
RETURNS SETOF public.whatsapp_updates
LANGUAGE sql
AS $$
  WITH candidates AS (
    SELECT id
    FROM public.whatsapp_updates
    WHERE processing_status = 'pending'
    ORDER BY received_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 2
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
$$;

GRANT SELECT, UPDATE ON public.whatsapp_updates TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_updates() TO service_role;