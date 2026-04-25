import { createClient } from "@supabase/supabase-js";

// Use placeholders to prevent crash if env vars are missing
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-url.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  if (typeof window !== "undefined") {
    console.warn("⚠️ Supabase environment variables are missing. Database features will not work.");
  }
}

export const supabase = createClient(supabaseUrl, supabaseKey);
