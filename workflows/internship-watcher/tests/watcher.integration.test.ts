import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { supabase } from '../src/db/client';
import { runWatcherPipeline } from '../src/pipeline/watcher';
import * as applyguyModule from '../src/sources/applyguy';
import * as simplifyModule from '../src/sources/simplify';
import { NtfyClient } from '../src/notifications/ntfy';

import * as persistenceModule from '../src/db/persistence';
import * as publisherModule from '../src/notifications/publisher';

const runIntegrationTests = !!process.env.SUPABASE_TEST_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!runIntegrationTests) {
  console.warn("Skipping Integration Tests: SUPABASE_TEST_URL is missing. Tests must not touch the production DB.");
}

describe.runIf(runIntegrationTests)('Integrated Watcher Pipeline (Phase 6)', () => {
  const TEST_COMPANY = 'Phase6 Integration Corp';
  let mockApplyGuyFetch: any;
  let mockSimplifyFetch: any;
  let ntfyPublishSpy: any;

  beforeAll(() => {
    // We mock the methods on the actual prototype to intercept calls inside the pipeline
    mockApplyGuyFetch = vi.spyOn(applyguyModule.ApplyGuySource.prototype, 'fetch');
    mockSimplifyFetch = vi.spyOn(simplifyModule.SimplifySource.prototype, 'fetch');
    ntfyPublishSpy = vi.spyOn(NtfyClient.prototype, 'publish').mockImplementation(async () => {});
    
    // Disable annoying console logs for cleaner test output
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    // Cleanup
    await supabase.from('canonical_jobs').delete().eq('company', TEST_COMPANY);
  });

  beforeEach(async () => {
    mockApplyGuyFetch.mockReset();
    mockSimplifyFetch.mockReset();
    ntfyPublishSpy.mockClear();

    // Default to empty successful fetches
    mockApplyGuyFetch.mockResolvedValue({ success: true, records: [] });
    mockSimplifyFetch.mockResolvedValue({ success: true, records: [] });
  });

  async function cleanupTestCompany() {
    await supabase.from('canonical_jobs').delete().eq('company', TEST_COMPANY);
    await supabase.from('job_listings').delete().like('source_job_id', '%-ag');
    await supabase.from('job_listings').delete().like('source_job_id', '%-sim%');
  }

  it('1. Successful execution across all phases', async () => {
    await cleanupTestCompany();
    mockApplyGuyFetch.mockResolvedValue({
      success: true,
      records: [{
        id: 'test-1-ag', company: TEST_COMPANY, title: 'Intern 2027 1', url: 'https://example.com/1'
      }]
    });

    const result = await runWatcherPipeline(false);
    expect(result.status).toBe('SUCCESS');
    expect(result.sourceStats.ApplyGuy.accepted).toBe(1);
    expect(result.persistenceStats.inserted).toBe(1);
    expect(result.canonicalStats.created).toBe(1); 
    expect(result.canonicalStats.discovery_events).toBe(1);

    // Properly scope the verification to the exact canonical job created by the test
    const { data: jobs } = await supabase.from('canonical_jobs').select('id').eq('company', TEST_COMPANY);
    expect(jobs?.length).toBe(1);

    const { count: pendingCount } = await supabase.from('discovery_events').select('*', { count: 'exact' }).eq('canonical_job_id', jobs![0].id).eq('status', 'pending');
    expect(pendingCount).toBe(1); // Dry run leaves it pending
  });

  it('2. New internship creates one source listing, one canonical job, and one discovery event', async () => {
    await cleanupTestCompany();
    mockApplyGuyFetch.mockResolvedValue({
      success: true,
      records: [{ id: 'test-2-ag', company: TEST_COMPANY, title: 'Intern 2027 2', url: 'https://example.com/2?gh_jid=123' }]
    });

    const result = await runWatcherPipeline(false);
    expect(result.canonicalStats.created).toBe(1);
    expect(result.canonicalStats.discovery_events).toBe(1);

    // Verify DB
    const { count: listingCount } = await supabase.from('job_listings').select('*', { count: 'exact' }).eq('source_job_id', 'test-2-ag');
    expect(listingCount).toBe(1);
  });

  it('3. Existing internship does not create duplicate canonical jobs or discovery events', async () => {
    // Run pipeline again with the exact same data from test 2
    mockApplyGuyFetch.mockResolvedValue({
      success: true,
      records: [{ id: 'test-2-ag', company: TEST_COMPANY, title: 'Intern 2027 2', url: 'https://example.com/2?gh_jid=123' }]
    });

    const result = await runWatcherPipeline(false);
    expect(result.status).toBe('SUCCESS');
    expect(result.persistenceStats.inserted).toBe(0); // Existing
    expect(result.canonicalStats.created).toBe(0);
    expect(result.canonicalStats.discovery_events).toBe(0);
  });

  it('4. Same internship in ApplyGuy and Simplify results in two source listings linked to one canonical job', async () => {
    await cleanupTestCompany();
    mockApplyGuyFetch.mockResolvedValue({
      success: true,
      records: [{ id: 'test-4-ag', company: TEST_COMPANY, title: 'Intern 2027 4', url: 'https://example.com/4?gh_jid=456' }]
    });
    mockSimplifyFetch.mockResolvedValue({
      success: true,
      records: [{
        id: 'test-4-sim', company_name: TEST_COMPANY, title: 'Intern 2027 4', url: 'https://example.com/4?gh_jid=456', source: 'Simplify', active: true
      }]
    });

    const result = await runWatcherPipeline(false);
    expect(result.persistenceStats.inserted).toBe(2);
    // If the URL is job-specific (gh_jid), they will merge into one canonical job!
    expect(result.canonicalStats.created).toBe(1); 
    expect(result.canonicalStats.discovery_events).toBe(1); 
  });

  it('5. Second repository discovers an already-known canonical opportunity without creating another discovery event', async () => {
    // Run simplify fetch with the same URL, but completely different source_id
    mockSimplifyFetch.mockResolvedValue({
      success: true,
      records: [{
        id: 'test-5-sim-late', company_name: TEST_COMPANY, title: 'Intern 2027 4', url: 'https://example.com/4?gh_jid=456', source: 'Simplify', active: true
      }]
    });

    const result = await runWatcherPipeline(false);
    expect(result.persistenceStats.inserted).toBe(1);
    expect(result.canonicalStats.created).toBe(0); // Linked to existing!
    expect(result.canonicalStats.linked).toBe(1);
    expect(result.canonicalStats.discovery_events).toBe(0); // No new event!
  });

  it('6. Notification dry run leaves discovery events pending and does not send real ntfy requests', async () => {
    await cleanupTestCompany();
    mockApplyGuyFetch.mockResolvedValue({
      success: true,
      records: [{ id: 'test-6-ag', company: TEST_COMPANY, title: 'Intern 2027 6', url: 'https://example.com/6?gh_jid=6' }]
    });

    const result = await runWatcherPipeline(false); // isLive = false
    expect(ntfyPublishSpy).not.toHaveBeenCalled();
    
    // Verify our specific event was left pending
    const { data: job } = await supabase.from('canonical_jobs').select('id').eq('company', TEST_COMPANY).single();
    const { count: notifiedCount } = await supabase.from('discovery_events').select('*', { count: 'exact' }).eq('canonical_job_id', job!.id).eq('status', 'notified');
    expect(notifiedCount).toBe(0);
  });

  it('7. Live mode with mocked ntfy successfully claims, publishes, and marks the event notified', async () => {
    await cleanupTestCompany();
    mockApplyGuyFetch.mockResolvedValue({
      success: true,
      records: [{ id: 'test-7-ag', company: TEST_COMPANY, title: 'Intern 2027 7', url: 'https://example.com/7' }]
    });

    // We must ensure the cutoff date allows this event. The test environment has a default cutoff.
    await runWatcherPipeline(true); // isLive = true

    expect(ntfyPublishSpy).toHaveBeenCalled(); // Should have hit the mock

    // Verify DB marked specifically our job as notified
    const { data: job } = await supabase.from('canonical_jobs').select('id').eq('company', TEST_COMPANY).single();
    const { data: event } = await supabase.from('discovery_events').select('status').eq('canonical_job_id', job!.id).single();
    expect(event!.status).toBe('notified');
  });

  it('8. Failed notification remains recoverable and is not incorrectly marked notified', async () => {
    await cleanupTestCompany();
    mockApplyGuyFetch.mockResolvedValue({
      success: true,
      records: [{ id: 'test-8-ag', company: TEST_COMPANY, title: 'Intern 2027 8', url: 'https://example.com/8' }]
    });

    ntfyPublishSpy.mockRejectedValueOnce(new Error('Ntfy API is down'));

    const result = await runWatcherPipeline(true);
    expect(result.status).toBe('PARTIAL_SUCCESS'); // Failing to notify is a partial failure

    // Verify DB still pending specifically for our job
    const { data: job } = await supabase.from('canonical_jobs').select('id').eq('company', TEST_COMPANY).single();
    const { data: event } = await supabase.from('discovery_events').select('status, claim_expires_at').eq('canonical_job_id', job!.id).single();
    expect(event!.status).toBe('pending');
  });

  it('9. Notification cutoff excludes older events without modifying them', async () => {
    // Set cutoff to future to simulate an old event relative to a new activation
    const originalCutoff = process.env.INTERNSHIP_WATCHER_IGNORE_JOBS_BEFORE_DATE;
    process.env.INTERNSHIP_WATCHER_IGNORE_JOBS_BEFORE_DATE = new Date(Date.now() + 86400000).toISOString(); // Tomorrow
    
    await cleanupTestCompany();
    mockApplyGuyFetch.mockResolvedValue({
      success: true,
      records: [{ id: 'test-9-ag', company: TEST_COMPANY, title: 'Intern 2027 9', url: 'https://example.com/9' }]
    });

    const result = await runWatcherPipeline(true);
    // The event was created now, but the cutoff is tomorrow, so it's "older" than the cutoff
    expect(result.notificationStats.excludedByCutoff).toBeGreaterThanOrEqual(1);
    
    // Verify our specific job was NOT notified
    const { data: job } = await supabase.from('canonical_jobs').select('id').eq('company', TEST_COMPANY).single();
    const { data: event } = await supabase.from('discovery_events').select('status').eq('canonical_job_id', job!.id).single();
    expect(event!.status).toBe('pending');

    process.env.INTERNSHIP_WATCHER_IGNORE_JOBS_BEFORE_DATE = originalCutoff;
  });

  it('10. One source succeeds while the other fails', async () => {
    await cleanupTestCompany();
    mockApplyGuyFetch.mockResolvedValue({
      success: true,
      records: [{ id: 'test-10-ag', company: TEST_COMPANY, title: 'Intern 2027 10', url: 'https://example.com/10' }]
    });
    mockSimplifyFetch.mockResolvedValue({
      success: false, error: 'HTTP 503'
    });

    const result = await runWatcherPipeline(false);
    expect(result.status).toBe('PARTIAL_SUCCESS');
    expect(result.persistenceStats.inserted).toBe(1); // ApplyGuy still processed safely
  });

  it('11. Critical database failure prevents invalid downstream processing', async () => {
    const persistSpy = vi.spyOn(persistenceModule, 'persistJobs').mockRejectedValueOnce(new Error('DB Offline'));
    
    mockApplyGuyFetch.mockResolvedValue({
      success: true,
      records: [{ id: 'test-11-ag', company: TEST_COMPANY, title: 'Intern 2027 11', url: 'https://example.com/11' }]
    });

    const result = await runWatcherPipeline(false);
    expect(result.status).toBe('PARTIAL_SUCCESS');
    expect(result.canonicalStats.created).toBe(0); // Prevented!
    
    persistSpy.mockRestore();
  });

  it('12. Repeated executions remain idempotent', async () => {
    await cleanupTestCompany();
    mockApplyGuyFetch.mockResolvedValue({
      success: true,
      records: [{ id: 'test-12-ag', company: TEST_COMPANY, title: 'Intern 2027 12', url: 'https://example.com/12' }]
    });

    const result1 = await runWatcherPipeline(false);
    const result2 = await runWatcherPipeline(false);
    const result3 = await runWatcherPipeline(false);

    expect(result1.persistenceStats.inserted).toBe(1);
    expect(result2.persistenceStats.inserted).toBe(0);
    expect(result3.persistenceStats.inserted).toBe(0);
  });

  it('13. Overlapping publishers do not send duplicate notifications', async () => {
    await cleanupTestCompany();
    mockApplyGuyFetch.mockResolvedValue({
      success: true,
      records: [{ id: 'test-13-ag', company: TEST_COMPANY, title: 'Intern 2027 13', url: 'https://example.com/13' }]
    });

    await runWatcherPipeline(false); // Creates the pending event, but claims it for 5 mins

    // Clear the claim so our concurrent publishers can actually try to grab it
    const { data: job } = await supabase.from('canonical_jobs').select('id').eq('company', TEST_COMPANY).single();
    await supabase.from('discovery_events').update({ claimed_at: null, claim_expires_at: null }).eq('canonical_job_id', job!.id);

    // Simulate concurrent publish calls by making them manually wait or running them together
    const pubPromise1 = publisherModule.processJobNotifications(true);
    const pubPromise2 = publisherModule.processJobNotifications(true);

    const [stats1, stats2] = await Promise.all([pubPromise1, pubPromise2]);

    // Check how many times Ntfy was called for OUR specific test job
    const ntfyCallsForOurJob = ntfyPublishSpy.mock.calls.filter((call: any) => 
      call[0].message.includes(TEST_COMPANY)
    ).length;

    expect(ntfyCallsForOurJob).toBe(1);
  });

  it('14. No eligible notifications is a normal successful execution, not an error', async () => {
    // Since mock fetches are reset to [], there is no new data.
    const result = await runWatcherPipeline(true);
    expect(result.status).toBe('SUCCESS'); // Fully successful, just empty
  });

  it('15. Existing date-precision and first-detection formatting behavior remains correct', async () => {
    await cleanupTestCompany();
    mockApplyGuyFetch.mockResolvedValue({
      success: true,
      records: [{ id: 'test-15-ag', company: TEST_COMPANY, title: 'Intern 2027 15', url: 'https://example.com/15', posted: '2026-09-19' }]
    });

    await runWatcherPipeline(true);

    // Verify that Ntfy was called with the correctly formatted strings
    const lastCall = ntfyPublishSpy.mock.calls[ntfyPublishSpy.mock.calls.length - 1][0];
    expect(lastCall.message).toContain('Posted: Sep 19, 2026 (exact time not specified)');
    expect(lastCall.message).toContain('Sources: ApplyGuy');
  });
});
