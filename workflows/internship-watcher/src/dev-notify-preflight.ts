import './config/env.ts';
import { supabase } from './db/client.ts';
import { IGNORE_JOBS_BEFORE_DATE } from './config/env.ts';

async function runPreflight() {
  console.log("\n==================================================");
  console.log("PHASE 5: NOTIFICATION PREFLIGHT");
  console.log("==================================================\n");

  const { count: jobListingsCount } = await supabase.from('job_listings').select('*', { count: 'exact', head: true });
  const { count: canonicalJobsCount } = await supabase.from('canonical_jobs').select('*', { count: 'exact', head: true });
  const { count: totalEventsCount } = await supabase.from('discovery_events').select('*', { count: 'exact', head: true });
  const { count: pendingCount } = await supabase.from('discovery_events').select('*', { count: 'exact', head: true }).eq('status', 'pending');
  const { count: notifiedCount } = await supabase.from('discovery_events').select('*', { count: 'exact', head: true }).eq('status', 'notified');

  const { data: oldestPending } = await supabase.from('discovery_events').select('created_at').eq('status', 'pending').order('created_at', { ascending: true }).limit(1).single();
  const { data: newestPending } = await supabase.from('discovery_events').select('created_at').eq('status', 'pending').order('created_at', { ascending: false }).limit(1).single();

  console.log(`[DATABASE STATE]`);
  console.log(`- Total job_listings: ${jobListingsCount}`);
  console.log(`- Total canonical_jobs: ${canonicalJobsCount}`);
  console.log(`- Total discovery_events: ${totalEventsCount}`);
  console.log(`- Pending discovery_events: ${pendingCount}`);
  console.log(`- Notified discovery_events: ${notifiedCount}`);
  console.log(`- Oldest pending event: ${oldestPending?.created_at || 'N/A'}`);
  console.log(`- Newest pending event: ${newestPending?.created_at || 'N/A'}\n`);

  if (!IGNORE_JOBS_BEFORE_DATE) {
    console.log(`LIVE NOTIFICATIONS NOT ACTIVATED`);
    console.log(`\nTo activate, configure INTERNSHIP_WATCHER_IGNORE_JOBS_BEFORE_DATE in your .env file`);
    return;
  }

  const cutoffDate = new Date(IGNORE_JOBS_BEFORE_DATE);
  if (isNaN(cutoffDate.getTime())) {
    console.log(`[ERROR] INTERNSHIP_WATCHER_IGNORE_JOBS_BEFORE_DATE (${IGNORE_JOBS_BEFORE_DATE}) is not a valid date.`);
    return;
  }

  console.log(`[ACTIVATION CUTOFF]`);
  console.log(`Configured Cutoff: ${cutoffDate.toISOString()}`);

  const { data: eligibleEvents } = await supabase
    .from('discovery_events')
    .select('id, created_at, canonical_job_id, canonical_jobs(company, title)')
    .eq('status', 'pending')
    .gte('created_at', cutoffDate.toISOString());

  const { count: excludedCount } = await supabase
    .from('discovery_events')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .lt('created_at', cutoffDate.toISOString());

  console.log(`- Pending events ELIGIBLE under cutoff: ${eligibleEvents?.length || 0}`);
  console.log(`- Pending events EXCLUDED by cutoff: ${excludedCount || 0}\n`);

  if (eligibleEvents && eligibleEvents.length > 0) {
    console.log(`[ELIGIBLE PENDING JOBS SAMPLE]`);
    eligibleEvents.slice(0, 5).forEach((event: any) => {
      console.log(`- [${event.id}] ${event.created_at}`);
      console.log(`  ${event.canonical_jobs?.company} | ${event.canonical_jobs?.title}`);
    });
  }
}

runPreflight().catch(console.error);
