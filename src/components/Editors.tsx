import { useState, type FormEvent } from "react";
import {
  Check,
  Camera,
  Upload,
  Trash2,
  Download,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { Modal, Field, Note, type ModalState } from "./ui";
import { useGarage } from "../lib/store";
import {
  id,
  photos,
  type Unit,
  type Currency,
  type History,
  type Fuel,
  type Reading,
  type CareTask,
} from "../lib/types";
import {
  displayMeters,
  confirmedMeters,
  fromMeters,
  toMeters,
  validateReading,
  dateInput,
  pressureFrom,
  pressureTo,
  fmtDate,
} from "../lib/calculations";
import { careTasks, intervalLabel, sourceUrl } from "../data/maintenance";
import {
  readFile,
  download,
  exportBackup,
  exportCsv,
  exportPdf,
  importDocument,
} from "../lib/files";

const categories = [
  "Maintenance",
  "Repair",
  "Inspection",
  "Tires",
  "Battery",
  "Insurance",
  "Registration",
  "Bodywork",
  "Accessories",
  "Detailing",
  "Parking",
  "Vehicle purchase",
  "Other",
];
function number(
  value: FormDataEntryValue | null,
  label: string,
  optional = false,
) {
  if (optional && (value === null || value === "")) return null;
  const n = Number(value);
  if (value === "" || value === null || !Number.isFinite(n) || n < 0)
    throw Error(`Enter a valid ${label}.`);
  return n;
}
const text = (f: FormData, key: string) => String(f.get(key) ?? "").trim();

export function Editor({
  state,
  onClose,
}: {
  state: ModalState;
  onClose: () => void;
}) {
  const { data, update, toast, replace, reset } = useGarage();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [unit, setUnit] = useState<Unit>(data.vehicle.unit),
    [pressureUnit, setPressureUnit] = useState("PSI");
  const [taskId, setTaskId] = useState(
      state.subject ??
        data.history.find((h) => h.id === state.id)?.taskId ??
        "",
    ),
    [docIds, setDocIds] = useState<string[]>([]),
    [uploadBusy, setUploadBusy] = useState(false);
  const oldHistory = data.history.find((h) => h.id === state.id),
    oldFuel = data.fuel.find((h) => h.id === state.id);
  const tire = data.tires[state.position ?? 0],
    tasks = careTasks(data),
    task = tasks.find((t) => t.id === (state.id ?? state.subject));
  const old = state.type === "fuel" ? oldFuel : oldHistory;
  const mileage = old
    ? old.meters
    : state.type === "service" || state.type === "expense"
      ? confirmedMeters(data)
      : displayMeters(data);
  const initialOdo =
    mileage === null ? "" : Number(fromMeters(mileage, unit).toFixed(1));
  const [odometerValue, setOdometerValue] = useState(String(initialOdo));
  const [odometerMeters, setOdometerMeters] = useState<number | null>(mileage);
  const title = {
    mileage: "Update odometer",
    service: old ? "Edit service" : "Record a service",
    fuel: old ? "Edit fuel purchase" : "Log a fill-up",
    expense: old ? "Edit expense" : "Add an expense",
    tire: tire.position + " tire",
    "tire-check": "Four tires. One quick check.",
    profile: "Your Mazda, in detail",
    reminder: "Create a reminder",
    settings: "Garage settings",
    documents: "Private document vault",
    manual: "Manual",
    learn: "Driving care",
    task: task?.name ?? "Custom care schedule",
    onboarding: "Welcome to your garage",
  }[state.type];
  const run = async (
    fn: () => Promise<void>,
    message = "Saved to your garage",
  ) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      toast(message);
      onClose();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const attach = async (files: FileList | null, kind = "Invoice") => {
    if (!files?.length) return;
    setUploadBusy(true);
    setError("");
    try {
      for (const file of Array.from(files)) {
        const doc = await importDocument(file, kind);
        await update((d) => {
          d.documents.push(doc);
        });
        setDocIds((v) => [...v, doc.id]);
      }
      toast("Files saved privately on this device");
    } catch (e) {
      setError(String(e));
    } finally {
      setUploadBusy(false);
    }
  };
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void run(async () => {
      if (state.type === "tire-check") {
        const checkDate = text(f, "date");
        const pressures = data.tires.map((t, i) =>
          number(f.get("pressure-" + i), t.position + " pressure")!,
        );
        if (pressures.some((p) => p <= 0))
          throw Error("Enter the actual cold pressure measured at each tire.");
        await update((d) => {
          d.tires.forEach((t, i) => {
            t.psi = pressureFrom(pressures[i], pressureUnit);
            t.checked = checkDate;
            d.history.push({
              id: id(),
              vehicleId: d.vehicle.id,
              title: `${t.position} tire pressure inspection`,
              category: "Tires",
              date: checkDate,
              meters: null,
              taskId: "",
              cost: null,
              currency: "USD",
              provider: "Owner inspection",
              notes: `Cold pressure: ${t.psi.toFixed(1)} PSI. Manual four-tire check; wheel condition not assessed by this entry.`,
              attachments: [],
            });
          });
          d.reminders = d.reminders.filter((r) => r.taskId !== "pressure");
        });
      }
      if (state.type === "mileage") {
        const value = number(f.get("odometer"), "odometer")!;
        const reading: Reading = {
          id: id(),
          date: new Date().toISOString(),
          meters: toMeters(value, unit),
          original: value,
          unit,
          reason: text(f, "notes") || "Manual odometer update",
        };
        await update((d) => {
          validateReading(d.readings, reading);
          d.readings.push(reading);
        });
      }
      if (state.type === "service" || state.type === "expense") {
        const value = number(f.get("odometer"), "odometer", true),
          meters = value === null ? null : toMeters(value, unit),
          date = text(f, "date");
        const entry: History = {
          id: oldHistory?.id ?? id(),
          vehicleId: data.vehicle.id,
          title: text(f, "title"),
          category: text(f, "category"),
          date,
          meters,
          taskId: state.type === "service" ? text(f, "taskId") : "",
          cost: number(f.get("cost"), "cost", true),
          currency: text(f, "currency") as Currency,
          provider: text(f, "provider"),
          notes: text(f, "notes"),
          attachments: [...(oldHistory?.attachments ?? []), ...docIds],
          recurring: (text(f, "recurring") || "none") as History["recurring"],
        };
        if (!entry.title) throw Error("Give this record a title.");
        await update((d) => {
          if (value !== null && meters !== null) {
            const reading: Reading = {
              id: entry.id,
              date,
              meters,
              original: value,
              unit,
              reason: entry.title,
            };
            validateReading(d.readings, reading);
            d.readings = d.readings.filter((r) => r.id !== entry.id);
            d.readings.push(reading);
          } else d.readings = d.readings.filter((r) => r.id !== entry.id);
          d.history = d.history.filter((h) => h.id !== entry.id);
          d.history.push(entry);
          if (entry.taskId)
            d.reminders = d.reminders.filter((r) => r.taskId !== entry.taskId);
        });
      }
      if (state.type === "fuel") {
        const value = number(f.get("odometer"), "odometer")!,
          liters = number(f.get("liters"), "liters")!;
        if (liters <= 0) throw Error("Liters must be greater than zero.");
        let cost = number(f.get("cost"), "total price", true);
        const perLiter = number(
          f.get("pricePerLiter"),
          "price per liter",
          true,
        );
        if (cost === null && perLiter !== null)
          cost = Number((perLiter * liters).toFixed(2));
        if (
          cost !== null &&
          perLiter !== null &&
          Math.abs(cost - perLiter * liters) > Math.max(0.1, cost * 0.01)
        )
          throw Error(
            "Total price and price per liter do not agree. Correct one or leave price per liter blank.",
          );
        const entry: Fuel = {
          id: oldFuel?.id ?? id(),
          vehicleId: data.vehicle.id,
          date: text(f, "date"),
          meters: toMeters(value, unit),
          original: value,
          unit,
          liters,
          cost,
          currency: text(f, "currency") as Currency,
          full: f.get("full") === "on",
          terrain: text(f, "terrain"),
          sport: f.get("sport") === "on",
          station: text(f, "station"),
          notes: text(f, "notes"),
        };
        await update((d) => {
          if (
            d.fuel.some((e) => e.id !== entry.id && e.meters === entry.meters)
          )
            throw Error(
              "A fill-up exists at this odometer. Edit it from your fuel history.",
            );
          const reading = {
            id: entry.id,
            date: entry.date,
            meters: entry.meters,
            original: value,
            unit,
            reason: "Fuel purchase",
          };
          validateReading(d.readings, reading);
          d.readings = d.readings.filter((r) => r.id !== entry.id);
          d.readings.push(reading);
          d.fuel = d.fuel.filter((e) => e.id !== entry.id);
          d.fuel.push(entry);
        });
      }
      if (state.type === "tire") {
        const psi = number(f.get("psi"), "cold pressure", true),
          tread = number(f.get("tread"), "tread depth", true);
        if (psi !== null && psi === 0)
          throw Error(
            "Enter a measured pressure above zero, or leave it unknown.",
          );
        await update((d) => {
          const actualPsi =
              psi === null ? null : pressureFrom(psi, pressureUnit),
            checkDate = text(f, "date");
          d.tires[state.position ?? 0] = {
            position: tire.position,
            psi: actualPsi,
            checked: psi === null ? null : checkDate,
            tread,
            manufactured: text(f, "manufactured"),
            brand: text(f, "brand"),
            model: text(f, "model"),
            size: text(f, "size"),
            condition: text(f, "condition"),
            notes: text(f, "notes"),
          };
          if (actualPsi !== null)
            d.history.push({
              id: id(),
              vehicleId: d.vehicle.id,
              title: `${tire.position} tire pressure inspection`,
              category: "Tires",
              date: checkDate,
              meters: null,
              taskId: "",
              cost: null,
              currency: "USD",
              provider: "Owner inspection",
              notes: `Cold pressure: ${actualPsi.toFixed(1)} PSI. ${text(f, "condition")}. ${text(f, "notes")}`,
              attachments: [],
            });
        });
      }
      if (state.type === "profile") {
        const specs = { ...data.vehicle.specs };
        for (const key of Object.keys(specs))
          specs[key] = text(f, "spec-" + key);
        const vin = text(f, "vin").toUpperCase();
        if (vin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin))
          throw Error(
            "A VIN has 17 characters and excludes I, O and Q. Leave it blank if unknown.",
          );
        const pressure = number(f.get("pressure"), "reference pressure")!;
        if (pressure <= 0)
          throw Error("Reference pressure must be greater than zero.");
        await update((d) => {
          d.vehicle.specs = specs;
          d.vehicle.vin = vin;
          d.vehicle.unit = unit;
          d.vehicle.driving = text(f, "driving") as "normal" | "severe";
          d.vehicle.pressure = pressure;
          d.vehicle.placardVerified = f.get("placard") === "on";
        });
      }
      if (state.type === "reminder") {
        const distance = number(f.get("odometer"), "odometer threshold", true),
          date = text(f, "date");
        if (!date && distance === null)
          throw Error("Set a date, an odometer threshold, or both.");
        await update((d) => {
          d.reminders.push({
            id: id(),
            taskId: "",
            title: text(f, "title"),
            date,
            meters: distance === null ? null : toMeters(distance, unit),
            status: "active",
            explanation: text(f, "notes"),
          });
        });
      }
      if (state.type === "task") {
        const miles = number(f.get("miles"), "distance interval", true),
          months = number(f.get("months"), "month interval", true),
          days = number(f.get("days"), "day interval", true);
        if (months && days)
          throw Error("Choose months or days for the time interval.");
        if (!miles && !months && !days)
          throw Error("Enter at least one positive interval.");
        if (
          (months && !Number.isInteger(months)) ||
          (days && !Number.isInteger(days))
        )
          throw Error("Use whole months or days.");
        const custom: CareTask = {
          id: task?.id ?? id(),
          name: text(f, "title"),
          category: task?.category ?? "Other",
          miles: miles || undefined,
          months: months || undefined,
          days: days || undefined,
          official: false,
          reason: text(f, "notes") || "Personal care schedule.",
          reference:
            "User-customized · " + (text(f, "source") || "personal reminder"),
        };
        await update((d) => {
          d.customTasks = d.customTasks.filter((t) => t.id !== custom.id);
          d.customTasks.push(custom);
        });
      }
    });
  };
  const photoUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploadBusy(true);
    try {
      if (!file.type.startsWith("image/")) throw Error("Choose an image file.");
      if (file.size > 10 * 1024 * 1024)
        throw Error("Choose a photo smaller than 10 MB.");
      const photo = await readFile(file);
      await update((d) => {
        d.vehicle.photo = photo;
      });
      toast("Your car photograph is updated");
    } catch (e) {
      setError(String(e));
    } finally {
      setUploadBusy(false);
    }
  };
  const unitSelect = (
    <select
      aria-label="Distance unit"
      value={unit}
      onChange={(e) => {
        const nextUnit = e.target.value as Unit;
        setUnit(nextUnit);
        if (odometerMeters !== null)
          setOdometerValue(
            String(Number(fromMeters(odometerMeters, nextUnit).toFixed(3))),
          );
      }}
    >
      <option value="mi">Miles (mi)</option>
      <option value="km">Kilometers (km)</option>
    </select>
  );
  const dateField = (
    <Field label="Date">
      <input
        type="date"
        name="date"
        required
        defaultValue={old?.date.slice(0, 10) ?? dateInput(new Date())}
        max={dateInput(new Date())}
      />
    </Field>
  );
  const odoField = (
    <Field
      label={`Odometer (${unit})${state.type === "service" || state.type === "expense" ? " · optional" : ""}`}
      hint="Use a verified dashboard reading. Leave an unknown historical reading blank."
    >
      <input
        name="odometer"
        type="number"
        min="0"
        step="any"
        required={state.type === "mileage" || state.type === "fuel"}
        value={odometerValue}
        onChange={(e) => {
          const value = e.target.value;
          setOdometerValue(value);
          setOdometerMeters(
            value === "" ? null : toMeters(Number(value), unit),
          );
        }}
        placeholder="Unknown"
      />
    </Field>
  );
  const notes = (
    <Field label="Notes (optional)">
      <textarea
        name="notes"
        rows={3}
        defaultValue={old?.notes ?? ""}
        placeholder="Anything you’d like to remember…"
      />
    </Field>
  );
  return (
    <Modal
      title={title}
      subtitle={
        state.type === "profile"
          ? "User-provided specifications · every detail is editable"
          : undefined
      }
      onClose={onClose}
      wide={state.type === "profile" || state.type === "documents"}
    >
      {state.type === "settings" ? (
        <div className="settings-content">
          <div className="setting-row">
            <div>
              <h3>Appearance</h3>
              <p>A different light for your garage.</p>
            </div>
            <select
              value={data.settings.theme}
              onChange={(e) => {
                const theme = e.target.value as "dark" | "light";
                void update((d) => {
                  d.settings.theme = theme;
                });
              }}
            >
              <option value="dark">Midnight</option>
              <option value="light">Daylight</option>
            </select>
          </div>
          <div className="setting-row">
            <div>
              <h3>Monthly mileage estimate</h3>
              <p>
                Optional planning value in km/month. It never changes your
                recorded odometer or a measured due status.
              </p>
            </div>
            <input
              aria-label="Estimated monthly kilometers"
              type="number"
              min="0"
              step="1"
              placeholder="Unknown"
              defaultValue={data.settings.estimatedMonthlyKm ?? ""}
              style={{ width: 110 }}
              onBlur={(e) => {
                const value =
                  e.target.value === "" ? null : Number(e.target.value);
                if (value !== null && (!Number.isFinite(value) || value < 0)) {
                  toast("Enter a valid monthly distance estimate.");
                  return;
                }
                void update((d) => {
                  d.settings.estimatedMonthlyKm = value;
                });
              }}
            />
          </div>
          <div className="setting-row">
            <div>
              <h3>Browser notifications</h3>
              <p>
                {data.settings.notifications ? "Enabled" : "Not enabled"} ·
                reminders refresh when you open the app.
              </p>
            </div>
            <button
              className="button secondary"
              onClick={() =>
                void run(async () => {
                  if (!("Notification" in window))
                    throw Error(
                      "This browser does not support notifications. On iPhone, install to the Home Screen first.",
                    );
                  if (data.settings.notifications) {
                    await update((d) => {
                      d.settings.notifications = false;
                    });
                    return;
                  }
                  const result = await Notification.requestPermission();
                  if (result !== "granted")
                    throw Error(
                      "Permission was not granted. Enable it in your browser site settings.",
                    );
                  await update((d) => {
                    d.settings.notifications = true;
                  });
                }, "Notification preferences saved")
              }
            >
              {data.settings.notifications ? "Disable" : "Enable"}
            </button>
          </div>
          <Note>
            Browser notifications cannot reliably run while this web app is
            closed. Due items are checked on launch and focus. Export date
            reminders to your calendar for alerts outside the app.
          </Note>
          <div className="setting-row">
            <div>
              <h3>Local backup</h3>
              <p>
                Includes photos and documents; excludes your VIN. Keep the
                downloaded file private.
              </p>
            </div>
            <button
              className="button secondary"
              onClick={() => exportBackup(data)}
            >
              <Download size={15} />
              Export
            </button>
          </div>
          <label className="button secondary file-button">
            <Upload size={16} />
            Restore backup
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (
                  !confirm(
                    "Replace all current records with this backup? Export a backup first if you want to keep them.",
                  )
                )
                  return;
                void run(async () => {
                  if (file.size > 100 * 1024 * 1024)
                    throw Error("Backup is too large.");
                  await replace(JSON.parse(await file.text()));
                }, "Backup restored");
              }}
            />
          </label>
          <div className="setting-row">
            <div>
              <h3>Storage protection</h3>
              <p>
                Records stay in this browser’s IndexedDB. No account or cloud
                sync. Anyone using this browser profile can access them.
              </p>
            </div>
            <ShieldCheck size={24} />
          </div>
          <button
            className="button secondary"
            onClick={() =>
              void navigator.storage
                ?.persist()
                .then((granted) =>
                  toast(
                    granted
                      ? "Persistent device storage granted"
                      : "Your browser manages storage automatically; keep a backup.",
                  ),
                )
            }
          >
            Request persistent storage
          </button>
          <div className="danger-zone">
            <h3>Delete all garage data</h3>
            <p>
              Removes your records, VIN, uploaded photos and documents from this
              browser.
            </p>
            <button
              className="button danger"
              onClick={() => {
                if (
                  prompt(
                    "Type DELETE to permanently remove all local garage records.",
                  ) === "DELETE"
                )
                  void run(reset, "Garage data deleted");
              }}
            >
              <Trash2 size={15} />
              Delete all data
            </button>
          </div>
        </div>
      ) : state.type === "documents" ? (
        <div>
          <Note>
            Private to this browser profile. Imported PDFs are indexed
            on-device. Image-only scans need OCR before their text can be
            searched. No navigation manual was supplied.
          </Note>
          <label className="upload-area">
            <Upload size={24} />
            <strong>
              {uploadBusy
                ? "Saving your document…"
                : "Add a manual, invoice or photo"}
            </strong>
            <span>PDF or image · up to 15 MB per file</span>
            <input
              type="file"
              accept="application/pdf,image/*"
              multiple
              disabled={uploadBusy}
              onChange={(e) => void attach(e.target.files, "Document")}
            />
          </label>
          <div className="document-list">
            {data.documents.map((doc) => (
              <div className="document-row" key={doc.id}>
                <div>
                  <strong>{doc.name}</strong>
                  <small>
                    {doc.pages.length
                      ? `${doc.pages.length} searchable pages`
                      : "Private local file"}{" "}
                    · {fmtDate(doc.added)}
                  </small>
                </div>
                <button
                  className="icon-button"
                  title={`Download ${doc.name}`}
                  onClick={() => download(doc.data, doc.name)}
                >
                  <Download size={17} />
                </button>
                <button
                  className="icon-button"
                  title={`Delete ${doc.name}`}
                  onClick={() => {
                    if (confirm("Remove this document?"))
                      void update((d) => {
                        d.documents = d.documents.filter(
                          (e) => e.id !== doc.id,
                        );
                        d.history.forEach((h) => {
                          h.attachments = h.attachments.filter(
                            (a) => a !== doc.id,
                          );
                        });
                      });
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          {!data.documents.length && (
            <p className="muted center">
              Your vault is ready for its first document.
            </p>
          )}
          <a
            className="button secondary"
            href="/manuals/2019-mazda3-maintenance.pdf"
            target="_blank"
            rel="noreferrer"
          >
            Open included Mazda maintenance PDF
            <ExternalLink size={14} />
          </a>
        </div>
      ) : (
        <form onSubmit={onSubmit}>
          {state.type === "mileage" && (
            <>
              <Note>
                The initial 32,000 mi is your approximate starting value.
                Confirm an actual reading here to calculate mileage-based
                reminders.
              </Note>
              <Field label="Display & input unit">{unitSelect}</Field>
              {odoField}
              <details className="form-more">
                <summary>Add a note (optional)</summary>
                {notes}
              </details>
            </>
          )}
          {(state.type === "service" || state.type === "expense") && (
            <>
              {state.type === "service" && (
                <Field label="Maintenance item">
                  <select
                    name="taskId"
                    value={taskId}
                    onChange={(e) => setTaskId(e.target.value)}
                  >
                    <option value="">General service / repair</option>
                    {tasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {oldHistory || !taskId ? (
                <Field label="Record title">
                  <input
                    key={taskId}
                    name="title"
                    required
                    defaultValue={
                      oldHistory?.title ??
                      tasks.find((t) => t.id === taskId)?.name ??
                      ""
                    }
                    placeholder={
                      state.type === "expense"
                        ? "e.g. Annual insurance"
                        : "e.g. Engine oil & filter replacement"
                    }
                  />
                </Field>
              ) : (
                <input
                  type="hidden"
                  name="title"
                  value={tasks.find((t) => t.id === taskId)?.name ?? ""}
                />
              )}
              <div className="form-grid">
                {dateField}
                <div className="field date-side-note">
                  <span>
                    {state.type === "service"
                      ? "Care, recorded."
                      : "Ownership, understood."}
                  </span>
                  <small>Only enter what you know.</small>
                </div>
              </div>
              <div className="form-grid">
                {odoField}
                <Field label="Distance unit">{unitSelect}</Field>
              </div>
              <div className="form-grid">
                <Field label="Cost (optional)">
                  <input
                    name="cost"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={oldHistory?.cost ?? ""}
                    placeholder="0.00"
                  />
                </Field>
                <Field label="Currency">
                  <select
                    name="currency"
                    defaultValue={oldHistory?.currency ?? "USD"}
                  >
                    <option>USD</option>
                    <option>LBP</option>
                  </select>
                </Field>
              </div>
              <details className="form-more" open={!!oldHistory}>
                <summary>Provider, notes & invoice (optional)</summary>
                <Field label="Category">
                  <select
                    name="category"
                    defaultValue={
                      oldHistory?.category ??
                      (state.type === "expense" ? "Other" : "Maintenance")
                    }
                  >
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Service provider (optional)">
                  <input
                    name="provider"
                    defaultValue={oldHistory?.provider ?? ""}
                    placeholder="Garage or technician"
                  />
                </Field>
                <Field label="Expense recurrence">
                  <select
                    name="recurring"
                    defaultValue={oldHistory?.recurring ?? "none"}
                  >
                    <option value="none">One-time expense</option>
                    <option value="monthly">Recurring · monthly</option>
                    <option value="annual">Recurring · annual</option>
                  </select>
                </Field>
                {notes}
                <label className="button secondary file-button">
                  <Upload size={15} />
                  {uploadBusy
                    ? "Attaching…"
                    : `Attach invoice / photo${docIds.length ? ` (${docIds.length})` : ""}`}
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    multiple
                    disabled={uploadBusy}
                    onChange={(e) => void attach(e.target.files)}
                  />
                </label>
              </details>
            </>
          )}
          {state.type === "fuel" && (
            <>
              <p className="form-intro">
                Just the essentials. Your garage calculates the rest.
              </p>
              <div className="form-grid">
                {dateField}
                <Field label="Distance unit">{unitSelect}</Field>
              </div>
              {odoField}
              <div className="form-grid">
                <Field label="Liters added">
                  <input
                    name="liters"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    defaultValue={oldFuel?.liters}
                    placeholder="e.g. 35.5"
                  />
                </Field>
                <Field label="Total price (optional)">
                  <input
                    name="cost"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={oldFuel?.cost ?? ""}
                    placeholder="0.00"
                  />
                </Field>
              </div>
              <label className="check-field full-tank-toggle">
                <input
                  type="checkbox"
                  name="full"
                  defaultChecked={oldFuel?.full ?? true}
                />
                <span>
                  Filled to a full tank
                  <small>
                    Partial fills are saved without guessing consumption.
                  </small>
                </span>
              </label>
              <details className="form-more" open={!!oldFuel}>
                <summary>Price per liter, driving & notes (optional)</summary>
                <div className="form-grid">
                  <Field label="Price per liter (optional)">
                    <input
                      name="pricePerLiter"
                      type="number"
                      min="0"
                      step="0.001"
                      placeholder="Used if total is blank"
                    />
                  </Field>
                  <Field label="Currency">
                    <select
                      name="currency"
                      defaultValue={oldFuel?.currency ?? "USD"}
                    >
                      <option>USD</option>
                      <option>LBP</option>
                    </select>
                  </Field>
                </div>
                <div className="form-grid">
                  <Field label="Driving conditions">
                    <select
                      name="terrain"
                      defaultValue={oldFuel?.terrain ?? "Mixed"}
                    >
                      {["Mixed", "City", "Highway", "Mountainous"].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Gas station (optional)">
                    <input
                      name="station"
                      defaultValue={oldFuel?.station ?? ""}
                    />
                  </Field>
                </div>
                <label className="check-field">
                  <input
                    name="sport"
                    type="checkbox"
                    defaultChecked={oldFuel?.sport ?? false}
                  />
                  Sport mode used
                </label>
                {notes}
              </details>
            </>
          )}
          {state.type === "tire" && (
            <>
              <Note>
                Manual cold measurement, not live TPMS. Reference:{" "}
                {data.vehicle.pressure} PSI ·{" "}
                {data.vehicle.placardVerified
                  ? "placard confirmed"
                  : "placard confirmation needed"}
                . Do not increase pressure above the specified value to protect
                rims.
              </Note>
              <div className="form-grid">
                <Field label={`Cold pressure (${pressureUnit})`}>
                  <input
                    key={pressureUnit}
                    name="psi"
                    type="number"
                    min="0.01"
                    step="0.01"
                    defaultValue={
                      tire.psi === null
                        ? ""
                        : Number(pressureTo(tire.psi, pressureUnit).toFixed(2))
                    }
                    placeholder="Unknown"
                  />
                </Field>
                <Field label="Pressure unit">
                  <select
                    value={pressureUnit}
                    onChange={(e) => setPressureUnit(e.target.value)}
                  >
                    <option>PSI</option>
                    <option>bar</option>
                    <option>kPa</option>
                  </select>
                </Field>
              </div>
              <Field label="Pressure checked on">
                <input
                  name="date"
                  type="date"
                  required
                  max={dateInput(new Date())}
                  defaultValue={
                    tire.checked?.slice(0, 10) ?? dateInput(new Date())
                  }
                />
              </Field>
              <details
                className="form-more"
                open={!!tire.brand || tire.tread !== null}
              >
                <summary>Tread, tire details & condition (optional)</summary>
                <div className="form-grid">
                  <Field label="Tread depth (mm)">
                    <input
                      name="tread"
                      type="number"
                      min="0"
                      step="0.1"
                      defaultValue={tire.tread ?? ""}
                      placeholder="Unknown"
                    />
                  </Field>
                  <Field label="Manufacture date (from DOT code)">
                    <input
                      name="manufactured"
                      type="date"
                      max={dateInput(new Date())}
                      defaultValue={tire.manufactured}
                    />
                  </Field>
                </div>
                <div className="form-grid">
                  <Field label="Tire brand">
                    <input name="brand" defaultValue={tire.brand} />
                  </Field>
                  <Field label="Tire model">
                    <input name="model" defaultValue={tire.model} />
                  </Field>
                </div>
                <Field label="Tire size">
                  <input name="size" defaultValue={tire.size} />
                </Field>
                <Field label="Wheel / tire condition">
                  <select name="condition" defaultValue={tire.condition}>
                    {[
                      "Needs inspection",
                      "Inspected — no visible damage",
                      "Visible damage — inspection needed",
                      "Unsafe — do not drive",
                    ].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Notes">
                  <textarea name="notes" defaultValue={tire.notes} />
                </Field>
              </details>
            </>
          )}
          {state.type === "tire-check" && (
            <>
              <p className="form-intro">
                Measure each tire when cold. Log all four together.
              </p>
              <Note>
                Reference: {data.vehicle.pressure} PSI front & rear ·{" "}
                {data.vehicle.placardVerified
                  ? "door placard confirmed"
                  : "confirm your door placard"}
                . These are manual measurements, not live tire readings.
              </Note>
              <div className="form-grid">
                <Field label="Check date">
                  <input
                    name="date"
                    type="date"
                    required
                    max={dateInput(new Date())}
                    defaultValue={dateInput(new Date())}
                  />
                </Field>
                <Field label="Pressure unit">
                  <select
                    value={pressureUnit}
                    onChange={(e) => setPressureUnit(e.target.value)}
                  >
                    <option>PSI</option>
                    <option>bar</option>
                    <option>kPa</option>
                  </select>
                </Field>
              </div>
              <div className="form-grid tire-quick-fields">
                {data.tires.map((t, i) => (
                  <Field key={i} label={`${t.position} (${pressureUnit})`}>
                    <input
                      type="number"
                      name={"pressure-" + i}
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="Measured pressure"
                    />
                  </Field>
                ))}
              </div>
              <p className="form-help">
                To log wheel damage, tread depth or tire age, select an
                individual wheel in the tire center.
              </p>
            </>
          )}
          {state.type === "profile" && (
            <>
              <div className="profile-photo">
                <img
                  src={data.vehicle.photo || photos[data.vehicle.photoIndex]}
                  alt="Your Mazda3"
                />
                <label className="button secondary file-button">
                  <Camera size={16} />
                  {uploadBusy ? "Uploading…" : "Upload your photograph"}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadBusy}
                    onChange={(e) => void photoUpload(e.target.files?.[0])}
                  />
                </label>
              </div>
              <div className="photo-thumbnails">
                {photos.map((photo, i) => (
                  <button
                    key={photo}
                    type="button"
                    aria-label={`Use vehicle photo ${i + 1}`}
                    className={
                      data.vehicle.photoIndex === i && !data.vehicle.photo
                        ? "selected"
                        : ""
                    }
                    onClick={() =>
                      void update((d) => {
                        d.vehicle.photo = "";
                        d.vehicle.photoIndex = i;
                      })
                    }
                  >
                    <img src={photo} alt={`Your Mazda, view ${i + 1}`} />
                  </button>
                ))}
              </div>
              <div className="form-grid">
                {Object.entries(data.vehicle.specs).map(([key, value]) => (
                  <Field key={key} label={key}>
                    <input name={"spec-" + key} defaultValue={value} />
                  </Field>
                ))}
              </div>
              <Field
                label="VIN (optional, private)"
                hint="Stored only in this browser profile. Excluded from exports."
              >
                <input
                  name="vin"
                  defaultValue={data.vehicle.vin}
                  maxLength={17}
                  autoComplete="off"
                />
              </Field>
              <div className="form-grid">
                <Field label="Distance unit">{unitSelect}</Field>
                <Field label="Driving profile">
                  <select name="driving" defaultValue={data.vehicle.driving}>
                    <option value="normal">Normal driving</option>
                    <option value="severe">Severe conditions</option>
                  </select>
                </Field>
              </div>
              <Note>
                Severe oil scheduling applies to qualifying dust, prolonged
                idling, extreme heat, short cold trips or continuous mountain
                driving. Living in Lebanon does not automatically shorten every
                service interval.
              </Note>
              <Field label="Verified cold-pressure reference (PSI)">
                <input
                  name="pressure"
                  type="number"
                  min="1"
                  step="0.1"
                  required
                  defaultValue={data.vehicle.pressure}
                />
              </Field>
              <label className="check-field">
                <input
                  name="placard"
                  type="checkbox"
                  defaultChecked={data.vehicle.placardVerified}
                />
                I confirmed this pressure against my driver’s door placard
              </label>
            </>
          )}
          {state.type === "reminder" && (
            <>
              <Field label="Reminder title">
                <input
                  name="title"
                  required
                  placeholder="e.g. Insurance renewal"
                />
              </Field>
              <Field label="Due date (optional)">
                <input name="date" type="date" />
              </Field>
              <div className="form-grid">
                <Field label={`Due odometer (${unit}, optional)`}>
                  <input name="odometer" type="number" min="0" step="0.1" />
                </Field>
                <Field label="Distance unit">{unitSelect}</Field>
              </div>
              {notes}
              <Note>
                When both limits are set, the earlier one applies. Distance is
                checked against your latest recorded reading.
              </Note>
            </>
          )}
          {state.type === "task" && (
            <>
              <Note>
                {task?.reason ??
                  "Set a personal reminder. Custom intervals are clearly labeled and do not become Mazda requirements."}
              </Note>
              {task?.official && (
                <a
                  href="/manuals/2019-mazda3-maintenance.pdf"
                  className="source-link"
                  target="_blank"
                  rel="noreferrer"
                >
                  {task.reference}
                  <ExternalLink size={13} />
                </a>
              )}
              <Field label="Task name">
                <input name="title" required defaultValue={task?.name} />
              </Field>
              <Field label="Distance interval (miles)">
                <input
                  name="miles"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue={task?.miles ?? ""}
                />
              </Field>
              <div className="form-grid">
                <Field label="Time interval (months)">
                  <input
                    name="months"
                    type="number"
                    min="1"
                    step="1"
                    defaultValue={task?.months ?? ""}
                  />
                </Field>
                <Field label="Or time interval (days)">
                  <input
                    name="days"
                    type="number"
                    min="1"
                    step="1"
                    defaultValue={task?.days ?? ""}
                  />
                </Field>
              </div>
              <Field label="Recommendation source">
                <input
                  name="source"
                  placeholder="Your mechanic, personal preference…"
                />
              </Field>
              <Field label="Reason / notes">
                <textarea
                  name="notes"
                  required
                  defaultValue={task?.official ? "" : task?.reason}
                />
              </Field>
              {task && (
                <p className="muted">Current: {intervalLabel(task, unit)}</p>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <footer className="modal-footer">
            {old && (
              <button
                type="button"
                className="button danger"
                disabled={busy}
                onClick={() => {
                  if (confirm("Permanently delete this record?"))
                    void run(async () => {
                      await update((d) => {
                        d.history = d.history.filter((h) => h.id !== old.id);
                        d.fuel = d.fuel.filter((h) => h.id !== old.id);
                        d.readings = d.readings.filter((r) => r.id !== old.id);
                      });
                    }, "Record deleted");
                }}
              >
                <Trash2 size={15} />
                Delete
              </button>
            )}
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="button primary"
              type="submit"
              disabled={busy || uploadBusy}
            >
              {busy ? (
                "Saving…"
              ) : (
                <>
                  <Check size={16} />
                  Save{" "}
                  {state.type === "fuel"
                    ? "fill-up"
                    : state.type === "mileage"
                      ? "reading"
                      : state.type === "profile"
                        ? "profile"
                        : "record"}
                </>
              )}
            </button>
          </footer>
        </form>
      )}
      {(state.type === "settings" || state.type === "documents") && error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </Modal>
  );
}
