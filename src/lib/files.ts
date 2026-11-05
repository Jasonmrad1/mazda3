import { id, type Document, type GarageData } from "./types";
import { careTasks } from "../data/maintenance";
import { deadline, formatDistance, fmtDate, dateInput } from "./calculations";
export function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(Error("File could not be read."));
    r.readAsDataURL(file);
  });
}
export function download(data: Blob | string, name: string) {
  if (
    typeof data === "string" &&
    !/^data:(application\/pdf|image\/(jpeg|png|webp|gif|avif));base64,/.test(
      data,
    )
  )
    throw Error("Unsupported file type.");
  const url = typeof data === "string" ? data : URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  if (typeof data !== "string")
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export async function importDocument(
  file: File,
  kind = "Document",
): Promise<Document> {
  if (file.size > 15 * 1024 * 1024)
    throw Error("Choose a file smaller than 15 MB.");
  if (!file.type.startsWith("image/") && file.type !== "application/pdf")
    throw Error("Choose a PDF or image.");
  const pages: string[] = [];
  if (file.type === "application/pdf") {
    const pdfjs = await import("pdfjs-dist");
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const task = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
    });
    const pdf = await task.promise;
    try {
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        pages.push(
          content.items
            .map((item) => ("str" in item ? item.str : ""))
            .join(" "),
        );
        page.cleanup();
      }
    } finally {
      await task.destroy();
    }
  }
  return {
    id: id(),
    name: file.name,
    data: await readFile(file),
    kind,
    pages,
    added: new Date().toISOString(),
  };
}
export function exportBackup(d: GarageData) {
  const safe = structuredClone(d);
  safe.vehicle.vin = "";
  download(
    new Blob([JSON.stringify(safe, null, 2)], { type: "application/json" }),
    `my-garage-backup-${dateInput(new Date())}.json`,
  );
}
const csvCell = (v: unknown) => {
  let value = String(v ?? "");
  if (/^[=+@\-\t\r]/.test(value)) value = "'" + value;
  return '"' + value.replaceAll('"', '""') + '"';
};
export function exportCsv(d: GarageData) {
  const rows: unknown[][] = [
    [
      "Date",
      "Type",
      "Title",
      "Odometer (meters)",
      "Cost",
      "Currency",
      "Provider",
      "Notes",
    ],
  ];
  [
    ...d.history.map((h) => [
      h.date,
      h.category,
      h.title,
      h.meters,
      h.cost ?? "",
      h.currency,
      h.provider,
      h.notes,
    ]),
    ...d.fuel.map((f) => [
      f.date,
      "Fuel",
      `${f.liters} L · ${f.full ? "full" : "partial"}`,
      f.meters,
      f.cost ?? "",
      f.currency,
      f.station,
      f.notes,
    ]),
  ]
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    .forEach((r) => rows.push(r));
  download(
    new Blob(
      ["\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    ),
    "my-garage-history.csv",
  );
}
export async function exportPdf(d: GarageData) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF();
  let y = 24;
  const ascii = (s: string) =>
    s.replace(/[–—·]/g, "-").replace(/[^\x20-\x7E\n]/g, "");
  pdf.setFontSize(23);
  pdf.text("MY GARAGE", 18, y);
  y += 10;
  pdf.setFontSize(11);
  pdf.text(
    ascii(`${d.vehicle.specs.Year} ${d.vehicle.specs.Model} | Service history`),
    18,
    y,
  );
  y += 8;
  pdf.setFontSize(9);
  pdf.text(
    "User-entered records. This report does not certify mechanical condition.",
    18,
    y,
  );
  y += 12;
  const records = [
    ...d.history.map((h) => ({
      date: h.date,
      title: h.title,
      meters: h.meters,
      detail: `${h.category} | ${h.cost === null ? "Cost not entered" : `${h.cost} ${h.currency}`} | ${h.provider}\n${h.notes}`,
    })),
    ...d.fuel.map((f) => ({
      date: f.date,
      title: `Fuel - ${f.liters} L (${f.full ? "full" : "partial"})`,
      meters: f.meters,
      detail: `${f.cost === null ? "Cost not entered" : `${f.cost} ${f.currency}`} | ${f.station}\n${f.notes}`,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  if (!records.length)
    pdf.text("No ownership records have been entered.", 18, y);
  for (const r of records) {
    const lines = pdf.splitTextToSize(ascii(r.detail), 170) as string[];
    const height = 20 + lines.length * 4;
    if (y + height > 277) {
      pdf.addPage();
      y = 22;
    }
    pdf.setFontSize(11);
    pdf.text(ascii(r.title), 18, y);
    y += 6;
    pdf.setFontSize(9);
    pdf.text(
      `${fmtDate(r.date)} | ${formatDistance(r.meters, d.vehicle.unit)}`,
      18,
      y,
    );
    y += 5;
    pdf.text(lines, 18, y);
    y += lines.length * 4 + 9;
  }
  pdf.save("my-garage-service-history.pdf");
}
export function exportCalendar(d: GarageData) {
  const escape = (s: string) =>
    s
      .replaceAll("\\", "\\\\")
      .replaceAll("\n", "\\n")
      .replaceAll(",", "\\,")
      .replaceAll(";", "\\;");
  const stamp =
    new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const events = careTasks(d)
    .map((t) => {
      const due = deadline(t, d);
      return due.date
        ? {
            id: t.id,
            title: t.name,
            date: dateInput(due.date),
            description:
              "Review recorded maintenance; odometer limits may be reached earlier.",
          }
        : null;
    })
    .filter((e) => e !== null);
  for (const r of d.reminders.filter((r) => r.status === "active" && r.date))
    events.push({
      id: r.id,
      title: r.title,
      date: r.date,
      description: r.explanation || "Personal vehicle reminder.",
    });
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//My Garage//Vehicle Care//EN",
    ...events.flatMap((e) => [
      "BEGIN:VEVENT",
      `UID:${e.id}@mygarage.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${e.date.replaceAll("-", "")}`,
      `SUMMARY:${escape(e.title)}`,
      `DESCRIPTION:${escape(e.description)}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT9H",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escape(e.title)}`,
      "END:VALARM",
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ].join("\r\n");
  download(
    new Blob([body], { type: "text/calendar" }),
    "my-garage-reminders.ics",
  );
}
