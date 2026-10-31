import { LockKeyhole, ShieldCheck, Users } from "lucide-react";
import { config } from "../config";
import { useAuth } from "../services/auth";
/** No browser-controlled admin grants. Live accounts and role management require a verified session. */
export function AdminAccess() {
  const { session } = useAuth();
  if (session?.user.role !== "administrator") return <section className="admin-console"><h2>Restricted access</h2><p>Administrator authentication is required.</p></section>;
  return <section className="admin-console" aria-label="Platform administration">
    <span className="section-kicker">PLATFORM MANAGEMENT</span>
    <h2><ShieldCheck size={28}/> Administration</h2>
    <p>Only the platform owner can appoint or revoke administrators. Administrators may moderate issues, but cannot appoint other administrators.</p>
    <div className="admin-console-grid">
      <article><LockKeyhole size={23}/><h3>Owner-controlled access</h3><p>Administrator roles are granted against verified account IDs in the database, never through browser-supplied role fields.</p></article>
      <article><Users size={23}/><h3>Identity required</h3><p>{config.serviceMode === "mock" ? "Admin management requires verified accounts and an active database." : "Administrator grants require the owner's authenticated server session. The administration API is not yet activated."}</p></article>
    </div>
  </section>;
}
