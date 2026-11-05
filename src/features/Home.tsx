import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  ChevronLeft,
  Gauge,
  Fuel,
  Wrench,
  CircleDot,
  Plus,
  ShieldCheck,
  Wallet,
  BookOpen,
  Sparkles,
  Camera,
  MapPin,
  ArrowRight,
} from "lucide-react";
import { useGarage } from "../lib/store";
import { photos, type Tab } from "../lib/types";
import {
  displayMeters,
  confirmedMeters,
  formatDistance,
  fromMeters,
  weightedConsumption,
  fuelMeasurements,
  money,
  dateInput,
  observedMonthlyDistance,
  fmtDate,
  deadline,
  type Deadline,
} from "../lib/calculations";
import { careTasks, intervalLabel } from "../data/maintenance";
import {
  Badge,
  IconBox,
  SectionTitle,
  Stat,
  type OpenModal,
} from "../components/ui";
import { TireVisual } from "./Tires";

export function CareRow({ due, open }: { due: Deadline; open: OpenModal }) {
  const { data } = useGarage();
  const status = {
    unknown: "History needed",
    unscheduled: "Inspection tracker",
    overdue: "Due for care",
    soon: "Coming up",
    current: "On schedule",
  }[due.state];
  return (
    <div className="care-row">
      <IconBox
        icon={
          due.task.id === "pressure" || due.task.id === "rotation"
            ? CircleDot
            : Wrench
        }
        tone={
          due.state === "overdue"
            ? "red"
            : due.state === "unknown"
              ? "amber"
              : "silver"
        }
      />
      <div className="care-row-main">
        <h3>{due.task.name}</h3>
        <p>
          {due.last
            ? `${due.date ? fmtDate(due.date) : ""}${due.date && due.meters ? " or " : ""}${due.meters ? formatDistance(due.meters, data.vehicle.unit) : ""}`
            : "Last completed: not recorded"}
        </p>
        <span className="care-interval">
          {intervalLabel(due.task, data.vehicle.unit)}
          {due.remainingMeters !== null
            ? ` · ${formatDistance(Math.max(0, due.remainingMeters), data.vehicle.unit)} remaining`
            : ""}
        </span>
      </div>
      <div className="care-row-end">
        <Badge
          tone={
            due.state === "overdue"
              ? "red"
              : due.state === "current"
                ? "green"
                : "amber"
          }
        >
          {status}
        </Badge>
        <button
          className="text-button"
          onClick={() => open({ type: "service", subject: due.task.id })}
        >
          Record
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}
export function Home({
  open,
  navigate,
}: {
  open: OpenModal;
  navigate: (tab: Tab, section?: string) => void;
}) {
  const { data, update } = useGarage();
  const unit = data.vehicle.unit,
    meters = displayMeters(data),
    confirmed = confirmedMeters(data) !== null;
  const consumption = weightedConsumption(fuelMeasurements(data.fuel));
  const month = dateInput(new Date()).slice(0, 7);
  const fuelSpend = data.fuel
    .filter(
      (f) =>
        f.currency === "USD" && f.date.startsWith(month) && f.cost !== null,
    )
    .reduce((s, f) => s + f.cost!, 0);
  const expenseRecords = [
    ...data.history
      .filter(
        (h) =>
          h.currency === "USD" && h.date.startsWith(month) && h.cost !== null,
      )
      .map((h) => h.cost!),
    ...data.fuel
      .filter(
        (f) =>
          f.currency === "USD" && f.date.startsWith(month) && f.cost !== null,
      )
      .map((f) => f.cost!),
  ];
  const tasks = careTasks(data);
  const relevant = tasks
    .map((t) => deadline(t, data))
    .filter((d) => d.state !== "unscheduled")
    .sort(
      (a, b) =>
        ({ overdue: 0, soon: 1, unknown: 2, current: 3, unscheduled: 4 })[
          a.state
        ] -
        { overdue: 0, soon: 1, unknown: 2, current: 3, unscheduled: 4 }[
          b.state
        ],
    )
    .slice(0, 3);
  const careComplete = tasks
    .filter((t) => t.official)
    .every((t) => {
      const due = deadline(t, data);
      return due.last && due.state === "current";
    });
  const distance = observedMonthlyDistance(data);
  return (
    <div className="page home-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">A LITTLE CARE. A LONG WAY.</span>
          <h1>
            Every mile, considered<span className="red-dot">.</span>
          </h1>
          <p>Your car. Perfectly cared for.</p>
        </div>
        <button
          className="button secondary desktop-add"
          onClick={() => open({ type: "service" })}
        >
          <Plus size={16} />
          Record service
        </button>
      </div>
      <section className="car-hero" aria-label="Your Mazda3 showcase">
        <div
          className="hero-photo"
          key={data.vehicle.photo || data.vehicle.photoIndex}
        >
          <img
            src={data.vehicle.photo || photos[data.vehicle.photoIndex]}
            alt="Your actual black 2019 Mazda3 Hatchback"
          />
        </div>
        <div className="hero-scrim" />
        <div className="hero-content">
          <Badge tone="glass">YOUR PERSONAL GARAGE</Badge>
          <p className="hero-year">
            {data.vehicle.specs.Year} ·{" "}
            {data.vehicle.specs.Manufacturer.toUpperCase()}
          </p>
          <h2>
            {data.vehicle.specs.Model.split(" ")[0]}
            <br />
            <span>
              {data.vehicle.specs.Model.replace(/^\S+\s*/, "").toUpperCase()}
            </span>
          </h2>
          <p className="hero-engine">
            {data.vehicle.specs.Engine.split(" naturally")[0]}
          </p>
          <div className="hero-color">
            <i />
            {data.vehicle.specs.Exterior}
            <span> / </span>
            {data.vehicle.specs.Interior} interior
          </div>
          <button
            className="hero-details"
            onClick={() => open({ type: "profile" })}
          >
            Explore your car
            <ArrowUpRight size={17} />
          </button>
        </div>
        <div className="hero-top-right">
          <MapPin size={13} />
          {data.vehicle.specs.Country}
        </div>
        <div className="hero-gallery">
          <button
            aria-label="Previous car photo"
            onClick={() =>
              void update((d) => {
                d.vehicle.photo = "";
                d.vehicle.photoIndex = (d.vehicle.photoIndex + 3) % 4;
              })
            }
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            {String(data.vehicle.photoIndex + 1).padStart(2, "0")}
            <i>/</i>04
          </span>
          <button
            aria-label="Next car photo"
            onClick={() =>
              void update((d) => {
                d.vehicle.photo = "";
                d.vehicle.photoIndex = (d.vehicle.photoIndex + 1) % 4;
              })
            }
          >
            <ChevronRight size={16} />
          </button>
          <button
            aria-label="Change car photograph"
            onClick={() => open({ type: "profile" })}
          >
            <Camera size={16} />
          </button>
        </div>
        <div className="hero-caption">
          <span className="tiny-line" />
          THE BEAUTY OF OWNERSHIP
        </div>
      </section>
      <div className="dashboard-stats">
        <button
          className="stat-card odometer-stat"
          onClick={() => open({ type: "mileage" })}
        >
          <div className="stat-label">
            CURRENT ODOMETER
            <Gauge size={17} />
          </div>
          <div className="stat-value">
            {meters === null
              ? "—"
              : `${!confirmed ? "~" : ""}${fromMeters(meters, unit).toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
            <span>{unit}</span>
          </div>
          <p>
            {confirmed
              ? "User-recorded reading"
              : "Approximate · confirm your reading"}
            <ArrowUpRight size={13} />
          </p>
        </button>
        <button
          className="stat-card care-stat"
          onClick={() => navigate("care")}
        >
          <div className="stat-label">
            CARE STATUS
            <ShieldCheck size={17} />
          </div>
          <div className="status-value">
            <i className={careComplete ? "green" : "amber"} />
            {careComplete ? "Recorded care current" : "History incomplete"}
          </div>
          <p>
            {careComplete
              ? "Based on your service records"
              : "Add records to build your care picture"}
            <ChevronRight size={13} />
          </p>
        </button>
        <Stat
          label="AVERAGE ECONOMY"
          value={
            consumption === null ? "—" : (235.214583 / consumption).toFixed(1)
          }
          unit="MPG"
          detail={
            consumption === null
              ? "Your first full-to-full cycle awaits"
              : "Measured · US gallons"
          }
          icon={Fuel}
        />
        <Stat
          label="THIS MONTH’S SPEND"
          value={
            expenseRecords.length
              ? money(expenseRecords.reduce((s, v) => s + v, 0))
              : "—"
          }
          detail={
            expenseRecords.length
              ? "Recorded expenses · USD only"
              : "A fresh start. No expenses recorded."
          }
          icon={Wallet}
        />
      </div>
      <div className="quick-actions">
        <span className="eyebrow">QUICK ADD</span>
        {[
          {
            label: "Log fuel",
            icon: Fuel,
            action: () => open({ type: "fuel" }),
          },
          {
            label: "Update mileage",
            icon: Gauge,
            action: () => open({ type: "mileage" }),
          },
          {
            label: "Record service",
            icon: Wrench,
            action: () => open({ type: "service" }),
          },
          {
            label: "Check tires",
            icon: CircleDot,
            action: () => navigate("care", "tires"),
          },
          {
            label: "Ask assistant",
            icon: Sparkles,
            action: () => navigate("assistant"),
          },
        ].map(({ label, icon: Icon, action }) => (
          <button key={label} onClick={action}>
            <Icon size={17} strokeWidth={1.5} />
            {label}
            <Plus size={13} />
          </button>
        ))}
      </div>
      <div className="dashboard-lower">
        <section className="panel maintenance-panel">
          <SectionTitle
            eyebrow="THE ROAD AHEAD"
            title="Upcoming care"
            action="View all"
            onAction={() => navigate("care")}
          />
          {relevant.map((d) => (
            <CareRow key={d.task.id} due={d} open={open} />
          ))}
          <div className="panel-foot">
            <ShieldCheck size={14} />
            <span>
              Scheduled from Mazda references. Grounded in your records.
            </span>
          </div>
        </section>
        <section className="panel tires-panel">
          <SectionTitle
            eyebrow="FOUR POINTS OF CONTACT"
            title="Tire check"
            action="Open center"
            onAction={() => navigate("care", "tires")}
          />
          <TireVisual compact open={open} />
          <div className="tire-reference">
            <span>
              <i className="status-dot amber" />
              Manual measurements
            </span>
            <span>{data.vehicle.pressure} PSI reference</span>
          </div>
        </section>
      </div>
      <div className="home-bottom">
        <button
          className="driving-card"
          onClick={() => open({ type: "learn", subject: "potholes" })}
        >
          <div className="driving-image">
            <img src="/images/mazda_rear.jpeg" alt="Rear view of your Mazda3" />
          </div>
          <div>
            <span className="eyebrow">MADE FOR YOUR ROADS</span>
            <h3>
              Protect the wheels.
              <br />
              Enjoy the drive.
            </h3>
            <p>A little know-how for Lebanon’s less predictable roads.</p>
            <span className="text-button">
              Explore driving care
              <ArrowUpRight size={15} />
            </span>
          </div>
        </button>
        <section className="panel small-insights">
          <SectionTitle
            eyebrow="OWNERSHIP, UNDERSTOOD"
            title="Your month, at a glance"
          />
          <div>
            <span>
              Recorded distance<span className="tiny-tag">OBSERVED</span>
            </span>
            <strong>{formatDistance(distance, unit)}</strong>
          </div>
          <div>
            <span>
              Fuel expenses<span className="tiny-tag">USD</span>
            </span>
            <strong>
              {data.fuel.some(
                (f) =>
                  f.date.startsWith(month) &&
                  f.cost !== null &&
                  f.currency === "USD",
              )
                ? money(fuelSpend)
                : "—"}
            </strong>
          </div>
          <button
            className="text-button"
            onClick={() => navigate("garage", "expenses")}
          >
            See ownership insights
            <ArrowUpRight size={14} />
          </button>
        </section>
      </div>
      <footer className="page-footer">
        <span>BUILT AROUND YOUR MAZDA.</span>
        <span>
          <ShieldCheck size={12} />
          Your records stay on this device.
        </span>
      </footer>
    </div>
  );
}
