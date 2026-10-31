import type { D1DatabaseBinding } from "./bindings";

/** All actor identities here MUST come from a validated server-side session, never request JSON. */
export async function getPlatformRole(db: D1DatabaseBinding, verifiedActorId: string): Promise<"owner" | "administrator" | null> {
  if (!verifiedActorId) return null;
  const row = await db.prepare("SELECT role FROM platform_roles WHERE user_id = ?").bind(verifiedActorId).first<{role:"owner"|"administrator"}>();
  return row?.role ?? null;
}
export async function requireOwner(db: D1DatabaseBinding, verifiedActorId: string): Promise<void> {
  if (await getPlatformRole(db, verifiedActorId) !== "owner") throw new Error("FORBIDDEN: only the verified platform owner may manage administrators");
}
/** Grant and revoke require verified owner session and an existing verified user. */
export async function changeAdministrator(db: D1DatabaseBinding, verifiedOwnerId: string, subjectId: string, grant: boolean): Promise<void> {
  if (!subjectId || !verifiedOwnerId || subjectId === verifiedOwnerId) throw new Error("Invalid administrator grant");
  await requireOwner(db, verifiedOwnerId);
  const target = await db.prepare("SELECT id FROM users WHERE id = ?").bind(subjectId).first<{id:string}>();
  if (!target) throw new Error("User not found");
  const prior = await getPlatformRole(db, subjectId);
  if (prior === "owner") throw new Error("The platform owner cannot be modified");
  if (grant && prior === "administrator") return;
  if (!grant && prior === null) return;
  const operation = grant
    ? db.prepare("INSERT INTO platform_roles (user_id,role,granted_by) VALUES (?,'administrator',?)").bind(subjectId,verifiedOwnerId)
    : db.prepare("DELETE FROM platform_roles WHERE user_id = ? AND role = 'administrator'").bind(subjectId);
  const audit = db.prepare("INSERT INTO admin_audit (id,actor_id,subject_id,action) VALUES (?,?,?,?)")
    .bind(crypto.randomUUID(),verifiedOwnerId,subjectId,grant?'grant_admin':'revoke_admin');
  await db.batch([operation,audit]);
}
/** SQL-enforced active map query and historical issue query remain separate. */
export function issueScopeSql(scope: "active" | "historical"): string {
  return scope === "active" ? "status <> 'resolved'" : "status = 'resolved'";
}
