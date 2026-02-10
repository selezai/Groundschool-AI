export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  plan: "basic" | "captains_club";
  plan_status: string | null;
  plan_period_end: string | null;
  monthly_quizzes_remaining: number | null;
  last_quota_reset_date: string | null;
  can_access_past_exams: boolean;
  updated_at: string;
}

export interface Document {
  id: string;
  user_id: string;
  title: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

export interface Quiz {
  id: string;
  user_id: string;
  title: string;
  document_ids: string[];
  question_count: number;
  status: string;
  created_at: string;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_text: string;
  options: { id: string; text: string }[];
  correct_answer_id: string;
  explanation: string | null;
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  user_id: string;
  score: number;
  completion_time: number | null;
  attempted_at: string;
  metadata: {
    total_questions?: number;
    answers?: Record<string, string>;
    appVersion?: string;
    platform?: string;
  } | null;
}
