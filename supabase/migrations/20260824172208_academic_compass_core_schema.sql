/*
# Academic Compass — Core Schema

Establishes the foundational, multi-user data model for Academic Compass. Every
table is owner-scoped: a signed-in student can only ever read or write their own
rows. This covers the core academic organization loop (profiles, classes,
assignments, commitments) that the dashboard, priority engine, grades, and goals
are built on.

## 1. New Tables

### profiles
Per-student profile and gamification state, keyed 1:1 to auth.users.
- `id` (uuid, PK, references auth.users) — the student
- `username` (text) — display name
- `compass_points` (int, default 0) — earned motivation points
- `streak_count` (int, default 0) — current stress-free streak in days
- `last_completion_date` (date) — last day an assignment was completed (streak calc)
- `announcements_enabled` (bool, default true) — opt-in to funny announcements
- `created_at` (timestamptz)

### classes
A student's academic classes, including grade + goal tracking.
- `id` (uuid, PK)
- `user_id` (uuid, owner, default auth.uid())
- `name` (text) — e.g. "AP Biology"
- `teacher` (text)
- `color` (text) — accent color token for UI
- `current_grade` (numeric) — nullable current percentage
- `goal_grade` (numeric) — nullable target percentage
- `created_at` (timestamptz)

### assignments
All academic tasks, from any source (manual today; import/sync later).
- `id` (uuid, PK)
- `user_id` (uuid, owner, default auth.uid())
- `class_id` (uuid, nullable, references classes) — owning class
- `title` (text)
- `description` (text)
- `category` (text) — summative | formative | preparatory | review_reflect
- `due_date` (timestamptz, nullable)
- `estimated_minutes` (int, default 30) — effort estimate
- `points_value` (int, default 10) — compass points awarded on completion
- `completed` (bool, default false)
- `completed_at` (timestamptz, nullable)
- `is_missing` (bool, default false) — overdue/missing flag
- `source` (text, default 'manual') — manual | paste | syllabus | schoology
- `created_at` (timestamptz)

### commitments
Recurring weekly time commitments (school, sports, clubs, sleep, study blocks).
- `id` (uuid, PK)
- `user_id` (uuid, owner, default auth.uid())
- `title` (text)
- `kind` (text) — school | sport | club | job | family | appointment | study | sleep | other
- `day_of_week` (int) — 0 (Sun) .. 6 (Sat)
- `start_time` (time)
- `end_time` (time)
- `created_at` (timestamptz)

## 2. Security
- RLS enabled on all four tables.
- Four explicit policies (select/insert/update/delete) per table, scoped
  `TO authenticated`, each enforcing `auth.uid() = user_id` (profiles use `id`).
- Owner columns default to `auth.uid()` so inserts that omit the owner still pass.

## 3. Notes
1. Email confirmation is expected to remain OFF; profile rows are created by the
   app immediately after sign-up.
2. Indexes are added on user_id / class_id / due_date for common queries.
*/

-- profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL DEFAULT '',
  compass_points int NOT NULL DEFAULT 0,
  streak_count int NOT NULL DEFAULT 0,
  last_completion_date date,
  announcements_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- classes
CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  teacher text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT 'blue',
  current_grade numeric,
  goal_grade numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_classes" ON classes;
CREATE POLICY "select_own_classes" ON classes FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_classes" ON classes;
CREATE POLICY "insert_own_classes" ON classes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_classes" ON classes;
CREATE POLICY "update_own_classes" ON classes FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_classes" ON classes;
CREATE POLICY "delete_own_classes" ON classes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- assignments
CREATE TABLE IF NOT EXISTS assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'preparatory',
  due_date timestamptz,
  estimated_minutes int NOT NULL DEFAULT 30,
  points_value int NOT NULL DEFAULT 10,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  is_missing boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_assignments" ON assignments;
CREATE POLICY "select_own_assignments" ON assignments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_assignments" ON assignments;
CREATE POLICY "insert_own_assignments" ON assignments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_assignments" ON assignments;
CREATE POLICY "update_own_assignments" ON assignments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_assignments" ON assignments;
CREATE POLICY "delete_own_assignments" ON assignments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- commitments
CREATE TABLE IF NOT EXISTS commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'other',
  day_of_week int NOT NULL DEFAULT 1,
  start_time time NOT NULL DEFAULT '16:00',
  end_time time NOT NULL DEFAULT '17:00',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE commitments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_commitments" ON commitments;
CREATE POLICY "select_own_commitments" ON commitments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_commitments" ON commitments;
CREATE POLICY "insert_own_commitments" ON commitments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_commitments" ON commitments;
CREATE POLICY "update_own_commitments" ON commitments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_commitments" ON commitments;
CREATE POLICY "delete_own_commitments" ON commitments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_classes_user ON classes(user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_user ON assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_class ON assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_assignments_due ON assignments(due_date);
CREATE INDEX IF NOT EXISTS idx_commitments_user ON commitments(user_id);
