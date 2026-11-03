-- Restrict direct Supabase Data API reads to content still public.
-- The Worker intentionally keeps full access through the server-side service role
-- for moderator review and reversible moderation.
drop policy if exists civic_reports_public_read on public.civic_reports;
create policy civic_reports_public_read on public.civic_reports
  for select to anon, authenticated
  using (moderation_state = 'visible');

drop policy if exists civic_comments_public_read on public.civic_comments;
create policy civic_comments_public_read on public.civic_comments
  for select to anon, authenticated
  using (
    moderation_state = 'visible'
    and exists (
      select 1 from public.civic_reports r
      where r.id = civic_comments.report_id
        and r.moderation_state = 'visible'
    )
  );

-- Smaller working set for public report reads (and city/map exploration).
create index if not exists civic_reports_visible_recent
  on public.civic_reports (created_at desc, id desc)
  where moderation_state = 'visible';
