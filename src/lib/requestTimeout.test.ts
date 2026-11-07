import { afterEach, describe, expect, it, vi } from "vitest";
import { within, boundedFetch } from "./requestTimeout";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("bounded sign-in requests", () => {
  it("releases a stalled request with a clear timeout error", async () => {
    vi.useFakeTimers();
    const pending = within(
      new Promise<string>(() => {}),
      15000,
      "Sign-in took too long.",
    );
    const rejected = expect(pending).rejects.toThrow("Sign-in took too long.");
    await vi.advanceTimersByTimeAsync(15000);
    await rejected;
  });
  it("clears its timeout after a successful request", async () => {
    vi.useFakeTimers();
    expect(await within(Promise.resolve("ready"), 15000, "timeout")).toBe(
      "ready",
    );
    expect(vi.getTimerCount()).toBe(0);
  });
  it("preserves server errors and clears the timer", async () => {
    vi.useFakeTimers();
    await expect(
      within(Promise.reject(Error("Access not granted")), 10000, "timeout"),
    ).rejects.toThrow("Access not granted");
    expect(vi.getTimerCount()).toBe(0);
  });
  it("preserves caller cancellation while adding a network deadline", async () => {
    const caller = new AbortController();
    let requestSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init) => {
        requestSignal = init.signal;
        return new Response("{}");
      }),
    );
    await boundedFetch("https://example.supabase.co/auth/v1/user", {
      signal: caller.signal,
    });
    expect(requestSignal).toBeDefined();
    expect(requestSignal?.aborted).toBe(false);
    caller.abort();
    expect(requestSignal?.aborted).toBe(true);
  });
});
