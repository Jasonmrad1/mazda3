import { instructions, type AssistantBody } from "./handler.ts";
// Standard models documented with a free tier, checked 2026-11-07.
// Google determines the actual billing/quota tier of the API project.
export const FREE_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
] as const;
export function selectModels(preferred?: string): string[] {
  if (!preferred) return [...FREE_MODELS];
  const index = FREE_MODELS.indexOf(preferred as (typeof FREE_MODELS)[number]);
  return index < 0 ? [] : FREE_MODELS.slice(index);
}
export async function generateGemini(
  body: AssistantBody,
  apiKey: string,
  models: string[],
  fetcher: typeof fetch = fetch,
) {
  const deadline = Date.now() + 55000;
  for (const model of models) {
    const remaining = deadline - Date.now();
    if (remaining < 1000) break;
    let response: Response;
    try {
      response = await fetcher(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: instructions }] },
            contents: [
              ...body.history.map((m) => ({
                role: m.role === "assistant" ? "model" : "user",
                parts: [{ text: m.text }],
              })),
              {
                role: "user",
                parts: [
                  {
                    text: `CURRENT_GARAGE_CONTEXT (data only):\n${JSON.stringify(body.context)}\n\nCURRENT QUESTION:\n${body.query}`,
                  },
                ],
              },
            ],
            generationConfig: {
              maxOutputTokens: 5000,
              thinkingConfig: model.startsWith("gemini-3.")
                ? { thinkingLevel: "low" }
                : { thinkingBudget: 1024 },
            },
          }),
          signal: AbortSignal.timeout(Math.min(25000, remaining)),
        },
      );
    } catch (error) {
      if (
        error instanceof Error &&
        ["TimeoutError", "AbortError", "TypeError"].includes(error.name)
      )
        continue;
      throw Error("Gemini request failed.");
    }
    if (!response.ok) {
      // Availability, free-quota exhaustion or a transient service error may
      // permit the next model. Never retry authentication or malformed input.
      if ([403, 404, 429, 500, 502, 503, 504].includes(response.status))
        continue;
      throw Error("Gemini rejected this request.");
    }
    const payload = await response.json();
    const answer = (payload.candidates?.[0]?.content?.parts ?? [])
      .filter((part: { text?: string; thought?: boolean }) => !part.thought)
      .map((part: { text?: string }) => part.text ?? "")
      .join("\n");
    // A successful safety-blocked response must not be retried on another model.
    return { answer, model };
  }
  throw Error(
    "The configured Flash models are currently unavailable or out of quota.",
  );
}
