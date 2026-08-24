export type Category = 'summative' | 'formative' | 'preparatory' | 'review_reflect';

export type CommitmentKind =
  | 'school'
  | 'sport'
  | 'club'
  | 'job'
  | 'family'
  | 'appointment'
  | 'study'
  | 'sleep'
  | 'other';

export type AssignmentSource = 'manual' | 'paste' | 'syllabus' | 'schoology';

export interface Profile {
  id: string;
  username: string;
  compass_points: number;
  streak_count: number;
  last_completion_date: string | null;
  announcements_enabled: boolean;
  created_at: string;
}

export interface Class {
  id: string;
  user_id: string;
  name: string;
  teacher: string;
  color: string;
  current_grade: number | null;
  goal_grade: number | null;
  created_at: string;
}

export interface Assignment {
  id: string;
  user_id: string;
  class_id: string | null;
  title: string;
  description: string;
  category: Category;
  due_date: string | null;
  estimated_minutes: number;
  points_value: number;
  completed: boolean;
  completed_at: string | null;
  is_missing: boolean;
  source: AssignmentSource;
  created_at: string;
}

export interface Commitment {
  id: string;
  user_id: string;
  title: string;
  kind: CommitmentKind;
  day_of_week: number;
  start_time: string;
  end_time: string;
  created_at: string;
}
