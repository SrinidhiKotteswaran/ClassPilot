/*
# Schoology integration tables

Adds the data model for the Schoology school-platform integration so Academic
Compass can store a student's authorized connection metadata and the external
identifiers that link imported records back to their Schoology source.

## 1. New Tables

### school_connections
Stores the student's authorized Schoology connection metadata. One row per user.
- `id` (uuid, PK)
- `user_id` (uuid, owner, default auth.uid(), references auth.users)
- `status` (text) — 'disconnected' | 'pending' | 'connected' | 'error'
- `status_message` (text) — human-readable error / status detail
- `schoology_user_id` (text, nullable) — Schoology's user id once authenticated
- `schoology_username` (text, nullable) — display name from Schoology
- `school_name` (text, nullable) — school/district name when available
- `last_synced_at` (timestamptz, nullable) — last successful synchronization
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### external_assignment_links
Links an Academic Compass assignment to its Schoology source so synchronization
can update existing records instead of duplicating them.
- `id` (uuid, PK)
- `user_id` (uuid, owner, default auth.uid())
- `assignment_id` (uuid, references assignments, ON DELETE CASCADE)
- `external_id` (text) — Schoology assignment id
- `external_course_id` (text, nullable) — Schoology course id
- `external_category` (text, nullable) — original Schoology category label
- `external_grade` (numeric, nullable) — grade info from Schoology if available
- `last_synced_at` (timestamptz, nullable)
- `created_at` (timestamptz)

### external_class_links
Links an Academic Compass class to its Schoology course.
- `id` (uuid, PK)
- `user_id` (uuid, owner, default auth.uid())
- `class_id` (uuid, references classes, ON DELETE CASCADE)
- `external_id` (text) — Schoology course id
- `external_name` (text, nullable) — original Schoology course name
- `last_synced_at` (timestamptz, nullable)
- `created_at` (timestamptz)

## 2. Security
- RLS enabled on all three tables.
- Four explicit policies (select/insert/update/delete) per table, scoped
  `TO authenticated`, enforcing `auth.uid() = user_id`.
- Owner columns default to `auth.uid()`.

## 3. Notes
1. OAuth tokens / Schoology credentials are NEVER stored in these tables — they
   live in Supabase Edge Function secrets / auth metadata, not user-writable
   rows. These tables only store connection status and external identifiers.
2. The actual Schoology API calls happen server-side in an edge function; the
   client never sees Schoology secrets.
*/

CREATE TABLE IF NOT EXISTS school_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'disconnected',
  status_message text NOT NULL DEFAULT '',
  schoology_user_id text,
  schoology_username text,
  school_name text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE school_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_connection" ON school_connections;
CREATE POLICY "select_own_connection" ON school_connections FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_connection" ON school_connections;
CREATE POLICY "insert_own_connection" ON school_connections FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_connection" ON school_connections;
CREATE POLICY "update_own_connection" ON school_connections FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_connection" ON school_connections;
CREATE POLICY "delete_own_connection" ON school_connections FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS external_assignment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  external_course_id text,
  external_category text,
  external_grade numeric,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE external_assignment_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ext_assignments" ON external_assignment_links;
CREATE POLICY "select_own_ext_assignments" ON external_assignment_links FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_ext_assignments" ON external_assignment_links;
CREATE POLICY "insert_own_ext_assignments" ON external_assignment_links FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_ext_assignments" ON external_assignment_links;
CREATE POLICY "update_own_ext_assignments" ON external_assignment_links FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_ext_assignments" ON external_assignment_links;
CREATE POLICY "delete_own_ext_assignments" ON external_assignment_links FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS external_class_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  external_name text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE external_class_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ext_classes" ON external_class_links;
CREATE POLICY "select_own_ext_classes" ON external_class_links FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_ext_classes" ON external_class_links;
CREATE POLICY "insert_own_ext_classes" ON external_class_links FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_ext_classes" ON external_class_links;
CREATE POLICY "update_own_ext_classes" ON external_class_links FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_ext_classes" ON external_class_links;
CREATE POLICY "delete_own_ext_classes" ON external_class_links FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ext_assignment_unique ON external_assignment_links(user_id, external_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ext_class_unique ON external_class_links(user_id, external_id);
CREATE INDEX IF NOT EXISTS idx_school_conn_user ON school_connections(user_id);
