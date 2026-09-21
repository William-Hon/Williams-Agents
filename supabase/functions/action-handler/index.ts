import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0';

// Web Crypto API is available in Deno natively
async function verifyActionToken(plaintext: string, storedHash: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Basic comparison (timing-safe is ideal but hard in pure JS without Deno crypto equivalents,
  // standard equality is acceptable here given random 256-bit hashes).
  return hashHex === storedHash;
}

serve(async (req) => {
  // CORS Headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), { status: 405, headers });
  }

  try {
    const url = new URL(req.url);
    const jobId = url.searchParams.get('job');
    const action = url.searchParams.get('action');
    const token = url.searchParams.get('token');

    if (!jobId || !action || !token) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), { status: 400, headers });
    }

    if (action !== 'applied' && action !== 'not_interested') {
      return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Server configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Re-hash the provided plaintext token to look it up in the database
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(token));
    const tokenHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    // 2. Fetch the token from DB
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('action_tokens')
      .select('*')
      .eq('token_hash', tokenHash)
      .single();

    if (tokenError || !tokenRecord) {
      return new Response(JSON.stringify({ error: 'Unauthorized or invalid token' }), { status: 401, headers });
    }

    // 3. Validate scope & expiration
    if (tokenRecord.canonical_job_id !== jobId) {
      return new Response(JSON.stringify({ error: 'Token not scoped to this job' }), { status: 403, headers });
    }

    if (tokenRecord.action !== action) {
      return new Response(JSON.stringify({ error: 'Token not authorized for this action' }), { status: 403, headers });
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Token expired' }), { status: 401, headers });
    }

    // 4. Update the canonical job
    const { error: updateError } = await supabase
      .from('canonical_jobs')
      .update({
        application_status: action,
        application_status_updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    if (updateError) {
      console.error(updateError);
      return new Response(JSON.stringify({ error: 'Failed to update job status' }), { status: 500, headers });
    }

    // 5. Success
    return new Response(JSON.stringify({ 
      success: true, 
      message: `Job successfully marked as ${action}` 
    }), { status: 200, headers });

  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers });
  }
});
