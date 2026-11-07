import Dexie, { type Table } from "dexie";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { seed, type GarageData } from "./types";
import { checkBackup } from "./calculations";
import { sendBrowserAlerts } from "./reminders";
import { supabase, type CloudSnapshot } from "./supabase";
import { prepareCloudData, restoreCloudFiles } from "./cloudFiles";
export class GarageDB extends Dexie {
  snapshots!: Table<{ id: string; data: GarageData }, string>;
  constructor(name = "my-garage-v1") {
    super(name);
    this.version(1).stores({ snapshots: "id" });
  }
}
export const db = new GarageDB();
export async function loadGarage(database = db) {
  return (await database.snapshots.get("garage"))?.data ?? seed();
}
export async function saveGarage(data: GarageData, database = db) {
  await database.snapshots.put({ id: "garage", data });
}
type Store = {
  data: GarageData;
  update: (fn: (d: GarageData) => void) => Promise<void>;
  replace: (value: unknown) => Promise<void>;
  toast: (message: string) => void;
  reset: () => Promise<void>;
  cloudStatus: "disabled" | "signed_out" | "offline" | "syncing" | "synced" | "conflict" | "error";
  cloudEmail: string;
  cloudError: string;
  signIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
  useCloudCopy: () => Promise<void>;
  uploadDeviceCopy: () => Promise<void>;
};
const Context = createContext<Store | null>(null);
let queue = Promise.resolve();
export function GarageProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<GarageData | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [cloudStatus, setCloudStatus] = useState<Store["cloudStatus"]>(supabase ? "signed_out" : "disabled"),
    [cloudEmail, setCloudEmail] = useState(""),
    [cloudError, setCloudError] = useState(""),
    [userId, setUserId] = useState<string | null>(null),
    [conflict, setConflict] = useState<CloudSnapshot | null>(null);
  const cloudRevision = useRef(0), cloudReady = useRef(false), cloudWrite = useRef(Promise.resolve());
  useEffect(() => {
    loadGarage()
      .then(setData)
      .catch(() =>
        setError(
          "Your local garage could not be opened. Check browser storage access, then retry. Existing records have not been removed.",
        ),
      );
  }, []);
  const pushCloud = (value: GarageData, expectedRevision: number | null, id: string) => {
    const operation = cloudWrite.current.then(async () => {
      if (!supabase || !navigator.onLine) throw Error("Cloud sync is unavailable offline.");
      const cloudData = await prepareCloudData(value, id);
      const { data: result, error: saveError } = await supabase.rpc("save_garage_snapshot", {
        p_expected_revision: expectedRevision ?? cloudRevision.current,
        p_schema_version: value.schema,
        p_data: cloudData,
      });
      if (saveError) {
        if (saveError.code === "40001") {
          const { data: latest } = await supabase
            .from("garage_snapshots")
            .select("data, revision, updated_at")
            .eq("user_id", id)
            .maybeSingle();
          if (latest) {
            setConflict(latest as CloudSnapshot);
            setCloudStatus("conflict");
            setCloudError("A newer cloud copy was saved on another device.");
          }
        }
        throw saveError;
      }
      const saved = Array.isArray(result) ? result[0] : result;
      if (!saved?.revision) throw Error("Supabase did not confirm the saved garage.");
      cloudRevision.current = Number(saved.revision);
    });
    cloudWrite.current = operation.catch(() => {});
    return operation;
  };
  const connectCloudUser = async (id: string, email: string) => {
    if (!supabase) return;
    setUserId(id);
    setCloudEmail(email);
    setCloudError("");
    if (!navigator.onLine) { setCloudStatus("offline"); return; }
    try {
      await queue;
      const localRow = await db.snapshots.get("garage");
      const localData = localRow?.data ?? seed();
      const { data: remote, error: readError } = await supabase
        .from("garage_snapshots")
        .select("data, revision, updated_at")
        .eq("user_id", id)
        .maybeSingle();
      if (readError) throw readError;
      if (remote) {
        cloudRevision.current = Number(remote.revision);
        const restored = await restoreCloudFiles(checkBackup(remote.data));
        if (!localRow) {
          await saveGarage(restored);
          setData(restored);
          cloudReady.current = true;
          setCloudStatus("synced");
        } else if (JSON.stringify(localData) === JSON.stringify(restored)) {
          cloudReady.current = true;
          setCloudStatus("synced");
        } else {
          cloudReady.current = false;
          setConflict(remote as CloudSnapshot);
          setCloudStatus("conflict");
        }
      } else {
        cloudRevision.current = 0;
        await pushCloud(localData, 0, id);
        cloudReady.current = true;
        setCloudStatus("synced");
      }
    } catch (e) {
      cloudReady.current = false;
      setCloudError(e instanceof Error ? e.message : "Cloud sync failed.");
      setCloudStatus("error");
    }
  };
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const applySession = (session: { user: { id: string; email?: string } } | null) => {
      if (!active) return;
      if (session) void connectCloudUser(session.user.id, session.user.email ?? "");
      else {
        cloudReady.current = false;
        setUserId(null);
        setCloudEmail("");
        setCloudStatus("signed_out");
      }
    };
    void supabase.auth.getSession().then(({ data: auth }) => applySession(auth.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => applySession(session));
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!data || !userId || !cloudReady.current || conflict || !supabase) return;
    const timer = setTimeout(() => {
      if (!navigator.onLine) { setCloudStatus("offline"); return; }
      setCloudStatus("syncing");
      void pushCloud(data, null, userId)
        .then(() => { setCloudError(""); setCloudStatus("synced"); })
        .catch((e: unknown) => {
          const conflictError = typeof e === "object" && e !== null && "code" in e && e.code === "40001";
          setCloudError(conflictError ? "A newer cloud copy was saved on another device." : e instanceof Error ? e.message : "Cloud sync failed.");
          setCloudStatus(conflictError ? "conflict" : "error");
        });
    }, 1200);
    return () => clearTimeout(timer);
  }, [data, userId, conflict]);
  useEffect(() => {
    if (!data) return;
    document.documentElement.dataset.theme = data.settings.theme;
    sendBrowserAlerts(data).catch(() => {});
  }, [data]);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 4000);
    return () => clearTimeout(t);
  }, [message]);
  useEffect(() => {
    if (!supabase) return;
    const retryWhenOnline = () => {
      if (!data || !userId || conflict) return;
      if (!cloudReady.current) { void connectCloudUser(userId, cloudEmail); return; }
      setCloudStatus("syncing");
      void pushCloud(data, null, userId)
        .then(() => { setCloudError(""); setCloudStatus("synced"); })
        .catch((e: unknown) => {
          const conflictError = typeof e === "object" && e !== null && "code" in e && e.code === "40001";
          setCloudError(conflictError ? "A newer cloud copy was saved on another device." : e instanceof Error ? e.message : "Cloud sync failed.");
          setCloudStatus(conflictError ? "conflict" : "error");
        });
    };
    window.addEventListener("online", retryWhenOnline);
    return () => window.removeEventListener("online", retryWhenOnline);
  }, [data, userId, cloudEmail, conflict]);
  useEffect(() => {
    const onFocus = () => {
      loadGarage()
        .then((d) => {
          setData(d);
          sendBrowserAlerts(d).catch(() => {});
        })
        .catch(() => {});
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);
  if (error)
    return (
      <div className="loading-screen">
        <h1>Let’s reopen your garage.</h1>
        <p>{error}</p>
        <button onClick={() => location.reload()}>Retry</button>
      </div>
    );
  if (!data)
    return (
      <div className="loading-screen">
        <div className="garage-mark">
          M<span>G</span>
        </div>
        <p>Opening your garage…</p>
      </div>
    );
  const update = (fn: (d: GarageData) => void) => {
    const job = queue.then(async () => {
      const next = await db.transaction("rw", db.snapshots, async () => {
        const draft = structuredClone(await loadGarage());
        fn(draft);
        await saveGarage(draft);
        return draft;
      });
      setData(next);
    });
    queue = job.catch((e) => {
      setMessage(
        e instanceof Error
          ? e.message
          : "Could not save. Check available device storage and retry.",
      );
    });
    return job;
  };
  const replace = async (value: unknown) => {
    const next = checkBackup(value);
    await queue;
    await saveGarage(next);
    setData(next);
  };
  const reset = async () => {
    await queue;
    await db.snapshots.clear();
    setData(seed());
    for (const k of Object.keys(localStorage))
      if (k.startsWith("garage-")) localStorage.removeItem(k);
  };
  const signIn = async (email: string) => {
    if (!supabase) throw Error("Add the Supabase project URL and publishable key to the app build first.");
    if (!email.includes("@")) throw Error("Enter a valid email address.");
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (signInError) throw signInError;
  };
  const signOut = async () => {
    if (!supabase) return;
    cloudReady.current = false;
    await supabase.auth.signOut();
  };
  const syncNow = async () => {
    if (!data || !userId) throw Error("Sign in to sync your garage.");
    if (conflict) throw Error("Choose which garage copy to keep before syncing.");
    setCloudStatus("syncing");
    await pushCloud(data, null, userId);
    cloudReady.current = true;
    setCloudStatus("synced");
    setCloudError("");
  };
  const useCloudCopy = async () => {
    if (!conflict) return;
    const clean = await restoreCloudFiles(checkBackup(conflict.data));
    await queue;
    await saveGarage(clean);
    setData(clean);
    cloudRevision.current = conflict.revision;
    setConflict(null);
    cloudReady.current = true;
    setCloudStatus("synced");
  };
  const uploadDeviceCopy = async () => {
    if (!data || !conflict) return;
    setCloudStatus("syncing");
    if (!userId) throw Error("Sign in to sync your garage.");
    await pushCloud(data, conflict.revision, userId);
    setConflict(null);
    cloudReady.current = true;
    setCloudStatus("synced");
    setCloudError("");
  };
  return (
    <Context.Provider
      value={{ data, update, replace, reset, toast: setMessage, cloudStatus, cloudEmail, cloudError, signIn, signOut, syncNow, useCloudCopy, uploadDeviceCopy }}
    >
      {children}
      {message && (
        <div role="status" className="toast">
          {message}
        </div>
      )}
    </Context.Provider>
  );
}
export const useGarage = () => {
  const store = useContext(Context);
  if (!store) throw Error("Garage provider missing");
  return store;
};
