import { useState } from "react";
import {
  Fuel as FuelIcon,
  Plus,
  TrendingUp,
  Droplets,
  Route,
  Wallet,
  ArrowUpRight,
  ChevronRight,
  Info,
} from "lucide-react";
import { useGarage } from "../lib/store";
import {
  fuelMeasurements,
  weightedConsumption,
  money,
  dateInput,
  fmtDate,
  formatDistance,
  observedMonthlyDistance,
} from "../lib/calculations";
import {
  Stat,
  SectionTitle,
  Empty,
  Badge,
  Note,
  type OpenModal,
} from "../components/ui";
import { TrendChart } from "../components/Chart";
export function Fuel({ open }: { open: OpenModal }) {
  const { data } = useGarage();
  const [unit, setUnit] = useState("MPG (US)"),
    [currency, setCurrency] = useState("USD");
  const measurements = fuelMeasurements(data.fuel),
    l100 = weightedConsumption(measurements),
    month = dateInput(new Date()).slice(0, 7);
  const entries = data.fuel.filter(
      (f) =>
        f.date.startsWith(month) && f.currency === currency && f.cost !== null,
    ),
    monthSpend = entries.reduce((s, f) => s + f.cost!, 0);
  const value = (l: number) =>
    unit === "MPG (US)"
      ? 235.214583 / l
      : unit === "km/L"
        ? 100 / l
        : unit === "km / 20 L"
          ? 2000 / l
          : l;
  const chart = measurements.map((m) => ({
    label: fmtDate(m.to.date).split(" ").slice(0, 2).join(" "),
    value: value(m.l100),
  }));
  const priced = measurements.filter(
    (m) => m.cost !== null && m.to.currency === currency,
  );
  const cost100 = priced.length
    ? (priced.reduce((s, m) => s + m.cost!, 0) /
        priced.reduce((s, m) => s + m.km, 0)) *
      100
    : null;
  const best = measurements.length
      ? [...measurements].sort((a, b) => a.l100 - b.l100)[0]
      : null,
    worst = measurements.length
      ? [...measurements].sort((a, b) => b.l100 - a.l100)[0]
      : null;
  const first = data.fuel.length
    ? [...data.fuel].sort((a, b) => a.date.localeCompare(b.date))[0]
    : null;
  const days = first
    ? (Date.now() - new Date(first.date).getTime()) / 86400000
    : 0;
  const totalPriced = data.fuel.filter(
    (f) => f.currency === currency && f.cost !== null,
  );
  const annual =
    days >= 90 && totalPriced.length >= 3
      ? (totalPriced.reduce((s, f) => s + f.cost!, 0) / days) * 365
      : null;
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">MAKE EVERY LITER COUNT</span>
          <h1>
            A clearer picture of every tank<span className="red-dot">.</span>
          </h1>
          <p>Real fill-ups. Meaningful trends. No guesswork.</p>
        </div>
        <button
          className="button primary"
          onClick={() => open({ type: "fuel" })}
        >
          <Plus size={17} />
          Log fuel
        </button>
      </div>
      <div className="fuel-intro">
        <span>
          <FuelIcon size={17} />
          GASOLINE<span className="divider-dot">·</span>US GALLONS FOR MPG
        </span>
        <div>
          <select
            aria-label="Fuel economy unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            {["MPG (US)", "L/100 km", "km/L", "km / 20 L"].map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
          <select
            aria-label="Fuel currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            <option>USD</option>
            <option>LBP</option>
          </select>
        </div>
      </div>
      <div className="dashboard-stats">
        <Stat
          label="AVERAGE CONSUMPTION"
          value={l100 === null ? "—" : value(l100).toFixed(1)}
          unit={unit}
          detail={
            measurements.length
              ? `${measurements.length} measured full-to-full cycles`
              : "Two full fill-ups establish your first cycle"
          }
          icon={Droplets}
        />
        <Stat
          label="DISTANCE PER 20 L"
          value={l100 === null ? "—" : (2000 / l100).toFixed(0)}
          unit="km"
          detail="From measured tank consumption"
          icon={Route}
        />
        <Stat
          label="FUEL COST / 100 KM"
          value={cost100 === null ? "—" : money(cost100, currency)}
          detail={
            priced.length
              ? "Cycles with complete recorded prices"
              : "Complete cycle prices needed"
          }
          icon={Wallet}
        />
        <Stat
          label="THIS MONTH’S FUEL"
          value={entries.length ? money(monthSpend, currency) : "—"}
          detail={
            entries.length
              ? `${entries.length} priced fuel purchases`
              : "No priced fuel purchases this month"
          }
          icon={FuelIcon}
        />
      </div>
      <div className="two-columns fuel-chart-layout">
        <section className="panel">
          <SectionTitle
            eyebrow="THE BIGGER PICTURE"
            title="Your efficiency over time"
          />
          <div className="chart-legend">
            <i />
            {unit}
            <span>Measured full-to-full</span>
          </div>
          {chart.length ? (
            <TrendChart data={chart} unit={unit} />
          ) : (
            <Empty
              icon={TrendingUp}
              title="Your story starts with a fill-up"
              action="Log your first fill-up"
              onAction={() => open({ type: "fuel" })}
            >
              Fill to full, record the odometer, and do it again next time. Your
              first measured trend will appear here.
            </Empty>
          )}
        </section>
        <section className="panel fuel-guide">
          <div className="fuel-guide-symbol">
            <Droplets size={36} strokeWidth={1} />
          </div>
          <span className="eyebrow">BETTER DATA. BETTER INSIGHTS.</span>
          <h2>The full-to-full method.</h2>
          <p>
            Start with a full tank. At your next full fill, your garage divides
            fuel added by the distance traveled.
          </p>
          <p>
            Partial fills in between count toward that cycle. They never become
            an exact measurement on their own.
          </p>
          <button
            className="text-button"
            onClick={() => open({ type: "learn", subject: "fuel" })}
          >
            Understand your fuel economy
            <ArrowUpRight size={15} />
          </button>
        </section>
      </div>
      <div className="three-columns fuel-extra">
        <div className="panel">
          <span className="eyebrow">BEST MEASURED CYCLE</span>
          <h3>
            {best
              ? `${value(best.l100).toFixed(1)} ${unit}`
              : "Waiting for real data"}
          </h3>
          <p>{best ? fmtDate(best.to.date) : "No measured cycles yet."}</p>
        </div>
        <div className="panel">
          <span className="eyebrow">HIGHEST CONSUMPTION CYCLE</span>
          <h3>
            {worst
              ? `${value(worst.l100).toFixed(1)} ${unit}`
              : "Every road has a context"}
          </h3>
          <p>
            {worst
              ? fmtDate(worst.to.date)
              : "Traffic and mountains can change a tank."}
          </p>
        </div>
        <div className="panel">
          <span className="eyebrow">ANNUAL FUEL ESTIMATE</span>
          <h3>
            {annual === null ? "More history needed" : money(annual, currency)}
          </h3>
          <p>
            {annual === null
              ? "At least 90 days and 3 priced fills."
              : "Estimate from recorded spending, not a forecast."}
          </p>
        </div>
      </div>
      <section className="panel fuel-history">
        <SectionTitle
          title="At the pump"
          action="Add fill-up"
          onAction={() => open({ type: "fuel" })}
        />
        {data.fuel.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Odometer</th>
                  <th>Liters</th>
                  <th>Total</th>
                  <th>Fill type</th>
                  <th>Driving</th>
                  <th>
                    <span className="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...data.fuel]
                  .sort(
                    (a, b) =>
                      b.date.localeCompare(a.date) || b.meters - a.meters,
                  )
                  .map((f) => (
                    <tr key={f.id}>
                      <td>{fmtDate(f.date)}</td>
                      <td>{formatDistance(f.meters, data.vehicle.unit)}</td>
                      <td>{f.liters.toFixed(2)} L</td>
                      <td>
                        {f.cost === null ? "—" : money(f.cost, f.currency)}
                      </td>
                      <td>
                        <Badge tone={f.full ? "green" : "amber"}>
                          {f.full ? "Full tank" : "Partial fill"}
                        </Badge>
                      </td>
                      <td>{f.terrain}</td>
                      <td>
                        <button
                          className="icon-button"
                          aria-label={`Edit fuel ${f.date}`}
                          onClick={() => open({ type: "fuel", id: f.id })}
                        >
                          <ChevronRight size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="table-empty">
            No fuel purchases yet. Your records will appear here.
          </p>
        )}
      </section>
      <Note>
        Fuel analytics describe recorded tank consumption. They do not estimate
        fuel level, instant MPG or live vehicle readings. USD and LBP totals
        stay separate; no exchange rate is assumed.
      </Note>
    </div>
  );
}
