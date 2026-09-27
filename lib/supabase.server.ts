import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export function createServerSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configure Supabase server credentials in .env.local");
  return createClient<Database>(url, key, {
    global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000) }) },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
