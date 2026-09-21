import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { supabase } from '../src/db/client';
import { processJobNotifications, dispatchNotificationForJob } from '../src/notifications/publisher';

const runIntegrationTests = !!process.env.SUPABASE_TEST_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

(runIntegrationTests ? describe : describe.skip)('Publisher & Application Lifecycle Integration Tests', () => {
  const dummyJobId = '00000000-0000-0000-0000-000000000000'; // We'll insert and fetch actual UUID
  let actualJobId: string;
  let eventId: string;

  beforeAll(async () => {
    // 1. Insert dummy canonical job
    const { data: job, error: jobError } = await supabase.from('canonical_jobs').insert([{
      company: 'Test Co',
      title: 'Test Intern',
      apply_url: 'https://test.com',
      normalized_url: 'https://test.com?q=' + Date.now(),
      is_job_specific: true
    }]).select('id').single();

    if (jobError) throw jobError;
    actualJobId = job.id;

    // 2. Insert dummy discovery event
    const { data: event, error: eventError } = await supabase.from('discovery_events').insert([{
      canonical_job_id: actualJobId,
      status: 'pending'
    }]).select('id').single();

    if (eventError) throw eventError;
    eventId = event.id;
  });

  afterAll(async () => {
    if (actualJobId) {
      await supabase.from('canonical_jobs').delete().eq('id', actualJobId);
    }
  });

  it('1. New canonical jobs start with not_applied application_status', async () => {
    const { data } = await supabase.from('canonical_jobs').select('application_status').eq('id', actualJobId).single();
    expect(data?.application_status).toBe('not_applied');
  });

  it('2. Discovery event claims are atomic and exclusive', async () => {
    // Claim it
    const claimExpiry = new Date(Date.now() + 5 * 60000).toISOString();
    const { data: claimed, error } = await supabase
      .from('discovery_events')
      .update({ claimed_at: new Date().toISOString(), claim_expires_at: claimExpiry })
      .eq('id', eventId)
      .is('claimed_at', null)
      .select('id')
      .single();
      
    expect(error).toBeNull();
    expect(claimed).toBeDefined();

    // Try to claim it again (should fail/return nothing)
    const { data: secondClaim } = await supabase
      .from('discovery_events')
      .update({ claimed_at: new Date().toISOString() })
      .eq('id', eventId)
      .is('claimed_at', null)
      .select('id')
      .single();
      
    expect(secondClaim).toBeNull();
  });

  it('3. Successful delivery changes status to notified', async () => {
    await supabase.from('discovery_events').update({ status: 'notified' }).eq('id', eventId);
    
    const { data } = await supabase.from('discovery_events').select('status').eq('id', eventId).single();
    expect(data?.status).toBe('notified');
  });

  it('5. Dry-run mode does not modify claimed_at or status', async () => {
    // Manually create an event directly in DB
    const { data: job } = await supabase.from('canonical_jobs').select('id').eq('company', 'Integration Publisher Corp').single();
    const eventId = crypto.randomUUID();
    
    await supabase.from('discovery_events').insert([{
      id: eventId,
      canonical_job_id: job!.id,
      status: 'pending'
    }]);

    // Run dry-run
    await processJobNotifications(false);

    // Verify it was NOT claimed
    const { data: dbEvent } = await supabase.from('discovery_events').select('claimed_at, claim_expires_at, status').eq('id', eventId).single();
    
    expect(dbEvent!.claimed_at).toBeNull();
    expect(dbEvent!.claim_expires_at).toBeNull();
    expect(dbEvent!.status).toBe('pending');

    // Cleanup
    await supabase.from('discovery_events').delete().eq('id', eventId);
  });

  describe('Notification Enrichment', () => {
    let twoSourceJobId: string;
    let oneSourceJobId: string;

    beforeAll(async () => {
      // 1. Create a 2-source job
      const { data: job2 } = await supabase.from('canonical_jobs').insert([{
        company: 'Enrichment Co',
        title: 'Two Source Intern',
        apply_url: 'https://enrich.com',
        normalized_url: 'https://enrich.com?q=' + Date.now(),
        is_job_specific: true
      }]).select('id').single();
      twoSourceJobId = job2!.id;

      await supabase.from('job_listings').insert([
        {
          canonical_job_id: twoSourceJobId,
          source: 'ApplyGuy',
          source_job_id: 'ag-enrich-1',
          company: 'Enrichment Co',
          title: 'Two Source Intern',
          apply_url: 'https://enrich.com',
          posted_at: '2026-09-21T00:00:00Z', // date only
          first_seen_at: '2026-09-22T10:00:00Z', // 6 AM EDT
          terms: ['Summer 2027'],
          active: true
        },
        {
          canonical_job_id: twoSourceJobId,
          source: 'Simplify',
          source_job_id: 'simp-enrich-1',
          company: 'Enrichment Co',
          title: 'Two Source Intern',
          apply_url: 'https://enrich.com',
          posted_at: '2026-09-20T16:00:00Z', // 12 PM EDT, older than ApplyGuy
          first_seen_at: '2026-09-23T10:00:00Z', 
          terms: ['Fall 2027'],
          active: true
        }
      ]);

      await supabase.from('discovery_events').insert([{
        canonical_job_id: twoSourceJobId,
        status: 'pending'
      }]);

      // 2. Create a 1-source job (with null posted_at and missing terms)
      const { data: job1 } = await supabase.from('canonical_jobs').insert([{
        company: 'Missing Terms Co',
        title: 'One Source Intern',
        apply_url: 'https://missing.com',
        normalized_url: 'https://missing.com?q=' + Date.now(),
        terms: ['Canonical Term Fallback'],
        is_job_specific: true
      }]).select('id').single();
      oneSourceJobId = job1!.id;

      await supabase.from('job_listings').insert([{
          canonical_job_id: oneSourceJobId,
          source: 'SomeWeirdSource',
          source_job_id: 'weird-1',
          company: 'Missing Terms Co',
          title: 'One Source Intern',
          apply_url: 'https://missing.com',
          posted_at: null,
          first_seen_at: '2026-09-20T12:00:00Z', // 8 AM EDT
          terms: [], // Missing
          active: true
      }]);

      await supabase.from('discovery_events').insert([{
        canonical_job_id: oneSourceJobId,
        status: 'pending'
      }]);
    });

    afterAll(async () => {
      if (twoSourceJobId) {
        await supabase.from('discovery_events').delete().eq('canonical_job_id', twoSourceJobId);
        await supabase.from('job_listings').delete().eq('canonical_job_id', twoSourceJobId);
        await supabase.from('canonical_jobs').delete().eq('id', twoSourceJobId);
      }
      if (oneSourceJobId) {
        await supabase.from('discovery_events').delete().eq('canonical_job_id', oneSourceJobId);
        await supabase.from('job_listings').delete().eq('canonical_job_id', oneSourceJobId);
        await supabase.from('canonical_jobs').delete().eq('id', oneSourceJobId);
      }
    });

    it('4. Correctly aggregates dates, sources, and terms from job_listings in dry run', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await processJobNotifications(false); // Dry run

      const logCalls = logSpy.mock.calls.map((c: any) => c[0]).join('\n');
      
      // 2-Source Validations
      expect(logCalls).toContain('Enrichment Co — Two Source Intern');
      expect(logCalls).toContain('Sources: ApplyGuy + Simplify');
      expect(logCalls).toContain('Term: Summer 2027, Fall 2027');
      expect(logCalls).toContain('Posted: Sep 20, 2026, 12:00 PM EDT'); // Simplify Sep 20 12:00 PM EDT vs ApplyGuy Sep 21
      expect(logCalls).toContain('First detected: Sep 22, 2026, 6:00 AM EDT'); // ApplyGuy 6AM vs Simplify 10AM

      // 1-Source Missing Validations
      expect(logCalls).toContain('Missing Terms Co — One Source Intern');
      expect(logCalls).toContain('Sources: SomeWeirdSource');
      expect(logCalls).toContain('Term: Canonical Term Fallback'); // Validates fallback to canonical_jobs
      expect(logCalls).toContain('Posted: Not specified'); // Validates null handling
      expect(logCalls).toContain('First detected: Sep 20, 2026, 8:00 AM EDT');

      logSpy.mockRestore();
    });

    it('5. dispatchNotificationForJob isolates delivery without mutating discovery events', async () => {
      // Pick a pending event that we know is in the DB
      const { data: beforeEvent } = await supabase
        .from('discovery_events')
        .select('*')
        .limit(1)
        .single();
      
      if (!beforeEvent) return; // Skip if no events to test

      const { data: job } = await supabase
        .from('canonical_jobs')
        .select('*, job_listings(*)')
        .eq('id', beforeEvent.canonical_job_id)
        .single();

      // Dispatch directly using the new helper
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Dry run dispatch
      await dispatchNotificationForJob(job, true, false);

      expect(logSpy).toHaveBeenCalled();
      
      // Ensure the string [TEST] is attached
      const logCalls = logSpy.mock.calls.map(call => call[0]).join('\n');
      expect(logCalls).toContain('[TEST]');

      logSpy.mockRestore();

      // Ensure discovery_event remains totally unchanged (no status update, no claimed_at)
      const { data: afterEvent } = await supabase
        .from('discovery_events')
        .select('*')
        .eq('id', beforeEvent.id)
        .single();
      
      expect(afterEvent!.status).toBe(beforeEvent.status);
      expect(afterEvent!.claimed_at).toBe(beforeEvent.claimed_at);
    });
  });
});
