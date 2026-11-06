


-- ==========================================
-- 1. STATIONS
-- ==========================================

CREATE TABLE public.stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ==========================================
-- 2. PROFILES
-- ==========================================

CREATE TYPE public.user_role AS ENUM ('admin', 'customer');

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.user_role NOT NULL,
    station_id UUID REFERENCES public.stations(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_profile_station CHECK (
        (role = 'admin' AND station_id IS NULL)
        OR
        (role = 'customer' AND station_id IS NOT NULL)
    )
);


-- ==========================================
-- 3. SKIDS
-- ==========================================

CREATE TABLE public.skids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID NOT NULL REFERENCES public.stations(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (station_id, name),
    UNIQUE (id, station_id)
);


-- ==========================================
-- 4. PRMS UNITS
-- ==========================================

CREATE TABLE public.prms_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID NOT NULL REFERENCES public.stations(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (station_id, name),
    UNIQUE (id, station_id)
);


-- ==========================================
-- 5. PRMS-SKID ASSIGNMENTS
-- ==========================================

CREATE TABLE public.prms_skid_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID NOT NULL,
    prms_id UUID NOT NULL,
    skid_id UUID NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,

    FOREIGN KEY (prms_id, station_id)
        REFERENCES public.prms_units(id, station_id)
        ON DELETE RESTRICT,

    FOREIGN KEY (skid_id, station_id)
        REFERENCES public.skids(id, station_id)
        ON DELETE RESTRICT,

    CHECK (ended_at IS NULL OR ended_at >= assigned_at)
);


-- ==========================================
-- 6. STATION UPDATES
-- ==========================================

CREATE TABLE public.station_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID NOT NULL REFERENCES public.stations(id) ON DELETE RESTRICT,

    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    standby_skids INTEGER CHECK (standby_skids >= 0),
    empty_skids INTEGER CHECK (empty_skids >= 0),
    landing_gear_boxes INTEGER CHECK (landing_gear_boxes >= 0),
    available_trucks INTEGER CHECK (available_trucks >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (id, station_id)
);


-- ==========================================
-- 7. UPDATE PRMS READINGS
-- ==========================================

CREATE TABLE public.update_prms_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    station_id UUID NOT NULL,
    update_id UUID NOT NULL,
    prms_id UUID NOT NULL,

    flow_rate NUMERIC CHECK (flow_rate >= 0),
    total_flow NUMERIC CHECK (total_flow >= 0),
    outlet_pressure NUMERIC CHECK (outlet_pressure >= 0),
    outlet_temperature NUMERIC,

    FOREIGN KEY (update_id, station_id)
        REFERENCES public.station_updates(id, station_id)
        ON DELETE CASCADE,

    FOREIGN KEY (prms_id, station_id)
        REFERENCES public.prms_units(id, station_id)
        ON DELETE RESTRICT,

    UNIQUE (update_id, prms_id)
);


-- ==========================================
-- 8. UPDATE SKID READINGS
-- ==========================================

CREATE TABLE public.update_skid_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    station_id UUID NOT NULL,
    update_id UUID NOT NULL,
    skid_id UUID NOT NULL,

    pressure NUMERIC CHECK (pressure >= 0),
    temperature NUMERIC,

    FOREIGN KEY (update_id, station_id)
        REFERENCES public.station_updates(id, station_id)
        ON DELETE CASCADE,

    FOREIGN KEY (skid_id, station_id)
        REFERENCES public.skids(id, station_id)
        ON DELETE RESTRICT,

    UNIQUE (update_id, skid_id)
);
