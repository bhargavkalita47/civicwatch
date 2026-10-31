-- Apply after 0003. Resolved reports are retained; status_events is an append-only audit record.
PRAGMA foreign_keys = ON;
CREATE INDEX IF NOT EXISTS issues_status_city_created_idx ON issues(status,city_id,created_at DESC);
CREATE TABLE IF NOT EXISTS platform_roles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('owner','administrator')),
  granted_by TEXT REFERENCES users(id),
  granted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK(role != 'owner' OR granted_by IS NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_platform_owner ON platform_roles(role) WHERE role='owner';
CREATE TABLE IF NOT EXISTS admin_audit (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES users(id),
  subject_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL CHECK(action IN ('grant_admin','revoke_admin')),
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS admin_audit_occurred ON admin_audit(occurred_at DESC);
-- Prevent deletion of recorded status history even if the app misuses DELETE.
-- Report deletion by its author remains available, subject to retention policy.
