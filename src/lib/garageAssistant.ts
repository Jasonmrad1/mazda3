import { supabase } from "./supabase";
import type { GarageData } from "./types";
import { buildAssistantContext, type Citation } from "./assistantContext";
export async function assistantReady() {
  if (!supabase) return false;
  const { data, error } = await supabase.functions.invoke("garage-assistant", {
    body: { action: "status" },
  });
  return !error && data?.ready === true;
}
export async function askGemini(
  question: string,
  data: GarageData,
  sources: Citation[],
  history: { role: "user" | "assistant"; text: string }[],
) {
  if (!supabase) throw Error("The secure assistant is not configured.");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw Error("Sign in again to use Garage Assistant.");
  const { data: reply, error } = await supabase.functions.invoke(
    "garage-assistant",
    {
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: {
        query: question,
        context: buildAssistantContext(data, sources),
        history: history
          .slice(-12)
          .map(({ role, text }) => ({ role, text: text.slice(0, 6000) })),
      },
    },
  );
  if (error) {
    const response =
      "context" in error ? (error.context as Response) : undefined;
    let explanation =
      "Garage Assistant could not connect. Your records are still saved.";
    if (response && typeof response.json === "function")
      try {
        const json = await response.json();
        if (typeof json.error === "string") explanation = json.error;
      } catch {}
    throw Error(explanation);
  }
  if (typeof reply?.answer !== "string")
    throw Error("Garage Assistant returned an invalid answer.");
  return {
    answer: reply.answer as string,
    model: typeof reply.model === "string" ? reply.model : undefined,
  };
}
