import { JobCandidate } from '../types/job.ts';
import { supabase } from './client.ts';

export interface PersistenceStats {
  filteredReceived: number;
  uniqueInBatch: number;
  dupesInBatch: number;
  inserted: number;
  updated: number;
  unchanged: number;
  failed: number;
  insertedIds: string[];
}

export async function persistJobs(jobs: JobCandidate[]): Promise<PersistenceStats> {
  const stats: PersistenceStats = {
    filteredReceived: jobs.length,
    uniqueInBatch: 0,
    dupesInBatch: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
    insertedIds: []
  };

  if (jobs.length === 0) {
    return stats;
  }

  // 1. Same-Source Deduplication
  const uniqueJobs = new Map<string, JobCandidate>();
  for (const job of jobs) {
    const key = `${job.source}::${job.sourceJobId}`;
    if (uniqueJobs.has(key)) {
      stats.dupesInBatch++;
    }
    uniqueJobs.set(key, job);
  }
  
  stats.uniqueInBatch = uniqueJobs.size;

  const dedupedJobs = Array.from(uniqueJobs.values());

  // 2. Batch Persistence
  const chunkSize = 200;
  for (let i = 0; i < dedupedJobs.length; i += chunkSize) {
    const chunk = dedupedJobs.slice(i, i + chunkSize);
    
    const payload = chunk.map(job => ({
      source: job.source,
      sourceJobId: job.sourceJobId,
      company: job.company,
      title: job.title,
      locations: job.locations,
      applyUrl: job.applyUrl,
      terms: job.terms,
      category: job.category,
      sourceUrl: job.sourceUrl,
      postedAt: job.postedAt,
      active: job.active
    }));

    try {
      const { data, error } = await supabase.rpc('upsert_job_listings', { payload });
      
      if (error) {
        console.error(`[Persistence Error] Failed to upsert chunk:`, error.message);
        stats.failed += chunk.length;
      } else if (data) {
        stats.inserted += data.inserted || 0;
        stats.updated += data.updated || 0;
        stats.unchanged += data.unchanged || 0;
        if (data.inserted_rows && Array.isArray(data.inserted_rows)) {
          for (const row of data.inserted_rows) {
            if (row.id) stats.insertedIds.push(row.id);
          }
        }
      }
    } catch (err: any) {
      console.error(`[Persistence Exception]`, err.message);
      stats.failed += chunk.length;
    }
  }

  return stats;
}
