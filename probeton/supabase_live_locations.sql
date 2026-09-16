-- Таблица для отслеживания местоположения водителей в реальном времени.
-- Вставьте это в Supabase -> SQL Editor -> Run (можно запускать повторно).

create table if not exists driver_locations (
  driver_id uuid primary key,
  driver_name text,
  lat double precision not null,
  lng double precision not null,
  is_online boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table driver_locations enable row level security;

drop policy if exists "driver_locations_all" on driver_locations;
create policy "driver_locations_all" on driver_locations for all using (true) with check (true);

do $$
begin
  alter publication supabase_realtime add table driver_locations;
exception when duplicate_object then null;
end $$;
