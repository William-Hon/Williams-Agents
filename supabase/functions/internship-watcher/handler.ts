import { runWatcherPipeline } from '../../../workflows/internship-watcher/src/pipeline/watcher.ts';

export async function handleRequest(req: Request): Promise<Response> {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), { status: 405, headers });
  }

  try {
    // @ts-ignore - Deno is available in Edge Function runtime
    const rawToken = typeof Deno !== 'undefined' ? Deno.env.get('WATCHER_INVOKE_TOKEN') : process.env.WATCHER_INVOKE_TOKEN;
    const expectedToken = rawToken ? rawToken.replace(/[\r\n]/g, '').trim() : undefined;
    
    if (!expectedToken) {
      console.error('[FATAL] Missing WATCHER_INVOKE_TOKEN in Edge Function environment');
      return new Response(JSON.stringify({ error: 'Server misconfigured: missing authorization secret.' }), { status: 500, headers });
    }

    const authHeader = req.headers.get('Authorization');
    const providedToken = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : '';

    if (!providedToken || providedToken !== expectedToken) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
    }

    // @ts-ignore
    const enableCloudDelivery = (typeof Deno !== 'undefined' ? Deno.env.get('INTERNSHIP_WATCHER_ENABLE_CLOUD_DELIVERY') : process.env.INTERNSHIP_WATCHER_ENABLE_CLOUD_DELIVERY) === 'true';

    console.log(`[START] Edge Function invoked. Live delivery enabled: ${enableCloudDelivery}`);

    const result = await runWatcherPipeline(enableCloudDelivery);

    console.log(`[END] Pipeline finished with status: ${result.status}`);
    
    // Create a safe logging copy without massive arrays
    const logSummary = {
      ...result,
      persistenceStats: {
        ...result.persistenceStats,
        insertedIds: undefined // Strip array to prevent log truncation
      }
    };
    
    // Prefixing with a string prevents Supabase Logflare from incorrectly parsing 
    // it as a top-level structured log and dropping it due to 'status' field conflicts.
    console.log(`[SUMMARY] ${JSON.stringify(logSummary)}`);

    let statusCode = 200;
    if (result.status === 'PARTIAL_SUCCESS') {
      statusCode = 207;
    } else if (result.status === 'FAILED') {
      statusCode = 500;
    }

    return new Response(JSON.stringify({
      success: result.status !== 'FAILED',
      result
    }), { status: statusCode, headers });

  } catch (err: any) {
    console.error(`[FATAL] Unhandled error during Edge Function execution: ${err.message}`);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers });
  }
}
