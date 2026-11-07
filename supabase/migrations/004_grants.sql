GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT ON
    public.stations,
    public.profiles,
    public.skids,
    public.prms_units,
    public.prms_skid_assignments,
    public.station_updates,
    public.update_prms_readings,
    public.update_skid_readings
TO authenticated;

GRANT UPDATE ON
    public.stations,
    public.profiles,
    public.skids,
    public.prms_units,
    public.prms_skid_assignments
TO authenticated;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_station_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_station_report(
    TIMESTAMPTZ, TEXT[], TEXT[], INTEGER, TEXT[], JSONB, JSONB
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_station_update_skid_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_stations_updated_at() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_station_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_station_report(
    TIMESTAMPTZ, TEXT[], TEXT[], INTEGER, TEXT[], JSONB, JSONB
) TO authenticated;
