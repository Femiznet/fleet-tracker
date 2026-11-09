create table public.vehicle_dispatches (
  id uuid primary key default gen_random_uuid(),
  plate_number text not null references public.vehicle_tracking(plate_number) on delete restrict,
  customer_station_id uuid not null references public.stations(id) on delete restrict,
  destination_name text not null,
  destination_lat numeric not null check (destination_lat between -90 and 90),
  destination_lon numeric not null check (destination_lon between -180 and 180),
  start_lat numeric not null check (start_lat between -90 and 90),
  start_lon numeric not null check (start_lon between -180 and 180),
  status text not null default 'in_transit'
    check (status in ('in_transit', 'arrived', 'cancelled')),
  started_at timestamptz not null default now(),
  arrived_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create unique index vehicle_dispatches_one_active_per_vehicle
  on public.vehicle_dispatches (plate_number)
  where status = 'in_transit';

alter table public.vehicle_dispatches enable row level security;
revoke all on table public.vehicle_dispatches from public, anon, authenticated;
grant all on table public.vehicle_dispatches to service_role;
