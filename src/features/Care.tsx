import { useState } from "react";
import {
  Plus,
  Search,
  CalendarDays,
  BookOpen,
  Bell,
  Clock,
  Check,
  Download,
} from "lucide-react";
import { useGarage } from "../lib/store";
import { careTasks, intervalLabel } from "../data/maintenance";
import {
  deadline,
  fmtDate,
  formatDistance,
  dateInput,
} from "../lib/calculations";
import { id } from "../lib/types";
import { dueAlerts } from "../lib/reminders";
import { exportCalendar } from "../lib/files";
import {
  Badge,
  SectionTitle,
  Note,
  Empty,
  type OpenModal,
} from "../components/ui";
import { CareRow } from "./Home";
import { Tires } from "./Tires";
export function Care({
  open,
  initialSection = "maintenance",
}: {
  open: OpenModal;
  initialSection?: string;
}) {
  const { data, update, toast } = useGarage();
  const [section, setSection] = useState(initialSection),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("All categories"),
    [showAll, setShowAll] = useState(false);
  const tasks = careTasks(data),
    alerts = dueAlerts(data);
  const categories = [
    "All categories",
    ...new Set(tasks.map((t) => t.category)),
  ];
  const filtered = tasks.filter(
    (t) =>
      (showAll ||
        query ||
        category !== "All categories" ||
        !!t.miles ||
        !!t.months ||
        !!t.days) &&
      (category === "All categories" || t.category === category) &&
      (t.name + " " + t.category).toLowerCase().includes(query.toLowerCase()),
  );
  const snooze = async (
    taskId: string,
    title: string,
    days: number,
    reminderId: string,
  ) => {
    await update((d) => {
      if (!taskId) {
        const existing = d.reminders.find((r) => r.id === reminderId);
        if (existing) {
          existing.date = dateInput(new Date(Date.now() + days * 86400000));
          existing.meters = null;
          existing.explanation = `Postponed ${days} days by owner`;
          return;
        }
      }
      d.reminders = d.reminders.filter((r) => r.taskId !== taskId || !taskId);
      d.reminders.push({
        id: id(),
        taskId,
        title,
        date: dateInput(new Date(Date.now() + days * 86400000)),
        meters: null,
        status: "active",
        explanation: `Postponed ${days} days by owner`,
      });
    });
    toast(`Reminder postponed ${days} days`);
  };
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">CARE THAT GOES THE DISTANCE</span>
          <h1>
            Ahead of the next mile<span className="red-dot">.</span>
          </h1>
          <p>Your maintenance, tires and reminders. All in one place.</p>
        </div>
        <button
          className="button primary"
          onClick={() =>
            open({ type: section === "reminders" ? "reminder" : "service" })
          }
        >
          <Plus size={16} />
          {section === "reminders" ? "New reminder" : "Record service"}
        </button>
      </div>
      <div className="tab-strip">
        {[
          { id: "maintenance", label: "Maintenance" },
          { id: "tires", label: "Tire & wheel center" },
          { id: "reminders", label: "Reminders" },
        ].map((t) => (
          <button
            className={section === t.id ? "active" : ""}
            key={t.id}
            onClick={() => setSection(t.id)}
          >
            {t.label}
            {t.id === "reminders" && <span>{alerts.length}</span>}
          </button>
        ))}
      </div>
      {section === "tires" ? (
        <Tires open={open} />
      ) : section === "reminders" ? (
        <>
          <div className="two-columns">
            <section className="panel">
              <SectionTitle
                eyebrow="YOUR NEXT SMALL STEPS"
                title="Care reminders"
                action="Add reminder"
                onAction={() => open({ type: "reminder" })}
              />
              {alerts.map((a) => (
                <div className="reminder-row" key={a.id}>
                  <Bell size={21} />
                  <div>
                    <h3>{a.title}</h3>
                    <p>{a.detail}</p>
                    <div className="inline-actions">
                      <button
                        className="text-button"
                        onClick={() =>
                          open({
                            type: a.taskId === "pressure" ? "tire" : "service",
                            subject: a.taskId,
                          })
                        }
                      >
                        Record check
                        <Check size={12} />
                      </button>
                      <button
                        className="text-button"
                        onClick={() => void snooze(a.taskId, a.title, 7, a.id)}
                      >
                        Snooze 7 days
                        <Clock size={12} />
                      </button>
                      <button
                        className="text-button muted"
                        onClick={() => {
                          const explanation = prompt(
                            "Why are you dismissing this reminder?",
                          );
                          if (!explanation) return;
                          void update((d) => {
                            if (a.taskId) {
                              d.reminders = d.reminders.filter(
                                (r) => r.taskId !== a.taskId,
                              );
                              d.reminders.push({
                                id: id(),
                                taskId: a.taskId,
                                title: a.title,
                                date: "",
                                meters: null,
                                status: "dismissed",
                                explanation,
                              });
                            } else {
                              const r = d.reminders.find((r) => r.id === a.id);
                              if (r) {
                                r.status = "dismissed";
                                r.explanation = explanation;
                              }
                            }
                          });
                        }}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {!alerts.length && (
                <Empty icon={Bell} title="A quiet moment in your garage">
                  No reminders are currently due. Unrecorded service history
                  still needs your attention.
                </Empty>
              )}
            </section>
            <section className="panel reminder-notes">
              <SectionTitle title="A reminder you can trust" />
              <Note>
                Odometer reminders use your latest confirmed manual reading.
                They do not track distance continuously.
              </Note>
              <p>
                Browser notifications are checked when the app opens or regains
                focus. For date alerts while the app is closed, add your care
                calendar to your calendar app.
              </p>
              <button
                className="button secondary"
                onClick={() => exportCalendar(data)}
              >
                <Download size={15} />
                Export care calendar
              </button>
              <button
                className="text-button"
                onClick={() => open({ type: "settings" })}
              >
                Notification settings
                <CalendarDays size={15} />
              </button>
            </section>
          </div>
          <section className="panel">
            <SectionTitle title="Your personal reminders" />
            {data.reminders.length ? (
              data.reminders.map((r) => (
                <div className="custom-reminder" key={r.id}>
                  <div>
                    <h3>
                      {r.title}
                      <Badge>{r.status}</Badge>
                    </h3>
                    <p>
                      {r.date ? fmtDate(r.date) : "No date"}
                      {r.meters !== null
                        ? " · " + formatDistance(r.meters, data.vehicle.unit)
                        : ""}
                    </p>
                    {r.explanation && <small>{r.explanation}</small>}
                  </div>
                  <div className="inline-actions">
                    {r.status === "active" && (
                      <button
                        className="text-button"
                        onClick={() =>
                          void update((d) => {
                            const record = d.reminders.find(
                              (e) => e.id === r.id,
                            )!;
                            record.status = "completed";
                          })
                        }
                      >
                        Complete
                        <Check size={13} />
                      </button>
                    )}
                    <button
                      className="text-button"
                      onClick={() =>
                        void update((d) => {
                          d.reminders = d.reminders.filter(
                            (e) => e.id !== r.id,
                          );
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">
                No personal reminders yet. Add insurance, registration or any
                date you want to remember.
              </p>
            )}
          </section>
        </>
      ) : (
        <>
          <div className="care-banner">
            <div>
              <Badge
                tone={data.vehicle.driving === "severe" ? "amber" : "muted"}
              >
                {data.vehicle.driving === "severe"
                  ? "Severe-driving oil schedule"
                  : "Normal driving profile"}
              </Badge>
              <h3>A few small steps. A better-kept Mazda.</h3>
              <p>
                Start with your oil service and tire checks. Add the history you
                know; your garage handles the next due dates.
              </p>
            </div>
            <button
              className="button secondary"
              onClick={() => open({ type: "profile" })}
            >
              Review driving profile
            </button>
          </div>
          <div className="filter-bar">
            <div className="search-field">
              <Search size={17} />
              <input
                aria-label="Search maintenance"
                placeholder="Find a maintenance item…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select
              aria-label="Maintenance category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <button
              className="button secondary"
              onClick={() => open({ type: "task" })}
            >
              <Plus size={15} />
              Custom task
            </button>
          </div>
          <div className="maintenance-list">
            {filtered.map((t) => {
              const due = deadline(t, data);
              return (
                <section className="panel maintenance-item" key={t.id}>
                  <CareRow due={due} open={open} />
                  <details className="task-explanation">
                    <summary>Why this matters & schedule details</summary>
                    <div className="task-detail">
                      <div>
                        <Badge tone={t.official ? "muted" : "amber"}>
                          {t.official
                            ? "Mazda schedule"
                            : t.reference.startsWith("User")
                              ? "Your custom schedule"
                              : "Advisory / tracking"}
                        </Badge>
                        <p>{t.reason}</p>
                        <span className="source-caption">{t.reference}</span>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => open({ type: "task", id: t.id })}
                      >
                        Customize interval
                      </button>
                    </div>
                  </details>
                </section>
              );
            })}
          </div>
          {!query && category === "All categories" && (
            <button
              className="button secondary care-catalog-toggle"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll
                ? "Show essential care only"
                : `Show all ${tasks.length} care & inspection items`}
            </button>
          )}
          {!filtered.length && (
            <Empty icon={Search} title="No matching care items">
              Try another name or category.
            </Empty>
          )}
          <a
            href="/manuals/2019-mazda3-maintenance.pdf"
            target="_blank"
            rel="noreferrer"
            className="reference-banner"
          >
            <BookOpen size={20} />
            <div>
              <strong>A schedule with a source</strong>
              <span>
                2019 Mazda3 US Scheduled Maintenance · included offline PDF
              </span>
            </div>
            <Download size={18} />
          </a>
        </>
      )}
    </div>
  );
}
