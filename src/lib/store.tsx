import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  db,
  loadGarage,
  saveGarage,
  switchOwner,
  activeOwner,
} from "./database";
import { seed, type GarageData } from "./types";
import { checkBackup } from "./calculations";
import { sendBrowserAlerts } from "./reminders";
import { supabase } from "./supabase";
import { syncRecords, resolveConflicts, stable } from "./recordSync";
export { GarageDB, loadGarage, saveGarage, db } from "./database";
type Status =
  | "disabled"
  | "signed_out"
  | "offline"
  | "syncing"
  | "synced"
  | "conflict"
  | "error"
  | "pending";
type Store = {
  data: GarageData;
  update: (fn: (data: GarageData) => void) => Promise<void>;
  replace: (data: unknown) => Promise<void>;
  reset: () => Promise<void>;
  toast: (message: string) => void;
  cloudStatus: Status;
  cloudEmail: string;
  cloudError: string;
  pendingCount: number;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
  useCloudCopy: () => Promise<void>;
  uploadDeviceCopy: () => Promise<void>;
};
const Context = createContext<Store | null>(null);
let localQueue = Promise.resolve();
export function GarageProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<GarageData | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [cloudStatus, setStatus] = useState<Status>(
    supabase ? "signed_out" : "disabled",
  );
  const [cloudEmail, setEmail] = useState(""),
    [cloudError, setCloudError] = useState(""),
    [pendingCount, setPending] = useState(0);
  const user = useRef<string | null>(null),
    running = useRef<Promise<void> | null>(null);
  const refresh = async () => {
    const owner = await activeOwner();
    const rows = await db.records.where("owner").equals(owner).toArray();
    const next = await loadGarage();
    setData((current) => (stable(current) === stable(next) ? current : next));
    setPending(rows.filter((r) => r.pending).length);
    return rows;
  };
  const syncNow = async () => {
    if (!user.current || !supabase) return;
    if (running.current) return running.current;
    if (!navigator.onLine) {
      setStatus("offline");
      return;
    }
    const owner = user.current;
    const work = async () => {
      setStatus("syncing");
      try {
        await localQueue;
        if ((await activeOwner()) !== owner) return;
        await syncRecords(owner);
        if (user.current !== owner) return;
        setCloudError("");
        const rows = await refresh();
        setStatus(
          rows.some((r) => r.conflict)
            ? "conflict"
            : rows.some((r) => r.pending)
              ? "pending"
              : "synced",
        );
      } catch (e) {
        if (user.current !== owner) return;
        const rows = await refresh();
        setCloudError(
          e && typeof e === "object" && "message" in e
            ? String(e.message)
            : "Could not sync. Your pending records are safe on this device.",
        );
        setStatus(
          !navigator.onLine
            ? "offline"
            : rows.some((r) => r.conflict)
              ? "conflict"
              : "error",
        );
      }
    };
    const operation = (
      "locks" in navigator
        ? navigator.locks.request("my-garage-sync", work)
        : work()
    ).then(() => {});
    running.current = operation;
    try {
      await operation;
    } finally {
      running.current = null;
    }
  };
  useEffect(() => {
    let active = true;
    void refresh().catch(() =>
      setError(
        "Local records could not be opened. Retry without clearing your browser data.",
      ),
    );
    if (!supabase) return;
    let previous: string | null | undefined = undefined;
    const apply = (
      session: { user: { id: string; email?: string } } | null,
    ) => {
      if (active && !session && !navigator.onLine) {
        void activeOwner().then(async (owner) => {
          if (!active || owner === "local") return;
          user.current = owner;
          setEmail((await db.meta.get("email:" + owner))?.value ?? "");
          setStatus("offline");
        });
        return;
      }
      if (!active || previous === (session?.user.id ?? null)) return;
      previous = session?.user.id ?? null;
      user.current = previous;
      setEmail(session?.user.email ?? "");
      const job = localQueue.then(async () => {
        await switchOwner(session?.user.id ?? "local");
        if (session)
          await db.meta.put({
            id: "email:" + session.user.id,
            value: session.user.email ?? "",
          });
        if (!active) return;
        await refresh();
        if (!session) setStatus("signed_out");
      });
      localQueue = job.catch(() => {});
      void job
        .then(() => {
          if (active && session) void syncNow();
        })
        .catch((e) => setCloudError(String(e)));
    };
    void supabase.auth
      .getSession()
      .then(({ data: auth }) => apply(auth.session))
      .catch(() => {
        if (active)
          setCloudError(
            "Sign-in could not be refreshed. Local records remain saved.",
          );
      });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setTimeout(() => apply(session), 0);
      },
    );
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!data) return;
    document.documentElement.dataset.theme = data.settings.theme;
    void sendBrowserAlerts(data).catch(() => {});
    if (!pendingCount || !user.current) return;
    if (!navigator.onLine) {
      setStatus("offline");
      return;
    }
    const timer = setTimeout(() => void syncNow(), 800);
    return () => clearTimeout(timer);
  }, [data, pendingCount]);
  useEffect(() => {
    const retry = () => void syncNow();
    const focus = () => {
      void refresh().then(retry);
    };
    const offline = () => {
      if (user.current) setStatus("offline");
    };
    const interval = setInterval(retry, 30000);
    window.addEventListener("online", retry);
    window.addEventListener("offline", offline);
    window.addEventListener("focus", focus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", retry);
      window.removeEventListener("offline", offline);
      window.removeEventListener("focus", focus);
    };
  }, []);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 5000);
    return () => clearTimeout(timer);
  }, [message]);
  const update = (fn: (d: GarageData) => void) => {
    const job = localQueue.then(async () => {
      await db.transaction("rw", db.records, db.meta, async () => {
        const draft = structuredClone(await loadGarage());
        fn(draft);
        await saveGarage(draft);
      });
      await refresh();
    });
    localQueue = job.catch((e) =>
      setMessage(
        e instanceof Error ? e.message : "Could not save on this device.",
      ),
    );
    return job;
  };
  const replace = async (value: unknown) => {
    const clean = checkBackup(value);
    await update((d) => Object.assign(d, clean));
  };
  const reset = async () => {
    await replace(seed());
  };
  const signOut = async () => {
    user.current = null;
    if (running.current) await running.current;
    if (supabase) {
      const { error: authError } = await supabase.auth.signOut();
      if (authError) throw authError;
    }
    await localQueue;
    await switchOwner("local");
    await refresh();
    setEmail("");
    setStatus("signed_out");
  };
  const resolve = async (choice: "local" | "remote") => {
    if (!user.current) return;
    await resolveConflicts(user.current, choice);
    await refresh();
    await syncNow();
  };
  if (error)
    return (
      <div className="loading-screen">
        <p>{error}</p>
        <button onClick={() => location.reload()}>Retry</button>
      </div>
    );
  if (!data)
    return (
      <div className="loading-screen">
        <p>Opening your garage...</p>
      </div>
    );
  return (
    <Context.Provider
      value={{
        data,
        update,
        replace,
        reset,
        toast: setMessage,
        cloudStatus,
        cloudEmail,
        cloudError,
        pendingCount,
        signOut,
        syncNow,
        useCloudCopy: () => resolve("remote"),
        uploadDeviceCopy: () => resolve("local"),
      }}
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
export function useGarage() {
  const store = useContext(Context);
  if (!store) throw Error("Garage provider missing");
  return store;
}
