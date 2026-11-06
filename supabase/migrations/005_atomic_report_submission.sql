CREATE OR REPLACE FUNCTION public.submit_station_report(
    p_reported_at TIMESTAMPTZ,
    p_standby_skids INTEGER,
    p_empty_skids INTEGER,
    p_landing_gear_boxes INTEGER,
    p_available_trucks INTEGER,
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
        p_standby_skids,
        p_empty_skids,
        p_landing_gear_boxes,
        p_available_trucks
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
        r.prms_name,
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
        r.skid_identifier,
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
    TIMESTAMPTZ, INTEGER, INTEGER, INTEGER, INTEGER, JSONB, JSONB
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_station_report(
    TIMESTAMPTZ, INTEGER, INTEGER, INTEGER, INTEGER, JSONB, JSONB
) TO authenticated;