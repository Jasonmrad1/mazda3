import { useState } from "react";
import { ArrowRight, Check, Camera, Bell, ShieldCheck } from "lucide-react";
import { useGarage } from "../lib/store";
import { photos, id, type Unit, type History } from "../lib/types";
import { toMeters, dateInput, validateReading } from "../lib/calculations";
import { readFile } from "../lib/files";
import { Modal, Field, Note } from "../components/ui";
export function Onboarding({ onClose }: { onClose: () => void }) {
  const { data, update, toast } = useGarage();
  const [step, setStep] = useState(0),
    [mileage, setMileage] = useState(""),
    [unit, setUnit] = useState<Unit>("mi"),
    [driving, setDriving] = useState<"normal" | "severe">("normal"),
    [photo, setPhoto] = useState(""),
    [oilDate, setOilDate] = useState(""),
    [oilMileage, setOilMileage] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const finish = async () => {
    setBusy(true);
    setError("");
    try {
      await update((d) => {
        d.settings.onboardingDone = true;
        d.vehicle.unit = unit;
        d.vehicle.driving = driving;
        if (photo) d.vehicle.photo = photo;
        if (mileage) {
          const v = Number(mileage);
          if (!Number.isFinite(v) || v < 0)
            throw Error("Enter a valid current odometer.");
          const reading = {
            id: id(),
            date: new Date().toISOString(),
            meters: toMeters(v, unit),
            original: v,
            unit,
            reason: "Confirmed during setup",
          };
          validateReading(d.readings, reading);
          d.readings.push(reading);
        } else {
          d.vehicle.initialMeters = null;
        }
        if (oilDate || oilMileage) {
          if (!oilDate || oilMileage === "")
            throw Error(
              "Enter both the oil-service date and odometer, or leave both blank.",
            );
          const value = Number(oilMileage);
          if (!Number.isFinite(value) || value < 0)
            throw Error("Enter a valid oil-service odometer.");
          const record: History = {
            id: id(),
            vehicleId: d.vehicle.id,
            title: "Engine oil & filter",
            category: "Maintenance",
            date: oilDate,
            meters: toMeters(value, unit),
            taskId: "oil",
            cost: null,
            currency: "USD",
            provider: "",
            notes: "Entered during setup",
            attachments: [],
          };
          const reading = {
            id: record.id,
            date: oilDate,
            meters: toMeters(value, unit),
            original: value,
            unit,
            reason: record.title,
          };
          validateReading(d.readings, reading);
          d.history.push(record);
          d.readings.push(reading);
        }
      });
      onClose();
      toast("Welcome to your garage");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save setup.");
    } finally {
      setBusy(false);
    }
  };
  const skip = () => {
    void update((d) => {
      d.settings.onboardingDone = true;
    })
      .then(onClose)
      .catch(() => setError("Could not save setup. Please retry."));
  };
  return (
    <Modal
      title={
        step === 0
          ? "A garage of your own."
          : step === 1
            ? "Make it unmistakably yours."
            : "A good place to begin."
      }
      subtitle={
        step === 0
          ? "Welcome to a more considered kind of car ownership."
          : step === 1
            ? "A few details now. Everything editable later."
            : "Add what you know. Leave the rest unknown."
      }
      onClose={skip}
    >
      <div className="onboarding-progress">
        {[0, 1, 2].map((i) => (
          <i key={i} className={i <= step ? "active" : ""} />
        ))}
      </div>
      {step === 0 ? (
        <>
          <div className="onboarding-photo">
            <img src={photos[0]} alt="Your black 2019 Mazda3 Hatchback" />
            <div>
              <span className="eyebrow">YOUR 2019 MAZDA3 HATCHBACK</span>
              <h2>
                Every mile.
                <br />A little more yours.
              </h2>
            </div>
          </div>
          <div className="welcome-points">
            <span>
              <ShieldCheck size={17} />
              Private, offline records
            </span>
            <span>
              <Check size={17} />
              Care with a verified source
            </span>
          </div>
          <p className="muted">
            Your actual photographs. Your black interior. A thoughtfully
            prepared profile, ready for your confirmation.
          </p>
        </>
      ) : step === 1 ? (
        <>
          <div className="onboarding-photo small">
            <img src={photo || photos[0]} alt="Your Mazda3" />
          </div>
          <label className="button secondary file-button">
            <Camera size={15} />
            Choose a different photo
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.size > 10 * 1024 * 1024) {
                    setError("Choose a photo under 10 MB.");
                    return;
                  }
                  void readFile(file).then(setPhoto);
                }
              }}
            />
          </label>
          <div className="form-grid">
            <Field label="Current odometer (optional)">
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="Approximately 32,000 mi supplied"
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
              />
            </Field>
            <Field label="Unit">
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as Unit)}
              >
                <option value="mi">Miles</option>
                <option value="km">Kilometers</option>
              </select>
            </Field>
          </div>
          <Field label="Driving conditions">
            <select
              value={driving}
              onChange={(e) =>
                setDriving(e.target.value as "normal" | "severe")
              }
            >
              <option value="normal">Normal driving</option>
              <option value="severe">Severe conditions</option>
            </select>
          </Field>
          <Note>
            Choose severe for qualifying dust, prolonged idling, extreme heat or
            continuous mountain driving. Only the oil schedule is shortened
            automatically.
          </Note>
          <div className="setup-specs">
            <span>2019 · BP · Preferred · US</span>
            <span>2.5L SKYACTIV-G · 6-speed automatic · FWD</span>
            <span>Jet Black Mica · Black interior · 215/45R18</span>
          </div>
        </>
      ) : (
        <>
          <Note>
            Known recent oil service? Add it here or skip. Blank fields never
            become a fabricated service record.
          </Note>
          <div className="form-grid">
            <Field label="Last oil change (optional)">
              <input
                type="date"
                value={oilDate}
                max={dateInput(new Date())}
                onChange={(e) => setOilDate(e.target.value)}
              />
            </Field>
            <Field label={`Service odometer (${unit})`}>
              <input
                type="number"
                min="0"
                step="0.1"
                value={oilMileage}
                onChange={(e) => setOilMileage(e.target.value)}
                placeholder="Unknown"
              />
            </Field>
          </div>
          <button
            className="button secondary"
            onClick={async () => {
              try {
                if (!("Notification" in window)) {
                  setError(
                    "Notifications are unavailable in this browser. Calendar export is available after setup.",
                  );
                  return;
                }
                const permission = await Notification.requestPermission();
                if (permission === "granted") {
                  await update((d) => {
                    d.settings.notifications = true;
                  });
                  toast("Browser notifications enabled");
                } else
                  setError(
                    "Permission was not granted. You can configure this later.",
                  );
              } catch {
                setError(
                  "Notifications could not be enabled. You can configure this later.",
                );
              }
            }}
          >
            <Bell size={16} />
            Configure browser notifications
          </button>
          <p className="muted">
            Reminders are checked when the app opens. Export to your calendar
            for date alerts when it is closed.
          </p>
          <div className="welcome-ready">
            <ShieldCheck size={24} />
            <h3>Your garage is ready.</h3>
            <p>
              Your records stay on this device. Add a backup whenever you need
              one.
            </p>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="modal-footer">
        <button
          className="text-button"
          onClick={step === 0 ? skip : () => setStep(step - 1)}
        >
          {step === 0 ? "Explore first" : "Back"}
        </button>
        <button
          className="button primary"
          disabled={busy}
          onClick={step < 2 ? () => setStep(step + 1) : () => void finish()}
        >
          {busy
            ? "Saving…"
            : step === 0
              ? "Make it yours"
              : step === 1
                ? "Continue"
                : "Enter my garage"}
          <ArrowRight size={16} />
        </button>
      </div>
    </Modal>
  );
}
