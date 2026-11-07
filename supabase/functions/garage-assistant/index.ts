import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { createHandler } from "./handler.ts";
import { generateGemini, selectModels } from "./gemini.ts";
const projectUrl = Deno.env.get("SUPABASE_URL")!;
const publicKey =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  "";
const apiKey = Deno.env.get("GEMINI_API_KEY");
const models = selectModels(Deno.env.get("GEMINI_MODEL"));
const client = (token: string) =>
  createClient(projectUrl, publicKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
Deno.serve(
  createHandler({
    origin:
      Deno.env.get("APP_ORIGIN") ??
      "https://my-garage-mazda-bp.nicecrab11.chatgpt.site",
    configured: () => !!apiKey && models.length > 0,
    async authorize(token) {
      const scoped = client(token);
      const {
        data: { user },
        error,
      } = await scoped.auth.getUser(token);
      if (error || !user) return false;
      const { data, error: memberError } = await scoped
        .from("garage_members")
        .select("active")
        .eq("user_id", user.id)
        .maybeSingle();
      return !memberError && data?.active === true;
    },
    async quota(token) {
      const { data, error } = await client(token).rpc(
        "consume_garage_ai_quota",
      );
      if (error) throw error;
      return data === true;
    },
    generate: (body) => generateGemini(body, apiKey!, models),
  }),
);
