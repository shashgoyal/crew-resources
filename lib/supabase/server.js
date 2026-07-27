import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Use Secret Service Key on server side to bypass RLS when inserting/updating webhook data & parsed schedules
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabaseServer = createClient(supabaseUrl, supabaseSecretKey);
