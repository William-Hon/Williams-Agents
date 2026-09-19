import { JobCandidate, JobFilterResult } from "../types/job";
import { FILTER_CONFIG } from "../config/filter-config";

export function filterJob(job: JobCandidate): JobFilterResult {
  // 1. Valid application URL (enforced during normalization mostly, but double check)
  if (!job.applyUrl) {
    return { accepted: false, reason: "INVALID_APPLICATION_URL" };
  }

  // 2. Active/Visible
  if (!job.active) {
    return { accepted: false, reason: "INACTIVE" };
  }

  // 3. Age / Date Posted (Must be < 30 days old)
  if (job.postedAt) {
    const postedDate = new Date(job.postedAt);
    const ageMs = Date.now() - postedDate.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays >= 30) {
      return { accepted: false, reason: "TOO_OLD", details: `Posted ${Math.floor(ageDays)} days ago` };
    }
  }

  // 3. Term/year & Title Fallback
  // Strictly require that the job has a term matching our target (e.g. "2027").
  const matchesTargetTerm = job.terms.some(t => 
    FILTER_CONFIG.targetTerms.some(target => t.toLowerCase().includes(target.toLowerCase()))
  );
  
  let titleFallbackUsed = false;
  let titleMatch = false;

  if (!matchesTargetTerm) {
    const titleLower = job.title.toLowerCase();
    if (titleLower.includes("2027") || titleLower.includes("'27") || titleLower.includes("’27")) {
      titleMatch = true;
      titleFallbackUsed = true;
    }
  }
  
  if (!matchesTargetTerm && !titleMatch) {
    return { accepted: false, reason: "TERM_MISMATCH", details: `Found terms: ${job.terms.length > 0 ? job.terms.join(', ') : 'None'}` };
  }

  return { accepted: true, reason: "ACCEPTED", titleFallbackUsed };
}
