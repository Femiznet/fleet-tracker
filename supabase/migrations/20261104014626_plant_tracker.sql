create type plant_location as enum (
  'workshop', 'washing_bay', 'loading_bay', 'parking', 'ngv_area', 'out_of_plant'
);

create table trucks (
  id uuid primary key default gen_random_uuid(),
  plate_number text not null,
  plate_key text generated always as (upper(regexp_replace(plate_number, '[^A-Za-z0-9]', '', 'g'))) stored unique,
  location plant_location not null default 'parking',
  location_since timestamptz not null default now(),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create table skids (
  id uuid primary key default gen_random_uuid(),
  skid_number text not null,
  skid_key text generated always as (upper(regexp_replace(skid_number, '[^A-Za-z0-9]', '', 'g'))) stored unique,
  truck_id uuid unique references trucks (id) on delete restrict,
  location plant_location default 'parking',
  location_since timestamptz not null default now(),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  -- hooked skid has no location of its own (it follows the truck); a loose skid always has one
  constraint skid_location_rule check ((truck_id is null) = (location is not null))
);

create table plant_movements (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  by_user uuid references auth.users (id),
  truck_id uuid references trucks (id),
  skid_id uuid references skids (id),
  action text not null check (action in ('move_truck', 'move_skid', 'hook', 'unhook')),
  from_location plant_location,
  to_location plant_location
);

create index plant_movements_truck_idx on plant_movements (truck_id, at desc);
create index plant_movements_skid_idx on plant_movements (skid_id, at desc);

alter table trucks enable row level security;
alter table skids enable row level security;
alter table plant_movements enable row level security;

create or replace function move_truck(p_truck uuid, p_to plant_location, p_user uuid)
returns void language plpgsql as $$
declare
  v_from plant_location;
  v_skid uuid;
begin
  select location into v_from from trucks where id = p_truck for update;
  if not found then raise exception 'Truck not found.'; end if;
  if v_from = p_to then return; end if;

  update trucks set location = p_to, location_since = now() where id = p_truck;
  select id into v_skid from skids where truck_id = p_truck;

  insert into plant_movements (by_user, truck_id, skid_id, action, from_location, to_location)
  values (p_user, p_truck, v_skid, 'move_truck', v_from, p_to);
end $$;

create or replace function move_skid(p_skid uuid, p_to plant_location, p_user uuid)
returns void language plpgsql as $$
declare
  v_from plant_location;
  v_truck uuid;
begin
  select location, truck_id into v_from, v_truck from skids where id = p_skid for update;
  if not found then raise exception 'Skid not found.'; end if;
  if v_truck is not null then
    raise exception 'This skid is hooked to a truck. Move the truck instead.';
  end if;
  if v_from = p_to then return; end if;

  update skids set location = p_to, location_since = now() where id = p_skid;

  insert into plant_movements (by_user, skid_id, action, from_location, to_location)
  values (p_user, p_skid, 'move_skid', v_from, p_to);
end $$;

create or replace function hook_skid(p_truck uuid, p_skid uuid, p_user uuid)
returns void language plpgsql as $$
declare
  v_truck_loc plant_location;
  v_skid_loc plant_location;
  v_skid_truck uuid;
begin
  select location into v_truck_loc from trucks where id = p_truck for update;
  if not found then raise exception 'Truck not found.'; end if;

  select location, truck_id into v_skid_loc, v_skid_truck from skids where id = p_skid for update;
  if not found then raise exception 'Skid not found.'; end if;

  if v_skid_truck is not null then raise exception 'That skid is already hooked to a truck.'; end if;
  if exists (select 1 from skids where truck_id = p_truck) then
    raise exception 'That truck already has a skid.';
  end if;

  update skids set truck_id = p_truck, location = null, location_since = now() where id = p_skid;

  insert into plant_movements (by_user, truck_id, skid_id, action, from_location, to_location)
  values (p_user, p_truck, p_skid, 'hook', v_skid_loc, v_truck_loc);
end $$;

create or replace function unhook_skid(p_skid uuid, p_user uuid, p_to plant_location default null)
returns void language plpgsql as $$
declare
  v_truck uuid;
  v_loc plant_location;
begin
  select truck_id into v_truck from skids where id = p_skid;
  if v_truck is null then raise exception 'That skid is not hooked.'; end if;

  select location into v_loc from trucks where id = v_truck for update;
  perform 1 from skids where id = p_skid and truck_id = v_truck for update;
  if not found then raise exception 'That skid was just changed. Refresh and try again.'; end if;

  update skids
  set truck_id = null, location = coalesce(p_to, v_loc), location_since = now()
  where id = p_skid;

  insert into plant_movements (by_user, truck_id, skid_id, action, from_location, to_location)
  values (p_user, v_truck, p_skid, 'unhook', v_loc, coalesce(p_to, v_loc));
end $$;

-- Only the server (service role) may call these.
revoke all on function move_truck(uuid, plant_location, uuid) from public, anon, authenticated;
revoke all on function move_skid(uuid, plant_location, uuid) from public, anon, authenticated;
revoke all on function hook_skid(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function unhook_skid(uuid, uuid, plant_location) from public, anon, authenticated;

grant execute on function move_truck(uuid, plant_location, uuid) to service_role;
grant execute on function move_skid(uuid, plant_location, uuid) to service_role;
grant execute on function hook_skid(uuid, uuid, uuid) to service_role;
grant execute on function unhook_skid(uuid, uuid, plant_location) to service_role;