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
  return (
    <svg className="car-diagram" viewBox="0 0 150 300" aria-hidden="true">
      <defs>
        <linearGradient id="body" x1="0" x2="1">
          <stop offset="0" stopColor="#181f28" />
          <stop offset="0.45" stopColor="#3d4653" />
          <stop offset="0.6" stopColor="#353e49" />
          <stop offset="1" stopColor="#151c24" />
        </linearGradient>
        <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#101820" />
          <stop offset="1" stopColor="#242e39" />
        </linearGradient>
      </defs>
      <ellipse cx="75" cy="158" rx="65" ry="137" fill="#000" opacity=".25" />
      <path
        d="M32 30Q75 7 118 30L126 68L126 237Q122 267 110 275Q75 289 40 275Q28 268 24 237L24 68Z"
        fill="url(#body)"
        stroke="#59616b"
        strokeWidth="1"
      />
      <path
        d="M32 71Q75 47 118 71L110 111Q75 98 40 111Z"
        fill="url(#glass)"
        stroke="#626a75"
        strokeWidth=".8"
      />
      <path
        d="M40 119Q75 107 110 119L112 211Q75 225 38 211Z"
        fill="#252d37"
        stroke="#49515e"
      />
      <path
        d="M39 222Q75 236 111 222L115 251Q75 272 35 251Z"
        fill="url(#glass)"
        stroke="#5c6370"
      />
      <path
        d="M32 87L32 235M118 87L118 235M75 31V56"
        stroke="#7d8796"
        opacity=".3"
      />
      <path
        d="M35 38L53 34M97 34L115 38"
        stroke="#d9d9cb"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M34 262L48 267M102 267L116 262"
        stroke="#9e2431"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <rect
        x="16"
        y="77"
        width="8"
        height="39"
        rx="3"
        fill="#101419"
        stroke="#4b5360"
      />
      <rect
        x="126"
        y="77"
        width="8"
        height="39"
        rx="3"
        fill="#101419"
        stroke="#4b5360"
      />
      <rect
        x="16"
        y="216"
        width="8"
        height="39"
        rx="3"
        fill="#101419"
        stroke="#4b5360"
      />
      <rect
        x="126"
        y="216"
        width="8"
        height="39"
        rx="3"
        fill="#101419"
        stroke="#4b5360"
      />
    </svg>
  );
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
            Illustrative vehicle diagram · select a wheel to record a check
          </p>
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
