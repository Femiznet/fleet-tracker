ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prms_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prms_skid_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.station_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.update_prms_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.update_skid_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY stations_select
ON public.stations FOR SELECT
TO authenticated
USING (
    public.is_admin()
    OR id = public.current_station_id()
);

CREATE POLICY stations_admin_insert
ON public.stations FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY stations_admin_update
ON public.stations FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY profiles_select
ON public.profiles FOR SELECT
TO authenticated
USING (
    id = (SELECT auth.uid())
    OR public.is_admin()
);

CREATE POLICY profiles_admin_insert
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY profiles_admin_update
ON public.profiles FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY skids_select
ON public.skids FOR SELECT
TO authenticated
USING (
    public.is_admin()
    OR station_id = public.current_station_id()
);

CREATE POLICY skids_insert
ON public.skids FOR INSERT
TO authenticated
WITH CHECK (
    public.is_admin()
    OR station_id = public.current_station_id()
);

CREATE POLICY skids_update
ON public.skids FOR UPDATE
TO authenticated
USING (
    public.is_admin()
    OR station_id = public.current_station_id()
)
WITH CHECK (
    public.is_admin()
    OR station_id = public.current_station_id()
);

CREATE POLICY prms_select
ON public.prms_units FOR SELECT
TO authenticated
USING (
    public.is_admin()
    OR station_id = public.current_station_id()
);

CREATE POLICY prms_insert
ON public.prms_units FOR INSERT
TO authenticated
WITH CHECK (
    public.is_admin()
    OR station_id = public.current_station_id()
);

CREATE POLICY prms_update
ON public.prms_units FOR UPDATE
TO authenticated
USING (
    public.is_admin()
    OR station_id = public.current_station_id()
)
WITH CHECK (
    public.is_admin()
    OR station_id = public.current_station_id()
);

CREATE POLICY assignments_select
ON public.prms_skid_assignments FOR SELECT
TO authenticated
USING (
    public.is_admin()
    OR station_id = public.current_station_id()
);

CREATE POLICY assignments_insert
ON public.prms_skid_assignments FOR INSERT
TO authenticated
WITH CHECK (
    public.is_admin()
    OR station_id = public.current_station_id()
);

CREATE POLICY assignments_update
ON public.prms_skid_assignments FOR UPDATE
TO authenticated
USING (
    public.is_admin()
    OR station_id = public.current_station_id()
)
WITH CHECK (
    public.is_admin()
    OR station_id = public.current_station_id()
);

CREATE POLICY updates_select
ON public.station_updates FOR SELECT
TO authenticated
USING (
    public.is_admin()
    OR station_id = public.current_station_id()
);

CREATE POLICY updates_insert
ON public.station_updates FOR INSERT
TO authenticated
WITH CHECK (
    public.is_admin()
    OR station_id = public.current_station_id()
);

CREATE POLICY prms_readings_select
ON public.update_prms_readings FOR SELECT
TO authenticated
USING (
    public.is_admin()
    OR station_id = public.current_station_id()
);

CREATE POLICY prms_readings_insert
ON public.update_prms_readings FOR INSERT
TO authenticated
WITH CHECK (
    public.is_admin()
    OR station_id = public.current_station_id()
);

CREATE POLICY skid_readings_select
ON public.update_skid_readings FOR SELECT
TO authenticated
USING (
    public.is_admin()
    OR station_id = public.current_station_id()
);

CREATE POLICY skid_readings_insert
ON public.update_skid_readings FOR INSERT
TO authenticated
WITH CHECK (
    public.is_admin()
    OR station_id = public.current_station_id()
);
