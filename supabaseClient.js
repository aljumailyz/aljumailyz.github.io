// supabaseClient.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://xsrbsmjklnigrtmqkbsm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_d82AZMNDIcPtyJUJECehRw_Rf2ZMfXV';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
