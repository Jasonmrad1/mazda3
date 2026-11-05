import { describe, it, expect } from "vitest";
import { seed, type Fuel, type History, type Reading } from "./types";
import {
  toMeters,
  fromMeters,
  pressureFrom,
  pressureTo,
  addMonths,
  deadline,
  fuelMeasurements,
  weightedConsumption,
  validateReading,
  checkBackup,
  dateInput,
} from "./calculations";
import { careTasks } from "../data/maintenance";
import { dueAlerts } from "./reminders";
const fuel = (
  meters: number,
  liters: number,
  full: boolean,
  date: string,
  cost: number | null = 40,
): Fuel => ({
  id: date,
  vehicleId: "mazda3-2019",
  date,
  meters,
  original: meters / 1000,
  unit: "km",
  liters,
  cost,
  currency: "USD",
  full,
  terrain: "Mixed",
  sport: false,
  station: "",
  notes: "",
});
const service = (date: string, meters: number | null): History => ({
  id: "service",
  vehicleId: "mazda3-2019",
  title: "Oil",
  category: "Maintenance",
  date,
  meters,
  taskId: "oil",
  cost: null,
  currency: "USD",
  provider: "",
  notes: "",
  attachments: [],
});
const reading = (date: string, meters: number): Reading => ({
  id: date,
  date,
  meters,
  original: meters / 1000,
  unit: "km",
  reason: "",
});
describe("Canonical units", () => {
  it("stores exact miles in integer meters, within half a meter", () => {
    const m = toMeters(32000, "mi");
    expect(m).toBe(51499008);
    expect(fromMeters(m, "mi")).toBeCloseTo(32000, 7);
    expect(toMeters(fromMeters(m, "km"), "km")).toBe(m);
  });
  it("converts pressure without changing the original measurement", () => {
    expect(pressureTo(36, "kPa")).toBeCloseTo(248.211, 3);
    expect(pressureFrom(pressureTo(36, "bar"), "bar")).toBeCloseTo(36, 10);
  });
  it("clamps month-end dates instead of rolling into the next month", () => {
    expect(dateInput(addMonths(new Date(2024, 0, 31, 12), 1))).toBe(
      "2024-02-29",
    );
    expect(dateInput(addMonths(new Date(2025, 0, 31, 12), 1))).toBe(
      "2025-02-28",
    );
  });
});
describe("Maintenance deadlines", () => {
  it("leaves unknown history unknown", () => {
    const d = seed(),
      t = careTasks(d)[0];
    expect(deadline(t, d).state).toBe("unknown");
    expect(d.readings).toHaveLength(0);
  });
  it("uses the time limit even with low mileage", () => {
    const d = seed();
    d.history = [service("2024-01-10", toMeters(30000, "mi"))];
    d.readings = [reading("2025-02-01", toMeters(31000, "mi"))];
    const result = deadline(careTasks(d)[0], d, new Date("2025-02-01"));
    expect(result.state).toBe("overdue");
    expect(result.remainingMeters).toBeGreaterThan(0);
  });
  it("uses the distance limit even before the date limit", () => {
    const d = seed();
    d.history = [service("2025-01-01", toMeters(30000, "mi"))];
    d.readings = [reading("2025-02-01", toMeters(41000, "mi"))];
    const result = deadline(careTasks(d)[0], d, new Date("2025-02-01"));
    expect(result.state).toBe("overdue");
    expect(result.date!.getFullYear()).toBe(2026);
  });
  it("shortens oil only for severe use", () => {
    const d = seed(),
      normal = careTasks(d);
    d.vehicle.driving = "severe";
    const severe = careTasks(d);
    expect(severe[0].miles).toBe(5000);
    expect(severe[0].months).toBe(6);
    expect(normal.find((t) => t.id === "rotation")).toEqual(
      severe.find((t) => t.id === "rotation"),
    );
  });
  it("resets the next deadline from the latest completed service", () => {
    const d = seed();
    d.history = [
      service("2024-01-01", toMeters(30000, "mi")),
      { ...service("2025-01-01", toMeters(40000, "mi")), id: "new" },
    ];
    expect(deadline(careTasks(d)[0], d, new Date("2025-02-01")).meters).toBe(
      toMeters(50000, "mi"),
    );
  });
  it("does not use a navigation manual to generate a service interval", () => {
    const d = seed();
    expect(
      careTasks(d)
        .filter((t) => t.official)
        .every((t) => !t.reference.includes("navigation")),
    ).toBe(true);
  });
});
describe("Full-to-full fuel consumption", () => {
  it("needs two full tank anchors", () => {
    expect(
      fuelMeasurements([
        fuel(0, 40, false, "2024-01-01"),
        fuel(100000, 20, true, "2024-01-02"),
      ]),
    ).toHaveLength(0);
  });
  it("excludes the first anchor liters and includes intervening partial fills", () => {
    const result = fuelMeasurements([
      fuel(0, 50, true, "2024-01-01"),
      fuel(200000, 15, false, "2024-01-02"),
      fuel(500000, 25, true, "2024-01-03"),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].liters).toBe(40);
    expect(result[0].l100).toBe(8);
    expect(result[0].mpg).toBeCloseTo(29.4018, 3);
    expect(result[0].km20).toBe(250);
  });
  it("weights the average by total measured distance", () => {
    const result = fuelMeasurements([
      fuel(0, 40, true, "2024-01-01"),
      fuel(100000, 10, true, "2024-01-02"),
      fuel(1100000, 50, true, "2024-01-03"),
    ]);
    expect(weightedConsumption(result)).toBeCloseTo((60 / 1100) * 100, 6);
    expect(weightedConsumption([])).toBeNull();
  });
  it("leaves cycle cost unknown if any price is missing", () => {
    const m = fuelMeasurements([
      fuel(0, 50, true, "2024-01-01"),
      fuel(200000, 15, false, "2024-01-02", null),
      fuel(500000, 25, true, "2024-01-03"),
    ]);
    expect(m[0].cost).toBeNull();
  });
  it("does not combine currencies into a cycle price", () => {
    const m = fuelMeasurements([
      fuel(0, 50, true, "2024-01-01"),
      { ...fuel(500000, 40, true, "2024-01-03"), currency: "LBP" },
    ]);
    expect(m[0].cost).toBeNull();
  });
  it("never divides by zero", () => {
    expect(
      fuelMeasurements([
        fuel(0, 50, true, "2024-01-01"),
        fuel(0, 40, true, "2024-01-02"),
      ]),
    ).toHaveLength(0);
  });
});
describe("Input integrity and reminders", () => {
  it("rejects contradictory chronological odometers", () => {
    expect(() =>
      validateReading(
        [reading("2024-02-01", 500000)],
        reading("2024-01-01", 600000),
      ),
    ).toThrow();
    expect(() =>
      validateReading(
        [reading("2024-01-01", 600000)],
        reading("2024-02-01", 500000),
      ),
    ).toThrow();
  });
  it("rejects future readings", () => {
    expect(() => validateReading([], reading("2099-01-01", 500000))).toThrow();
  });
  it("accepts a correction replacing the same record", () => {
    const r = reading("2024-01-01", 500000);
    expect(() => validateReading([r], { ...r, meters: 400000 })).not.toThrow();
  });
  it("uses recorded distance for custom reminders", () => {
    const d = seed();
    d.reminders = [
      {
        id: "x",
        taskId: "",
        title: "Inspect",
        date: "",
        meters: toMeters(33000, "mi"),
        status: "active",
        explanation: "",
      },
    ];
    expect(dueAlerts(d).some((a) => a.id === "x")).toBe(false);
    d.readings = [reading("2024-01-01", toMeters(34000, "mi"))];
    expect(dueAlerts(d).some((a) => a.id === "x")).toBe(true);
  });
  it("supports snooze and dismissal without inventing a completion", () => {
    const d = seed();
    d.reminders = [
      {
        id: "x",
        taskId: "pressure",
        title: "Pressure",
        date: "2099-01-01",
        meters: null,
        status: "active",
        explanation: "Postponed",
      },
    ];
    expect(dueAlerts(d).some((a) => a.taskId === "pressure")).toBe(false);
    expect(d.history).toHaveLength(0);
  });
  it("rejects invalid or unsupported backups before restoring", () => {
    expect(() => checkBackup({ schema: 2 })).toThrow();
    const d = seed();
    d.fuel = [fuel(0, -1, true, "2024-01-01")];
    expect(() => checkBackup(d)).toThrow();
    expect(checkBackup(seed()).schema).toBe(1);
  });
});
