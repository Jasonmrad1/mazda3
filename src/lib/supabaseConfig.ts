import project from "../config/supabase.public.json";
// Publishable keys are public client configuration, not server credentials.
export function resolveSupabaseConfig(environment: {
  url?: string;
  publishableKey?: string;
  anonKey?: string;
}) {
  return {
    url: environment.url?.trim() || project.url,
    key:
      environment.publishableKey?.trim() ||
      environment.anonKey?.trim() ||
      project.publishableKey,
  };
}
