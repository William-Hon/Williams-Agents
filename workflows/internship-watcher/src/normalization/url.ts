export function normalizeApplicationUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);

    // Remove safe URL fragments (hashes)
    parsed.hash = '';

    // Remove explicitly recognized tracking parameters
    const trackingParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
    ];

    for (const param of trackingParams) {
      parsed.searchParams.delete(param);
    }

    // Sort remaining query parameters deterministically
    const params = Array.from(parsed.searchParams.entries());
    params.sort((a, b) => a[0].localeCompare(b[0]));
    
    // Clear and re-append sorted
    const sortedSearchParams = new URLSearchParams();
    for (const [k, v] of params) {
      sortedSearchParams.append(k, v);
    }
    parsed.search = sortedSearchParams.toString();

    // Ensure trailing slashes are handled conservatively
    // Some sites treat /jobs and /jobs/ differently, but generally we can standardize
    // We'll leave it exactly as parsed to avoid false-positives on trailing slashes
    // returning the normalized string
    return parsed.toString();
  } catch {
    return null; // Invalid URL
  }
}

export function isJobSpecificUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);

    // 1. Check for known job-identifying query parameters
    const identifyingParams = [
      'gh_jid',       // Greenhouse
      'token',        // Greenhouse embed / Ashby
      'job_board_id', // General ATS
      'job',          // General
      'for',          // General
      'req_id',       // General
      'id',           // General
      'guid',         // General
      'requisitionId' // Workday
    ];

    for (const param of identifyingParams) {
      if (parsed.searchParams.has(param)) {
        return true;
      }
    }

    // 2. Check for known job-specific path patterns
    const path = parsed.pathname.toLowerCase();
    
    // e.g. /jobs/12345, /careers/job/abc
    // But NOT just /jobs or /careers
    
    // Workday paths often look like: /en-US/external/job/...
    if (path.includes('/job/')) return true;
    
    // Lever paths: /COMPANY/job/UUID
    // Ashby paths: /COMPANY/role/UUID
    if (path.includes('/role/')) return true;
    if (path.includes('/position/')) return true;

    // Greenhouse standard: /COMPANY/jobs/ID
    const parts = path.split('/').filter(Boolean);
    
    // If there's a /jobs/ or /careers/ followed by an ID
    const jobsIndex = parts.indexOf('jobs');
    const careersIndex = parts.indexOf('careers');
    
    if (jobsIndex !== -1 && jobsIndex < parts.length - 1) return true;
    if (careersIndex !== -1 && careersIndex < parts.length - 1) return true;
    
    // Workday fallback: /req-1234
    if (parts.some(p => p.startsWith('req-') || p.startsWith('r-'))) return true;

    return false;
  } catch {
    return false;
  }
}
