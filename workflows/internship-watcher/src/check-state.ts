import { supabase } from './db/client.ts';

async function checkState() {
  const { count: totalPending } = await supabase.from('discovery_events').select('*', { count: 'exact', head: true }).eq('status', 'pending');
  const { count: totalNotified } = await supabase.from('discovery_events').select('*', { count: 'exact', head: true }).eq('status', 'notified');
  
  const now = new Date().toISOString();
  
  const { count: unexpiredClaims } = await supabase.from('discovery_events').select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .not('claimed_at', 'is', null)
    .gt('claim_expires_at', now);
    
  const { count: expiredClaims } = await supabase.from('discovery_events').select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .not('claimed_at', 'is', null)
    .lte('claim_expires_at', now);
    
  // Check for test records
  const { count: testRecordsJob } = await supabase.from('canonical_jobs').select('*', { count: 'exact', head: true }).ilike('company', '%Integration%Corp%');
  const { count: testRecordsListing } = await supabase.from('job_listings').select('*', { count: 'exact', head: true }).ilike('source_job_id', 'test-%');

  console.log('--- PRODUCTION STATE AUDIT ---');
  console.log(`Total Pending Events: ${totalPending}`);
  console.log(`Total Notified Events: ${totalNotified}`);
  console.log(`Pending Events w/ Unexpired Claims (> NOW): ${unexpiredClaims}`);
  console.log(`Pending Events w/ Expired Claims (<= NOW): ${expiredClaims}`);
  console.log(`Remaining Test Canonical Jobs: ${testRecordsJob}`);
  console.log(`Remaining Test Job Listings: ${testRecordsListing}`);
}

checkState().catch(console.error);
