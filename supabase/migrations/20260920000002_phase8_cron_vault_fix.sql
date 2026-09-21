-- Phase 8: Internship Watcher Cron Vault Column Fix
-- Re-schedules the Cron job to correctly retrieve the decrypted_secret column from Vault instead of the encrypted secret column.

-- Enable pg_cron and pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'internship-watcher-15min') THEN
    PERFORM cron.unschedule('internship-watcher-15min');
  END IF;
END;
$$;

-- Re-create the 15-minute cron schedule with the corrected token retrieval
SELECT cron.schedule(
  'internship-watcher-15min',
  '*/15 * * * *',
  $$
  DO $do$
  DECLARE
    invoke_token text;
    request_id bigint;
  BEGIN
    -- 1. Retrieve the PLAIN TEXT secure token from Supabase Vault
    SELECT decrypted_secret INTO invoke_token 
    FROM vault.decrypted_secrets 
    WHERE name = 'WATCHER_INVOKE_TOKEN';

    IF invoke_token IS NULL THEN
      RAISE EXCEPTION 'Vault secret "WATCHER_INVOKE_TOKEN" not found. Cannot invoke Edge Function.';
    END IF;

    -- 2. Execute the async HTTP POST request via pg_net
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
