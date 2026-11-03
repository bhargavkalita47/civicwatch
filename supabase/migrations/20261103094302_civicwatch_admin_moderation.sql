-- CivicWatch administration: reversible moderation and transactional audit trail.
alter table public.civic_reports
  add column if not exists moderation_state text not null default 'visible'
  check (moderation_state in ('visible', 'hidden'));
alter table public.civic_comments
  add column if not exists moderation_state text not null default 'visible'
  check (moderation_state in ('visible', 'hidden'));

create table if not exists public.civic_admin_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in (
    'admin_granted', 'admin_revoked',
    'report_hidden', 'report_restored', 'report_status_changed',
    'comment_hidden', 'comment_restored'
  )),
  target_id uuid not null,
  reason text not null default '' check (char_length(reason) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists civic_admin_audit_recent
  on public.civic_admin_audit (created_at desc, id desc);
alter table public.civic_admin_audit enable row level security;
revoke all on public.civic_admin_audit from public, anon, authenticated;
grant select, insert on public.civic_admin_audit to service_role;
grant usage, select on sequence public.civic_admin_audit_id_seq to service_role;

create or replace function public.civic_admin_set_role(
  p_actor_id uuid, p_target_id uuid, p_enabled boolean
) returns void
language plpgsql security invoker set search_path = ''
as $$
declare existing_role text;
begin
  if not exists (
    select 1 from public.civic_platform_roles
    where user_id = p_actor_id and role = 'owner'
  ) then
    raise exception 'Only the platform owner can manage administrators' using errcode = '42501';
  end if;
  if p_target_id = p_actor_id then
    raise exception 'Owner cannot change their own platform role' using errcode = '22023';
  end if;
  select role into existing_role
  from public.civic_platform_roles where user_id = p_target_id for update;
  if existing_role = 'owner' then
    raise exception 'The platform owner cannot be changed here' using errcode = '42501';
  end if;
  if p_enabled then
    insert into public.civic_platform_roles (user_id, role) values (p_target_id, 'admin')
    on conflict (user_id) do update set role = 'admin';
  else
    if existing_role is distinct from 'admin' then
      raise exception 'This account is not an administrator' using errcode = '22023';
    end if;
    delete from public.civic_platform_roles
    where user_id = p_target_id and role = 'admin';
  end if;
  insert into public.civic_admin_audit (actor_id, action, target_id)
    values (p_actor_id, case when p_enabled then 'admin_granted' else 'admin_revoked' end, p_target_id);
end;
$$;
revoke all on function public.civic_admin_set_role(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.civic_admin_set_role(uuid, uuid, boolean) to service_role;

create or replace function public.civic_admin_moderate(
  p_actor_id uuid, p_target_id uuid, p_action text,
  p_status text default null, p_reason text default ''
) returns void
language plpgsql security invoker set search_path = ''
as $$
declare audit_action text;
begin
  if not exists (
    select 1 from public.civic_platform_roles
    where user_id = p_actor_id and role in ('owner', 'admin')
  ) then
    raise exception 'Administrator authentication is required' using errcode = '42501';
  end if;
  if char_length(p_reason) > 500 then
    raise exception 'Reason exceeds 500 characters' using errcode = '22023';
  end if;
  if p_action in ('report_hide', 'comment_hide') and char_length(btrim(p_reason)) < 3 then
    raise exception 'A reason is required when hiding content' using errcode = '22023';
  end if;

  if p_action = 'report_hide' then
    update public.civic_reports set moderation_state = 'hidden', updated_at = now()
      where id = p_target_id;
    audit_action := 'report_hidden';
  elsif p_action = 'report_restore' then
    update public.civic_reports set moderation_state = 'visible', updated_at = now()
      where id = p_target_id;
    audit_action := 'report_restored';
  elsif p_action = 'report_status' then
    if p_status is null or p_status not in ('reported', 'acknowledged', 'in_progress', 'resolved') then
      raise exception 'Invalid report status' using errcode = '22023';
    end if;
    update public.civic_reports set status = p_status, updated_at = now()
      where id = p_target_id;
    audit_action := 'report_status_changed';
  elsif p_action = 'comment_hide' then
    update public.civic_comments set moderation_state = 'hidden'
      where id = p_target_id;
    audit_action := 'comment_hidden';
  elsif p_action = 'comment_restore' then
    update public.civic_comments set moderation_state = 'visible'
      where id = p_target_id;
    audit_action := 'comment_restored';
  else
    raise exception 'Unsupported moderation action' using errcode = '22023';
  end if;
  if not found then
    raise exception 'Moderation target not found' using errcode = 'P0002';
  end if;
  insert into public.civic_admin_audit (actor_id, action, target_id, reason)
    values (p_actor_id, audit_action, p_target_id, btrim(p_reason));
end;
$$;
revoke all on function public.civic_admin_moderate(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.civic_admin_moderate(uuid, uuid, text, text, text)
  to service_role;
