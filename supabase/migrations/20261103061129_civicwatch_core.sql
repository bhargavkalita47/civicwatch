create table public.civic_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  city text not null default '' check (char_length(city) <= 120),
  bio text not null default '' check (char_length(bio) <= 500),
  website text not null default '' check (char_length(website) <= 300)
);

create table public.civic_platform_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin'))
);
create unique index civic_one_platform_owner
  on public.civic_platform_roles (role) where role = 'owner';

create table public.civic_reports (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users(id),
  category_id text not null check (char_length(category_id) between 1 and 80),
  city_id text not null check (char_length(city_id) between 1 and 255),
  city_name text not null check (char_length(city_name) between 1 and 120),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text not null default '' check (char_length(description) <= 5000),
  address text not null default '' check (char_length(address) <= 500),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  status text not null default 'reported'
    check (status in ('reported', 'acknowledged', 'in_progress', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index civic_reports_by_author on public.civic_reports (author_id, created_at desc);
create index civic_reports_by_city_status on public.civic_reports (city_id, status, created_at desc);
create index civic_reports_active_location on public.civic_reports (latitude, longitude)
  where status <> 'resolved';

create table public.civic_comments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.civic_reports(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id),
  parent_id uuid,
  body text not null default '' check (char_length(body) <= 5000),
  created_at timestamptz not null default now(),
  unique (id, report_id),
  foreign key (parent_id, report_id)
    references public.civic_comments(id, report_id) on delete cascade
);
create index civic_comments_by_report on public.civic_comments (report_id, created_at);
create index civic_comments_by_parent on public.civic_comments (parent_id, report_id);

create table public.civic_confirmations (
  report_id uuid not null references public.civic_reports(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (report_id, user_id)
);

-- A single row allows the full watchlist order to be replaced atomically.
create table public.civic_watchlists (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  towns jsonb not null default '[]' check (jsonb_typeof(towns) = 'array')
);

alter table public.civic_profiles enable row level security;
alter table public.civic_platform_roles enable row level security;
alter table public.civic_reports enable row level security;
alter table public.civic_comments enable row level security;
alter table public.civic_confirmations enable row level security;
alter table public.civic_watchlists enable row level security;

revoke all on public.civic_profiles,
  public.civic_platform_roles, public.civic_reports, public.civic_comments,
  public.civic_confirmations, public.civic_watchlists from public, anon, authenticated;

grant select on public.civic_reports, public.civic_comments to anon, authenticated;
grant select on public.civic_profiles, public.civic_watchlists to authenticated;
grant insert (user_id, display_name, city, bio, website),
  update (display_name, city, bio, website) on public.civic_profiles to authenticated;
grant insert (towns), update (towns) on public.civic_watchlists to authenticated;
grant select, insert, update, delete on public.civic_profiles,
  public.civic_platform_roles, public.civic_reports, public.civic_comments,
  public.civic_confirmations, public.civic_watchlists to service_role;

create policy civic_reports_public_read on public.civic_reports for select to anon, authenticated using (true);
create policy civic_comments_public_read on public.civic_comments for select to anon, authenticated using (true);
create policy civic_profile_owner_read on public.civic_profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy civic_profile_owner_insert on public.civic_profiles for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy civic_profile_owner_update on public.civic_profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy civic_watchlist_owner_read on public.civic_watchlists for select to authenticated
  using (user_id = (select auth.uid()));
create policy civic_watchlist_owner_insert on public.civic_watchlists for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy civic_watchlist_owner_update on public.civic_watchlists for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Report, comment, confirmation and moderation writes stay behind the API
-- until the server can enforce validation, attachment ownership and audit rules.

