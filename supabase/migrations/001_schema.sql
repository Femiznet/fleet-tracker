create extension if not exists pgcrypto;

create type public.truck_state  as enum ('good', 'maintenance');
create type public.truck_status as enum ('standby', 'assigned');

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

-- GRANT ACCESS TO ANONS

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated;