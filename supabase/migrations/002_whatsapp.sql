CREATE TYPE processing_status_type AS ENUM (
  'pending',
  'processing',
  'processed',
  'needs_review',
  'failed'
);

CREATE TABLE whatsapp_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  group_name TEXT,
  sender TEXT,
  notification_title TEXT,
  message TEXT NOT NULL,

  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processing_status processing_status_type NOT NULL DEFAULT 'pending',
  extracted_data JSONB,
  needs_review BOOLEAN NOT NULL DEFAULT FALSE,
  review_reason TEXT,
  processing_attempts INTEGER NOT NULL DEFAULT 0,
  processing_error TEXT,
  processing_started_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ
);
