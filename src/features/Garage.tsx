import { useState } from "react";
import {
  Plus,
  Download,
  Search,
  FileText,
  Wallet,
  ChevronRight,
  ArrowUpRight,
  Wrench,
  Fuel,
  Camera,
  CarFront,
  ShieldCheck,
  Clock,
  Trash2,
} from "lucide-react";
import { useGarage } from "../lib/store";
import { photos, type Currency } from "../lib/types";
import {
  fmtDate,
  money,
  formatDistance,
  dateInput,
  displayMeters,
} from "../lib/calculations";
import { exportCsv, exportPdf, exportBackup, download } from "../lib/files";
import {
  SectionTitle,
  Stat,
  Empty,
  Badge,
  Note,
  type OpenModal,
} from "../components/ui";
import { TrendChart } from "../components/Chart";
export function Garage({
  open,
  initialSection = "overview",
}: {
  open: OpenModal;
  initialSection?: string;
}) {
  const { data, update, toast } = useGarage();
  const [section, setSection] = useState(initialSection),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All records"),
    [currency, setCurrency] = useState<Currency>("USD"),
    [period, setPeriod] = useState("year");
  const expenses = [
    ...data.history
      .filter((h) => h.cost !== null && h.currency === currency)
      .map((h) => ({ date: h.date, category: h.category, cost: h.cost! })),
    ...data.fuel
      .filter((f) => f.cost !== null && f.currency === currency)
      .map((f) => ({ date: f.date, category: "Fuel", cost: f.cost! })),
  ];
  const month = dateInput(new Date()).slice(0, 7),
    year = month.slice(0, 4),
    annual = expenses.filter(
      (e) => e.date.startsWith(year) && e.category !== "Vehicle purchase",
    ),
    monthly = expenses.filter(
      (e) => e.date.startsWith(month) && e.category !== "Vehicle purchase",
    );
  const purchase = expenses.filter((e) => e.category === "Vehicle purchase");
  const running = expenses.filter((e) => e.category !== "Vehicle purchase");
  const rows = [
    ...data.history.map((h) => ({
      ...h,
      type: h.category,
      kind: "service" as const,
    })),
    ...data.fuel.map((f) => ({
      id: f.id,
      title: `Fuel · ${f.liters.toFixed(1)} liters`,
      date: f.date,
      meters: f.meters,
      cost: f.cost,
      currency: f.currency,
      provider: f.station,
      notes: f.notes,
      attachments: [] as string[],
      type: "Fuel",
      kind: "fuel" as const,
    })),
  ]
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || (b.meters ?? 0) - (a.meters ?? 0),
    )
    .filter(
      (e) =>
        (filter === "All records" || e.type === filter) &&
        (e.title + " " + e.notes + " " + e.provider)
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
  const chartMonths =
    period === "year"
      ? Array.from({ length: 12 }, (_, i) => ({
          key: `${year}-${String(i + 1).padStart(2, "0")}`,
          label: new Date(Number(year), i, 1).toLocaleDateString("en", {
            month: "short",
          }),
        }))
      : Array.from({ length: 5 }, (_, i) => ({
          key: String(Number(year) - 4 + i),
          label: String(Number(year) - 4 + i),
        }));
  const chart = chartMonths.map((m) => ({
    label: m.label,
    value: running
      .filter((e) => e.date.startsWith(m.key))
      .reduce((s, e) => s + e.cost, 0),
  }));
  const distribution = Object.entries(
    running.reduce<Record<string, number>>(
      (s, e) => ({ ...s, [e.category]: (s[e.category] ?? 0) + e.cost }),
      {},
    ),
  ).sort((a, b) => b[1] - a[1]);
  const allMeters = data.readings.map((r) => r.meters),
    distance =
      allMeters.length >= 2
        ? Math.max(...allMeters) - Math.min(...allMeters)
        : 0;
  const minDate = data.readings.length
    ? [...data.readings].sort((a, b) => a.date.localeCompare(b.date))[0].date
    : null;
  const trackedCosts = minDate
    ? running
        .filter((e) => e.date >= minDate.slice(0, 10))
        .reduce((s, e) => s + e.cost, 0)
    : 0;
  const costPerKm =
    distance > 0 && trackedCosts > 0 ? trackedCosts / (distance / 1000) : null;
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">MORE THAN A CAR</span>
          <h1>
            Your ownership story<span className="red-dot">.</span>
          </h1>
          <p>Every detail, every record, every mile along the way.</p>
        </div>
        <button
          className="button secondary"
          onClick={() => open({ type: "profile" })}
        >
          <CarFront size={17} />
          Edit vehicle
        </button>
      </div>
      <div className="tab-strip">
        {[
          { id: "overview", label: "My vehicle" },
          { id: "timeline", label: "Vehicle history" },
          { id: "expenses", label: "Ownership costs" },
          { id: "documents", label: "Documents" },
        ].map((t) => (
          <button
            className={section === t.id ? "active" : ""}
            onClick={() => setSection(t.id)}
            key={t.id}
          >
            {t.label}
          </button>
        ))}
      </div>
      {section === "overview" ? (
        <>
          <section className="profile-overview panel">
            <img
              src={data.vehicle.photo || photos[data.vehicle.photoIndex]}
              alt="Your black Mazda3"
            />
            <div>
              <span className="eyebrow">YOUR PERSONAL GARAGE</span>
              <h2>
                {data.vehicle.specs.Year} {data.vehicle.specs.Model}
              </h2>
              <p>{data.vehicle.specs.Trim}</p>
              <Badge tone="muted">
                {data.vehicle.specs.Exterior} · {data.vehicle.specs.Interior}{" "}
                interior
              </Badge>
              <div className="profile-overview-actions">
                <button
                  className="button primary"
                  onClick={() => open({ type: "profile" })}
                >
                  <Camera size={16} />
                  Customize your car
                </button>
                <button
                  className="button secondary"
                  onClick={() => setSection("timeline")}
                >
                  See the history
                  <ArrowUpRight size={16} />
                </button>
              </div>
            </div>
          </section>
          <div className="two-columns">
            <section className="panel">
              <SectionTitle
                title="The details that make it yours"
                action="Edit details"
                onAction={() => open({ type: "profile" })}
              />
              <dl className="spec-list">
                {Object.entries(data.vehicle.specs)
                  .filter(
                    ([k]) => !["Equipment", "Unverified equipment"].includes(k),
                  )
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v || "Not entered"}</dd>
                    </div>
                  ))}
                <div>
                  <dt>VIN</dt>
                  <dd>
                    {data.vehicle.vin
                      ? "•••••••••••••" + data.vehicle.vin.slice(-4)
                      : "Not entered · private"}
                  </dd>
                </div>
              </dl>
            </section>
            <div>
              <section className="panel equipment-panel">
                <SectionTitle title="Thoughtfully equipped" />
                <div className="equipment-list">
                  {data.vehicle.specs.Equipment.split(";").map((e) => (
                    <div key={e}>
                      <ShieldCheck size={15} />
                      {e.trim()}
                    </div>
                  ))}
                </div>
                <Note>{data.vehicle.specs["Unverified equipment"]}</Note>
              </section>
              <section className="panel ownership-links">
                <SectionTitle title="Keep the full picture" />
                {[
                  {
                    label: "Vehicle history",
                    icon: Clock,
                    section: "timeline",
                  },
                  {
                    label: "Ownership costs",
                    icon: Wallet,
                    section: "expenses",
                  },
                  {
                    label: "Private documents",
                    icon: FileText,
                    section: "documents",
                  },
                ].map((l) => (
                  <button key={l.section} onClick={() => setSection(l.section)}>
                    <l.icon size={18} />
                    {l.label}
                    <ChevronRight size={16} />
                  </button>
                ))}
              </section>
            </div>
          </div>
        </>
      ) : section === "timeline" ? (
        <>
          <div className="filter-bar">
            <div className="search-field">
              <Search size={17} />
              <input
                aria-label="Search history"
                placeholder="Search your vehicle history…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select
              aria-label="History category"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              {[
                "All records",
                ...new Set([...data.history.map((h) => h.category), "Fuel"]),
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <button
              className="button primary"
              onClick={() => open({ type: "service" })}
            >
              <Plus size={15} />
              Add record
            </button>
          </div>
          <div className="export-toolbar">
            <span>
              {data.history.length + data.fuel.length} ownership records
            </span>
            <div>
              <button className="text-button" onClick={() => exportCsv(data)}>
                <Download size={14} />
                CSV
              </button>
              <button
                className="text-button"
                onClick={() =>
                  void exportPdf(data).catch(() =>
                    toast("PDF export failed. Please retry."),
                  )
                }
              >
                <Download size={14} />
                PDF
              </button>
              <button
                className="text-button"
                onClick={() => exportBackup(data)}
              >
                <Download size={14} />
                Backup
              </button>
            </div>
          </div>
          {rows.length ? (
            <div className="timeline">
              {rows.map((r, i) => (
                <div className="timeline-entry" key={r.id}>
                  {(i === 0 ||
                    r.date.slice(0, 7) !== rows[i - 1].date.slice(0, 7)) && (
                    <h3 className="timeline-month">
                      {new Date(r.date).toLocaleDateString("en-GB", {
                        month: "long",
                        year: "numeric",
                      })}
                    </h3>
                  )}
                  <div className="timeline-record panel">
                    <div className="timeline-dot">
                      {r.kind === "fuel" ? (
                        <Fuel size={19} />
                      ) : (
                        <Wrench size={19} />
                      )}
                    </div>
                    <button
                      className="timeline-record-main"
                      onClick={() => open({ type: r.kind, id: r.id })}
                    >
                      <div>
                        <span className="eyebrow">
                          {fmtDate(r.date)} · {r.type}
                        </span>
                        <h3>{r.title}</h3>
                        <p>
                          {formatDistance(r.meters, data.vehicle.unit)}
                          {r.provider ? " · " + r.provider : ""}
                        </p>
                        {r.notes && <p className="record-notes">{r.notes}</p>}
                      </div>
                      <div>
                        <strong>
                          {r.cost === null ? "—" : money(r.cost, r.currency)}
                        </strong>
                        <ChevronRight size={17} />
                      </div>
                    </button>
                    {r.attachments.length > 0 && (
                      <div className="record-attachments">
                        {r.attachments.map((id) => {
                          const doc = data.documents.find((d) => d.id === id);
                          return doc ? (
                            <button
                              className="text-button"
                              key={id}
                              onClick={() => download(doc.data, doc.name)}
                            >
                              <FileText size={13} />
                              {doc.name}
                            </button>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <section className="panel">
              <Empty
                icon={Clock}
                title={
                  query ? "No matching records" : "Your story is ready to begin"
                }
                action="Add your first record"
                onAction={() => open({ type: "service" })}
              >
                Service, repairs, fuel, insurance and the small details of
                ownership—kept together, privately.
              </Empty>
            </section>
          )}
          {data.readings.length > 0 && (
            <section className="panel odometer-history">
              <SectionTitle title="Odometer log" />
              <p className="muted">
                Corrections are validated against other dated records. Edit
                linked service or fuel entries from the history above.
              </p>
              {[...data.readings]
                .sort(
                  (a, b) => b.date.localeCompare(a.date) || b.meters - a.meters,
                )
                .map((r) => (
                  <div className="document-row" key={r.id}>
                    <div>
                      <strong>
                        {formatDistance(r.meters, data.vehicle.unit)}
                      </strong>
                      <small>
                        {fmtDate(r.date)} · {r.reason} · original{" "}
                        {r.original.toLocaleString()} {r.unit}
                      </small>
                    </div>
                    {!data.history.some((h) => h.id === r.id) &&
                      !data.fuel.some((f) => f.id === r.id) && (
                        <button
                          className="icon-button"
                          title="Remove incorrect manual reading"
                          onClick={() => {
                            if (
                              confirm("Remove this incorrect manual reading?")
                            )
                              void update((d) => {
                                d.readings = d.readings.filter(
                                  (e) => e.id !== r.id,
                                );
                              });
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                  </div>
                ))}
            </section>
          )}
        </>
      ) : section === "expenses" ? (
        <>
          <div className="fuel-intro">
            <span>OWNERSHIP, WITHOUT THE GUESSWORK</span>
            <div>
              <select
                aria-label="Expense currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
              >
                <option>USD</option>
                <option>LBP</option>
              </select>
              <button
                className="button primary"
                onClick={() => open({ type: "expense" })}
              >
                <Plus size={15} />
                Add expense
              </button>
            </div>
          </div>
          <div className="dashboard-stats">
            <Stat
              label="TOTAL RUNNING COSTS"
              value={
                running.length
                  ? money(
                      running.reduce((s, e) => s + e.cost, 0),
                      currency,
                    )
                  : "—"
              }
              detail="Recorded ownership expenses"
              icon={Wallet}
            />
            <Stat
              label="THIS MONTH"
              value={
                monthly.length
                  ? money(
                      monthly.reduce((s, e) => s + e.cost, 0),
                      currency,
                    )
                  : "—"
              }
              detail="Recorded expenses this month"
              icon={Wallet}
            />
            <Stat
              label="THIS YEAR"
              value={
                annual.length
                  ? money(
                      annual.reduce((s, e) => s + e.cost, 0),
                      currency,
                    )
                  : "—"
              }
              detail="Calendar-year recorded expenses"
              icon={Wallet}
            />
            <Stat
              label="RECORDED COST / KM"
              value={costPerKm === null ? "—" : money(costPerKm, currency)}
              detail={
                costPerKm === null
                  ? "More distance and cost records needed"
                  : "Partial view · logged costs over observed distance"
              }
              icon={Wallet}
            />
          </div>
          <div className="two-columns">
            <section className="panel">
              <SectionTitle title="The cost of the journey" />
              <div className="segmented">
                <button
                  className={period === "year" ? "active" : ""}
                  onClick={() => setPeriod("year")}
                >
                  Monthly
                </button>
                <button
                  className={period === "years" ? "active" : ""}
                  onClick={() => setPeriod("years")}
                >
                  Annual
                </button>
              </div>
              {running.length ? (
                <TrendChart data={chart} unit={currency} bar />
              ) : (
                <Empty
                  icon={Wallet}
                  title="Make ownership costs visible"
                  action="Add an expense"
                  onAction={() => open({ type: "expense" })}
                >
                  Your actual spending will appear here. No sample expenses or
                  estimates are added.
                </Empty>
              )}
            </section>
            <section className="panel">
              <SectionTitle title="Where it goes" />
              {distribution.length ? (
                distribution.map(([category, value], i) => (
                  <div className="distribution-row" key={category}>
                    <div>
                      <span>
                        <i
                          style={{
                            background: [
                              "#5d5d5d",
                              "#aaaaaa",
                              "#898989",
                              "#858585",
                              "#808080",
                            ][i % 5],
                          }}
                        />
                        {category}
                      </span>
                      <strong>{money(value, currency)}</strong>
                    </div>
                    <div className="distribution-track">
                      <i
                        style={{
                          width:
                            (value /
                              (running.reduce((s, e) => s + e.cost, 0) || 1)) *
                              100 +
                            "%",
                          background: [
                            "#5d5d5d",
                            "#aaaaaa",
                            "#898989",
                            "#858585",
                            "#808080",
                          ][i % 5],
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">
                  Add expenses to see a category breakdown.
                </p>
              )}
              <Note>
                Fuel and service entries are included automatically. USD and LBP
                remain separate. Missing costs are never treated as zero-cost
                services.
              </Note>
            </section>
          </div>
          <section className="panel">
            <SectionTitle title="Purchases & recurring costs" />
            <div className="custom-reminder">
              <div>
                <h3>One-time vehicle purchases</h3>
                <p>Kept separate from running costs and efficiency charts.</p>
              </div>
              <strong>
                {purchase.length
                  ? money(
                      purchase.reduce((s, e) => s + e.cost, 0),
                      currency,
                    )
                  : "Not entered"}
              </strong>
            </div>
            {data.history
              .filter(
                (h) =>
                  h.recurring &&
                  h.recurring !== "none" &&
                  h.currency === currency,
              )
              .map((h) => (
                <div className="custom-reminder" key={h.id}>
                  <div>
                    <h3>
                      {h.title}
                      <Badge>{h.recurring}</Badge>
                    </h3>
                    <p>
                      Recurring label only; future expenses are not generated.
                    </p>
                  </div>
                  <strong>
                    {h.cost === null ? "Not entered" : money(h.cost, currency)}
                  </strong>
                </div>
              ))}
          </section>
        </>
      ) : (
        <section className="panel">
          <SectionTitle
            eyebrow="ON THIS DEVICE. IN YOUR CONTROL."
            title="Your document vault"
            action="Manage documents"
            onAction={() => open({ type: "documents" })}
          />
          {data.documents.length ? (
            <div className="document-grid">
              {data.documents.map((doc) => (
                <div className="document-tile" key={doc.id}>
                  <FileText size={30} />
                  <h3>{doc.name}</h3>
                  <p>
                    {fmtDate(doc.added)} ·{" "}
                    {doc.pages.length
                      ? `${doc.pages.length} searchable pages`
                      : "Local file"}
                  </p>
                  <button
                    className="text-button"
                    onClick={() => download(doc.data, doc.name)}
                  >
                    Download
                    <Download size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              icon={FileText}
              title="A home for the important things"
              action="Add your first document"
              onAction={() => open({ type: "documents" })}
            >
              Keep invoices, insurance, registration and manuals together. Files
              sync to your private account and remain available offline here.
            </Empty>
          )}
          <Note>
            Your account keeps a synced copy. This device keeps an offline copy;
            export a backup when needed and keep your device secure.
          </Note>
        </section>
      )}
    </div>
  );
}
