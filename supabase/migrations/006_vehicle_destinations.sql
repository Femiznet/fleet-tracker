alter table public.vehicle_tracking
  alter column destination_name set default 'Ibadan Delivery Hub',
  add column destination_lat numeric not null default 7.377,
  add column destination_lon numeric not null default 3.947;
