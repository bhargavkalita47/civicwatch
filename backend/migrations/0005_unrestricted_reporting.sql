-- Reporting areas are not a controlled catalogue. New places are upserted when
-- the authenticated report-create transaction is enabled. Preserve all reports.
-- Previous require_issue_city ensures every report still references a real area,
-- but does not prohibit adding new cities, towns, villages or other localities.
DELETE FROM cities WHERE id IN ('guwahati','shillong','jorhat','silchar')
  AND NOT EXISTS (SELECT 1 FROM issues WHERE issues.city_id = cities.id);
CREATE INDEX IF NOT EXISTS cities_country_region_idx ON cities(country, region, name);
