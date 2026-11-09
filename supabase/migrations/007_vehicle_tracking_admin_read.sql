alter table public.vehicle_tracking enable row level security;

revoke all on table public.vehicle_tracking from public, anon, authenticated;
grant select on table public.vehicle_tracking to authenticated;

create policy vehicle_tracking_admin_select
on public.vehicle_tracking
for select
to authenticated
using (public.is_admin());
