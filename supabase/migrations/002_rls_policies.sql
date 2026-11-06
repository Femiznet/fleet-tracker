
-- ==========================================
-- 1. HELPER FUNCTIONS
-- ==========================================

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


REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_station_id() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_station_id() TO authenticated;


-- ==========================================
-- 2. ENABLE RLS
-- ==========================================

ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prms_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prms_skid_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.station_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.update_prms_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.update_skid_readings ENABLE ROW LEVEL SECURITY;


-- ==========================================
-- 3. STATIONS
-- ==========================================

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


-- ==========================================
-- 4. PROFILES
-- ==========================================

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


-- ==========================================
-- 5. SKIDS
-- ==========================================

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


-- ==========================================
-- 6. PRMS UNITS
-- ==========================================

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


-- ==========================================
-- 7. PRMS-SKID ASSIGNMENTS
-- ==========================================

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


-- ==========================================
-- 8. STATION UPDATES
-- ==========================================

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


-- ==========================================
-- 9. PRMS READINGS
-- ==========================================

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


-- ==========================================
-- 10. SKID READINGS
-- ==========================================

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
