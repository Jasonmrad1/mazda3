import { useState } from "react";
import {
  CircleDot,
  ShieldCheck,
  TriangleAlert,
  ChevronRight,
  ArrowUpRight,
} from "lucide-react";
import { useGarage } from "../lib/store";
import { pressureTo, fmtDate, localDate } from "../lib/calculations";
import { SectionTitle, Badge, Note, type OpenModal } from "../components/ui";
import type { Tire, GarageData } from "../lib/types";
import mazdaTopView from "../assets/mazda3-bp-top.png";
export function tireTone(t: Tire, d: GarageData) {
  if (t.condition.startsWith("Unsafe")) return "red";
  if (
    !d.vehicle.placardVerified ||
    t.psi === null ||
    !t.checked ||
    Date.now() - localDate(t.checked).getTime() > 30 * 86400000 ||
    t.condition.includes("damage —")
  )
    return "amber";
  return Math.abs(t.psi - d.vehicle.pressure) <= 1 ? "green" : "amber";
}
export function CarDiagram() {
  return <img className="car-diagram" src={mazdaTopView} alt="Top-view technical drawing of a 2019 Mazda3 BP hatchback" />;
}
export function TireVisual({
  compact = false,
  open,
}: {
  compact?: boolean;
  open: OpenModal;
}) {
  const { data } = useGarage();
  return (
    <div className={`tire-visual ${compact ? "compact" : ""}`}>
      <CarDiagram />
      {data.tires.map((t, i) => (
        <button
          key={t.position}
          className={`tire-node tire-${i} ${tireTone(t, data)}`}
          onClick={() => open({ type: "tire", position: i })}
        >
          <span className="tire-position">
            {compact ? ["FL", "FR", "RL", "RR"][i] : t.position}
          </span>
          <strong>
            {t.psi === null ? "—" : Number(t.psi.toFixed(1))}
            <small>PSI</small>
          </strong>
          <span className="tire-check">
            <i />
            {t.psi === null ? "Not checked" : "Recorded"}
          </span>
        </button>
      ))}
    </div>
  );
}
export function Tires({ open }: { open: OpenModal }) {
  const { data } = useGarage();
  const [unit, setUnit] = useState("PSI");
  return (
    <div className="tires-center">
      <div className="tire-quick-banner">
        <div>
          <span className="eyebrow">THE MONTHLY ROUTINE, MADE SIMPLE</span>
          <h3>All four tires. One quick log.</h3>
          <p>Cold pressures, recorded together. Details can come later.</p>
        </div>
        <button
          className="button primary"
          onClick={() => open({ type: "tire-check" })}
        >
          <CircleDot size={17} />
          Check all four tires
        </button>
      </div>
      <div className="two-columns">
        <section className="panel">
          <SectionTitle
            eyebrow="WHEEL & TIRE PROTECTION"
            title="Confidence at every corner"
          />
          <div className="tire-screen-meta">
            <Badge tone="amber">Manual measurements</Badge>
            <select
              aria-label="Pressure display unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            >
              <option>PSI</option>
              <option>bar</option>
              <option>kPa</option>
            </select>
          </div>
          <TireVisual open={open} />
          <p className="diagram-label">
            2019 MAZDA3 HATCHBACK · PLAN VIEW · SELECT A WHEEL TO RECORD A CHECK
          </p>
          <a className="diagram-source" href="https://www.dimensions.com/element/mazda3-hatchback-bp-4th-gen" target="_blank" rel="noreferrer">Mazda3 BP plan-view reference · Dimensions.com <ArrowUpRight size={11} /></a>
          <div className="pressure-reference">
            <ShieldCheck size={22} />
            <div>
              <strong>
                {pressureTo(data.vehicle.pressure, unit).toFixed(
                  unit === "bar" ? 2 : 0,
                )}{" "}
                {unit} · front & rear
              </strong>
              <p>
                {data.vehicle.placardVerified
                  ? "Confirmed against your door placard"
                  : "Reference only. Verify your driver’s door placard."}
              </p>
            </div>
            <button
              className="icon-button"
              aria-label="Configure tire placard reference"
              onClick={() => open({ type: "profile" })}
            >
              <ArrowUpRight size={18} />
            </button>
          </div>
        </section>
        <div className="wheel-details">
          {data.tires.map((t, i) => (
            <button
              className="panel wheel-card"
              key={t.position}
              onClick={() => open({ type: "tire", position: i })}
            >
              <div className="wheel-heading">
                <CircleDot size={22} />
                <h3>{t.position}</h3>
                <ChevronRight size={16} />
              </div>
              <div className="wheel-measures">
                <strong className={tireTone(t, data)}>
                  {t.psi === null
                    ? "—"
                    : pressureTo(t.psi, unit).toFixed(unit === "bar" ? 2 : 1)}
                  <span>{unit}</span>
                </strong>
                <span>
                  {t.tread === null
                    ? "Tread not entered"
                    : `${t.tread} mm tread`}
                  <small>{t.size}</small>
                </span>
              </div>
              <p>Last checked: {fmtDate(t.checked)}</p>
              <span className="wheel-condition">{t.condition}</span>
              {t.manufactured &&
                new Date(t.manufactured) <
                  new Date(
                    new Date().getFullYear() - 6,
                    new Date().getMonth(),
                    new Date().getDate(),
                  ) && (
                  <p className="amber">
                    Age check needed · confirm tire maker’s guidance
                  </p>
                )}
              {t.tread !== null && t.tread <= 1.6 && (
                <p className="red">
                  Very low recorded tread · arrange professional inspection
                </p>
              )}
            </button>
          ))}
        </div>
      </div>
      <Note>
        Green means a recent manual pressure is within 1 PSI of your confirmed
        reference. Amber means verify the reading, reference or condition. Red
        indicates a condition you explicitly recorded as unsafe. These colors
        are not a mechanical safety assessment.
      </Note>
      <SectionTitle
        eyebrow="FOR THE ROADS YOU DRIVE"
        title="A little tire knowledge goes a long way"
      />
      <div className="education-grid">
        {[
          {
            id: "tires",
            title: "Cold readings, clear answers",
            text: "When to measure, and which pressure to trust.",
          },
          {
            id: "potholes",
            title: "After a hard impact",
            text: "Sidewalls, wheels, vibration and the next safe step.",
          },
          {
            id: "long-trip",
            title: "Ready for the long way",
            text: "A thoughtful check before your next trip.",
          },
        ].map((a) => (
          <button
            className="panel education-card"
            key={a.id}
            onClick={() => open({ type: "learn", subject: a.id })}
          >
            <CircleDot size={22} />
            <h3>{a.title}</h3>
            <p>{a.text}</p>
            <ArrowUpRight size={18} />
          </button>
        ))}
      </div>
    </div>
  );
}
