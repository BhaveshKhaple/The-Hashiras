import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// DISP-005 fix: only create a real Supabase client when env vars are present.
// Avoids WebSocket connections to placeholder.supabase.co that flood the console
// and can cause React hydration warnings.
export const isSupabaseConfigured = !!(supabaseUrl && supabaseKey &&
  supabaseUrl !== 'your-supabase-url' &&
  !supabaseUrl.includes('placeholder'));

// Always export a client — callers guard with isSupabaseConfigured or try/catch
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-key',
  // When not configured, disable realtime to prevent WebSocket spam
  isSupabaseConfigured ? {} : { realtime: { params: { eventsPerSecond: 0 } } }
);

