// Helper to check if we are in a Deno environment (like Supabase Edge Functions)
// @ts-ignore
const isDeno = typeof Deno !== 'undefined';

if (!isDeno) {
  // We are in Node.js (local development/testing). Load the local .env file.
  // Using require to avoid static import resolution errors in Deno.
  const dotenv = require('dotenv');
  const path = require('node:path');
  const envPath = path.resolve(__dirname, '../../.env');
  dotenv.config({ path: envPath });
}

// Prevent tests from accidentally touching the production database!
// @ts-ignore
const getEnv = (key: string) => isDeno ? Deno.env.get(key) : process.env[key];
const isTestEnv = getEnv('NODE_ENV') === 'test' || getEnv('VITEST');

// In test environments, STRICTLY use the test URL. If missing, fail closed by providing an empty URL
// rather than falling back to production credentials.
export const SUPABASE_URL = isTestEnv 
  ? (getEnv('SUPABASE_TEST_URL') || '') 
  : (getEnv('SUPABASE_URL') || '');

export const SUPABASE_SERVICE_ROLE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY') || '';
export const NTFY_HOST_URL = getEnv('INTERNSHIP_WATCHER_NTFY_HOST_URL') || 'https://ntfy.sh';
export const NTFY_JOBS_ALERT_TOPIC = getEnv('INTERNSHIP_WATCHER_NTFY_JOBS_ALERT_TOPIC') || '';
export const NTFY_DEV_LOGS_TOPIC = getEnv('INTERNSHIP_WATCHER_NTFY_DEV_LOGS_TOPIC') || '';
export const IGNORE_JOBS_BEFORE_DATE = getEnv('INTERNSHIP_WATCHER_IGNORE_JOBS_BEFORE_DATE') || '';
export const ACTION_FUNCTION_URL = getEnv('SUPABASE_ACTION_FUNCTION_URL') || 
  (SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/action-handler` : '');
