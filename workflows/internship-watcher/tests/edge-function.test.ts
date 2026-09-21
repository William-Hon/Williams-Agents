import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We must mock the pipeline before importing the handler
vi.mock('../src/pipeline/watcher.ts', () => ({
  runWatcherPipeline: vi.fn()
}));

import { handleRequest } from '../../../supabase/functions/internship-watcher/handler';
import { runWatcherPipeline } from '../src/pipeline/watcher';

describe('Edge Function HTTP Handler (Cloud-Runtime Tests)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
    process.env.WATCHER_INVOKE_TOKEN = 'test-secret-token';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('1. Rejects non-POST requests', async () => {
    const req = new Request('https://edge.supabase/internship-watcher', { method: 'GET' });
    const res = await handleRequest(req);
    expect(res.status).toBe(405);
    const json = await res.json();
    expect(json.error).toContain('Use POST');
  });

  it('2. Rejects requests with missing WATCHER_INVOKE_TOKEN', async () => {
    const req = new Request('https://edge.supabase/internship-watcher', { method: 'POST' });
    const res = await handleRequest(req);
    expect(res.status).toBe(401);
  });

  it('3. Rejects requests with invalid WATCHER_INVOKE_TOKEN', async () => {
    const req = new Request('https://edge.supabase/internship-watcher', { 
      method: 'POST',
      headers: { 'Authorization': 'Bearer wrong-token' }
    });
    const res = await handleRequest(req);
    expect(res.status).toBe(401);
  });

  it('4. Fails 500 if server environment lacks WATCHER_INVOKE_TOKEN', async () => {
    delete process.env.WATCHER_INVOKE_TOKEN;
    const req = new Request('https://edge.supabase/internship-watcher', { 
      method: 'POST',
      headers: { 'Authorization': 'Bearer some-token' }
    });
    const res = await handleRequest(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toContain('Server misconfigured');
  });

  it('5. Safe cloud invocation with notification delivery disabled', async () => {
    process.env.INTERNSHIP_WATCHER_ENABLE_CLOUD_DELIVERY = 'false';
    const req = new Request('https://edge.supabase/internship-watcher', { 
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-secret-token' }
    });

    vi.mocked(runWatcherPipeline).mockResolvedValueOnce({
      status: 'SUCCESS',
      durationSec: '4.2',
      sourceStats: {},
      persistenceStats: {},
      canonicalStats: {},
      notificationStats: { processed: 10, notified: 0, failed: 0, pendingRemaining: 10, excludedByCutoff: 0 }
    });

    const res = await handleRequest(req);
    expect(res.status).toBe(200);
    
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.result.status).toBe('SUCCESS');
    
    // Verify it invoked the pipeline in safe mode (false)
    expect(runWatcherPipeline).toHaveBeenCalledWith(false);
  });

  it('6. Live cloud invocation when configured', async () => {
    process.env.INTERNSHIP_WATCHER_ENABLE_CLOUD_DELIVERY = 'true';
    const req = new Request('https://edge.supabase/internship-watcher', { 
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-secret-token' }
    });

    vi.mocked(runWatcherPipeline).mockResolvedValueOnce({
      status: 'SUCCESS',
      durationSec: '4.2',
      sourceStats: {},
      persistenceStats: {},
      canonicalStats: {},
      notificationStats: { processed: 0, notified: 5, failed: 0, pendingRemaining: 0, excludedByCutoff: 0 }
    });

    const res = await handleRequest(req);
    expect(res.status).toBe(200);
    
    // Verify it invoked the pipeline in live mode (true)
    expect(runWatcherPipeline).toHaveBeenCalledWith(true);
  });

  it('7. Returns 207 for PARTIAL_SUCCESS', async () => {
    const req = new Request('https://edge.supabase/internship-watcher', { 
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-secret-token' }
    });

    vi.mocked(runWatcherPipeline).mockResolvedValueOnce({
      status: 'PARTIAL_SUCCESS',
      durationSec: '4.2',
      sourceStats: {},
      persistenceStats: {},
      canonicalStats: {},
      notificationStats: { processed: 0, notified: 0, failed: 0, pendingRemaining: 0, excludedByCutoff: 0 }
    });

    const res = await handleRequest(req);
    expect(res.status).toBe(207);
    
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('8. Returns 500 for FAILED', async () => {
    const req = new Request('https://edge.supabase/internship-watcher', { 
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-secret-token' }
    });

    vi.mocked(runWatcherPipeline).mockResolvedValueOnce({
      status: 'FAILED',
      durationSec: '4.2',
      sourceStats: {},
      persistenceStats: {},
      canonicalStats: {},
      notificationStats: { processed: 0, notified: 0, failed: 0, pendingRemaining: 0, excludedByCutoff: 0 }
    });

    const res = await handleRequest(req);
    expect(res.status).toBe(500);
    
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it('9. Returns 500 for unhandled exceptions in the pipeline', async () => {
    const req = new Request('https://edge.supabase/internship-watcher', { 
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-secret-token' }
    });

    vi.mocked(runWatcherPipeline).mockRejectedValueOnce(new Error('Supabase completely offline'));

    const res = await handleRequest(req);
    expect(res.status).toBe(500);
    
    const json = await res.json();
    expect(json.error).toContain('Internal Server Error');
  });
});
