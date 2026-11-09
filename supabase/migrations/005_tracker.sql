create table public.vehicle_tracking (
    plate_number text primary key,
    fleet_owner text not null,
    speed numeric not null,
    status text not null,
    total_mileage numeric not null,
    current_address text,
    approaching_next text not null,
    destination_name text not null,
    remaining_distance_km numeric not null,
    lat numeric not null,
    lon numeric not null,
    last_sync timestamp with time zone not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 1. Ensure the replica identity is set to full to capture complete updates
alter table public.vehicle_tracking replica identity full;

-- 2. Correctly add the table to the existing supabase_realtime publication
alter publication supabase_realtime add table public.vehicle_tracking;
