import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '../config/env.ts';

const supabaseUrl = SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || 'dummy-key';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[WARNING] Supabase credentials (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) are missing. Persistence will fail.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
