import { createClient } from "@supabase/supabase-js";

export const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
  string | undefined;

export const supabase = url && key ? createClient(url, key) : null;
