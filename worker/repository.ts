import type { D1DatabaseBinding } from "./bindings";

/**
 * Call ONLY after verifying the user server-side from a signed, HttpOnly session.
 * The actor is never accepted from request JSON, URL params or client headers.
 * Foreign keys must be enforced (D1 defaults to FK enforcement).
 * This intentionally does not turn on the API scaffold.
 */
export async function deleteIssueAsAuthor(db: D1DatabaseBinding, issueId: string, verifiedActorId: string): Promise<boolean> {
  if (!issueId || !verifiedActorId) return false;
  const result = await db.prepare("DELETE FROM issues WHERE id = ? AND author_id = ?")
    .bind(issueId, verifiedActorId).run();
  return result.success && result.meta.changes === 1;
}

/** Public city catalogue is storage-backed when D1 is provisioned. */
export async function listCities(db: D1DatabaseBinding) {
  const { results } = await db.prepare("SELECT id,name,region,country,center_lat,center_lng,radius_km FROM cities WHERE EXISTS (SELECT 1 FROM issues WHERE issues.city_id=cities.id) ORDER BY name").all<{
    id: string; name: string; region: string; country: string;
    center_lat: number; center_lng: number; radius_km: number;
  }>();
  return results.map((row) => ({
    id: row.id, name: row.name, region: row.region, country: row.country,
    center: { lat: row.center_lat, lng: row.center_lng }, radiusKm: row.radius_km,
  }));
}

/** Call inside a validated, authenticated report-creation transaction in the future API. */
export async function upsertReportingArea(db: D1DatabaseBinding, area: import("../src/domain/types").City) {
  if (!area.id || !area.name || !area.region || !area.country ||
      !Number.isFinite(area.center.lat) || !Number.isFinite(area.center.lng) ||
      Math.abs(area.center.lat) > 90 || Math.abs(area.center.lng) > 180) {
    throw new Error("Invalid reporting area");
  }
  return db.prepare(`INSERT INTO cities (id,name,region,country,center_lat,center_lng,radius_km)
     VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`)
     .bind(area.id, area.name, area.region, area.country, area.center.lat, area.center.lng, area.radiusKm || 20).run();
}
