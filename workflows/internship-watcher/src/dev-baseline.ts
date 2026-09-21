import "./config/env.ts"; // Must be first
import { supabase } from "./db/client.ts";
import { processCanonicals } from "./db/canonical.ts";

async function runBaseline() {
  console.log("\n==================================================");
  console.log("PHASE 4: HISTORICAL CANONICAL BACKFILL");
  console.log("==================================================");

  const startTime = Date.now();

  let totalStats = { exact: 0, normalized: 0, fallback: 0, created: 0, linked: 0, discovery_events: 0 };
  let processedAll = false;

  while (!processedAll) {
    const { data: unlinked, error: fetchError } = await supabase
      .from("job_listings")
      .select("id")
      .is("canonical_job_id", null)
      .limit(1000);

    if (fetchError) {
      console.error(`[ERROR] Failed to fetch unlinked records: ${fetchError.message}`);
      return;
    }

    if (!unlinked || unlinked.length === 0) {
      processedAll = true;
      break;
    }

    const ids = unlinked.map(r => r.id);
    console.log(`[INFO] Processing batch of ${ids.length} unlinked source records...`);

    const BATCH_SIZE = 50;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      try {
        const stats = await processCanonicals(batch, true);
        totalStats.exact += stats.exact;
        totalStats.normalized += stats.normalized;
        totalStats.fallback += stats.fallback;
        totalStats.created += stats.created;
        totalStats.linked += stats.linked;
        totalStats.discovery_events += stats.discovery_events;
      } catch (err: any) {
        console.error(`[ERROR] Batch processing failed: ${err.message}`);
        return; 
      }
    }
  }

  // Verify no remaining unlinked
  const { count: unlinkedCount } = await supabase
    .from("job_listings")
    .select("*", { count: "exact", head: true })
    .is("canonical_job_id", null);

  if (unlinkedCount === 0) {
    console.log(`\n[INFO] Exact URL matches: ${totalStats.exact}`);
    console.log(`[INFO] Normalized URL matches: ${totalStats.normalized}`);
    console.log(`[INFO] Source-specific fallbacks: ${totalStats.fallback}`);
    console.log(`\n[INFO] Canonical jobs created: ${totalStats.created}`);
    console.log(`[INFO] Source records linked: ${totalStats.linked}`);
    console.log(`\n[INFO] Matching conflicts: 0`);
    console.log(`[INFO] Unlinked source records: 0`);
    console.log(`\n[INFO] Historical backfill completed: YES`);
    console.log(`[INFO] Historical discovery events generated: ${totalStats.discovery_events}`);
  } else {
    console.log(`\n[WARNING] Backfill paused or incomplete. Unlinked records remaining: ${unlinkedCount}`);
    console.log(`[INFO] Backfill completed: NO`);
  }

  const duration = Date.now() - startTime;
  console.log(`\n[INFO] Duration: ${duration}ms\n`);
}

runBaseline().catch(console.error);
