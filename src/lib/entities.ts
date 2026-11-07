import { seed, type GarageData } from "./types";

export const entities = {
  vehicles: {
    source: "vehicle",
    fields: {
      specs: "specs",
      unit: "unit",
      driving: "driving",
      initialMeters: "initial_meters",
      photo: "photo",
      photoIndex: "photo_index",
      vin: "vin",
      pressure: "pressure",
      placardVerified: "placard_verified",
    },
  },
  odometer_readings: {
    source: "readings",
    fields: {
      date: "recorded_date",
      meters: "meters",
      original: "original_value",
      unit: "unit",
      reason: "reason",
    },
  },
  service_records: {
    source: "history",
    fields: {
      vehicleId: "vehicle_id",
      title: "title",
      category: "category",
      date: "recorded_date",
      meters: "meters",
      taskId: "task_id",
      cost: "cost",
      currency: "currency",
      provider: "provider",
      notes: "notes",
      attachments: "attachment_ids",
      recurring: "recurring",
    },
  },
  fuel_entries: {
    source: "fuel",
    fields: {
      vehicleId: "vehicle_id",
      date: "recorded_date",
      meters: "meters",
      original: "original_value",
      unit: "unit",
      liters: "liters",
      cost: "cost",
      currency: "currency",
      full: "full_tank",
      terrain: "terrain",
      sport: "sport",
      station: "station",
      notes: "notes",
    },
  },
  tires: {
    source: "tires",
    fields: {
      position: "position",
      psi: "psi",
      checked: "checked_at",
      tread: "tread_mm",
      manufactured: "manufactured",
      brand: "brand",
      model: "model",
      size: "size",
      condition: "condition",
      notes: "notes",
    },
  },
  documents: {
    source: "documents",
    fields: {
      name: "name",
      data: "file_ref",
      kind: "kind",
      pages: "page_text",
      added: "added_at",
    },
  },
  reminders: {
    source: "reminders",
    fields: {
      taskId: "task_id",
      title: "title",
      date: "due_date",
      meters: "due_meters",
      status: "status",
      explanation: "explanation",
    },
  },
  custom_tasks: {
    source: "customTasks",
    fields: {
      name: "name",
      category: "category",
      miles: "interval_miles",
      months: "interval_months",
      days: "interval_days",
      official: "official",
      reason: "reason",
      reference: "reference",
    },
  },
  user_settings: {
    source: "settings",
    fields: {
      theme: "theme",
      onboardingDone: "onboarding_done",
      notifications: "notifications",
      estimatedMonthlyKm: "estimated_monthly_km",
      assistantEndpoint: "assistant_endpoint",
    },
  },
} as const;
export type Entity = keyof typeof entities;
export const entityNames = Object.keys(entities) as Entity[];
export type Payload = Record<string, unknown>;
export function toRows(data: GarageData) {
  const result: { entity: Entity; id: string; payload: Payload }[] = [];
  for (const entity of entityNames) {
    const spec = entities[entity];
    const value = data[spec.source];
    const items = Array.isArray(value) ? value : [value];
    for (const item of items) {
      const row = item as unknown as Payload;
      const id = String(
        row.id ?? (entity === "tires" ? row.position : "preferences"),
      );
      const payload: Payload = { id };
      if (entity !== "vehicles" && entity !== "user_settings")
        payload.vehicle_id = data.vehicle.id;
      for (const [local, remote] of Object.entries(spec.fields))
        payload[remote] =
          row[local] === "" &&
          ["due_date", "manufactured", "checked_at"].includes(remote)
            ? null
            : (row[local] ?? null);
      for (const field of ["checked_at", "added_at"])
        if (typeof payload[field] === "string")
          payload[field] = new Date(payload[field] as string).toISOString();
      result.push({ entity, id, payload });
    }
  }
  return result;
}
export function fromRows(
  rows: { entity: Entity; payload: Payload; deleted: boolean }[],
): GarageData {
  const data = seed();
  data.readings = [];
  data.history = [];
  data.fuel = [];
  data.documents = [];
  data.reminders = [];
  data.customTasks = [];
  const tireRows = rows.filter((r) => r.entity === "tires");
  if (tireRows.length) data.tires = [];
  for (const row of rows) {
    if (row.deleted) continue;
    const spec = entities[row.entity];
    const value: Payload = {};
    if (!["tires", "user_settings"].includes(row.entity))
      value.id = row.payload.id;
    for (const [local, remote] of Object.entries(spec.fields))
      if (row.payload[remote] !== undefined && row.payload[remote] !== null)
        value[local] = row.payload[remote];
    // Nullable values are meaningful (unknown pressure, cost or mileage).
    for (const [local, remote] of Object.entries(spec.fields))
      if (row.payload[remote] === null) value[local] = null;
    for (const key of ["miles", "months", "days", "recurring"])
      if (value[key] === null) delete value[key];
    if (row.entity === "reminders" && value.date === null) value.date = "";
    if (row.entity === "tires" && value.manufactured === null)
      value.manufactured = "";
    const target = data[spec.source];
    if (Array.isArray(target)) target.push(value as never);
    else Object.assign(target, value);
  }
  return data;
}
