alter table public.civic_profiles add column if not exists avatar_url text not null default '';
alter table public.civic_reports
  add column if not exists city_region text not null default '',
  add column if not exists city_country text not null default '',
  add column if not exists attachments jsonb not null default '[]' check (jsonb_typeof(attachments) = 'array');
alter table public.civic_comments
  add column if not exists attachments jsonb not null default '[]' check (jsonb_typeof(attachments) = 'array');

create table if not exists public.civic_media (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) <= 255),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size integer not null check (size between 1 and 15728640),
  created_at timestamptz not null default now()
);
alter table public.civic_media enable row level security;
revoke all on public.civic_media from public, anon, authenticated;
grant select, insert, update, delete on public.civic_media to service_role;

create index if not exists civic_media_owner on public.civic_media (owner_id);
create index if not exists civic_reports_attachments on public.civic_reports using gin (attachments jsonb_path_ops);
create index if not exists civic_comments_attachments on public.civic_comments using gin (attachments jsonb_path_ops);
create index if not exists civic_profiles_avatar on public.civic_profiles (avatar_url) where avatar_url <> '';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('civic-media', 'civic-media', false, 15728640, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
