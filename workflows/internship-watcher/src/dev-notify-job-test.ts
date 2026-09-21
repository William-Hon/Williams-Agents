import './config/env.ts';
import { supabase } from './db/client.ts';
import { NTFY_JOBS_ALERT_TOPIC, ACTION_FUNCTION_URL } from './config/env.ts';
import { NtfyClient } from './notifications/ntfy.ts';
import { generateActionToken } from './notifications/tokens.ts';

async function runJobTest() {
  console.log("\n==================================================");
  console.log("PHASE 5: SINGLE CONTROLLED INTERNSHIP TEST");
  console.log("==================================================\n");

  if (!NTFY_JOBS_ALERT_TOPIC) {
    console.error("[ERROR] INTERNSHIP_WATCHER_NTFY_JOBS_ALERT_TOPIC is not configured.");
    return;
  }

  // 1. Create a dummy canonical job
  const { data: job, error: jobError } = await supabase
    .from('canonical_jobs')
    .insert([{
      company: 'Watcher Test Corp',
      title: 'Test Internship Role',
      apply_url: 'https://example.com/apply',
      normalized_url: 'https://example.com/apply?test=' + Date.now(),
      is_job_specific: true
    }])
    .select('id')
    .single();

  if (jobError || !job) {
    console.error("[ERROR] Failed to create test canonical job:", jobError?.message);
    return;
  }

  console.log(`[INFO] Created test canonical job: ${job.id}`);

  // 2. Generate and store tokens
  const appliedToken = generateActionToken();
  const ignoreToken = generateActionToken();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  await supabase.from('action_tokens').insert([
    { token_hash: appliedToken.hash, canonical_job_id: job.id, action: 'applied', expires_at: expiresAt },
    { token_hash: ignoreToken.hash, canonical_job_id: job.id, action: 'not_interested', expires_at: expiresAt }
  ]);

  console.log(`[INFO] Generated and stored action capability tokens`);

  // 3. Build action URLs
  const getActionUrl = (action: string, token: string) => {
    if (!ACTION_FUNCTION_URL) return undefined;
    return `${ACTION_FUNCTION_URL}?job=${job.id}&action=${action}&token=${token}`;
  };

  const appliedUrl = getActionUrl('applied', appliedToken.plaintext);
  const ignoreUrl = getActionUrl('not_interested', ignoreToken.plaintext);

  const actions: any[] = [
    { action: 'view', label: 'Apply Now', url: 'https://example.com/apply' }
  ];

  if (appliedUrl) {
    actions.push({ action: 'http', label: 'Mark Applied', url: appliedUrl, method: 'POST', clear: true });
  }
  if (ignoreUrl) {
    actions.push({ action: 'http', label: 'Not Interested', url: ignoreUrl, method: 'POST', clear: true });
  }

  // 4. Send Notification
  const ntfy = new NtfyClient();
  try {
    await ntfy.publish({
      topic: NTFY_JOBS_ALERT_TOPIC,
      title: `New Internship: Watcher Test Corp`,
      message: `Test Internship Role\n📍 Test Location`,
      tags: ['briefcase'],
      clickUrl: 'https://example.com/apply',
      actions
    });
    console.log(`[SUCCESS] Test job notification published to ${NTFY_JOBS_ALERT_TOPIC}`);
    console.log(`\nYou can now test the Mark Applied / Not Interested buttons on your device.`);
  } catch (err: any) {
    console.error(`[ERROR] Failed to publish test notification: ${err.message}`);
  }
}

runJobTest().catch(console.error);
