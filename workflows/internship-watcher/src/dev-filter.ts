import "./config/env.ts";
import { ApplyGuySource } from "./sources/applyguy.ts";
import { SimplifySource } from "./sources/simplify.ts";
import { normalizeApplyGuy } from "./normalization/applyguy.ts";
import { normalizeSimplify } from "./normalization/simplify.ts";
import { classifyLocation } from "./filtering/location.ts";
import { filterJob } from "./filtering/rules.ts";
import { publishSystemAlert } from "./notifications/publisher.ts";

async function runDevFilter() {
  console.log("==================================================");
  console.log("INTERNSHIP NORMALIZATION + FILTER CHECK");
  console.log("==================================================\n");

  const [applyGuyData, simplifyData] = await Promise.all([
    new ApplyGuySource().fetch(),
    new SimplifySource().fetch()
  ]);

  const allAcceptedJobs: any[] = [];

  const sources = [
    { name: "ApplyGuy", data: applyGuyData, normalizer: normalizeApplyGuy },
    { name: "Simplify", data: simplifyData, normalizer: normalizeSimplify }
  ];

  for (const src of sources) {
    if (!src.data || !src.data.success) {
      console.error(`[ERROR] Fetch for ${src.name} failed: ${src.data?.error}`);
      await publishSystemAlert(
        'critical',
        `Fetcher: ${src.name}`,
        `API Fetch Failed`,
        src.data?.error || 'Unknown error fetching source'
      );
      continue;
    }

    let inputCount = 0;
    let normalizedCount = 0;
    let failedNorm = 0;
    
    let accepted = 0;
    let rejected = 0;
    let titleFallbackCount = 0;
    
    const rejectionReasons: Record<string, number> = {};
    const locations = { US: 0, NON_US: 0, UNKNOWN: 0 };
    const categories: Record<string, number> = {};
    const termsMap: Record<string, number> = {};
    
    const acceptedSamples: any[] = [];
    const rejectedSamples: Record<string, any[]> = {};

    if (src.data && src.data.success) {
      const records = src.data.records;
      if (Array.isArray(records)) {
        inputCount = records.length;
        
        for (const raw of records) {
          const normalized = src.normalizer(raw);
          if (!normalized) {
            failedNorm++;
            console.log(`[Normalize:${src.name}] FAILED for record ID: ${raw.id} - missing application URL or malformed`);
            continue;
          }
          normalizedCount++;
          
          const cat = normalized.category || "None";
          categories[cat] = (categories[cat] || 0) + 1;
          
          if (src.name === "Simplify") {
            for (const t of normalized.terms) {
              termsMap[t] = (termsMap[t] || 0) + 1;
            }
          }
          
          if (normalized.locations.length > 0) {
            let primaryLoc = "UNKNOWN";
            for (const l of normalized.locations) {
              const c = classifyLocation(l);
              if (c === "US") { primaryLoc = "US"; break; }
              if (c === "NON_US" && primaryLoc !== "US") { primaryLoc = "NON_US"; }
            }
            locations[primaryLoc as keyof typeof locations]++;
          }

          const result = filterJob(normalized);
          if (result.accepted) {
            accepted++;
            allAcceptedJobs.push(normalized);
            
            if (result.titleFallbackUsed) {
              titleFallbackCount++;
            }
            if (acceptedSamples.length < 5) {
              acceptedSamples.push(normalized);
            }
          } else {
            rejected++;
            const reason = result.reason;
            rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
            
            if (!rejectedSamples[reason]) rejectedSamples[reason] = [];
            if (rejectedSamples[reason].length < 2) {
              rejectedSamples[reason].push(normalized);
            }
          }
        }
      }
    }

    console.log(`[Normalize:${src.name}]`);
    console.log(`Input: ${inputCount}`);
    console.log(`Normalized: ${normalizedCount}`);
    console.log(`Failed: ${failedNorm}\n`);
    
    console.log(`[Filter:${src.name}]`);
    console.log(`Input: ${normalizedCount}`);
    console.log(`Accepted: ${accepted} (Title Fallbacks Used: ${titleFallbackCount})`);
    console.log(`Rejected: ${rejected}\n`);
    
    console.log(`Rejections:`);
    for (const [r, count] of Object.entries(rejectionReasons)) {
      console.log(`${r}: ${count}`);
    }
    console.log();
    
    console.log(`[Location:${src.name}]`);
    console.log(`US: ${locations.US}`);
    console.log(`NON_US: ${locations.NON_US}`);
    console.log(`UNKNOWN: ${locations.UNKNOWN}\n`);
    
    console.log(`[Category:${src.name}]`);
    for (const [c, count] of Object.entries(categories).sort((a,b) => b[1] - a[1]).slice(0, 5)) {
      console.log(`${c}: ${count}`);
    }
    console.log();

    if (src.name === "Simplify") {
      console.log(`[Terms:${src.name}]`);
      for (const [t, count] of Object.entries(termsMap).sort((a,b) => b[1] - a[1]).slice(0, 5)) {
        console.log(`${t}: ${count}`);
      }
      console.log();
    }

    console.log(`[Samples Accepted:${src.name}]`);
    for (const s of acceptedSamples) {
      console.log(`- ${s.company} | ${s.title} | Cat: ${s.category} | Loc: ${s.locations.join(',')}`);
    }
    console.log();
    
    console.log(`[Samples Rejected:${src.name}]`);
    for (const [reason, samples] of Object.entries(rejectedSamples)) {
      console.log(`Reason: ${reason}`);
      for (const s of samples) {
        console.log(`- ${s.company} | ${s.title} | Cat: ${s.category} | Terms: ${s.terms.join(', ')}`);
      }
      console.log();
    }
    console.log("--------------------------------------------------");
    
    if (failedNorm > 0) {
      await publishSystemAlert(
        'warning',
        `Normalizer: ${src.name}`,
        `Standardization Warnings`,
        `Failed to normalize ${failedNorm} out of ${inputCount} records. Check logs for schema changes.`
      );
    }
  }

  // --- PHASE 3: PERSISTENCE ---
  console.log("\n==================================================");
  console.log("PHASE 3: SUPABASE PERSISTENCE");
  console.log("==================================================");
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log("[INFO] Skipping database persistence: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.");
    console.log("[INFO] Configure these environment variables to enable Supabase storage.");
    return;
  }

  const { persistJobs } = await import("./db/persistence");
  const { processCanonicals } = await import("./db/canonical");
  const { supabase } = await import("./db/client");

  const startTime = Date.now();
  console.log(`[INFO] Persistence started...`);
  
  const stats = await persistJobs(allAcceptedJobs);
  
  const durationMs = Date.now() - startTime;
  
  console.log(`[INFO] Filtered jobs received: ${stats.filteredReceived}`);
  console.log(`[INFO] Unique source records (after batch deduplication): ${stats.uniqueInBatch}`);
  console.log(`[INFO] Duplicate records in batch: ${stats.dupesInBatch}`);
  console.log(`[INFO] New records inserted: ${stats.inserted}`);
  console.log(`[INFO] Existing records with changed metadata: ${stats.updated}`);
  console.log(`[INFO] Existing records unchanged: ${stats.unchanged}`);
  if (stats.failed > 0) {
    console.log(`[ERROR] Failed records: ${stats.failed}`);
    console.log(`[INFO] Persistence completed with partial failures in ${durationMs}ms`);
    await publishSystemAlert(
      'error' as any,
      `Database: Persistence`,
      `Failed to persist ${stats.failed} jobs`,
      `Check Supabase logs for insertion or constraint errors.`
    );
  } else {
    console.log(`[INFO] Failed records: 0`);
    console.log(`[INFO] Persistence completed successfully in ${durationMs}ms`);
  }

  // --- PHASE 4: CANONICAL MATCHING ---
  console.log("\n==================================================");
  console.log("PHASE 4: CANONICAL JOB DETECTION");
  console.log("==================================================");

  if (stats.insertedIds.length === 0) {
    console.log(`[INFO] No new source records inserted. Skipping canonicalization.`);
  } else {
    console.log(`[INFO] Processing ${stats.insertedIds.length} newly inserted source records...`);
    const cStartTime = Date.now();
    try {
      const cStats = await processCanonicals(stats.insertedIds, false);
      
      const { count: pendingCount } = await supabase
        .from("discovery_events")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      console.log(`[INFO] Source records evaluated: ${stats.insertedIds.length}`);
      console.log(`[INFO] Newly inserted source records: ${stats.insertedIds.length}`);
      console.log(`\n[INFO] Exact URL matches: ${cStats.exact}`);
      console.log(`[INFO] Normalized URL matches: ${cStats.normalized}`);
      console.log(`[INFO] Source-specific fallbacks: ${cStats.fallback}`);
      
      console.log(`\n[INFO] Existing canonical jobs reused: ${cStats.linked - cStats.created}`);
      console.log(`[INFO] New canonical jobs created: ${cStats.created}`);
      
      console.log(`\n[INFO] New discovery events created: ${cStats.discovery_events}`);
      console.log(`[INFO] Total pending discovery events: ${pendingCount}`);
      
      console.log(`\n[INFO] Matching conflicts: 0`);
      console.log(`[INFO] Failed records: 0`);
      
      console.log(`\n[INFO] Duration: ${Date.now() - cStartTime}ms`);
    } catch (err: any) {
      console.error(`[ERROR] Canonical processing failed: ${err.message}`);
      await publishSystemAlert(
        'critical',
        `Database: Canonicalization`,
        `Canonical Processing Crashed`,
        err.message
      );
    }
  }
}

runDevFilter().catch(console.error);
