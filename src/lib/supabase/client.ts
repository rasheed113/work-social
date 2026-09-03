import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ejpcgcaoqyqjionvtsdi.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_C0Bp6jRBkpzRtnqBLcUfOA_NHZrCmam';

type ViteImportMeta = ImportMeta & {
  env?: {
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  };
};

// Vite supplies import.meta.env in the browser/build. Node-based contract tests
// executed through tsx do not, so the fallback configuration must be safe when
// the env object is absent rather than dereferencing undefined.
const env = (import.meta as ViteImportMeta).env ?? {};
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
