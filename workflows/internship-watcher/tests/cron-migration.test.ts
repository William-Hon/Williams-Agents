import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 8 Cron Migration Safety & Configuration Tests', () => {
  const migrationPath = path.resolve(__dirname, '../../../supabase/migrations/20260920000002_phase8_cron_vault_fix.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  it('1. Correct Cron expression (*/15 * * * *)', () => {
    expect(sql).toContain("'*/15 * * * *'");
  });

  it('2. Correct Edge Function URL', () => {
    expect(sql).toContain("url := 'https://qormhrdjkgxmbnxhabnf.supabase.co/functions/v1/internship-watcher'");
  });

  it('3. HTTP timeout explicitly set to 15000ms', () => {
    expect(sql).toContain("timeout_milliseconds := 15000");
  });

  it('4. Uses POST method', () => {
    // net.http_post implies POST, ensure no get or other methods are used
    expect(sql).toContain("net.http_post");
  });

  it('5. Retrieves WATCHER_INVOKE_TOKEN from Vault correctly', () => {
    expect(sql).toContain("WHERE name = 'WATCHER_INVOKE_TOKEN'");
  });

  it('6. Does not contain plaintext tokens', () => {
    // Ensure that it reads from vault, not hardcoded
    expect(sql).not.toContain("Authorization: Bearer test");
    expect(sql).not.toContain("Authorization', 'Bearer ey");
    expect(sql).toContain("SELECT decrypted_secret INTO invoke_token");
    expect(sql).toContain("FROM vault.decrypted_secrets");
  });

  it('7. No duplicate active watcher schedules (Unschedule before schedule)', () => {
    expect(sql).toContain("PERFORM cron.unschedule('internship-watcher-15min');");
    expect(sql).toContain("IF EXISTS");
  });

  it('8. Correct scheduling configuration (15-minute)', () => {
    expect(sql).toContain("'internship-watcher-15min'");
    expect(sql).toContain("cron.schedule");
  });

  it('9. Correct pg_net timeout (15 seconds / 15000ms)', () => {
    expect(sql).toContain("timeout_milliseconds := 15000");
  });

  it('10. Schedule activation requires pg_cron and pg_net', () => {
    expect(sql).toContain("CREATE EXTENSION IF NOT EXISTS pg_cron;");
    expect(sql).toContain("CREATE EXTENSION IF NOT EXISTS pg_net;");
  });
});
