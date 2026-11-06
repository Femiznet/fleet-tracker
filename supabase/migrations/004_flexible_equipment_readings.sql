-- Allow PRMS readings without a registered PRMS unit
ALTER TABLE public.update_prms_readings
    ALTER COLUMN prms_id DROP NOT NULL,
    ADD COLUMN prms_name TEXT;

-- Allow skid readings without a registered skid
ALTER TABLE public.update_skid_readings
    ALTER COLUMN skid_id DROP NOT NULL,
    ADD COLUMN skid_identifier TEXT;