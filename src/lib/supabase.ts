import { createClient } from "@supabase/supabase-js";
import { boundedFetch } from "./requestTimeout";
import { resolveSupabaseConfig } from "./supabaseConfig";

export const { url, key } = resolveSupabaseConfig({
  url: import.meta.env.VITE_SUPABASE_URL,
  publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
});

export const supabase =
  url && key
    ? createClient(url, key, { global: { fetch: boundedFetch } })
    : null;
