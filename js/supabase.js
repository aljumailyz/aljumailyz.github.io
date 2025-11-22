import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.3/+esm';

let client;

const getConfig = () => {
  if (window.__SUPABASE_CONFIG?.supabaseUrl && window.__SUPABASE_CONFIG?.supabaseAnonKey) {
    return window.__SUPABASE_CONFIG;
  }
  return null;
};

export const supabaseAvailable = () => Boolean(getConfig());

export const supabaseClient = () => {
  if (client) return client;
  const cfg = getConfig();
  if (!cfg) return null;
  client = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      // Explicitly set flow type to avoid undefined this.flowType issues in Safari/older browsers.
      flowType: 'pkce',
    },
  });
  return client;
};
