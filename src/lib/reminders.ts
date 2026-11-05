import type { GarageData } from "./types";
import { careTasks } from "../data/maintenance";
import {
  deadline,
  confirmedMeters,
  localDate,
  addMonths,
  dateInput,
} from "./calculations";
export interface Alert {
  id: string;
  title: string;
  detail: string;
  urgent: boolean;
  date: string | null;
  taskId: string;
}
export function dueAlerts(d: GarageData, now = new Date()): Alert[] {
  const result: Alert[] = [];
  for (const t of careTasks(d)) {
    const override = d.reminders.find((r) => r.taskId === t.id);
    if (
      override &&
      (override.status !== "active" ||
        (override.date && localDate(override.date) > now))
    )
      continue;
    const due = deadline(t, d, now);
    if (due.state === "overdue" || due.state === "soon")
      result.push({
        id: "task-" + t.id,
        title: t.name,
        detail:
          due.state === "overdue"
            ? "Due by a recorded time or odometer threshold."
            : "Approaching a recorded care deadline.",
        urgent: due.state === "overdue",
        date: due.date ? dateInput(due.date) : null,
        taskId: t.id,
      });
  }
  const meter = confirmedMeters(d);
  for (const r of d.reminders.filter((r) => r.status === "active")) {
    if (
      (r.date && localDate(r.date) <= now) ||
      (r.meters !== null && meter !== null && meter >= r.meters)
    ) {
      if (!result.some((a) => a.taskId && a.taskId === r.taskId))
        result.push({
          id: r.id,
          title: r.title,
          detail: "Your custom reminder is due.",
          urgent: true,
          date: r.date || null,
          taskId: r.taskId,
        });
    }
  }
  const suppressed = d.reminders.some(
    (r) =>
      r.taskId === "pressure" &&
      (r.status !== "active" || (r.date && localDate(r.date) > now)),
  );
  const pressureDue = d.tires.some(
    (t) => !t.checked || addMonths(localDate(t.checked), 1) <= now,
  );
  if (
    pressureDue &&
    !suppressed &&
    !result.some((r) => r.taskId === "pressure")
  )
    result.push({
      id: "monthly-pressure",
      title: "Check cold tire pressures",
      detail:
        "A monthly check is missing or due. No live tire data is connected.",
      urgent: false,
      date: null,
      taskId: "pressure",
    });
  return result;
}
export async function sendBrowserAlerts(d: GarageData) {
  if (
    !d.settings.notifications ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  )
    return;
  const day = dateInput(new Date());
  for (const a of dueAlerts(d)) {
    const key = `garage-notified-${a.id}-${day}`;
    if (localStorage.getItem(key)) continue;
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration)
      await registration.showNotification(a.title, {
        body: a.detail,
        icon: "/icon-192.png",
        tag: a.id,
      });
    else
      new Notification(a.title, {
        body: a.detail,
        icon: "/icon-192.png",
        tag: a.id,
      });
    localStorage.setItem(key, "1");
  }
}
