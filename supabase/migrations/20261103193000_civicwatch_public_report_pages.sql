-- Bounded public report browsing for CivicWatch.
-- Used only by the Cloudflare Worker with the service-role secret.
-- Every query below enforces public visibility regardless of caller filters.
CREATE OR REPLACE FUNCTION public.civic_public_report_page(
  p_cities text[] DEFAULT NULL,
  p_author uuid DEFAULT NULL,
  p_section text DEFAULT 'active',
  p_query text DEFAULT '',
  p_categories text[] DEFAULT NULL,
  p_status text DEFAULT 'all',
  p_sort text DEFAULT 'recent',
  p_limit integer DEFAULT 10,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH scoped AS MATERIALIZED (
    SELECT r.*
    FROM public.civic_reports AS r
    WHERE r.moderation_state = 'visible'
      AND (p_cities IS NULL OR r.city_id = ANY(p_cities))
      AND (p_author IS NULL OR r.author_id = p_author)
  ),
  scope_counts AS (
    SELECT count(*)::integer AS total,
      count(*) FILTER (WHERE status <> 'resolved')::integer AS active,
      count(*) FILTER (WHERE status = 'resolved')::integer AS resolved
    FROM scoped
  ),
  matched AS MATERIALIZED (
    SELECT r.*,
      (SELECT count(*)::integer FROM public.civic_confirmations c
        WHERE c.report_id = r.id) AS confirmation_count
    FROM scoped r
    WHERE (p_section = 'all'
      OR (p_section = 'active' AND r.status <> 'resolved')
      OR (p_section = 'resolved' AND r.status = 'resolved'))
      AND (p_status = 'all' OR r.status = p_status)
      AND (p_categories IS NULL OR r.category_id = ANY(p_categories))
      AND (btrim(p_query) = ''
        OR r.title ILIKE '%' || btrim(p_query) || '%'
        OR r.address ILIKE '%' || btrim(p_query) || '%'
        OR r.description ILIKE '%' || btrim(p_query) || '%')
  ),
  ordered_page AS (
    SELECT r.*,
      row_number() OVER (
        ORDER BY
          CASE WHEN p_sort = 'supported' THEN r.confirmation_count END DESC NULLS LAST,
          r.created_at DESC, r.id DESC
      ) AS position
    FROM matched AS r
    ORDER BY
      CASE WHEN p_sort = 'supported' THEN r.confirmation_count END DESC NULLS LAST,
      r.created_at DESC, r.id DESC
    LIMIT greatest(1, least(p_limit, 50))
    OFFSET greatest(0, p_offset)
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*)::integer FROM matched),
    'pageSize', greatest(1, least(p_limit, 50)),
    'offset', greatest(0, p_offset),
    'counts', jsonb_build_object(
      'total', (SELECT total FROM scope_counts),
      'active', (SELECT active FROM scope_counts),
      'resolved', (SELECT resolved FROM scope_counts)
    ),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id,
        'categoryId', p.category_id,
        'cityId', p.city_id,
        'title', p.title,
        'description', p.description,
        'address', p.address,
        'location', jsonb_build_object('lat', p.latitude, 'lng', p.longitude),
        'status', p.status,
        'authorId', p.author_id,
        'organizationId', null,
        'confirmationUserIds', COALESCE((
          SELECT jsonb_agg(c.user_id ORDER BY c.user_id)
          FROM public.civic_confirmations c WHERE c.report_id = p.id
        ), '[]'::jsonb),
        'attachments', p.attachments,
        'createdAt', p.created_at,
        'updatedAt', p.updated_at,
        'commentCount', (
          SELECT count(*)::integer FROM public.civic_comments c
          WHERE c.report_id = p.id
        )
      ) ORDER BY p.position)
      FROM ordered_page p
    ), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.civic_public_report_page(
  text[], uuid, text, text, text[], text, text, integer, integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.civic_public_report_page(
  text[], uuid, text, text, text[], text, text, integer, integer
) TO service_role;

-- Keep common chronological browse paths indexed. Existing foreign-key,
-- city/status and author indexes are retained.
CREATE INDEX IF NOT EXISTS civic_reports_city_visible_recent
  ON public.civic_reports (city_id, created_at DESC, id DESC)
  WHERE moderation_state = 'visible';
CREATE INDEX IF NOT EXISTS civic_reports_author_visible_recent
  ON public.civic_reports (author_id, created_at DESC, id DESC)
  WHERE moderation_state = 'visible';
