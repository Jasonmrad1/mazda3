import Dexie, { type Table } from "dexie";
import { toRows, fromRows, type Entity, type Payload } from "./entities";
import { seed, type GarageData } from "./types";

export interface LocalRecord {
  key: string;
  owner: string;
  entity: Entity;
  id: string;
  payload: Payload;
  pending: boolean;
  deleted: boolean;
  revision: number;
  mutationId: string;
  conflict?: Payload;
  error?: string;
  sentMutationId?: string;
}
export const recordKey = (owner: string, entity: Entity, id: string) =>
  JSON.stringify([owner, entity, id]);
export class GarageDB extends Dexie {
  snapshots!: Table<{ id: string; data: GarageData }, string>;
  records!: Table<LocalRecord, string>;
  meta!: Table<{ id: string; value: string }, string>;
  constructor(name = "my-garage-v1") {
    super(name);
    this.version(1).stores({ snapshots: "id" });
    this.version(2)
      .stores({
        snapshots: "id",
        records: "key,owner,[owner+entity]",
        meta: "id",
      })
      .upgrade(async (tx) => {
        const old = await tx.table("snapshots").get("garage");
        if (old)
          for (const row of toRows(old.data))
            await tx.table("records").put({
              ...row,
              key: recordKey("local", row.entity, row.id),
              owner: "local",
              pending: true,
              deleted: false,
              revision: 0,
              mutationId: crypto.randomUUID(),
            });
      });
  }
}
export const db = new GarageDB();
export async function activeOwner(database = db) {
  return (await database.meta.get("activeOwner"))?.value ?? "local";
}
export async function loadGarage(database = db) {
  const owner = await activeOwner(database);
  const rows = await database.records.where("owner").equals(owner).toArray();
  return rows.length ? fromRows(rows) : seed();
}
export async function saveGarage(data: GarageData, database = db) {
  await database.transaction(
    "rw",
    database.records,
    database.meta,
    async () => {
      const owner = await activeOwner(database);
      const current = await database.records
        .where("owner")
        .equals(owner)
        .toArray();
      const incoming = toRows(data);
      const keys = new Set(
        incoming.map((r) => recordKey(owner, r.entity, r.id)),
      );
      for (const row of incoming) {
        const key = recordKey(owner, row.entity, row.id);
        const old = current.find((r) => r.key === key);
        if (
          old &&
          !old.deleted &&
          JSON.stringify(old.payload) === JSON.stringify(row.payload)
        )
          continue;
        await database.records.put({
          ...old,
          ...row,
          key,
          owner,
          pending: true,
          deleted: false,
          revision: old?.revision ?? 0,
          mutationId: crypto.randomUUID(),
          error: undefined,
        });
      }
      for (const old of current)
        if (!keys.has(old.key) && !old.deleted)
          await database.records.put({
            ...old,
            deleted: true,
            pending: true,
            mutationId: crypto.randomUUID(),
            error: undefined,
          });
    },
  );
}
export async function switchOwner(owner: string, database = db) {
  await database.transaction(
    "rw",
    database.meta,
    database.records,
    async () => {
      if (owner !== "local") {
        const target = await database.records
          .where("owner")
          .equals(owner)
          .count();
        if (!target) {
          const local = await database.records
            .where("owner")
            .equals("local")
            .toArray();
          for (const row of local) {
            await database.records.put({
              ...row,
              owner,
              key: recordKey(owner, row.entity, row.id),
            });
            await database.records.delete(row.key);
          }
        }
      }
      await database.meta.put({ id: "activeOwner", value: owner });
    },
  );
}
