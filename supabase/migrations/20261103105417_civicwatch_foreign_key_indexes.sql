-- Cover the three foreign keys flagged by Supabase Performance Advisor.
-- These indexes aid user deletion checks/cascades and author-scoped queries.
create index if not exists civic_admin_audit_actor_id_idx
  on public.civic_admin_audit (actor_id);
create index if not exists civic_comments_author_id_idx
  on public.civic_comments (author_id, created_at desc);
create index if not exists civic_confirmations_user_id_idx
  on public.civic_confirmations (user_id, created_at desc);
