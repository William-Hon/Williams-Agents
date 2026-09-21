import "../config/env.ts";
import { ApplyGuySource } from "../sources/applyguy.ts";
import { SimplifySource } from "../sources/simplify.ts";
import { normalizeApplyGuy } from "../normalization/applyguy.ts";
import { normalizeSimplify } from "../normalization/simplify.ts";
import { filterJob } from "../filtering/rules.ts";
import { persistJobs } from "../db/persistence.ts";
import { processCanonicals } from "../db/canonical.ts";
import { processJobNotifications, publishSystemAlert, NotificationStats } from "../notifications/publisher.ts";
import { supabase } from "../db/client.ts";

export interface WatcherResult {
  status: "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED";
  durationSec: string;
  sourceStats: any;
  persistenceStats: any;
  canonicalStats: any;
  notificationStats: NotificationStats;
}

export async function runWatcherPipeline(isLive: boolean): Promise<WatcherResult> {
  const startTime = Date.now();

  const allAcceptedJobs: any[] = [];
  const sourceStats: any = { ApplyGuy: {}, Simplify: {} };
  let partialFailure = false;

  // 1. Fetch & Normalize & Filter
  const [applyGuyData, simplifyData] = await Promise.all([
    new ApplyGuySource().fetch(),
    new SimplifySource().fetch()
  ]);

  const sources = [
    { name: "ApplyGuy", data: applyGuyData, normalizer: normalizeApplyGuy },
    { name: "Simplify", data: simplifyData, normalizer: normalizeSimplify }
  ];

  for (const src of sources) {
    sourceStats[src.name] = { fetch: "SUCCESS", raw: 0, accepted: 0 };
    
    if (!src.data || !src.data.success) {
      sourceStats[src.name].fetch = "FAILED";
      partialFailure = true;
      console.error(`[ERROR] Fetch for ${src.name} failed: ${src.data?.error}`);
      await publishSystemAlert('critical', `Fetcher: ${src.name}`, `API Fetch Failed`, src.data?.error || 'Unknown error');
      continue;
    }

    const records = src.data.records || [];
    sourceStats[src.name].raw = records.length;
    
    let failedNorm = 0;
    for (const raw of records) {
      const normalized = src.normalizer(raw);
      if (!normalized) {
        failedNorm++;
        continue;
      }
      const result = filterJob(normalized);
      if (result.accepted) {
        sourceStats[src.name].accepted++;
        allAcceptedJobs.push(normalized);
      }
    }

    if (failedNorm > 0) {
      partialFailure = true;
      await publishSystemAlert('warning', `Normalizer: ${src.name}`, `Standardization Warnings`, `Failed to normalize ${failedNorm} out of ${records.length} records.`);
    }
  }

  // 2. Persistence
  let persistenceStats = { filteredReceived: 0, uniqueInBatch: 0, dupesInBatch: 0, inserted: 0, updated: 0, unchanged: 0, failed: 0, insertedIds: [] as string[] };
  if (allAcceptedJobs.length > 0) {
    try {
      persistenceStats = await persistJobs(allAcceptedJobs);
      if (persistenceStats.failed > 0) {
        partialFailure = true;
        await publishSystemAlert('error' as any, `Database: Persistence`, `Failed to persist ${persistenceStats.failed} jobs`, `Check Supabase logs.`);
      }
    } catch (err: any) {
      partialFailure = true;
      console.error(`[ERROR] Persistence totally failed: ${err.message}`);
      await publishSystemAlert('critical', `Database: Persistence`, `Persistence Crashed`, err.message);
    }
  }

  // 3. Canonicalization
  let canonicalStats = { exact: 0, normalized: 0, fallback: 0, created: 0, linked: 0, discovery_events: 0 };
  if (persistenceStats.insertedIds && persistenceStats.insertedIds.length > 0) {
    try {
      canonicalStats = await processCanonicals(persistenceStats.insertedIds, false);
    } catch (err: any) {
      partialFailure = true;
      console.error(`[ERROR] Canonical processing failed: ${err.message}`);
      await publishSystemAlert('critical', `Database: Canonicalization`, `Canonical Processing Crashed`, err.message);
    }
  }

  // 4. Notifications
  let notificationStats = { processed: 0, notified: 0, failed: 0, pendingRemaining: 0, excludedByCutoff: 0 };
  try {
    notificationStats = await processJobNotifications(isLive);
    if (notificationStats.failed > 0) {
      partialFailure = true;
      await publishSystemAlert('error' as any, `Publisher`, `Failed to send ${notificationStats.failed} notifications`, `Check Ntfy client or Edge Function timeout.`);
    }
  } catch (err: any) {
    partialFailure = true;
    console.error(`[ERROR] Publisher failed: ${err.message}`);
    await publishSystemAlert('critical', `Publisher`, `Publisher Crashed`, err.message);
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  const status = partialFailure ? "PARTIAL_SUCCESS" : "SUCCESS";

  return {
    status,
    durationSec,
    sourceStats,
    persistenceStats,
    canonicalStats,
    notificationStats
  };
}
