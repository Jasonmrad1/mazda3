import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { GarageDB, loadGarage, saveGarage } from "./store";
import { seed } from "./types";
describe("Offline persistence", () => {
  it("survives database close and reopening without seeding ownership records", async () => {
    const name = "test-garage-" + Date.now();
    const first = new GarageDB(name);
    const initial = await loadGarage(first);
    expect(initial.history).toHaveLength(0);
    expect(initial.fuel).toHaveLength(0);
    const next = seed();
    next.settings.onboardingDone = true;
    next.vehicle.specs.Interior = "Black";
    next.readings = [
      {
        id: "x",
        date: "2024-01-01",
        meters: 51499008,
        original: 32000,
        unit: "mi",
        reason: "Confirmed",
      },
    ];
    await saveGarage(next, first);
    first.close();
    const reopened = new GarageDB(name);
    const loaded = await loadGarage(reopened);
    expect(loaded).toEqual(next);
    await reopened.delete();
  });
});
