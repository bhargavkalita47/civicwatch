-- Eliminate full-table report/confirmation transfers for platform totals
-- and published town discovery. Only the server's service_role may execute.
CREATE OR REPLACE FUNCTION public.civic_public_overview()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH visible AS MATERIALIZED (
    SELECT id, city_id, author_id, status
    FROM public.civic_reports WHERE moderation_state = 'visible'
  ),
  participants AS MATERIALIZED (
    SELECT city_id, author_id AS user_id FROM visible
    UNION
    SELECT r.city_id, c.user_id
    FROM visible r
    JOIN public.civic_confirmations c ON c.report_id = r.id
  ),
  city_counts AS (
    SELECT city_id,
      count(*)::integer AS reports,
      count(*) FILTER (WHERE status <> 'resolved')::integer AS open,
      count(*) FILTER (WHERE status = 'resolved')::integer AS resolved
    FROM visible GROUP BY city_id
  ),
  city_people AS (
    SELECT city_id, count(DISTINCT user_id)::integer AS people
    FROM participants GROUP BY city_id
  ),
  all_counts AS (
    SELECT count(*)::integer AS reports,
      count(*) FILTER (WHERE status <> 'resolved')::integer AS open,
      count(*) FILTER (WHERE status = 'resolved')::integer AS resolved
    FROM visible
  )
  SELECT jsonb_build_object(
    'platform', jsonb_build_object(
      'reports', (SELECT reports FROM all_counts),
      'open', (SELECT open FROM all_counts),
      'resolved', (SELECT resolved FROM all_counts),
      'people', (SELECT count(DISTINCT user_id)::integer FROM participants)
    ),
    'cities', COALESCE((
      SELECT jsonb_object_agg(c.city_id, jsonb_build_object(
        'reports', c.reports,
        'open', c.open,
        'resolved', c.resolved,
        'people', COALESCE(p.people, 0)
      ))
      FROM city_counts c LEFT JOIN city_people p USING(city_id)
    ), '{}'::jsonb),
    'updatedAt', now()
  );
$$;

CREATE OR REPLACE FUNCTION public.civic_public_cities()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', row.city_id,
    'name', row.city_name,
    'region', row.city_region,
    'country', row.city_country,
    'center', jsonb_build_object('lat', row.latitude, 'lng', row.longitude),
    'radiusKm', 0
  ) ORDER BY row.city_name), '[]'::jsonb)
  FROM (
    SELECT DISTINCT ON (r.city_id)
      r.city_id, r.city_name, r.city_region, r.city_country,
      r.latitude, r.longitude
    FROM public.civic_reports r
    WHERE r.moderation_state = 'visible'
    ORDER BY r.city_id, r.created_at DESC, r.id DESC
  ) row;
$$;

REVOKE ALL ON FUNCTION public.civic_public_overview() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.civic_public_cities() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.civic_public_overview() TO service_role;
GRANT EXECUTE ON FUNCTION public.civic_public_cities() TO service_role;
