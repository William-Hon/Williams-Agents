export type JobSource = "applyguy" | "simplify";

export interface JobCandidate {
  source: JobSource;
  sourceJobId: string | null;

  company: string;
  title: string;

  category: string | null;
  terms: string[];

  locations: string[];

  applyUrl: string;
  sourceUrl: string | null;

  postedAt: string | null;

  active: boolean;
}

export type FilterReason =
  | "ACCEPTED"
  | "INACTIVE"
  | "NOT_VISIBLE"
  | "TERM_MISMATCH"
  | "NON_US_LOCATION"
  | "NOT_INTERNSHIP"
  | "NON_TARGET_ROLE"
  | "INVALID_APPLICATION_URL"
  | "TOO_OLD";

export interface JobFilterResult {
  accepted: boolean;
  reason: FilterReason;
  details?: string;
  titleFallbackUsed?: boolean;
}
