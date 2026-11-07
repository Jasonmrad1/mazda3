import {
  db,
  activeOwner,
  recordKey,
  type GarageDB,
  type LocalRecord,
} from "./database";
import { entities, entityNames, type Entity, type Payload } from "./entities";
import { supabase, url, key } from "./supabase";
import { createClient } from "@supabase/supabase-js";
import { storeDataUrl, restoreDataUrl } from "./cloudFiles";

export const stable = (value: unknown): string => {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ":" + stable(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value) ?? "null";
};
export type RemoteRecord = Payload & {
  id: string;
  revision: number;
  mutation_id: string;
  deleted: boolean;
};
export interface SyncTransport {
  list(entity: Entity, owner: string): Promise<RemoteRecord[]>;
  write(row: LocalRecord): Promise<RemoteRecord>;
  hydrate(entity: Entity, payload: Payload): Promise<Payload>;
}
async function accountClient(owner: string) {
  if (!supabase || !url || !key) throw Error("Cloud sync is not configured.");
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session || session.user.id !== owner)
    throw Error("Sign in to the account that owns these pending records.");
  // Bind each request to this session so switching accounts during an upload
  // cannot send another account's cached records under the new session.
  const token = session.access_token;
  return createClient(url, key, { accessToken: async () => token });
}
function cleanPayload(entity: Entity, remote: Payload): Payload {
  const result: Payload = { id: remote.id };
  for (const field of Object.values(entities[entity].fields))
    if (remote[field] !== undefined) result[field] = remote[field];
  if (entity !== "vehicles" && entity !== "user_settings")
    result.vehicle_id = remote.vehicle_id;
  for (const field of ["checked_at", "added_at"])
    if (typeof result[field] === "string")
      result[field] = new Date(result[field] as string).toISOString();
  return result;
}
export const cloudTransport: SyncTransport = {
  async list(entity, owner) {
    const client = await accountClient(owner);
    const rows: RemoteRecord[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client
        .from(entity)
        .select("*")
        .eq("user_id", owner)
        .order("id")
        .range(offset, offset + 499);
      if (error) {
        if (["PGRST205", "42P01"].includes(error.code))
          throw Error(
            "Database update required: run 202611070002_relational_sync.sql in Supabase SQL Editor. Pending records remain saved on this device.",
          );
        throw error;
      }
      rows.push(...(data as RemoteRecord[]));
      if (data.length < 500) return rows;
    }
  },
  async write(row) {
    const client = await accountClient(row.owner);
    const payload = { ...row.payload };
    if (!row.deleted) {
      if (row.entity === "vehicles")
        payload.photo = await storeDataUrl(
          String(payload.photo ?? ""),
          row.owner,
          "vehicle",
        );
      if (row.entity === "documents")
        payload.file_ref = await storeDataUrl(
          String(payload.file_ref ?? ""),
          row.owner,
          `documents/${row.id}`,
        );
    }
    const { data, error } = await client.rpc("sync_garage_record", {
      p_table: row.entity,
      p_record: { ...payload, deleted: row.deleted },
      p_expected_revision: row.revision,
      p_mutation_id: row.mutationId,
    });
    if (error) throw error;
    if (!data?.revision) throw Error("Server did not acknowledge the record.");
    return data as RemoteRecord;
  },
  async hydrate(entity, payload) {
    const copy = { ...payload };
    if (entity === "vehicles")
      copy.photo = await restoreDataUrl(String(copy.photo ?? ""));
    if (entity === "documents")
      copy.file_ref = await restoreDataUrl(String(copy.file_ref ?? ""));
    return copy;
  },
};
export async function acceptRemote(
  owner: string,
  entity: Entity,
  remote: RemoteRecord,
  database = db,
  transport = cloudTransport,
) {
  const payload = remote.deleted
    ? cleanPayload(entity, remote)
    : await transport.hydrate(entity, cleanPayload(entity, remote));
  const key = recordKey(owner, entity, remote.id);
  await database.transaction("rw", database.records, async () => {
    const local = await database.records.get(key);
    if (local?.pending) {
      if (
        local.sentMutationId === remote.mutation_id &&
        local.mutationId !== remote.mutation_id
      ) {
        await database.records.put({
          ...local,
          revision: Number(remote.revision),
          sentMutationId: undefined,
          conflict: undefined,
          error: undefined,
        });
        return;
      }
      if (
        local.mutationId === remote.mutation_id ||
        (local.revision === 0 &&
          local.deleted === remote.deleted &&
          stable(local.payload) === stable(payload))
      ) {
        await database.records.put({
          ...local,
          pending: false,
          revision: Number(remote.revision),
          sentMutationId: undefined,
          conflict: undefined,
          error: undefined,
        });
      } else if (Number(remote.revision) > local.revision) {
        await database.records.put({
          ...local,
          conflict: { ...remote, ...payload },
          error: "This record changed on another device.",
        });
      }
      return;
    }
    await database.records.put({
      key,
      owner,
      entity,
      id: remote.id,
      payload,
      pending: false,
      deleted: remote.deleted,
      revision: Number(remote.revision),
      mutationId: remote.mutation_id,
    });
  });
}
export async function acknowledge(
  sent: LocalRecord,
  remote: RemoteRecord,
  database = db,
) {
  await database.transaction("rw", database.records, async () => {
    const current = await database.records.get(sent.key);
    if (!current) return;
    if (current.mutationId === sent.mutationId)
      await database.records.put({
        ...current,
        pending: false,
        revision: Number(remote.revision),
        sentMutationId: undefined,
        conflict: undefined,
        error: undefined,
      });
    else if (current.revision === sent.revision)
      await database.records.put({
        ...current,
        revision: Number(remote.revision),
        sentMutationId: undefined,
      });
  });
}
export async function syncRecords(
  owner: string,
  database: GarageDB = db,
  transport: SyncTransport = cloudTransport,
) {
  const assertOwner = async () => {
    if ((await activeOwner(database)) !== owner)
      throw Error("Account changed; sync stopped.");
  };
  await assertOwner();
  for (const entity of entityNames) {
    const remote = await transport.list(entity, owner);
    await assertOwner();
    for (const record of remote)
      await acceptRemote(owner, entity, record, database, transport);
  }
  const errors: string[] = [];
  for (const entity of entityNames) {
    const pending = (
      await database.records
        .where("[owner+entity]")
        .equals([owner, entity])
        .toArray()
    ).filter((r) => r.pending && !r.conflict);
    for (const row of pending) {
      await assertOwner();
      try {
        await database.records.update(row.key, {
          sentMutationId: row.mutationId,
        });
        await acknowledge(row, await transport.write(row), database);
      } catch (e) {
        const message =
          e && typeof e === "object" && "message" in e
            ? String(e.message)
            : "Could not sync record.";
        const current = await database.records.get(row.key);
        if (current?.mutationId === row.mutationId)
          await database.records.update(row.key, { error: message });
        errors.push(message);
      }
    }
  }
  if (errors.length) throw Error(errors[0]);
}
export async function resolveConflicts(
  owner: string,
  choice: "local" | "remote",
  database = db,
) {
  await database.transaction("rw", database.records, async () => {
    const rows = await database.records.where("owner").equals(owner).toArray();
    for (const row of rows)
      if (row.conflict) {
        const remote = row.conflict as RemoteRecord;
        await database.records.put(
          choice === "local"
            ? {
                ...row,
                revision: Number(remote.revision),
                mutationId: crypto.randomUUID(),
                conflict: undefined,
                error: undefined,
                pending: true,
              }
            : {
                ...row,
                payload: cleanPayload(row.entity, remote),
                deleted: remote.deleted,
                revision: Number(remote.revision),
                mutationId: remote.mutation_id,
                conflict: undefined,
                error: undefined,
                pending: false,
              },
        );
      }
  });
}
