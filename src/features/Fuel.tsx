import { useEffect, useState } from "react";
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
import fuelPriceHistory from "../data/lebanonFuelHistory.json";
const iptFuelPricesUrl = "https://www.iptgroup.com.lb/ipt/en/our-stations/fuel-prices";
export function Fuel({ open }: { open: OpenModal }) {
  const { data } = useGarage();
  const [unit, setUnit] = useState("MPG (US)"),
    [currency, setCurrency] = useState("USD"),
    [officialRange, setOfficialRange] = useState("12M"),
    [iptRate, setIptRate] = useState<{ date: string; lbpPer20L: number } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    fetch(iptFuelPricesUrl, { signal: controller.signal, credentials: "omit", cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("IPT fuel prices are unavailable");
        return response.text();
      })
      .then((html) => {
        const rate = html.match(/id="[^"]*tr95Octane"[\s\S]*?<strong[^>]*>([\d,]+)/i);
        const date = html.match(/Weekly Fuel Prices<\/strong><\/span>\s*<span[^>]*>(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})/i);
        if (!rate || !date) throw new Error("IPT price format was not recognized");
        setIptRate({ date: `${date[3]}-${date[2]}-${date[1]}`, lbpPer20L: Number(rate[1].replaceAll(",", "")) });
      })
      .catch(() => {
        // Keep the saved history available offline or if the retailer page changes.
      });
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);
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
  const paidPriceChart = data.fuel
    .filter((fill) => fill.cost !== null && fill.currency === currency && fill.liters > 0)
    .sort((a, b) => a.date.localeCompare(b.date) || a.meters - b.meters)
    .map((fill) => ({ label: fmtDate(fill.date).split(" ").slice(0, 2).join(" "), value: Number((fill.cost! / fill.liters).toFixed(3)) }));
  const latestArchive = fuelPriceHistory.records.at(-1)!;
  const latestRate = iptRate ?? latestArchive;
  const archiveWithLiveRate = iptRate && iptRate.date >= latestArchive.date
    ? [...fuelPriceHistory.records.filter((record) => record.date !== iptRate.date), iptRate].sort((a, b) => a.date.localeCompare(b.date))
    : fuelPriceHistory.records;
  const rangeStart = new Date(`${latestRate.date}T12:00:00Z`);
  if (officialRange !== "ALL") {
    if (officialRange === "7D") {
      rangeStart.setUTCDate(rangeStart.getUTCDate() - 7);
    } else {
      const months = Number.parseInt(officialRange, 10);
      if (Number.isFinite(months))
        rangeStart.setUTCMonth(rangeStart.getUTCMonth() - months);
    }
  }
  const rangeCutoff = Number.isFinite(rangeStart.getTime())
    ? rangeStart.toISOString().slice(0, 10)
    : latestArchive.date;
  const officialChart = archiveWithLiveRate
    .filter((record) => officialRange === "ALL" || record.date >= rangeCutoff)
    .map((record) => ({
      label: new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${record.date}T12:00:00Z`)),
      value: record.lbpPer20L,
    }));
  const officialDate = new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${latestRate.date}T12:00:00Z`));
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
      <section className="panel official-price-history">
        <div className="official-price-heading">
          <SectionTitle eyebrow="LEBANON FUEL REFERENCE · 95 OCTANE" title="Fuel prices in Lebanon" />
          <div className="official-price-latest">
            <strong>{latestRate.lbpPer20L.toLocaleString("en-US")} <small>LBP</small></strong>
            <span>{iptRate ? "IPT latest weekly rate" : "Saved archive rate"} · {officialDate} · per 20 liters</span>
          </div>
        </div>
        <div className="official-price-chart-head">
          <p className="fuel-price-caption">{iptRate ? "The latest weekly 95-octane rate loads directly from IPT while online." : "IPT could not be reached; showing the saved historical archive rate."} The chart uses TheFuelPrice.com’s historical reference archive, with the current IPT point shown when newer. Check the station for its actual pump price.</p>
          <div className="official-price-ranges" aria-label="Chart time range">
            {[{ id: "7D", label: "1 week" }, { id: "12M", label: "12 months" }, { id: "24M", label: "2 years" }, { id: "ALL", label: "All history" }].map((range) => <button key={range.id} className={officialRange === range.id ? "active" : ""} aria-pressed={officialRange === range.id} onClick={() => setOfficialRange(range.id)}>{range.label}</button>)}
          </div>
        </div>
        <TrendChart data={officialChart} unit="LBP per 20 liters" seriesName={iptRate ? "IPT + reference archive" : "Reference archive"} />
        <div className="fuel-reference-links">
          <a className="text-button official-price-source" href={iptFuelPricesUrl} target="_blank" rel="noreferrer">IPT weekly fuel prices <ArrowUpRight size={15} /></a>
          <a className="text-button official-price-source" href={fuelPriceHistory.sourceUrl} target="_blank" rel="noreferrer">TheFuelPrice historical archive <ArrowUpRight size={15} /></a>
          <a className="text-button official-price-source" href="https://www.energyandwater.gov.lb/ar/prices?type=1" target="_blank" rel="noreferrer">Ministry schedule <ArrowUpRight size={15} /></a>
        </div>
      </section>
      <section className="panel fuel-price-history">
        <div className="fuel-price-heading">
          <SectionTitle eyebrow="YOUR RECORDED PURCHASES" title="Your price per liter" />
          <a className="text-button" href="https://www.energyandwater.gov.lb/ar/prices?type=1" target="_blank" rel="noreferrer">Official Lebanon fuel schedule <ArrowUpRight size={15} /></a>
        </div>
        <p className="fuel-price-caption">Calculated from your saved fill-ups and their recorded totals. USD and LBP are graphed separately. The Ministry publishes its rates in LBP per 20 liters; check its official site for the latest dated schedule.</p>
        {paidPriceChart.length ? <TrendChart data={paidPriceChart} unit={`${currency} / liter`} /> : <Empty icon={TrendingUp} title="Your pump-price history starts with a fill-up" action="Log fuel" onAction={() => open({ type: "fuel" })}>Record the amount you paid and liters added. A separate price trend will appear here.</Empty>}
      </section>
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
