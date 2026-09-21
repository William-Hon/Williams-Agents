-- Phase 8: Internship Watcher Cron Schedule
-- IMPORTANT: This migration assumes the Vault secret 'WATCHER_INVOKE_TOKEN' has already been created.

-- Enable pg_cron and pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
-- Supabase Vault is typically enabled by default, but we can ensure the schema exists:
-- CREATE EXTENSION IF NOT EXISTS supabase_vault CASCADE;

-- Remove any existing job with the same name to ensure idempotency
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'internship-watcher-15min') THEN
    PERFORM cron.unschedule('internship-watcher-15min');
  END IF;
END;
$$;

-- Create the 15-minute cron schedule
SELECT cron.schedule(
  'internship-watcher-15min',
  '*/15 * * * *',
  $$
  DO $do$
  DECLARE
    invoke_token text;
    request_id bigint;
  BEGIN
    -- 1. Retrieve and trim the secure token from Supabase Vault (removes accidental newlines/spaces)
    SELECT trim(both E' \n\r\t' from secret) INTO invoke_token 
    FROM vault.decrypted_secrets 
    WHERE name = 'WATCHER_INVOKE_TOKEN';

    IF invoke_token IS NULL THEN
      RAISE EXCEPTION 'Vault secret "WATCHER_INVOKE_TOKEN" not found. Cannot invoke Edge Function.';
    END IF;

    -- 2. Execute the async HTTP POST request via pg_net
    -- Using a 15-second timeout (15000ms) because typical execution is 4-6 seconds.
    SELECT net.http_post(
        url := 'https://qormhrdjkgxmbnxhabnf.supabase.co/functions/v1/internship-watcher',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || invoke_token
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 15000
    ) INTO request_id;
  END;
  $do$;
  $$
);
