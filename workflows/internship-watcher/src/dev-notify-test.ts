import './config/env.ts';
import { supabase } from './db/client.ts';
import { dispatchNotificationForJob } from './notifications/publisher.ts';

async function main() {
  const args = process.argv.slice(2);
  const sendIdx = args.indexOf('--send');
  const live = sendIdx !== -1;
  
  const uuids = args.filter(a => a !== '--send');
  
  if (uuids.length !== 2) {
    console.error("Usage: tsx src/dev-notify-test.ts <uuid1> <uuid2> [--send]");
    process.exit(1);
  }

  for (const id of uuids) {
    const { data: job, error } = await supabase
      .from('canonical_jobs')
      .select(`*, job_listings(*)`)
      .eq('id', id)
      .single();

    if (error || !job) {
      console.error(`[ERROR] Canonical job not found: ${id}`);
      continue;
    }

    console.log(`\n==================================================`);
    console.log(`Processing Job: ${job.company} — ${job.title} (${id})`);
    console.log(`==================================================`);
    
    // dispatchNotificationForJob performs formatting, creates tokens (if live), and sends payload.
    // The 'isTest=true' argument prepends [TEST] to the title.
    await dispatchNotificationForJob(job, true, live);
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
