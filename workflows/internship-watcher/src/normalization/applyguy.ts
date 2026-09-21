import { JobCandidate } from "../types/job.ts";
import { cleanString, cleanUrl } from "./utils.ts";

export function normalizeApplyGuy(raw: any): JobCandidate | null {
  if (!raw || typeof raw !== 'object') return null;

  const id = cleanString(raw.id);
  const company = cleanString(raw.company) || "Unknown Company";
  const title = cleanString(raw.title) || "Unknown Title";
  const category = cleanString(raw.category);
  const location = cleanString(raw.location);
  const season = cleanString(raw.season);
  
  const applyUrlRaw = cleanString(raw.listingUrl) || cleanString(raw.url);
  const applyUrl = cleanUrl(applyUrlRaw);

  if (!applyUrl) {
    return null;
  }

  let postedAt = null;
  if (raw.posted) {
    try {
      const parsed = new Date(raw.posted);
      if (!isNaN(parsed.getTime())) {
        postedAt = parsed.toISOString();
      }
    } catch {
      // Ignore malformed date
    }
  }

  return {
    source: "applyguy",
    sourceJobId: id,
    company,
    title,
    category,
    terms: season ? [season] : [],
    locations: location ? [location] : [],
    applyUrl,
    sourceUrl: cleanUrl(raw.url),
    postedAt,
    active: true
  };
}
