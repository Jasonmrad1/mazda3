import "fake-indexeddb/auto";
import { describe, it, expect, afterEach } from "vitest";
import { GarageDB, saveGarage, loadGarage, switchOwner } from "./database";
import { seed } from "./types";
import {
  syncRecords,
  acknowledge,
  acceptRemote,
  type RemoteRecord,
  type SyncTransport,
} from "./recordSync";
import { entityNames, type Entity } from "./entities";
const databases: GarageDB[] = [];
const create = () => {
  const db = new GarageDB("queue-test-" + crypto.randomUUID());
  databases.push(db);
  return db;
};
afterEach(async () => {
  for (const db of databases.splice(0)) await db.delete();
});
function transport(): SyncTransport & {
  server: Map<string, RemoteRecord>;
  fail: boolean;
} {
  const server = new Map<string, RemoteRecord>();
  return {
    server,
    fail: false,
    async list(entity) {
      return [...server]
        .filter(([key]) => key.startsWith(entity + ":"))
        .map(([, row]) => row);
    },
    async hydrate(_entity, payload) {
      return payload;
    },
    async write(row) {
      if (this.fail) throw Error("Network interrupted");
      const key = row.entity + ":" + row.id,
        old = server.get(key);
      if (old?.mutation_id === row.mutationId) return old;
      if ((old?.revision ?? 0) !== row.revision) throw Error("Conflict");
      const saved = {
        ...row.payload,
        id: row.id,
        deleted: row.deleted,
        revision: row.revision + 1,
        mutation_id: row.mutationId,
      };
      server.set(key, saved);
      return saved;
    },
  };
}
describe("durable row sync", () => {
  it("flags only changed rows and persists pending flags after reopening", async () => {
    const db = create();
    await saveGarage(seed(), db);
    await switchOwner("alice", db);
    const api = transport();
    await syncRecords("alice", db, api);
    const data = await loadGarage(db);
    data.settings.theme = "light";
    await saveGarage(data, db);
    const pending = (await db.records.toArray()).filter((r) => r.pending);
    expect(pending.map((r) => r.entity)).toEqual(["user_settings"]);
    db.close();
    await db.open();
    expect((await db.records.get(pending[0].key))?.pending).toBe(true);
  });
  it("retains failed records and drains them on a later retry", async () => {
    const db = create();
    await saveGarage(seed(), db);
    await switchOwner("alice", db);
    const api = transport();
    api.fail = true;
    await expect(syncRecords("alice", db, api)).rejects.toThrow(
      "Network interrupted",
    );
    expect((await db.records.toArray()).every((r) => r.pending)).toBe(true);
    api.fail = false;
    await syncRecords("alice", db, api);
    expect((await db.records.toArray()).some((r) => r.pending)).toBe(false);
  });
  it("keeps a newer local edit pending when an older upload is acknowledged", async () => {
    const db = create();
    await saveGarage(seed(), db);
    const sent = (await db.records.toArray()).find(
      (r) => r.entity === "vehicles",
    )!;
    const next = await loadGarage(db);
    next.vehicle.vin = "NEW";
    await saveGarage(next, db);
    await acknowledge(
      sent,
      {
        ...sent.payload,
        id: sent.id,
        revision: 1,
        mutation_id: sent.mutationId,
        deleted: false,
      },
      db,
    );
    const current = await db.records.get(sent.key);
    expect(current?.pending).toBe(true);
    expect(current?.payload.vin).toBe("NEW");
    expect(current?.revision).toBe(1);
  });
  it("syncs deletion tombstones without resurrecting a deleted fuel entry", async () => {
    const db = create(),
      data = seed();
    data.fuel.push({
      id: "fill",
      vehicleId: data.vehicle.id,
      date: "2026-11-01",
      meters: 50000,
      original: 50,
      unit: "km",
      liters: 25,
      cost: 20,
      currency: "USD",
      full: true,
      terrain: "City",
      sport: false,
      station: "",
      notes: "",
    });
    await saveGarage(data, db);
    await switchOwner("alice", db);
    const api = transport();
    await syncRecords("alice", db, api);
    data.fuel = [];
    await saveGarage(data, db);
    expect(
      (await db.records.toArray()).find((r) => r.entity === "fuel_entries")
        ?.deleted,
    ).toBe(true);
    await syncRecords("alice", db, api);
    await syncRecords("alice", db, api);
    expect((await loadGarage(db)).fuel).toHaveLength(0);
    expect(api.server.get("fuel_entries:fill")?.deleted).toBe(true);
  });
  it("isolates accounts and preserves unsynced records when signing out", async () => {
    const db = create();
    await saveGarage(seed(), db);
    await switchOwner("alice", db);
    const d = await loadGarage(db);
    d.vehicle.vin = "ALICE";
    await saveGarage(d, db);
    await switchOwner("local", db);
    expect((await loadGarage(db)).vehicle.vin).toBe("");
    await switchOwner("bob", db);
    expect((await loadGarage(db)).vehicle.vin).toBe("");
    await switchOwner("alice", db);
    expect((await loadGarage(db)).vehicle.vin).toBe("ALICE");
  });
  it("preserves local values and records per-row conflicts", async () => {
    const db = create();
    await saveGarage(seed(), db);
    const local = (await db.records.toArray()).find(
      (r) => r.entity === "vehicles",
    )!;
    await acceptRemote(
      "local",
      "vehicles",
      {
        ...local.payload,
        id: local.id,
        vin: "REMOTE",
        revision: 2,
        mutation_id: crypto.randomUUID(),
        deleted: false,
      },
      db,
      transport(),
    );
    const row = await db.records.get(local.key);
    expect(row?.payload.vin).toBe("");
    expect(row?.conflict?.vin).toBe("REMOTE");
    expect(row?.pending).toBe(true);
  });
  it("recovers a lost response without conflicting with a newer queued edit", async () => {
    const db = create();
    await saveGarage(seed(), db);
    const sent = (await db.records.toArray()).find(
      (r) => r.entity === "vehicles",
    )!;
    await db.records.update(sent.key, { sentMutationId: sent.mutationId });
    const data = await loadGarage(db);
    data.vehicle.vin = "LATEST";
    await saveGarage(data, db);
    await acceptRemote(
      "local",
      "vehicles",
      {
        ...sent.payload,
        id: sent.id,
        revision: 1,
        mutation_id: sent.mutationId,
        deleted: false,
      },
      db,
      transport(),
    );
    const latest = await db.records.get(sent.key);
    expect(latest?.conflict).toBeUndefined();
    expect(latest?.pending).toBe(true);
    expect(latest?.revision).toBe(1);
    expect(latest?.payload.vin).toBe("LATEST");
  });
  it("upgrades the legacy local backup into pending individual records", async () => {
    const db = create();
    await db.delete();
    const { default: Dexie } = await import("dexie");
    const legacy = new Dexie(db.name);
    legacy.version(1).stores({ snapshots: "id" });
    const original = seed();
    original.vehicle.vin = "LEGACY";
    await legacy.table("snapshots").put({ id: "garage", data: original });
    legacy.close();
    await db.open();
    expect((await loadGarage(db)).vehicle.vin).toBe("LEGACY");
    expect((await db.records.toArray()).every((r) => r.pending)).toBe(true);
    expect(db.tables.some((table) => table.name === "snapshots")).toBe(false);
  });
});
