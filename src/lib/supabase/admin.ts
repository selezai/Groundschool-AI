import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Service role client for admin operations — bypasses RLS
// NEVER use this on the client side or in non-admin routes
// Returns null if SUPABASE_SERVICE_ROLE_KEY is not configured
export function createAdminClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey || serviceRoleKey === "YOUR_SERVICE_ROLE_KEY_HERE") {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
