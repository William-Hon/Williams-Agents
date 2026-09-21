import { supabase } from "./client.ts";
import { normalizeApplicationUrl, isJobSpecificUrl } from "../normalization/url.ts";

export interface CanonicalStats {
  exact: number;
  normalized: number;
  fallback: number;
  created: number;
  linked: number;
  discovery_events: number;
}

export async function processCanonicals(jobListingIds: string[], isBaseline: boolean = false): Promise<CanonicalStats> {
  if (jobListingIds.length === 0) {
    return { exact: 0, normalized: 0, fallback: 0, created: 0, linked: 0, discovery_events: 0 };
  }

  // 1. Fetch the apply URLs for the given IDs
  const { data: listings, error: fetchError } = await supabase
    .from("job_listings")
    .select("id, apply_url")
    .in("id", jobListingIds);

  if (fetchError) {
    throw new Error(`Failed to fetch job listings for canonicalization: ${fetchError.message}`);
  }

  if (!listings || listings.length === 0) {
    return { exact: 0, normalized: 0, fallback: 0, created: 0, linked: 0, discovery_events: 0 };
  }

  // 2. Prepare payload for RPC
  const payload = listings.map(job => {
    const isSpecific = isJobSpecificUrl(job.apply_url);
    // If invalid URL, fallback to raw or empty string to avoid DB error, and mark NOT specific
    const normalized = normalizeApplicationUrl(job.apply_url) || job.apply_url;

    return {
      id: job.id,
      normalized_url: normalized,
      is_job_specific: isSpecific
    };
  });

  // 3. Call the RPC
  const { data: stats, error: rpcError } = await supabase.rpc("process_canonical_batch", {
    payload,
    is_baseline: isBaseline
  });

  if (rpcError) {
    throw new Error(`Failed to process canonical batch: ${rpcError.message}`);
  }

  return stats as CanonicalStats;
}
