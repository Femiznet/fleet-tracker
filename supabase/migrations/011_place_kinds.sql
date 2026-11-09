alter table public.stations
  add column place_kind text not null default 'station'
    check (place_kind in ('station', 'milestone'));

create index stations_milestones_with_coordinates_idx
  on public.stations (place_kind)
  where place_kind = 'milestone'
    and latitude is not null
    and longitude is not null;
