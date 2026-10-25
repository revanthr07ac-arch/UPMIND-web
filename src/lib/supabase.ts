import { createClient } from '@supabase/supabase-js';

// Environment variables with fallback to production project
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://nfjrhdrmsdincireoada.supabase.co';

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_TvYgdpQKKrS-4IpGFxGXSg_MQo00pzp';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
