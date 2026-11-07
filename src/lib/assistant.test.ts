import { describe, it, expect, vi } from "vitest";
import { seed } from "./types";
import { retrieve, buildAssistantContext } from "./assistantContext";
import {
  createHandler,
  type Dependencies,
} from "../../supabase/functions/garage-assistant/handler";
import {
  generateGemini,
  selectModels,
  FREE_MODELS,
} from "../../supabase/functions/garage-assistant/gemini";
describe("Gemini Flash fallback", () => {
  const body = { query: "What is due?", context: { tires: [] }, history: [] };
  const success = () =>
    new Response(
      JSON.stringify({
        candidates: [
          { content: { parts: [{ text: "Your recorded maintenance..." }] } },
        ],
      }),
      { status: 200 },
    );
  it("tries 3.8 first and goes down when models are missing or out of quota", async () => {
    const calls: string[] = [];
    const mock = vi.fn(
      async (url: Parameters<typeof fetch>[0], options?: RequestInit) => {
        calls.push(String(url));
        const config = JSON.parse(String(options?.body));
        expect(config.generationConfig.temperature).toBeUndefined();
        return calls.length === 1
          ? new Response("", { status: 404 })
          : calls.length === 2
            ? new Response("", { status: 429 })
            : success();
      },
    );
    const result = await generateGemini(
      body,
      "test-key",
      selectModels(),
      mock as typeof fetch,
    );
    expect(calls[0]).toContain("gemini-3.8-flash");
    expect(calls[1]).toContain("gemini-3.7-flash");
    expect(result.model).toBe("gemini-3.6-flash");
    expect(result.answer).toContain("maintenance");
  });
  it("limits defaults to the documented Flash chain and allows a lower starting point", () => {
    expect(selectModels()).toEqual([...FREE_MODELS]);
    expect(selectModels("gemini-2.5-flash")).toEqual([
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
    ]);
    expect(selectModels("paid-model")).toEqual([]);
  });
  it("does not downgrade after an authentication error or a safety-blocked success", async () => {
    const unauthorized = vi.fn(async () => new Response("", { status: 401 }));
    await expect(
      generateGemini(
        body,
        "test-key",
        selectModels(),
        unauthorized as typeof fetch,
      ),
    ).rejects.toThrow("rejected");
    expect(unauthorized).toHaveBeenCalledTimes(1);
    const blocked = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } }),
          { status: 200 },
        ),
    );
    const result = await generateGemini(
      body,
      "test-key",
      selectModels(),
      blocked as typeof fetch,
    );
    expect(result.answer).toBe("");
    expect(blocked).toHaveBeenCalledTimes(1);
  });
  it("fails clearly when every fallback is unavailable", async () => {
    const missing = vi.fn(async () => new Response("", { status: 404 }));
    await expect(
      generateGemini(body, "test-key", selectModels(), missing as typeof fetch),
    ).rejects.toThrow("unavailable or out of quota");
    expect(missing).toHaveBeenCalledTimes(FREE_MODELS.length);
  });
});
describe("assistant context", () => {
  it("shares the current garage without VIN, passwords or binary files", () => {
    const data = seed();
    data.vehicle.vin = "PRIVATE-VIN";
    data.vehicle.photo = "data:image/png;base64,SECRETIMAGE";
    data.documents.push({
      id: "manual",
      name: "Owners manual",
      kind: "Manual",
      data: "PRIVATE-PDF-BYTES",
      pages: ["Oil guidance"],
      added: "2026-11-07",
    });
    data.history.push({
      id: "oil",
      vehicleId: data.vehicle.id,
      title: "Oil replaced",
      category: "Maintenance",
      date: "2026-11-01",
      meters: 52000000,
      taskId: "oil",
      cost: 50,
      currency: "USD",
      provider: "My workshop",
      notes: "User record",
      attachments: ["manual"],
    });
    const context = buildAssistantContext(data, retrieve("oil", data)),
      serialized = JSON.stringify(context);
    expect(serialized).not.toContain("PRIVATE-VIN");
    expect(serialized).not.toContain("SECRETIMAGE");
    expect(serialized).not.toContain("PRIVATE-PDF-BYTES");
    expect(context.serviceHistory[0].provider).toBe("My workshop");
    expect(context.tires).toHaveLength(4);
    expect(context.maintenance.length).toBeGreaterThan(0);
  });
  it("retrieves the relevant passage later in a manual page and keeps page identity", () => {
    const data = seed();
    data.documents.push({
      id: "manual",
      name: "Mechanical owners manual",
      kind: "Manual",
      data: "",
      pages: [
        "irrelevant ".repeat(400) + "Spark plug procedure for this engine.",
      ],
      added: "",
    });
    const source = retrieve("spark plug procedure", data).find(
      (s) => s.documentId === "manual",
    );
    expect(source?.excerpt).toContain("Spark plug procedure");
    expect(source?.page).toBe(1);
    expect(source?.id).toMatch(/^S\d+$/);
  });
  it("never uses a navigation manual to establish mechanical servicing", () => {
    const data = seed();
    data.documents.push({
      id: "nav",
      name: "Navigation Mazda Connect",
      kind: "Navigation manual",
      data: "",
      pages: ["Engine oil change every 1 mile"],
      added: "",
    });
    expect(
      retrieve("engine oil", data).some((s) => s.documentId === "nav"),
    ).toBe(false);
  });
});
function deps(overrides: Partial<Dependencies> = {}) {
  return {
    origin: "https://garage.example",
    configured: () => true,
    authorize: vi.fn(async () => true),
    quota: vi.fn(async () => true),
    generate: vi.fn(async () => "Based on your recorded oil change [S1]."),
    ...overrides,
  };
}
const request = (
  body: unknown = {
    query: "What is due?",
    context: { tires: [] },
    history: [],
  },
  token = "user-jwt",
) =>
  new Request("https://edge.example", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: "https://garage.example",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
describe("authenticated Gemini backend", () => {
  it("checks readiness without consuming model quota or calling Gemini", async () => {
    const d = deps();
    const response = await createHandler(d)(request({ action: "status" }));
    expect(response.status).toBe(200);
    expect((await response.json()).ready).toBe(true);
    expect(d.quota).not.toHaveBeenCalled();
    expect(d.generate).not.toHaveBeenCalled();
  });
  it("rejects public API keys as bearer tokens without calling the provider", async () => {
    const d = deps();
    expect(
      (await createHandler(d)(request(undefined, "sb_publishable_public")))
        .status,
    ).toBe(401);
    expect(d.generate).not.toHaveBeenCalled();
  });
  it("denies a valid session without administrator membership", async () => {
    const d = deps({ authorize: async () => false });
    expect((await createHandler(d)(request())).status).toBe(403);
    expect(d.generate).not.toHaveBeenCalled();
  });
  it("requires server configuration and does not claim to be connected without it", async () => {
    const d = deps({ configured: () => false });
    expect((await createHandler(d)(request())).status).toBe(503);
    expect(d.generate).not.toHaveBeenCalled();
  });
  it("enforces the server quota before generating", async () => {
    const d = deps({ quota: async () => false });
    expect((await createHandler(d)(request())).status).toBe(429);
    expect(d.generate).not.toHaveBeenCalled();
  });
  it("sends conversation and current context to the provider after authorization", async () => {
    const d = deps();
    const body = {
      query: "What about my tires?",
      context: { tires: [{ psi: 35 }] },
      history: [{ role: "user", text: "I checked today" }],
    };
    const response = await createHandler(d)(request(body));
    expect(response.status).toBe(200);
    expect(d.generate).toHaveBeenCalledWith(body);
    expect((await response.json()).answer).toContain("[S1]");
  });
  it("keeps provider secrets out of client errors", async () => {
    const d = deps({
      generate: async () => {
        throw Error("SECRET_KEY=private-provider-key");
      },
    });
    const response = await createHandler(d)(request());
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("private-provider-key");
  });
  it("rejects oversized payloads, malformed questions, and cross-origin calls", async () => {
    const d = deps();
    expect(
      (await createHandler(d)(request({ query: "", context: {} }))).status,
    ).toBe(400);
    expect((await createHandler(d)(request(null))).status).toBe(400);
    expect(
      (
        await createHandler(d)(
          request({ query: "test", context: { x: "a".repeat(350001) } }),
        )
      ).status,
    ).toBe(413);
    const other = new Request("https://edge.example", {
      method: "POST",
      headers: { Origin: "https://wrong.example" },
    });
    expect((await createHandler(d)(other)).status).toBe(403);
    expect(d.generate).not.toHaveBeenCalled();
  });
});
