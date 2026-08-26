import { supabase } from '../../../lib/supabase/client';

export async function signOut() {
  return supabase.auth.signOut();
}
