import { supabase } from '../db/client.ts';
import { NTFY_JOBS_ALERT_TOPIC, NTFY_DEV_LOGS_TOPIC, IGNORE_JOBS_BEFORE_DATE, ACTION_FUNCTION_URL } from '../config/env.ts';
import { NtfyClient, NtfyPublishOptions } from './ntfy.ts';
import { generateActionToken } from './tokens.ts';

const ntfy = new NtfyClient();

export type TimestampPrecision = 'exact' | 'date-only';

export function getSourcePrecision(source: string): TimestampPrecision {
  // A clear, maintainable way to distinguish source precision.
  // Future sources can be added here without database migrations.
  const s = (source || '').toLowerCase();
  if (s === 'simplify') return 'exact';
  if (s === 'applyguy') return 'date-only';
  return 'date-only'; // Default unknown sources to date-only for safety
}

export function formatEST(dateString: string | null | undefined, precision: TimestampPrecision = 'exact'): string {
  if (!dateString) return "Not specified";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Not specified";

  if (precision === 'date-only') {
    // Extract YYYY-MM-DD exactly as represented in the ISO string
    // to prevent any timezone shifts during conversion.
    const [y, m, day] = dateString.substring(0, 10).split('-');
    // Creating it at noon local avoids boundaries regardless of current timezone
    const localD = new Date(parseInt(y), parseInt(m) - 1, parseInt(day), 12, 0, 0);
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return `${new Intl.DateTimeFormat('en-US', options).format(localD)} (exact time not specified)`;
  } else {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short'
    };
    return new Intl.DateTimeFormat('en-US', options).format(date);
  }
}

export function resolvePostedAt(listings: any[]) {
  let bestPosted: { dateString: string, isoString: string, precision: TimestampPrecision } | null = null;
  
  for (const listing of listings) {
    if (!listing.posted_at) continue;

    const precision = getSourcePrecision(listing.source);
    let dateString = '';

    if (precision === 'date-only') {
      dateString = listing.posted_at.substring(0, 10);
    } else {
      const d = new Date(listing.posted_at);
      // 'en-CA' inherently formats as YYYY-MM-DD
      const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
      dateString = formatter.format(d);
    }

    const current = { dateString, isoString: listing.posted_at, precision };

    if (!bestPosted) {
      bestPosted = current;
    } else {
      // 1. Earliest calendar date wins
      if (current.dateString < bestPosted.dateString) {
        bestPosted = current;
      } 
      // 2. On tie, prefer exact over date-only
      else if (current.dateString === bestPosted.dateString) {
        if (current.precision === 'exact' && bestPosted.precision === 'date-only') {
          bestPosted = current;
        } 
        // 3. On exact tie, earliest actual timestamp wins
        else if (current.precision === 'exact' && bestPosted.precision === 'exact') {
          if (new Date(current.isoString) < new Date(bestPosted.isoString)) {
            bestPosted = current;
          }
        }
      }
    }
  }

  return bestPosted;
}

export async function publishSystemAlert(
  severity: 'info' | 'warning' | 'critical',
  component: string,
  summary: string,
  detail?: string
): Promise<void> {
  const errorTopic = NTFY_DEV_LOGS_TOPIC;
  if (!errorTopic) {
    console.warn("[WARNING] System alert skipped: INTERNSHIP_WATCHER_NTFY_DEV_LOGS_TOPIC is not configured.");
    return;
  }

  const priorityMap = {
    info: 3,
    warning: 4,
    critical: 5
  };

  const message = detail ? `${component}\n\n${detail}` : component;

  const options: NtfyPublishOptions = {
    topic: errorTopic,
    title: `[${severity.toUpperCase()}] ${summary}`,
    message,
    priority: priorityMap[severity] as any,
    tags: severity === 'critical' ? ['rotating_light'] : severity === 'warning' ? ['warning'] : ['information_source']
  };

  try {
    await ntfy.publish(options);
  } catch (err: any) {
    // DO NOT recursively try to publish this failure to the error topic
    console.error(`[FATAL] Failed to publish system alert to ntfy: ${err.message}`);
  }
}

export async function dispatchNotificationForJob(job: any, isTest: boolean = false, live: boolean = false): Promise<void> {
  // Calculate enriched fields
  const listings = job.job_listings || [];
  
  let firstSeenAt = null;
  const sourcesSet = new Set<string>();
  const termsSet = new Set<string>();

  for (const listing of listings) {
    if (listing.first_seen_at) {
      if (!firstSeenAt || new Date(listing.first_seen_at) < new Date(firstSeenAt)) {
        firstSeenAt = listing.first_seen_at;
      }
    }
    if (listing.source) {
      const srcName = listing.source.toLowerCase() === 'applyguy' ? 'ApplyGuy' : 
                      listing.source.toLowerCase() === 'simplify' ? 'Simplify' : listing.source;
      sourcesSet.add(srcName);
    }
    if (listing.terms && Array.isArray(listing.terms)) {
      listing.terms.forEach((t: string) => termsSet.add(t));
    }
  }

  // Fallback terms to canonical_jobs.terms if missing
  if (termsSet.size === 0 && job.terms && Array.isArray(job.terms)) {
    job.terms.forEach((t: string) => termsSet.add(t));
  }

  const sourcesStr = sourcesSet.size > 0 ? Array.from(sourcesSet).join(' + ') : 'Unknown';
  const termsStr = termsSet.size > 0 ? Array.from(termsSet).join(', ') : 'Unknown';
  const locationText = job.locations && job.locations.length > 0 ? job.locations.join(' | ') : 'Unknown';

  const bestPosted = resolvePostedAt(listings);
  const postedStr = bestPosted ? formatEST(bestPosted.isoString, bestPosted.precision) : 'Not specified';
  const firstSeenStr = firstSeenAt ? formatEST(firstSeenAt, 'exact') : 'Not specified';

  const messageBody = `${job.company} — ${job.title}\n\nLocation: ${locationText}\nTerm: ${termsStr}\nSources: ${sourcesStr}\n\nPosted: ${postedStr}\nFirst detected: ${firstSeenStr}`;

  if (live) {
    // Generate Tokens
    const appliedToken = generateActionToken();
    const ignoreToken = generateActionToken();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(); // 14 days

    // Insert tokens (requires write access to action_tokens)
    await supabase.from('action_tokens').insert([
      { token_hash: appliedToken.hash, canonical_job_id: job.id, action: 'applied', expires_at: expiresAt },
      { token_hash: ignoreToken.hash, canonical_job_id: job.id, action: 'not_interested', expires_at: expiresAt }
    ]);

    const actions: any[] = [];
    
    // Button 1: Apply Now
    if (job.apply_url && job.apply_url.startsWith('http')) {
      actions.push({
        action: 'view',
        label: 'Apply Now',
        url: job.apply_url
      });
    }

    // Action Webhook URL helper
    const getActionUrl = (action: string, token: string) => {
      if (!ACTION_FUNCTION_URL) return undefined;
      return `${ACTION_FUNCTION_URL}?job=${job.id}&action=${action}&token=${token}`;
    };

    const appliedUrl = getActionUrl('applied', appliedToken.plaintext);
    const ignoreUrl = getActionUrl('not_interested', ignoreToken.plaintext);

    if (appliedUrl) {
      actions.push({
        action: 'http',
        label: 'Mark Applied',
        url: appliedUrl,
        method: 'POST',
        clear: true
      });
    }

    if (ignoreUrl) {
      actions.push({
        action: 'http',
        label: 'Not Interested',
        url: ignoreUrl,
        method: 'POST',
        clear: true
      });
    }

    const titlePrefix = isTest ? '[TEST] ' : '';

    await ntfy.publish({
      topic: NTFY_JOBS_ALERT_TOPIC as string,
      title: `${titlePrefix}New Internship: ${job.company}`,
      message: messageBody,
      tags: ['briefcase'],
      clickUrl: job.apply_url,
      actions: actions.length > 0 ? actions : undefined
    });

  } else {
    console.log(`[DRY RUN] Would publish:\n${isTest ? '[TEST] ' : ''}New Internship: ${job.company}\n${messageBody}`);
  }
}

export interface NotificationStats {
  processed: number;
  notified: number;
  failed: number;
  pendingRemaining: number;
  excludedByCutoff: number;
}

export async function processJobNotifications(live: boolean = false): Promise<NotificationStats> {
  const stats: NotificationStats = {
    processed: 0,
    notified: 0,
    failed: 0,
    pendingRemaining: 0,
    excludedByCutoff: 0
  };

  if (!IGNORE_JOBS_BEFORE_DATE) {
    console.warn(`[WARNING] Notification publisher skipped: INTERNSHIP_WATCHER_IGNORE_JOBS_BEFORE_DATE is missing.`);
    return stats;
  }
  
  if (!NTFY_JOBS_ALERT_TOPIC) {
    console.warn(`[WARNING] Notification publisher skipped: INTERNSHIP_WATCHER_NTFY_JOBS_ALERT_TOPIC is missing.`);
    return stats;
  }

  const cutoff = new Date(IGNORE_JOBS_BEFORE_DATE).toISOString();

  // Get total pending for cutoff math
  const { count: totalPending } = await supabase
    .from('discovery_events')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  const { data: pendingEvents, error: fetchError } = await supabase
    .from('discovery_events')
    .select('id, canonical_job_id, claimed_at, claim_expires_at')
    .eq('status', 'pending')
    .gte('created_at', cutoff);

  if (fetchError) {
    await publishSystemAlert('error' as any, 'Publisher', 'Failed to fetch pending events', fetchError.message);
    return stats;
  }

  const eligiblePendingCount = pendingEvents ? pendingEvents.length : 0;
  stats.excludedByCutoff = (totalPending || 0) - eligiblePendingCount;

  if (!pendingEvents || pendingEvents.length === 0) {
    stats.pendingRemaining = totalPending || 0;
    return stats;
  }

  const now = new Date();
  const eligible = pendingEvents.filter(e => !e.claimed_at || new Date(e.claim_expires_at!) < now);

  if (eligible.length === 0) {
    stats.pendingRemaining = totalPending || 0;
    return stats;
  }

  for (const event of eligible) {
    if (live) {
      // Attempt claim
      const claimExpiry = new Date(Date.now() + 5 * 60000).toISOString();
      const { data: claimed, error: claimError } = await supabase
        .from('discovery_events')
        .update({ claimed_at: new Date().toISOString(), claim_expires_at: claimExpiry })
        .eq('id', event.id)
        .is('claimed_at', event.claimed_at) // Optimistic locking
        .select('id')
        .single();

      if (claimError || !claimed) {
        continue; // Another worker got it
      }
    }

    try {
      const { data: job, error: jobError } = await supabase
        .from('canonical_jobs')
        .select(`*, job_listings(*)`)
        .eq('id', event.canonical_job_id)
        .single();

      if (jobError || !job) throw new Error("Canonical job not found");

      await dispatchNotificationForJob(job, false, live);

      if (live) {
        // Mark notified
        await supabase
          .from('discovery_events')
          .update({ status: 'notified' })
          .eq('id', event.id);
        stats.notified++;
      } else {
        stats.processed++; // Previewed without claiming
      }

    } catch (err: any) {
      console.error(`[ERROR] Failed to publish event ${event.id}: ${err.message}`);
      if (live) {
        stats.failed++;
        // Leave claimed_at as is, it will expire and retry
      }
    }
  }

  // Calculate final pending
  const { count: finalPending } = await supabase
    .from('discovery_events')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
  stats.pendingRemaining = finalPending || 0;

  return stats;
}
