export type LocationClassification = "US" | "NON_US" | "UNKNOWN";

const US_STATES = new Set([
  "al", "ak", "az", "ar", "ca", "co", "ct", "de", "fl", "ga", "hi", "id", "il", "in", 
  "ia", "ks", "ky", "la", "me", "md", "ma", "mi", "mn", "ms", "mo", "mt", "ne", "nv", 
  "nh", "nj", "nm", "ny", "nc", "nd", "oh", "ok", "or", "pa", "ri", "sc", "sd", "tn", 
  "tx", "ut", "vt", "va", "wa", "wv", "wi", "wy", "dc"
]);

const US_KEYWORDS = [
  "us", "usa", "u.s.", "united states", "united states of america", "america"
];

const KNOWN_NON_US = [
  "uk", "united kingdom", "canada", "india", "australia", "germany", "france", 
  "ireland", "mexico", "london", "toronto", "vancouver", "montreal", "tokyo",
  "singapore", "paris", "berlin", "amsterdam", "sydney", "melbourne", "ontario",
  "british columbia", "quebec"
];

export function classifyLocation(locStr: string): LocationClassification {
  const normalized = locStr.toLowerCase().trim();
  
  if (!normalized || normalized === "remote") {
    return "UNKNOWN";
  }

  // Exact matching for remote US
  if (normalized === "remote - us" || normalized === "remote, us" || normalized === "remote, united states") {
    return "US";
  }

  for (const kw of US_KEYWORDS) {
    if (normalized === kw || normalized.includes(kw)) {
      return "US";
    }
  }

  const parts = normalized.split(',').map(p => p.trim());
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1];
    if (US_STATES.has(lastPart) || US_KEYWORDS.includes(lastPart)) {
      return "US";
    }
  }

  for (const kw of KNOWN_NON_US) {
    if (normalized.endsWith(kw) || normalized === kw || parts.includes(kw)) {
      return "NON_US";
    }
  }

  // Simplified fallback
  const hasState = parts.some(p => US_STATES.has(p));
  if (hasState) return "US";

  return "UNKNOWN";
}
