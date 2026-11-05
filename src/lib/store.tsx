import Dexie, { type Table } from "dexie";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { seed, type GarageData } from "./types";
import { checkBackup } from "./calculations";
import { sendBrowserAlerts } from "./reminders";
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
};
const Context = createContext<Store | null>(null);
let queue = Promise.resolve();
export function GarageProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<GarageData | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    loadGarage()
      .then(setData)
      .catch(() =>
        setError(
          "Your local garage could not be opened. Check browser storage access, then retry. Existing records have not been removed.",
        ),
      );
  }, []);
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
  return (
    <Context.Provider
      value={{ data, update, replace, reset, toast: setMessage }}
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
