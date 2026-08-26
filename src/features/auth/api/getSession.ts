import { supabase } from '../../../lib/supabase/client';

export async function getSession() {
  return supabase.auth.getSession();
}
