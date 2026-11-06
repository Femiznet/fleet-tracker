-- Schema access
GRANT USAGE ON SCHEMA public TO authenticated;

-- SELECT access
GRANT SELECT ON
    public.stations,
    public.profiles,
    public.skids,
    public.prms_units,
    public.prms_skid_assignments,
    public.station_updates,
    public.update_prms_readings,
    public.update_skid_readings
TO authenticated;


-- INSERT access
GRANT INSERT ON
    public.stations,
    public.profiles,
    public.skids,
    public.prms_units,
    public.prms_skid_assignments,
    public.station_updates,
    public.update_prms_readings,
    public.update_skid_readings
TO authenticated;


-- UPDATE access
GRANT UPDATE ON
    public.stations,
    public.profiles,
    public.skids,
    public.prms_units,
    public.prms_skid_assignments
TO authenticated;