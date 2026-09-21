import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NTFY_JOBS_ALERT_TOPIC, IGNORE_JOBS_BEFORE_DATE } from "./config/env.ts";
import { runWatcherPipeline } from "./pipeline/watcher.ts";
import { publishSystemAlert } from "./notifications/publisher.ts";

async function main() {
  const args = process.argv.slice(2);
  const isLive = args.includes("--send");

  // Validate configuration before starting
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[FATAL] Missing Supabase credentials in config");
    process.exit(1);
  }

  if (isLive && (!NTFY_JOBS_ALERT_TOPIC || !IGNORE_JOBS_BEFORE_DATE)) {
    console.error("[FATAL] Live execution requires INTERNSHIP_WATCHER_NTFY_JOBS_ALERT_TOPIC and INTERNSHIP_WATCHER_IGNORE_JOBS_BEFORE_DATE.");
    process.exit(1);
  }

  console.log("Starting integrated watcher pipeline...");
  const startTime = Date.now();

  const result = await runWatcherPipeline(isLive);

  console.log(`\n==================================================`);
  console.log(`INTERNSHIP WATCHER — EXECUTION SUMMARY`);
  console.log(`==================================================`);
  
  console.log(`\nStarted:`);
  console.log(new Date(startTime).toLocaleString('en-US', { timeZoneName: 'short' }));
  
  console.log(`\nMode:`);
  console.log(isLive ? `LIVE / NOTIFICATION DELIVERY` : `LOCAL / NOTIFICATION DRY RUN`);
  
  console.log(`\nSOURCES`);
  console.log(`--------------------------------------------------`);
  for (const src of ["ApplyGuy", "Simplify"]) {
    console.log(`${src}:`);
    console.log(`  Fetch: ${result.sourceStats[src].fetch}`);
    console.log(`  Raw records: ${result.sourceStats[src].raw}`);
    console.log(`  Accepted: ${result.sourceStats[src].accepted}\n`);
  }
  
  console.log(`PERSISTENCE`);
  console.log(`--------------------------------------------------`);
  console.log(`New source listings: ${result.persistenceStats.inserted}`);
  console.log(`Existing source listings: ${result.persistenceStats.unchanged + result.persistenceStats.updated}`);
  console.log(`Failed writes: ${result.persistenceStats.failed}`);
  
  console.log(`\nCANONICAL MATCHING`);
  console.log(`--------------------------------------------------`);
  console.log(`New canonical jobs: ${result.canonicalStats.created}`);
  console.log(`Matched existing canonical jobs: ${result.canonicalStats.linked - result.canonicalStats.created}`);
  
  console.log(`\nDISCOVERY EVENTS`);
  console.log(`--------------------------------------------------`);
  console.log(`New discovery events: ${result.canonicalStats.discovery_events}`);
  console.log(`Eligible pending events: ${result.notificationStats.processed + result.notificationStats.notified + result.notificationStats.failed}`);
  console.log(`Excluded by notification cutoff: ${result.notificationStats.excludedByCutoff}`);
  
  console.log(`\nNOTIFICATIONS`);
  console.log(`--------------------------------------------------`);
  console.log(`Mode: ${isLive ? 'LIVE' : 'DRY RUN'}`);
  console.log(`Sent: ${result.notificationStats.notified}`);
  console.log(`Failed: ${result.notificationStats.failed}`);
  console.log(`Pending preserved: ${result.notificationStats.pendingRemaining}`);
  
  console.log(`\nEXECUTION`);
  console.log(`--------------------------------------------------`);
  console.log(`Status: ${result.status}`);
  console.log(`Duration: ${result.durationSec} seconds`);
  console.log(`==================================================\n`);

  if (result.status === "FAILED") {
    process.exit(1);
  } else if (result.status === "PARTIAL_SUCCESS") {
    process.exit(2);
  } else {
    process.exit(0);
  }
}

main().catch(async (err) => {
  console.error("[FATAL] Unhandled watcher error:", err);
  await publishSystemAlert('critical', `Watcher Pipeline`, `Unhandled Fatal Error`, err.message);
  process.exit(1);
});
