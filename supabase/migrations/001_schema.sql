create extension if not exists pgcrypto;

create type public.truck_state  as enum ('good', 'maintenance');
create type public.truck_status as enum ('standby', 'assigned');
create type public.trip_status as enum ('in_transit', 'arrived', 'cancelled');


create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  type text not null
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null
);
create unique index companies_name_lower_key on public.companies (lower(name));

-- TRUCKS
create table public.trucks (
  id uuid primary key default gen_random_uuid(),
  plate_number text not null unique,
  company_id uuid not null references public.companies(id) on delete restrict,
  location_id uuid not null references public.locations(id) on delete restrict,
  state public.truck_state not null default 'good',
  status public.truck_status not null default 'standby',
  updated_at timestamptz not null default now()
);
create index trucks_company_idx on public.trucks (company_id);
create index trucks_location_idx on public.trucks (location_id);

-- MOTOR MATES

create table public.motormates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone_number text unique,
  created_at timestamptz not null default now()
);
create unique index motormates_name_lower_key on public.motormates (lower(name));


-- DRIVERS

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone_number text unique,
  motormate_id uuid unique references public.motormates(id) on delete set null,
  truck_id uuid unique references public.trucks(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index drivers_name_lower_key on public.drivers (lower(name));

create function public.guard_driver_truck() returns trigger language plpgsql as $$
begin
  if new.truck_id is not null
     and (select state from public.trucks where id = new.truck_id) = 'maintenance' then
    raise exception 'Truck is in maintenance and cannot be assigned';
  end if;
  return new;
end; $$;
create trigger guard_driver_truck_before_write
before insert or update of truck_id on public.drivers
for each row execute function public.guard_driver_truck();

create function public.sync_truck_status() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    if old.truck_id is not null and old.truck_id is distinct from new.truck_id then
      update public.trucks set status = 'standby', updated_at = now() where id = old.truck_id;
    end if;
  elsif tg_op = 'DELETE' and old.truck_id is not null then
    update public.trucks set status = 'standby', updated_at = now() where id = old.truck_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.truck_id is not null then
    update public.trucks set status = 'assigned', updated_at = now() where id = new.truck_id;
  end if;
  return null;
end; $$;
create trigger sync_truck_status_after_write
after insert or update of truck_id or delete on public.drivers
for each row execute function public.sync_truck_status();

create function public.release_driver_on_maintenance() returns trigger language plpgsql as $$
begin
  if new.state = 'maintenance' then
    update public.drivers set truck_id = null where truck_id = new.id;
  end if;
  return null;
end; $$;
create trigger release_driver_after_state_change
after update of state on public.trucks
for each row execute function public.release_driver_on_maintenance();


-- MANAGERS
create table public.managers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone_number text unique,
  created_at timestamptz not null default now()
);
create unique index if not exists managers_name_unique on managers (lower(name));

-- TRIPS
create table public.truck_trips (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  truck_id uuid not null references public.trucks(id) on delete restrict,
  driver_id uuid not null references public.drivers(id) on delete restrict,
  motormate_id uuid references public.motormates(id) on delete set null,
  manager_id uuid references public.managers(id) on delete set null,
  origin_id uuid not null references public.locations(id) on delete restrict,
  destination_id uuid not null references public.locations(id) on delete restrict,
  status public.trip_status not null default 'in_transit',
  check (origin_id <> destination_id)
);
create index truck_trips_truck_id_idx on public.truck_trips (truck_id);
create index truck_trips_driver_id_idx on public.truck_trips (driver_id);
create index truck_trips_motormate_id_idx on public.truck_trips (motormate_id);

create function public.before_insert_truck_trips() returns trigger language plpgsql as $$
declare
  truck_loc uuid;
begin
  if new.origin_id is null then
    select location_id into truck_loc from public.trucks where id = new.truck_id;
    if not found then
      raise exception 'Truck % has no current location', new.truck_id;
    end if;
    new.origin_id := truck_loc;
  end if;
  if (select state from public.trucks where id = new.truck_id) = 'maintenance' then
    raise exception 'Trip for truck % rejected: truck is in maintenance', new.truck_id;
  end if;
  return new;
end;
$$;

create trigger before_insert_truck_trips
before insert on public.truck_trips
for each row
execute function public.before_insert_truck_trips();

create function public.before_update_truck_trips() returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    if old.status <> 'in_transit' then
      raise exception 'Only in-transit trips can change status';
    end if;
    if new.status <> 'arrived' and new.status <> 'cancelled' then
      raise exception 'Status may only transition to arrived or cancelled';
    end if;
    new.completed_at := now();
  end if;
  if new.truck_id is not null and new.truck_id <> old.truck_id then
    raise exception 'Cannot change truck on a trip';
  end if;
  if new.driver_id is not null and new.driver_id <> old.driver_id then
    raise exception 'Cannot change driver on a trip';
  end if;
  if new.origin_id is not null and new.origin_id <> old.origin_id then
    raise exception 'Cannot change origin on a trip';
  end if;
  if new.destination_id is not null and new.destination_id <> old.destination_id then
    raise exception 'Cannot change destination on a trip';
  end if;
  return new;
end;
$$;

create trigger before_update_truck_trips
before update on public.truck_trips
for each row
execute function public.before_update_truck_trips();

create function public.after_update_truck_trips() returns trigger language plpgsql as $$
begin
  if old.status = 'in_transit' and new.status = 'arrived' then
    update public.trucks
    set location_id = new.destination_id
    where id = new.truck_id;
  end if;
  return new;
end;
$$;

create trigger after_update_truck_trips
after update on public.truck_trips
for each row
execute function public.after_update_truck_trips();

create function public.before_update_trucks() returns trigger language plpgsql as $$
begin
  if new.location_id is distinct from old.location_id then
    if exists (
      select 1 from public.truck_trips
      where truck_id = new.id
        and status = 'in_transit'
    ) then
      raise exception 'Cannot change location of a truck with an in-transit trip';
    end if;
  end if;
  if new.state = 'maintenance' and exists (
    select 1 from public.truck_trips
    where truck_id = new.id
      and status = 'in_transit'
  ) then
    raise exception 'Cannot set a truck in maintenance while it has an in-transit trip';
  end if;
  return new;
end;
$$;

create trigger before_update_trucks
before update on public.trucks
for each row
execute function public.before_update_trucks();

create unique index trip_trips_in_transit_truck_id_key on public.truck_trips (truck_id) where status = 'in_transit';
create unique index trip_trips_in_transit_driver_id_key on public.truck_trips (driver_id) where status = 'in_transit';
create unique index trip_trips_in_transit_motormate_id_key on public.truck_trips (motormate_id) where status = 'in_transit';


-- GRANT ACCESS TO ANONS

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated;