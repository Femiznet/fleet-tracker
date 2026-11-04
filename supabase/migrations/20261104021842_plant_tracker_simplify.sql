-- Simplify the plant tracker: in plant / out of plant, status, skid gas state, event log.
-- Keeps registered trucks and skids. The old movement history and the five locations are dropped.

drop function if exists move_truck(uuid, plant_location, uuid);
drop function if exists move_skid(uuid, plant_location, uuid);
drop function if exists hook_skid(uuid, uuid, uuid);
drop function if exists unhook_skid(uuid, uuid, plant_location);
drop table if exists plant_movements;

alter table trucks rename column location_since to state_since;
alter table skids rename column location_since to state_since;

alter table trucks
  add column in_plant boolean not null default true,
  add column status text not null default 'active' check (status in ('active', 'maintenance')),
  add column customer_id uuid references customers (id);

update trucks set in_plant = (location <> 'out_of_plant');
alter table trucks drop column location;

alter table skids drop constraint skid_location_rule;

alter table skids
  add column in_plant boolean not null default true,
  add column status text not null default 'active' check (status in ('active', 'maintenance')),
  add column gas_state text not null default 'empty' check (gas_state in ('empty', 'loading', 'loaded')),
  add column customer_id uuid references customers (id);

update skids set in_plant = (location <> 'out_of_plant') where truck_id is null;
update skids s set in_plant = t.in_plant from trucks t where s.truck_id = t.id;
alter table skids drop column location;

drop type plant_location;

create table plant_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  recorded_at timestamptz not null default now(),
  by_user uuid references auth.users (id),
  event text not null check (event in (
    'arrived', 'dispatched', 'hooked', 'unhooked',
    'maintenance_start', 'maintenance_end', 'gas_state'
  )),
  truck_id uuid references trucks (id),
  skid_id uuid references skids (id),
  customer_id uuid references customers (id),
  gas_state text check (gas_state in ('empty', 'loading', 'loaded')),
  note text
);

create index plant_events_truck_idx on plant_events (truck_id, occurred_at desc);
create index plant_events_skid_idx on plant_events (skid_id, occurred_at desc);
create index plant_events_recent_idx on plant_events (occurred_at desc);

alter table plant_events enable row level security;

-- Arrival: a truck (optionally with the skid it brought back), or a skid on its own.
-- A skid the truck left with that is not the one it came back with stays out of plant, at the customer.
create or replace function record_arrival(
  p_truck uuid, p_skid uuid, p_gas text, p_at timestamptz, p_note text, p_user uuid
) returns void language plpgsql as $$
declare
  v_t trucks%rowtype;
  v_s skids%rowtype;
  v_old uuid;
  v_at timestamptz := coalesce(p_at, now());
begin
  if p_truck is null and p_skid is null then
    raise exception 'Choose a truck or a skid.';
  end if;
  if p_gas is not null and p_gas not in ('empty', 'loading', 'loaded') then
    raise exception 'Invalid gas state.';
  end if;

  if p_truck is not null then
    select * into v_t from trucks where id = p_truck for update;
    if not found then raise exception 'Truck not found.'; end if;
    if v_t.in_plant then raise exception 'That truck is already in the plant.'; end if;
  end if;

  if p_skid is not null then
    select * into v_s from skids where id = p_skid for update;
    if not found then raise exception 'Skid not found.'; end if;
  end if;

  if p_truck is not null then
    select id into v_old from skids where truck_id = p_truck for update;

    if v_old is not null and (p_skid is null or v_old <> p_skid) then
      update skids
      set truck_id = null, in_plant = false, customer_id = v_t.customer_id, state_since = v_at
      where id = v_old;

      insert into plant_events (occurred_at, by_user, event, truck_id, skid_id, customer_id, note)
      values (v_at, p_user, 'unhooked', p_truck, v_old, v_t.customer_id, 'Left at the customer');
    end if;

    if p_skid is not null then
      if v_s.truck_id is not null and v_s.truck_id <> p_truck then
        raise exception 'That skid is hooked to another truck.';
      end if;
      update skids
      set truck_id = p_truck, in_plant = true, customer_id = null,
          state_since = v_at, gas_state = coalesce(p_gas, gas_state)
      where id = p_skid;
    end if;

    update trucks set in_plant = true, customer_id = null, state_since = v_at where id = p_truck;
  else
    if v_s.in_plant then raise exception 'That skid is already in the plant.'; end if;
    if v_s.truck_id is not null then
      raise exception 'That skid is hooked to a truck. Record the truck arriving instead.';
    end if;
    update skids
    set in_plant = true, customer_id = null, state_since = v_at, gas_state = coalesce(p_gas, gas_state)
    where id = p_skid;
  end if;

  insert into plant_events (occurred_at, by_user, event, truck_id, skid_id, gas_state, note)
  values (v_at, p_user, 'arrived', p_truck, p_skid, p_gas, p_note);
end $$;

-- Dispatch: an active truck in plant with an active, loaded skid goes to a customer.
create or replace function record_dispatch(
  p_truck uuid, p_skid uuid, p_customer uuid, p_at timestamptz, p_note text, p_user uuid
) returns void language plpgsql as $$
declare
  v_t trucks%rowtype;
  v_s skids%rowtype;
  v_hooked uuid;
  v_skid uuid;
  v_at timestamptz := coalesce(p_at, now());
begin
  if p_customer is null then raise exception 'Choose a customer.'; end if;

  select * into v_t from trucks where id = p_truck for update;
  if not found then raise exception 'Truck not found.'; end if;
  if not v_t.active then raise exception 'That truck is not in the fleet.'; end if;
  if v_t.status <> 'active' then raise exception 'That truck is in maintenance.'; end if;
  if not v_t.in_plant then raise exception 'That truck is already out of plant.'; end if;

  select id into v_hooked from skids where truck_id = p_truck for update;
  v_skid := coalesce(p_skid, v_hooked);
  if v_skid is null then raise exception 'Choose a skid to send.'; end if;
  if v_hooked is not null and v_hooked <> v_skid then
    raise exception 'That truck already carries another skid. Unhook it first.';
  end if;

  select * into v_s from skids where id = v_skid for update;
  if not found then raise exception 'Skid not found.'; end if;
  if not v_s.active then raise exception 'That skid is not in the fleet.'; end if;
  if v_s.status <> 'active' then raise exception 'That skid is in maintenance.'; end if;
  if not v_s.in_plant then raise exception 'That skid is out of plant.'; end if;
  if v_s.gas_state <> 'loaded' then raise exception 'That skid is not loaded.'; end if;
  if v_s.truck_id is not null and v_s.truck_id <> p_truck then
    raise exception 'That skid is hooked to another truck.';
  end if;

  update skids
  set truck_id = p_truck, in_plant = false, customer_id = p_customer, state_since = v_at
  where id = v_skid;

  update trucks
  set in_plant = false, customer_id = p_customer, state_since = v_at
  where id = p_truck;

  insert into plant_events (occurred_at, by_user, event, truck_id, skid_id, customer_id, note)
  values (v_at, p_user, 'dispatched', p_truck, v_skid, p_customer, p_note);
end $$;

create or replace function hook_skid(p_truck uuid, p_skid uuid, p_user uuid)
returns void language plpgsql as $$
declare
  v_t trucks%rowtype;
  v_s skids%rowtype;
begin
  select * into v_t from trucks where id = p_truck for update;
  if not found then raise exception 'Truck not found.'; end if;
  select * into v_s from skids where id = p_skid for update;
  if not found then raise exception 'Skid not found.'; end if;

  if not v_t.in_plant or not v_s.in_plant then
    raise exception 'Both must be in the plant. Record the arrival first.';
  end if;
  if v_t.status <> 'active' then raise exception 'That truck is in maintenance.'; end if;
  if v_s.status <> 'active' then raise exception 'That skid is in maintenance.'; end if;
  if v_s.truck_id is not null then raise exception 'That skid is already hooked to a truck.'; end if;
  if exists (select 1 from skids where truck_id = p_truck) then
    raise exception 'That truck already has a skid.';
  end if;

  update skids set truck_id = p_truck, state_since = now() where id = p_skid;

  insert into plant_events (by_user, event, truck_id, skid_id)
  values (p_user, 'hooked', p_truck, p_skid);
end $$;

create or replace function unhook_skid(p_skid uuid, p_user uuid)
returns void language plpgsql as $$
declare
  v_truck uuid;
  v_in_plant boolean;
begin
  select truck_id into v_truck from skids where id = p_skid;
  if v_truck is null then raise exception 'That skid is not hooked.'; end if;

  perform 1 from trucks where id = v_truck for update;
  select in_plant into v_in_plant from skids where id = p_skid and truck_id = v_truck for update;
  if not found then raise exception 'That skid was just changed. Refresh and try again.'; end if;
  if not v_in_plant then
    raise exception 'It is out of plant. Record the arrival to bring it back.';
  end if;

  update skids set truck_id = null, state_since = now() where id = p_skid;

  insert into plant_events (by_user, event, truck_id, skid_id)
  values (p_user, 'unhooked', v_truck, p_skid);
end $$;

create or replace function set_gas_state(p_skid uuid, p_state text, p_user uuid)
returns void language plpgsql as $$
declare
  v_s skids%rowtype;
begin
  if p_state not in ('empty', 'loading', 'loaded') then raise exception 'Invalid gas state.'; end if;

  select * into v_s from skids where id = p_skid for update;
  if not found then raise exception 'Skid not found.'; end if;
  if not v_s.in_plant then raise exception 'It is out of plant. Record the arrival first.'; end if;
  if p_state in ('loading', 'loaded') and v_s.status <> 'active' then
    raise exception 'That skid is in maintenance.';
  end if;
  if v_s.gas_state = p_state then return; end if;

  update skids set gas_state = p_state where id = p_skid;

  insert into plant_events (by_user, event, skid_id, truck_id, gas_state)
  values (p_user, 'gas_state', p_skid, v_s.truck_id, p_state);
end $$;

create or replace function set_maintenance(
  p_kind text, p_id uuid, p_on boolean, p_note text, p_user uuid
) returns void language plpgsql as $$
declare
  v_in_plant boolean;
  v_status text;
  v_new text := case when p_on then 'maintenance' else 'active' end;
begin
  if p_kind = 'truck' then
    select in_plant, status into v_in_plant, v_status from trucks where id = p_id for update;
  elsif p_kind = 'skid' then
    select in_plant, status into v_in_plant, v_status from skids where id = p_id for update;
  else
    raise exception 'Unknown item type.';
  end if;

  if not found then raise exception 'Not found.'; end if;
  if not v_in_plant then raise exception 'It is out of plant. Record the arrival first.'; end if;
  if v_status = v_new then return; end if;

  if p_kind = 'truck' then
    update trucks set status = v_new where id = p_id;
  else
    update skids set status = v_new where id = p_id;
  end if;

  insert into plant_events (by_user, event, truck_id, skid_id, note)
  values (
    p_user,
    case when p_on then 'maintenance_start' else 'maintenance_end' end,
    case when p_kind = 'truck' then p_id end,
    case when p_kind = 'skid' then p_id end,
    p_note
  );
end $$;

-- Only the server (service role) may call these.
revoke all on function record_arrival(uuid, uuid, text, timestamptz, text, uuid) from public, anon, authenticated;
revoke all on function record_dispatch(uuid, uuid, uuid, timestamptz, text, uuid) from public, anon, authenticated;
revoke all on function hook_skid(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function unhook_skid(uuid, uuid) from public, anon, authenticated;
revoke all on function set_gas_state(uuid, text, uuid) from public, anon, authenticated;
revoke all on function set_maintenance(text, uuid, boolean, text, uuid) from public, anon, authenticated;

grant execute on function record_arrival(uuid, uuid, text, timestamptz, text, uuid) to service_role;
grant execute on function record_dispatch(uuid, uuid, uuid, timestamptz, text, uuid) to service_role;
grant execute on function hook_skid(uuid, uuid, uuid) to service_role;
grant execute on function unhook_skid(uuid, uuid) to service_role;
grant execute on function set_gas_state(uuid, text, uuid) to service_role;
grant execute on function set_maintenance(text, uuid, boolean, text, uuid) to service_role;