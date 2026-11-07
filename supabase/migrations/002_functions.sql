CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = (SELECT auth.uid())
          AND role = 'admin'::public.user_role
    );
$$;

CREATE OR REPLACE FUNCTION public.current_station_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT station_id
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role = 'customer'::public.user_role
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.submit_station_report(
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
    WHERE id = (SELECT auth.uid())
      AND role = 'customer'::public.user_role;

    IF v_station_id IS NULL THEN
        RAISE EXCEPTION 'Customer station not found';
    END IF;

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

CREATE OR REPLACE FUNCTION public.validate_station_update_skid_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM unnest(COALESCE(NEW.standby_skids, ARRAY[]::TEXT[])) AS s(value)
        JOIN unnest(COALESCE(NEW.empty_skids, ARRAY[]::TEXT[])) AS e(value)
          ON lower(btrim(s.value)) = lower(btrim(e.value))
    ) THEN
        RAISE EXCEPTION 'A skid cannot be both standby and empty';
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_stations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_standby_empty_skid_overlap
BEFORE INSERT OR UPDATE OF standby_skids, empty_skids
ON public.station_updates
FOR EACH ROW
EXECUTE FUNCTION public.validate_station_update_skid_status();

CREATE TRIGGER update_stations_updated_at_trigger
BEFORE UPDATE ON public.stations
FOR EACH ROW
EXECUTE FUNCTION public.update_stations_updated_at();
