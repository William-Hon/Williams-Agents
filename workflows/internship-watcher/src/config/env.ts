import * as dotenv from 'dotenv';
import path from 'path';

// Resolve the path to the internship-watcher specific .env file
// __dirname here will be .../workflows/internship-watcher/src/config
const envPath = path.resolve(__dirname, '../../.env');

// Load the environment variables from this specific path
dotenv.config({ path: envPath });

export const SUPABASE_URL = process.env.SUPABASE_URL || '';
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const NTFY_SERVER_URL = process.env.INTERNSHIP_WATCHER_NTFY_SERVER_URL || 'https://ntfy.sh';
export const NTFY_TOPIC = process.env.INTERNSHIP_WATCHER_NTFY_TOPIC || '';
