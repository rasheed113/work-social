import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ejpcgcaoqyqjionvtsdi.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_C0Bp6jRBkpzRtnqBLcUfOA_NHZrCmam';

type ViteImportMeta = ImportMeta & {
  env: {
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  };
};

const env = (import.meta as ViteImportMeta).env;
const supabaseUrl = env.VITE_SUPABASE_URL || SUPABASE_URL;
const supabasePublishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    flowType: 'pkce',
    detectSessionInUrl: false,
    persistSession: true,
    autoRefreshToken: true,
  },
});
