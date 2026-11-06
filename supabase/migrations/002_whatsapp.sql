CREATE TABLE whatsapp_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  group_name TEXT,
  sender TEXT,
  notification_title TEXT,
  message TEXT NOT NULL,

  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processing_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (
    processing_status IN (
      'pending',
      'processing',
      'completed',
      'needs_review',
      'failed'
    )
  ),
  extracted_data JSONB,
  needs_review BOOLEAN NOT NULL DEFAULT FALSE,
  review_reason TEXT,
  processing_attempts INTEGER NOT NULL DEFAULT 0,
  processing_error TEXT,
  processing_started_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ
);


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

