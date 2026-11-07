import { describe, it, expect } from "vitest";
import { resolveSupabaseConfig } from "./supabaseConfig";
describe("Render public project configuration", () => {
  it("keeps sign-in configured when ignored local env files are absent", () => {
    const config = resolveSupabaseConfig({});
    expect(config.url).toBe("https://trrdhmbkyaivlfbuupbf.supabase.co");
    expect(config.key).toMatch(/^sb_publishable_/);
    expect(config.key).not.toMatch(/^sb_secret_/);
  });
  it("allows environment overrides and supports the usual anon-key alias", () => {
    expect(
      resolveSupabaseConfig({
        url: " https://other.supabase.co ",
        anonKey: " legacy-public-key ",
      }),
    ).toEqual({ url: "https://other.supabase.co", key: "legacy-public-key" });
    expect(
      resolveSupabaseConfig({ publishableKey: "public-new", anonKey: "old" })
        .key,
    ).toBe("public-new");
  });
});
