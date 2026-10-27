create extension if not exists pgcrypto;

-- ENUMS

create type public.object_tracking_status as enum (
  'online',
  'in_transit',
  'empty',
  'loaded',
  'maintenance'
);

create type public.dispatch_status as enum (
  'in_transit',
  'arrived',
  'cancelled'
);


-- REGISTERED DATA

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  phone_number text unique
);

create table public.motormates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  phone_number text unique
);

create table public.trucks (
  id uuid primary key default gen_random_uuid(),
  plate_number text not null unique
);

create table public.skids (
  id uuid primary key default gen_random_uuid(),
  skid_no text not null unique
);

create table public.managers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  type text not null
);


-- DRIVER AND MOTORMATE PAIRING

create table public.driver_motormate (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null unique
    references public.drivers(id) on delete cascade,
  motormate_id uuid not null unique
    references public.motormates(id) on delete cascade
);


-- DRIVER AND TRUCK ASSIGNMENTS

create table public.driver_trucks (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null
    references public.drivers(id) on delete cascade,
  truck_id uuid not null unique
    references public.trucks(id) on delete cascade
);


-- CURRENT TRUCK AND SKID TRACKING

create table public.object_tracker (
  id uuid primary key default gen_random_uuid(),

  location_id uuid not null
    references public.locations(id) on delete restrict,

  truck_id uuid unique
    references public.trucks(id) on delete cascade,

  skid_id uuid unique
    references public.skids(id) on delete cascade,

  status public.object_tracking_status not null default 'online',

  updated_at timestamptz not null default now(),

  check (
    (truck_id is not null and skid_id is null)
    or
    (truck_id is null and skid_id is not null)
  )
);


-- DISPATCH HISTORY

create table public.trip_tracker (
  id uuid primary key default gen_random_uuid(),

  manager_id uuid not null
    references public.managers(id) on delete restrict,

  driver_id uuid not null
    references public.drivers(id) on delete restrict,

  motormate_id uuid not null
    references public.motormates(id) on delete restrict,

  truck_id uuid not null
    references public.trucks(id) on delete restrict,

  skid_id uuid
    references public.skids(id) on delete restrict,

  origin uuid not null
    references public.locations(id) on delete restrict,

  destination uuid not null
    references public.locations(id) on delete restrict,

  status public.dispatch_status not null default 'in_transit',

  created_at timestamptz not null default now(),
  completed_at timestamptz,

  truck_previous_location_id uuid
    references public.locations(id) on delete set null,
  truck_previous_status public.object_tracking_status,

  skid_previous_location_id uuid
    references public.locations(id) on delete set null,
  skid_previous_status public.object_tracking_status,

  check (origin <> destination),

  check (
    (status = 'in_transit' and completed_at is null)
    or
    (status in ('arrived', 'cancelled') and completed_at is not null)
  )
);


-- ONLY ONE ACTIVE DISPATCH PER RESOURCE

create unique index one_active_dispatch_per_truck
  on public.trip_tracker (truck_id)
  where status = 'in_transit';

create unique index one_active_dispatch_per_driver
  on public.trip_tracker (driver_id)
  where status = 'in_transit';

create unique index one_active_dispatch_per_motormate
  on public.trip_tracker (motormate_id)
  where status = 'in_transit';

create unique index one_active_dispatch_per_skid
  on public.trip_tracker (skid_id)
  where status = 'in_transit';


-- PREPARE DISPATCH AND SAVE PREVIOUS STATES

create or replace function public.prepare_dispatch()
returns trigger
language plpgsql
as $$
begin
  select location_id, status
  into new.truck_previous_location_id,
       new.truck_previous_status
  from public.object_tracker
  where truck_id = new.truck_id;

  if not found then
    raise exception 'Truck has no tracking record';
  end if;

  if new.origin <> new.truck_previous_location_id then
    raise exception 'Dispatch origin must match the truck location';
  end if;

  if new.skid_id is not null then
    select location_id, status
    into new.skid_previous_location_id,
         new.skid_previous_status
    from public.object_tracker
    where skid_id = new.skid_id;

    if not found then
      raise exception 'Skid has no tracking record';
    end if;

    if new.origin <> new.skid_previous_location_id then
      raise exception 'Skid must be at the dispatch origin';
    end if;
  end if;

  return new;
end;
$$;

create trigger prepare_dispatch_before_insert
before insert on public.trip_tracker
for each row
execute function public.prepare_dispatch();


-- SET OBJECTS TO IN_TRANSIT WHEN DISPATCH IS CREATED

create or replace function public.start_dispatch_tracking()
returns trigger
language plpgsql
as $$
begin
  update public.object_tracker
  set status = 'in_transit',
      updated_at = now()
  where truck_id = new.truck_id;

  if new.skid_id is not null then
    update public.object_tracker
    set status = 'in_transit',
        updated_at = now()
    where skid_id = new.skid_id;
  end if;

  return new;
end;
$$;

create trigger start_dispatch_tracking_after_insert
after insert on public.trip_tracker
for each row
execute function public.start_dispatch_tracking();


-- HANDLE ARRIVAL AND CANCELLATION

create or replace function public.sync_dispatch_tracking()
returns trigger
language plpgsql
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if old.status <> 'in_transit' then
    raise exception 'Only an in-transit dispatch can be changed';
  end if;

  if new.status = 'arrived' then

    -- Move truck to destination and restore its previous status.
    update public.object_tracker
    set location_id = new.destination,
        status = coalesce(new.truck_previous_status, 'online'),
        updated_at = now()
    where truck_id = new.truck_id;

    -- Move optional skid, preserving its previous status.
    if new.skid_id is not null then
      update public.object_tracker
      set location_id = new.destination,
          status = coalesce(new.skid_previous_status, 'online'),
          updated_at = now()
      where skid_id = new.skid_id;
    end if;

    new.completed_at := now();

  elsif new.status = 'cancelled' then

    -- Restore truck's previous state.
    update public.object_tracker
    set location_id = new.truck_previous_location_id,
        status = coalesce(new.truck_previous_status, 'online'),
        updated_at = now()
    where truck_id = new.truck_id;

    -- Restore optional skid's previous state.
    if new.skid_id is not null then
      update public.object_tracker
      set location_id = new.skid_previous_location_id,
          status = coalesce(new.skid_previous_status, 'online'),
          updated_at = now()
      where skid_id = new.skid_id;
    end if;

    new.completed_at := now();
  end if;

  return new;
end;
$$;

create trigger sync_dispatch_tracking_before_update
before update of status on public.trip_tracker
for each row
execute function public.sync_dispatch_tracking();
