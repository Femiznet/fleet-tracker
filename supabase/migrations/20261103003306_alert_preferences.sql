create table alert_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  dashboard_alerts boolean not null default false,
  whatsapp_alerts boolean not null default false,
  whatsapp_number text,
  updated_at timestamptz not null default now(),
  constraint whatsapp_number_format
    check (whatsapp_number is null or whatsapp_number ~ '^\+[1-9][0-9]{7,14}$'),
  constraint whatsapp_needs_number
    check (not whatsapp_alerts or whatsapp_number is not null)
);

alter table alert_preferences enable row level security;

create policy "Users read their own alert preferences"
  on alert_preferences for select
  using (auth.uid() = user_id);

create policy "Users create their own alert preferences"
  on alert_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users update their own alert preferences"
  on alert_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);