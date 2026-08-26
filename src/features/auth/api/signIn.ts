import { supabase } from '../../../lib/supabase/client';

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}
