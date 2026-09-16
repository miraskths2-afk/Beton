-- Добавляет поля для имени пользователя, согласия с офертой и настроек.
-- Вставьте в Supabase -> SQL Editor -> Run (можно запускать повторно).

alter table app_users add column if not exists full_name text;
alter table app_users add column if not exists terms_accepted boolean not null default false;
alter table app_users add column if not exists terms_version text;
alter table app_users add column if not exists notifications_enabled boolean not null default true;
