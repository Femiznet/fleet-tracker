create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  group_name text not null unique,
  cutoff_bar numeric not null default 20,
  trip_minutes integer,
  full_bar numeric not null default 199,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table customers enable row level security;