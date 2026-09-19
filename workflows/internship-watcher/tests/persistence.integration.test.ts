import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { supabase } from '../src/db/client';
import { persistJobs } from '../src/db/persistence';
import { JobCandidate } from '../src/types/job';

// Only run these tests if we have a real Supabase connection configured
const runIntegrationTests = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

(runIntegrationTests ? describe : describe.skip)('Persistence Integration Tests (Supabase)', () => {
  const testJobId1 = 'test-job-1';
  const testJobId2 = 'test-job-2';

  const baseJob1: JobCandidate = {
    source: 'applyguy',
    sourceJobId: testJobId1,
    company: 'Integration Corp',
    title: 'Test Software Engineer Intern',
    category: 'Software',
    locations: ['Remote, US'],
    applyUrl: 'https://test.com/apply/1',
    sourceUrl: 'https://test.com/source/1',
    terms: ['Summer 2027'],
    postedAt: new Date().toISOString(),
    active: true
  };

  const baseJob2: JobCandidate = {
    source: 'simplify',
    sourceJobId: testJobId2,
    company: 'Integration Corp',
    title: 'Test Data Intern',
    category: 'Data',
    locations: ['New York, NY'],
    applyUrl: 'https://test.com/apply/2',
    sourceUrl: 'https://test.com/source/2',
    terms: ['Fall 2027'],
    postedAt: new Date().toISOString(),
    active: true
  };

  // Cleanup before and after tests
  const cleanup = async () => {
    await supabase.from('job_listings')
      .delete()
      .in('source_job_id', [testJobId1, testJobId2]);
  };

  beforeAll(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  it('1. Inserting a new listing (Case A)', async () => {
    const stats = await persistJobs([baseJob1]);
    expect(stats.inserted).toBe(1);
    expect(stats.updated).toBe(0);
    expect(stats.unchanged).toBe(0);

    const { data } = await supabase.from('job_listings').select('*').eq('source_job_id', testJobId1).single();
    expect(data).toBeDefined();
    expect(data.company).toBe('Integration Corp');
    // Ensure first_seen_at and last_seen_at are populated
    expect(data.first_seen_at).toBeTruthy();
    expect(data.last_seen_at).toBeTruthy();
  });

  it('2. Existing records with identical metadata update only last_seen_at (Case C)', async () => {
    // Wait a brief moment to ensure last_seen_at could theoretically change, though in practice
    // we just want to ensure it counts as unchanged in our RPC logic
    const stats = await persistJobs([baseJob1]);
    expect(stats.inserted).toBe(0);
    expect(stats.updated).toBe(0);
    expect(stats.unchanged).toBe(1); // Should hit Case C
  });

  it('3. Existing records with changed metadata synchronize correctly without creating new rows (Case B)', async () => {
    const updatedJob = { ...baseJob1, title: 'Test Senior Software Engineer Intern' };
    
    const stats = await persistJobs([updatedJob]);
    expect(stats.inserted).toBe(0);
    expect(stats.updated).toBe(1); // Should hit Case B
    expect(stats.unchanged).toBe(0);

    const { data, count } = await supabase.from('job_listings').select('*', { count: 'exact' }).eq('source_job_id', testJobId1);
    
    // Ensure uniqueness constraint holds
    expect(count).toBe(1);
    expect(data![0].title).toBe('Test Senior Software Engineer Intern');
  });

  it('4. Duplicate source IDs within one incoming batch are deduplicated', async () => {
    // Send the same job twice in one batch
    const stats = await persistJobs([baseJob2, baseJob2]);
    
    expect(stats.filteredReceived).toBe(2);
    expect(stats.dupesInBatch).toBe(1);
    expect(stats.uniqueInBatch).toBe(1);
    
    expect(stats.inserted).toBe(1);
  });

  it('5. Independent sources with identical sourceJobIds do not collide', async () => {
    // baseJob2 uses 'simplify' and testJobId2
    // Let's create a job with 'applyguy' and testJobId2
    const independentJob: JobCandidate = {
      ...baseJob2,
      source: 'applyguy',
      company: 'Different Corp'
    };

    const stats = await persistJobs([independentJob]);
    expect(stats.inserted).toBe(1); // Should insert cleanly, no collision

    // Verify both exist
    const { count } = await supabase.from('job_listings').select('*', { count: 'exact' }).eq('source_job_id', testJobId2);
    expect(count).toBe(2);
  });

  it('6. Missing optional fields handle gracefully', async () => {
    const sparseJob: JobCandidate = {
      ...baseJob1,
      sourceJobId: testJobId1 + '-sparse',
      category: '',
      locations: [],
      terms: [],
      sourceUrl: null,
      postedAt: null
    };

    const stats = await persistJobs([sparseJob]);
    expect(stats.inserted).toBe(1);

    const { data } = await supabase.from('job_listings').select('*').eq('source_job_id', testJobId1 + '-sparse').single();
    expect(data.posted_at).toBeNull();
    
    // Cleanup
    await supabase.from('job_listings').delete().eq('source_job_id', testJobId1 + '-sparse');
  });

  it('7. Empty batches do not fail', async () => {
    const stats = await persistJobs([]);
    expect(stats.filteredReceived).toBe(0);
    expect(stats.inserted).toBe(0);
    expect(stats.failed).toBe(0);
  });
});
