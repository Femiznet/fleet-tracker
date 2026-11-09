alter table public.stations
  add column latitude numeric,
  add column longitude numeric,
  add constraint stations_coordinates_pair_check
    check ((latitude is null) = (longitude is null)),
  add constraint stations_latitude_range_check
    check (latitude is null or latitude between -90 and 90),
  add constraint stations_longitude_range_check
    check (longitude is null or longitude between -180 and 180);
