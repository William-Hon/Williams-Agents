import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { supabase } from '../src/db/client';
import { persistJobs } from '../src/db/persistence';
import { processCanonicals } from '../src/db/canonical';
import { JobCandidate } from '../src/types/job';

const runIntegrationTests = !!process.env.SUPABASE_TEST_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

(runIntegrationTests ? describe : describe.skip)('Canonical Integration Tests (Supabase)', () => {
  const testId1 = 'canonical-test-1';
  const testId2 = 'canonical-test-2';

  const baseJobWaymo1: JobCandidate = {
    source: 'applyguy',
    sourceJobId: testId1,
    company: 'Waymo',
    title: 'SWE Intern',
    category: 'Software',
    locations: ['Remote'],
    applyUrl: 'https://careers.withwaymo.com/jobs?gh_jid=12345&utm_source=test',
    sourceUrl: null,
    terms: ['Summer 2027'],
    postedAt: new Date().toISOString(),
    active: true
  };

  const baseJobWaymo2: JobCandidate = {
    source: 'simplify',
    sourceJobId: testId2,
    company: 'Waymo',
    title: 'Software Engineering Intern',
    category: 'Software',
    locations: ['US'],
    applyUrl: 'https://careers.withwaymo.com/jobs?utm_medium=test2&gh_jid=12345',
    sourceUrl: null,
    terms: ['Summer 2027'],
    postedAt: new Date().toISOString(),
    active: true
  };

  const cleanup = async () => {
    // Delete test jobs from job_listings (cascade should handle discovery_events indirectly if we delete canonicals)
    await supabase.from('job_listings').delete().in('source_job_id', [testId1, testId2]);
    // Cleanup canonicals with normalized_url matching
    await supabase.from('canonical_jobs').delete().eq('normalized_url', 'https://careers.withwaymo.com/jobs?gh_jid=12345');
  };

  beforeAll(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  it('1. Inserts a new source record and creates one canonical job and one discovery event', async () => {
    const stats1 = await persistJobs([baseJobWaymo1]);
    expect(stats1.insertedIds.length).toBe(1);

    const cStats1 = await processCanonicals(stats1.insertedIds, false);
    expect(cStats1.created).toBe(1);
    expect(cStats1.discovery_events).toBe(1);

    // Verify view
    const { data: viewData } = await supabase
      .from('canonical_jobs_inspection')
      .select('*')
      .eq('normalized_url', 'https://careers.withwaymo.com/jobs?gh_jid=12345')
      .single();

    expect(viewData).toBeDefined();
    expect(viewData.source_record_count).toBe(1);
    expect(viewData.is_deduplicated).toBe(false);
  });

  it('2. Inserts a duplicate from another source and groups it without creating a new discovery event', async () => {
    const stats2 = await persistJobs([baseJobWaymo2]);
    expect(stats2.insertedIds.length).toBe(1);

    const cStats2 = await processCanonicals(stats2.insertedIds, false);
    expect(cStats2.created).toBe(0); // Should reuse the one from test 1
    expect(cStats2.normalized).toBe(1);
    expect(cStats2.discovery_events).toBe(0);

    // Verify view grouping
    const { data: viewData } = await supabase
      .from('canonical_jobs_inspection')
      .select('*')
      .eq('normalized_url', 'https://careers.withwaymo.com/jobs?gh_jid=12345')
      .single();

    expect(viewData).toBeDefined();
    expect(viewData.source_record_count).toBe(2);
    expect(viewData.distinct_source_count).toBe(2);
    expect(viewData.is_deduplicated).toBe(true);
  });
});
