
-- ==========================================
-- 1. REPLACE INVENTORY COUNTS WITH TEXT ARRAYS
-- ==========================================

ALTER TABLE public.station_updates
    DROP COLUMN standby_skids,
    DROP COLUMN empty_skids,
    DROP COLUMN available_trucks,
    ADD COLUMN standby_skids TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN empty_skids TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN available_trucks TEXT[] NOT NULL DEFAULT '{}';


-- ==========================================
-- 2. CASE-INSENSITIVE REGISTERED NAME UNIQUENESS
-- ==========================================

CREATE UNIQUE INDEX skids_station_name_unique
ON public.skids (station_id, lower(btrim(name)));

CREATE UNIQUE INDEX prms_station_name_unique
ON public.prms_units (station_id, lower(btrim(name)));


-- ==========================================
-- 3. PREVENT DUPLICATE FREE-TEXT READINGS
-- ==========================================

ALTER TABLE public.update_prms_readings
ADD CONSTRAINT prms_name_not_blank
CHECK (prms_name IS NULL OR btrim(prms_name) <> '');

ALTER TABLE public.update_skid_readings
ADD CONSTRAINT skid_identifier_not_blank
CHECK (skid_identifier IS NULL OR btrim(skid_identifier) <> '');

CREATE UNIQUE INDEX update_prms_name_unique
ON public.update_prms_readings (update_id, lower(btrim(prms_name)))
WHERE prms_name IS NOT NULL;

CREATE UNIQUE INDEX update_skid_identifier_unique
ON public.update_skid_readings (update_id, lower(btrim(skid_identifier)))
WHERE skid_identifier IS NOT NULL;


-- ==========================================
-- 4. REPLACE REPORT SUBMISSION FUNCTION
-- ==========================================

DROP FUNCTION public.submit_station_report(
    TIMESTAMPTZ, INTEGER, INTEGER, INTEGER, INTEGER, JSONB, JSONB
);

CREATE FUNCTION public.submit_station_report(
    p_reported_at TIMESTAMPTZ,
    p_standby_skids TEXT[],
    p_empty_skids TEXT[],
    p_landing_gear_boxes INTEGER,
    p_available_trucks TEXT[],
    p_prms_readings JSONB,
    p_skid_readings JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_station_id UUID;
    v_update_id UUID;
BEGIN
    SELECT station_id
    INTO v_station_id
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'customer'::public.user_role;

    IF v_station_id IS NULL THEN
        RAISE EXCEPTION 'Customer station not found';
    END IF;

    -- Reject blank inventory entries.
    IF EXISTS (
        SELECT 1
        FROM unnest(coalesce(p_standby_skids, ARRAY[]::TEXT[])) AS x(value)
        WHERE btrim(x.value) = ''
    ) OR EXISTS (
        SELECT 1
        FROM unnest(coalesce(p_empty_skids, ARRAY[]::TEXT[])) AS x(value)
        WHERE btrim(x.value) = ''
    ) OR EXISTS (
        SELECT 1
        FROM unnest(coalesce(p_available_trucks, ARRAY[]::TEXT[])) AS x(value)
        WHERE btrim(x.value) = ''
    ) THEN
        RAISE EXCEPTION 'Inventory entries cannot be blank';
    END IF;

    -- Reject duplicate inventory entries, ignoring case and whitespace.
    IF EXISTS (
        SELECT 1
        FROM unnest(coalesce(p_standby_skids, ARRAY[]::TEXT[])) AS x(value)
        GROUP BY lower(btrim(x.value))
        HAVING count(*) > 1
    ) OR EXISTS (
        SELECT 1
        FROM unnest(coalesce(p_empty_skids, ARRAY[]::TEXT[])) AS x(value)
        GROUP BY lower(btrim(x.value))
        HAVING count(*) > 1
    ) OR EXISTS (
        SELECT 1
        FROM unnest(coalesce(p_available_trucks, ARRAY[]::TEXT[])) AS x(value)
        GROUP BY lower(btrim(x.value))
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate inventory entries are not allowed';
    END IF;

    INSERT INTO public.station_updates (
        station_id,
        reported_at,
        standby_skids,
        empty_skids,
        landing_gear_boxes,
        available_trucks
    )
    VALUES (
        v_station_id,
        p_reported_at,
        ARRAY(
            SELECT btrim(x.value)
            FROM unnest(coalesce(p_standby_skids, ARRAY[]::TEXT[]))
                WITH ORDINALITY AS x(value, position)
            ORDER BY x.position
        ),
        ARRAY(
            SELECT btrim(x.value)
            FROM unnest(coalesce(p_empty_skids, ARRAY[]::TEXT[]))
                WITH ORDINALITY AS x(value, position)
            ORDER BY x.position
        ),
        p_landing_gear_boxes,
        ARRAY(
            SELECT btrim(x.value)
            FROM unnest(coalesce(p_available_trucks, ARRAY[]::TEXT[]))
                WITH ORDINALITY AS x(value, position)
            ORDER BY x.position
        )
    )
    RETURNING id INTO v_update_id;

    INSERT INTO public.update_prms_readings (
        station_id,
        update_id,
        prms_name,
        flow_rate,
        total_flow,
        outlet_pressure,
        outlet_temperature
    )
    SELECT
        v_station_id,
        v_update_id,
        btrim(r.prms_name),
        r.flow_rate,
        r.total_flow,
        r.outlet_pressure,
        r.outlet_temperature
    FROM jsonb_to_recordset(p_prms_readings) AS r(
        prms_name TEXT,
        flow_rate NUMERIC,
        total_flow NUMERIC,
        outlet_pressure NUMERIC,
        outlet_temperature NUMERIC
    );

    INSERT INTO public.update_skid_readings (
        station_id,
        update_id,
        skid_identifier,
        pressure,
        temperature
    )
    SELECT
        v_station_id,
        v_update_id,
        btrim(r.skid_identifier),
        r.pressure,
        r.temperature
    FROM jsonb_to_recordset(p_skid_readings) AS r(
        skid_identifier TEXT,
        pressure NUMERIC,
        temperature NUMERIC
    );

    RETURN v_update_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_station_report(
    TIMESTAMPTZ, TEXT[], TEXT[], INTEGER, TEXT[], JSONB, JSONB
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_station_report(
    TIMESTAMPTZ, TEXT[], TEXT[], INTEGER, TEXT[], JSONB, JSONB
) TO authenticated;
