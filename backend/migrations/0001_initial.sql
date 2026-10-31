PRAGMA foreign_keys = ON;
CREATE TABLE users (
 id TEXT PRIMARY KEY, auth_subject TEXT NOT NULL UNIQUE,
 display_name TEXT NOT NULL CHECK(length(display_name) BETWEEN 2 AND 60),
 email TEXT NOT NULL COLLATE NOCASE UNIQUE,
 role TEXT NOT NULL DEFAULT 'resident' CHECK(role IN ('resident','moderator','administrator')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE organizations (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, jurisdiction TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE memberships (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK(role IN ('moderator','administrator')),
 PRIMARY KEY(user_id,organization_id)
);
CREATE TABLE categories (id TEXT PRIMARY KEY, label TEXT NOT NULL, category_group TEXT NOT NULL, color TEXT NOT NULL, symbol TEXT NOT NULL, description TEXT NOT NULL);
CREATE TABLE issues (
 id TEXT PRIMARY KEY, category_id TEXT NOT NULL REFERENCES categories(id),
 author_id TEXT NOT NULL REFERENCES users(id), organization_id TEXT REFERENCES organizations(id),
 title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 8 AND 120),
 description TEXT NOT NULL CHECK(length(trim(description)) BETWEEN 20 AND 3000),
 address TEXT NOT NULL CHECK(length(trim(address)) BETWEEN 3 AND 240),
 latitude REAL NOT NULL CHECK(latitude BETWEEN -90 AND 90), longitude REAL NOT NULL CHECK(longitude BETWEEN -180 AND 180),
 status TEXT NOT NULL DEFAULT 'reported' CHECK(status IN ('reported','acknowledged','in_progress','resolved')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX issues_location_idx ON issues(latitude,longitude);
CREATE INDEX issues_category_status_created_idx ON issues(category_id,status,created_at DESC);
CREATE INDEX issues_author_idx ON issues(author_id,created_at DESC);
CREATE TABLE confirmations (
 issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 PRIMARY KEY(issue_id,user_id)
);
CREATE TRIGGER confirmation_not_author BEFORE INSERT ON confirmations
WHEN NEW.user_id=(SELECT author_id FROM issues WHERE id=NEW.issue_id)
BEGIN SELECT RAISE(ABORT,'The reporter already counts as one person'); END;
CREATE TABLE comments (
 id TEXT PRIMARY KEY, issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 author_id TEXT NOT NULL REFERENCES users(id), parent_id TEXT REFERENCES comments(id),
 body TEXT NOT NULL CHECK(length(body)<=2000),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX comments_issue_created_idx ON comments(issue_id,created_at);
CREATE INDEX comments_parent_idx ON comments(parent_id);
CREATE TRIGGER comment_same_thread BEFORE INSERT ON comments WHEN NEW.parent_id IS NOT NULL
AND NOT EXISTS(SELECT 1 FROM comments WHERE id=NEW.parent_id AND issue_id=NEW.issue_id)
BEGIN SELECT RAISE(ABORT,'Reply must belong to the same issue'); END;
CREATE TABLE attachments (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
 issue_id TEXT REFERENCES issues(id) ON DELETE CASCADE, comment_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
 object_key TEXT NOT NULL UNIQUE, filename TEXT NOT NULL,
 mime_type TEXT NOT NULL CHECK(mime_type IN ('image/jpeg','image/png','image/webp')),
 size_bytes INTEGER NOT NULL CHECK(size_bytes BETWEEN 1 AND 4194304),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 CHECK(NOT(issue_id IS NOT NULL AND comment_id IS NOT NULL))
);
CREATE INDEX attachments_issue_idx ON attachments(issue_id);
CREATE INDEX attachments_comment_idx ON attachments(comment_id);
CREATE TABLE status_events (
 id TEXT PRIMARY KEY, issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE, actor_id TEXT NOT NULL REFERENCES users(id),
 previous_status TEXT NOT NULL, next_status TEXT NOT NULL, reason TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX status_events_issue_idx ON status_events(issue_id,created_at);
