alter table public.vehicle_tracking
  alter column destination_name set default 'Unknown',
  alter column destination_lat drop not null,
  alter column destination_lat drop default,
  alter column destination_lon drop not null,
  alter column destination_lon drop default,
  alter column remaining_distance_km drop not null;

update public.vehicle_tracking
set
  destination_name = 'Unknown',
  destination_lat = null,
  destination_lon = null,
  approaching_next = 'Set destination',
  remaining_distance_km = null
where destination_name = 'Ibadan Delivery Hub'
  and destination_lat = 7.377
  and destination_lon = 3.947;
