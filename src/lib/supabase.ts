import { createClient } from "@supabase/supabase-js";
import { boundedFetch } from "./requestTimeout";

export const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
  string | undefined;

export const supabase =
  url && key
    ? createClient(url, key, { global: { fetch: boundedFetch } })
    : null;
