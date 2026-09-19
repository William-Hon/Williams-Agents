import { JobCandidate } from "../types/job";
import { cleanString, cleanUrl } from "./utils";

export function normalizeSimplify(raw: any): JobCandidate | null {
  if (!raw || typeof raw !== 'object') return null;

  const id = cleanString(raw.id);
  const company = cleanString(raw.company_name) || "Unknown Company";
  const title = cleanString(raw.title) || "Unknown Title";
  const category = cleanString(raw.category);
  
  const terms = Array.isArray(raw.terms) 
    ? raw.terms.map((t: any) => cleanString(t)).filter((t: string | null): t is string => t !== null)
    : [];
    
  const locations = Array.isArray(raw.locations)
    ? raw.locations.map((l: any) => cleanString(l)).filter((l: string | null): l is string => l !== null)
    : [];

  const applyUrl = cleanUrl(raw.url);
  if (!applyUrl) {
    return null;
  }

  let postedAt = null;
  if (typeof raw.date_posted === 'number') {
    try {
      postedAt = new Date(raw.date_posted * 1000).toISOString();
    } catch {}
  }

  return {
    source: "simplify",
    sourceJobId: id,
    company,
    title,
    category,
    terms,
    locations,
    applyUrl,
    sourceUrl: cleanUrl(raw.company_url),
    postedAt,
    active: raw.active !== false && raw.is_visible !== false
  };
}
