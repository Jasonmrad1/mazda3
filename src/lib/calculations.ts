import type {
  GarageData,
  Unit,
  Reading,
  Fuel,
  CareTask,
  History,
} from "./types";
export const MILE = 1609.344;
export const toMeters = (value: number, unit: Unit) =>
  Math.round(value * (unit === "mi" ? MILE : 1000));
export const fromMeters = (meters: number, unit: Unit) =>
  meters / (unit === "mi" ? MILE : 1000);
export const formatDistance = (
  meters: number | null,
  unit: Unit,
  decimals = 0,
) =>
  meters === null
    ? "—"
    : `${fromMeters(meters, unit).toLocaleString("en-US", { maximumFractionDigits: decimals })} ${unit}`;
export const today = () => new Date().toLocaleDateString("en-CA");
export const dateInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const localDate = (s: string) =>
  new Date(s.length === 10 ? s + "T12:00:00" : s);
export const fmtDate = (s: string | Date | null | undefined) =>
  !s
    ? "Not recorded"
    : (typeof s === "string" ? localDate(s) : s).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
export const money = (value: number, currency: string = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "LBP" ? 0 : 2,
  }).format(value);
export function latestReading(d: GarageData): Reading | undefined {
  return [...d.readings].sort(
    (a, b) => b.date.localeCompare(a.date) || b.meters - a.meters,
  )[0];
}
export const confirmedMeters = (d: GarageData) =>
  latestReading(d)?.meters ?? null;
export const displayMeters = (d: GarageData) =>
  confirmedMeters(d) ?? d.vehicle.initialMeters;
export function validateReading(readings: Reading[], candidate: Reading): void {
  if (!Number.isSafeInteger(candidate.meters) || candidate.meters < 0)
    throw Error("Enter a valid, non-negative odometer.");
  if (
    !Number.isFinite(localDate(candidate.date).getTime()) ||
    candidate.date.slice(0, 10) > dateInput(new Date())
  )
    throw Error("Choose a valid date that is not in the future.");
  for (const r of readings.filter((r) => r.id !== candidate.id)) {
    if (
      r.date.slice(0, 10) < candidate.date.slice(0, 10) &&
      r.meters > candidate.meters
    )
      throw Error(
        "This odometer is lower than an earlier reading. Correct that record first.",
      );
    if (
      r.date.slice(0, 10) > candidate.date.slice(0, 10) &&
      r.meters < candidate.meters
    )
      throw Error(
        "This odometer exceeds a later reading. Check the date and units.",
      );
  }
}
export function addMonths(date: Date, months: number): Date {
  const day = date.getDate();
  const target = new Date(date);
  target.setDate(1);
  target.setMonth(target.getMonth() + months);
  const last = new Date(
    target.getFullYear(),
    target.getMonth() + 1,
    0,
  ).getDate();
  target.setDate(Math.min(day, last));
  return target;
}
export type CareState =
  "overdue" | "soon" | "unknown" | "current" | "unscheduled";
export interface Deadline {
  task: CareTask;
  last?: History;
  date: Date | null;
  meters: number | null;
  remainingMeters: number | null;
  days: number | null;
  state: CareState;
}
export function deadline(
  task: CareTask,
  data: GarageData,
  now = new Date(),
): Deadline {
  const last = [...data.history]
    .filter((e) => e.taskId === task.id && e.vehicleId === data.vehicle.id)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || (b.meters ?? 0) - (a.meters ?? 0),
    )[0];
  const result: Deadline = {
    task,
    last,
    date: null,
    meters: null,
    remainingMeters: null,
    days: null,
    state: "unknown",
  };
  if (!task.miles && !task.months && !task.days)
    return { ...result, state: "unscheduled" };
  if (!last) return result;
  result.date = task.months
    ? addMonths(localDate(last.date), task.months)
    : task.days
      ? new Date(localDate(last.date).getTime() + task.days * 86400000)
      : null;
  result.meters =
    task.miles && last.meters !== null
      ? last.meters + toMeters(task.miles, "mi")
      : null;
  const current = confirmedMeters(data);
  result.remainingMeters =
    current !== null && result.meters !== null ? result.meters - current : null;
  result.days = result.date
    ? Math.ceil((result.date.getTime() - now.getTime()) / 86400000)
    : null;
  result.state =
    (result.date && result.date <= now) ||
    (result.remainingMeters !== null && result.remainingMeters <= 0)
      ? "overdue"
      : (result.days !== null && result.days <= 30) ||
          (result.remainingMeters !== null &&
            result.remainingMeters <= toMeters(500, "mi"))
        ? "soon"
        : "current";
  if (
    result.state === "current" &&
    task.miles &&
    result.remainingMeters === null
  )
    result.state = "unknown";
  return result;
}
export interface FuelMeasurement {
  from: Fuel;
  to: Fuel;
  liters: number;
  km: number;
  l100: number;
  mpg: number;
  km20: number;
  cost: number | null;
}
export function fuelMeasurements(entries: Fuel[]): FuelMeasurement[] {
  const sorted = [...entries].sort(
    (a, b) => a.date.localeCompare(b.date) || a.meters - b.meters,
  );
  const result: FuelMeasurement[] = [];
  let anchor: Fuel | undefined,
    liters = 0,
    cost = 0,
    complete = true;
  for (const e of sorted) {
    if (anchor) {
      liters += e.liters;
      if (e.cost === null || e.currency !== anchor.currency) complete = false;
      else cost += e.cost;
      if (e.full) {
        const km = (e.meters - anchor.meters) / 1000;
        if (km > 0 && liters > 0) {
          const l100 = (liters / km) * 100;
          result.push({
            from: anchor,
            to: e,
            liters,
            km,
            l100,
            mpg: 235.214583 / l100,
            km20: (km / liters) * 20,
            cost: complete ? cost : null,
          });
        }
      }
    }
    if (e.full) {
      anchor = e;
      liters = 0;
      cost = 0;
      complete = true;
    }
  }
  return result;
}
export function weightedConsumption(values: FuelMeasurement[]): number | null {
  if (!values.length) return null;
  return (
    (values.reduce((s, e) => s + e.liters, 0) /
      values.reduce((s, e) => s + e.km, 0)) *
    100
  );
}
export const pressureTo = (psi: number, unit: string) =>
  unit === "bar" ? psi * 0.0689475729 : unit === "kPa" ? psi * 6.89475729 : psi;
export const pressureFrom = (value: number, unit: string) =>
  unit === "bar"
    ? value / 0.0689475729
    : unit === "kPa"
      ? value / 6.89475729
      : value;
export function observedMonthlyDistance(
  data: GarageData,
  now = new Date(),
): number | null {
  const month = dateInput(now).slice(0, 7);
  const readings = data.readings
    .filter((r) => r.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date) || a.meters - b.meters);
  return readings.length < 2
    ? null
    : readings[readings.length - 1].meters - readings[0].meters;
}
export function checkBackup(value: unknown): GarageData {
  const d = value as GarageData;
  if (
    !d ||
    d.schema !== 1 ||
    !d.vehicle ||
    !d.vehicle.specs ||
    !Array.isArray(d.history) ||
    !Array.isArray(d.fuel) ||
    !Array.isArray(d.readings) ||
    !Array.isArray(d.documents) ||
    !Array.isArray(d.customTasks) ||
    !Array.isArray(d.reminders) ||
    !Array.isArray(d.tires) ||
    d.tires.length !== 4 ||
    !d.settings
  )
    throw Error("This is not a supported My Garage backup.");
  if (
    !["mi", "km"].includes(d.vehicle.unit) ||
    !["normal", "severe"].includes(d.vehicle.driving) ||
    !["dark", "light"].includes(d.settings.theme) ||
    !Number.isFinite(d.vehicle.pressure) ||
    d.vehicle.pressure <= 0 ||
    !Number.isInteger(d.vehicle.photoIndex) ||
    d.vehicle.photoIndex < 0 ||
    d.vehicle.photoIndex > 3 ||
    !Object.values(d.vehicle.specs).every((s) => typeof s === "string")
  )
    throw Error("Invalid vehicle settings.");
  const safeData = (s: unknown) =>
    typeof s === "string" &&
    /^data:(application\/pdf|image\/(jpeg|png|webp|gif|avif));base64,[A-Za-z0-9+/=]+$/.test(
      s,
    );
  if (d.vehicle.photo && !safeData(d.vehicle.photo))
    throw Error("Invalid vehicle photo in backup.");
  for (const doc of d.documents)
    if (
      !doc.id ||
      typeof doc.name !== "string" ||
      !safeData(doc.data) ||
      !Array.isArray(doc.pages) ||
      !doc.pages.every((p) => typeof p === "string")
    )
      throw Error("Invalid document in backup.");
  for (const tire of d.tires)
    if (
      typeof tire.position !== "string" ||
      (tire.psi !== null && (!Number.isFinite(tire.psi) || tire.psi <= 0)) ||
      (tire.tread !== null && (!Number.isFinite(tire.tread) || tire.tread < 0))
    )
      throw Error("Invalid tire data in backup.");
  for (const task of d.customTasks)
    if (
      !task.id ||
      typeof task.name !== "string" ||
      task.official ||
      ![task.miles, task.months, task.days].every(
        (v) => v === undefined || (Number.isFinite(v) && v > 0),
      )
    )
      throw Error("Invalid custom maintenance schedule.");
  for (const r of d.readings) validateReading(d.readings, r);
  for (const f of d.fuel)
    if (
      !Number.isFinite(f.liters) ||
      f.liters <= 0 ||
      !Number.isSafeInteger(f.meters) ||
      f.meters < 0 ||
      (f.cost !== null && (!Number.isFinite(f.cost) || f.cost < 0))
    )
      throw Error("Invalid fuel record in backup.");
  for (const h of d.history)
    if (
      !h.id ||
      !h.title ||
      (h.meters !== null &&
        (!Number.isSafeInteger(h.meters) || h.meters < 0)) ||
      !Number.isFinite(localDate(h.date).getTime()) ||
      (h.cost !== null && (!Number.isFinite(h.cost) || h.cost < 0))
    )
      throw Error("Invalid history record in backup.");
  return d;
}
