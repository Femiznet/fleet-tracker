CREATE TYPE public.user_role AS ENUM ('admin', 'customer');
CREATE TYPE public.customer_delivery_type AS ENUM ('METER', 'SELF-PICK', 'WAYBILL');

CREATE TABLE public.stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    type public.customer_delivery_type,
    distance NUMERIC(10, 2),
    location TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.user_role NOT NULL,
    station_id UUID REFERENCES public.stations(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT profiles_station_id_unique UNIQUE (station_id),
    CONSTRAINT valid_profile_station CHECK (
        (role = 'admin' AND station_id IS NULL)
        OR
        (role = 'customer' AND station_id IS NOT NULL)
    )
);

CREATE TABLE public.skids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID NOT NULL REFERENCES public.stations(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (station_id, name),
    UNIQUE (id, station_id)
);

CREATE TABLE public.prms_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID NOT NULL REFERENCES public.stations(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (station_id, name),
    UNIQUE (id, station_id)
);

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

CREATE TABLE public.station_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID NOT NULL REFERENCES public.stations(id) ON DELETE RESTRICT,
    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    standby_skids TEXT[] NOT NULL DEFAULT '{}',
    empty_skids TEXT[] NOT NULL DEFAULT '{}',
    landing_gear_boxes INTEGER CHECK (landing_gear_boxes >= 0),
    available_trucks TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (id, station_id)
);

CREATE TABLE public.update_prms_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID NOT NULL,
    update_id UUID NOT NULL,
    prms_id UUID,
    prms_name TEXT,
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

    UNIQUE (update_id, prms_id),
    CONSTRAINT prms_name_not_blank
        CHECK (prms_name IS NULL OR btrim(prms_name) <> '')
);

CREATE TABLE public.update_skid_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID NOT NULL,
    update_id UUID NOT NULL,
    skid_id UUID,
    skid_identifier TEXT,
    pressure NUMERIC CHECK (pressure >= 0),
    temperature NUMERIC,

    FOREIGN KEY (update_id, station_id)
        REFERENCES public.station_updates(id, station_id)
        ON DELETE CASCADE,

    FOREIGN KEY (skid_id, station_id)
        REFERENCES public.skids(id, station_id)
        ON DELETE RESTRICT,

    UNIQUE (update_id, skid_id),
    CONSTRAINT skid_identifier_not_blank
        CHECK (skid_identifier IS NULL OR btrim(skid_identifier) <> '')
);

CREATE UNIQUE INDEX skids_station_name_unique
    ON public.skids (station_id, lower(btrim(name)));

CREATE UNIQUE INDEX prms_station_name_unique
    ON public.prms_units (station_id, lower(btrim(name)));

CREATE UNIQUE INDEX update_prms_name_unique
    ON public.update_prms_readings (update_id, lower(btrim(prms_name)))
    WHERE prms_name IS NOT NULL;

CREATE UNIQUE INDEX update_skid_identifier_unique
    ON public.update_skid_readings (update_id, lower(btrim(skid_identifier)))
    WHERE skid_identifier IS NOT NULL;
