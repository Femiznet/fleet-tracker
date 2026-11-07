CREATE OR REPLACE FUNCTION public.validate_station_update_skid_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM unnest(
            COALESCE(NEW.standby_skids, ARRAY[]::TEXT[])
        ) AS s(value)
        JOIN unnest(
            COALESCE(NEW.empty_skids, ARRAY[]::TEXT[])
        ) AS e(value)
        ON lower(btrim(s.value)) = lower(btrim(e.value))
    ) THEN
        RAISE EXCEPTION
            'A skid cannot be both standby and empty';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_standby_empty_skid_overlap
BEFORE INSERT OR UPDATE OF standby_skids, empty_skids
ON public.station_updates
FOR EACH ROW
EXECUTE FUNCTION public.validate_station_update_skid_status();