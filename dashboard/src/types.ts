export interface Application {
  id: number;
  company: string;
  role: string;
  job_url?: string;
  application_url: string;
  location?: string;
  compensation?: string;
  status: string;
  fit_score?: number;
  date_discovered?: string;
  date_started?: string;
  date_ready_for_review?: string;
  date_submitted?: string;
  resume_path?: string;
  cover_letter_path?: string;
  notes?: string;
}

export interface ApplicationQuestion {
  id: number;
  application_id: number;
  question_text: string;
  answer?: string;
  answer_source?: string;
  confidence?: number;
  needs_human: boolean;
  approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApprovedAnswer {
  id: number;
  question_pattern: string;
  answer: string;
  category?: string;
  source?: string;
  created_at: string;
  last_used_at?: string;
}

export interface WorkflowStats {
  total_applications: number;
  status_counts: Record<string, number>;
  auto_fill_rate_percent: number;
  generated_documents_count: number;
  queued: number;
  ready_for_review: number;
  needs_input: number;
  submitted: number;
}
