-- Keep comment identity and reply links while letting the author remove
-- their words and photo references from the public discussion.
alter table public.civic_comments
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz;

comment on column public.civic_comments.deleted_at is
  'Author deletion tombstone. Body and attachments must be cleared by the Worker; replies remain.';
comment on column public.civic_comments.edited_at is
  'Timestamp of the last author edit to the comment body or attachments.';

-- Existing comments remain readable. Direct client UPDATE/DELETE grants are
-- intentionally unchanged: only the authenticated Worker may mutate comments
-- after checking author_id against its authenticated session.
