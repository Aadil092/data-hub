import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zsogzrqvtahuqvwnthuk.supabase.co';
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_JCuDqvmy8isPaoisevQzgw_2x8BxJNb';

export const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
