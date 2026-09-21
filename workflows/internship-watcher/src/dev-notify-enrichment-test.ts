import './config/env.ts';
import { NTFY_JOBS_ALERT_TOPIC } from './config/env.ts';
import { NtfyClient } from './notifications/ntfy.ts';
import { resolvePostedAt, formatEST } from './notifications/publisher.ts';

async function runEnrichmentTest() {
  console.log("\n==================================================");
  console.log("PHASE 5: CONTROLLED ENRICHMENT LIVE TEST");
  console.log("==================================================\n");

  if (!NTFY_JOBS_ALERT_TOPIC) {
    console.error("[ERROR] INTERNSHIP_WATCHER_NTFY_JOBS_ALERT_TOPIC is not configured.");
    return;
  }

  // Generate fake listings array representing a 2-source job
  const listings = [
    {
      source: 'ApplyGuy',
      posted_at: '2026-09-20T00:00:00Z', // Date only
      first_seen_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      terms: ['Summer 2027']
    },
    {
      source: 'Simplify',
      posted_at: new Date(Date.now() - 86400000).toISOString(), // Exact time 24 hrs ago
      first_seen_at: new Date().toISOString(),
      terms: ['Fall 2027']
    }
  ];

  // Emulate publisher.ts logic exactly
  let firstSeenAt = null;
  const sourcesSet = new Set<string>();
  const termsSet = new Set<string>();

  for (const listing of listings) {
    if (listing.first_seen_at) {
      if (!firstSeenAt || new Date(listing.first_seen_at) < new Date(firstSeenAt)) {
        firstSeenAt = listing.first_seen_at;
      }
    }
    if (listing.source) {
      const srcName = listing.source.toLowerCase() === 'applyguy' ? 'ApplyGuy' : 
                      listing.source.toLowerCase() === 'simplify' ? 'Simplify' : listing.source;
      sourcesSet.add(srcName);
    }
    if (listing.terms && Array.isArray(listing.terms)) {
      listing.terms.forEach((t: string) => termsSet.add(t));
    }
  }

  const sourcesStr = sourcesSet.size > 0 ? Array.from(sourcesSet).join(' + ') : 'Unknown';
  const termsStr = termsSet.size > 0 ? Array.from(termsSet).join(', ') : 'Unknown';
  const locationText = 'New York, NY | San Francisco, CA';

  const bestPosted = resolvePostedAt(listings);
  const postedStr = bestPosted ? formatEST(bestPosted.isoString, bestPosted.precision) : 'Not specified';
  const firstSeenStr = firstSeenAt ? formatEST(firstSeenAt, 'exact') : 'Not specified';

  const messageBody = `Test Corp — Senior Intern\n\nLocation: ${locationText}\nTerm: ${termsStr}\nSources: ${sourcesStr}\n\nPosted: ${postedStr}\nFirst detected: ${firstSeenStr}`;

  // We don't need a real DB job to test the Ntfy UI payload layout!
  // Just send the UI layout
  const actions = [
    { action: 'view', label: 'Apply Now', url: 'https://example.com' },
    { action: 'http', label: 'Mark Applied', url: 'https://example.com', method: 'POST', clear: true },
    { action: 'http', label: 'Not Interested', url: 'https://example.com', method: 'POST', clear: true }
  ];

  const ntfy = new NtfyClient();
  try {
    await ntfy.publish({
      topic: NTFY_JOBS_ALERT_TOPIC,
      title: `New Internship: Test Corp`,
      message: messageBody,
      tags: ['briefcase'],
      clickUrl: 'https://example.com',
      actions: actions as any
    });
    console.log(`[SUCCESS] Test enriched notification published to ${NTFY_JOBS_ALERT_TOPIC}`);
    console.log(`\nPayload sent:\n${messageBody}`);
  } catch (err: any) {
    console.error(`[ERROR] Failed to publish test notification: ${err.message}`);
  }
}

runEnrichmentTest().catch(console.error);
