import type { GarageData } from "./types";
import { articles } from "../data/knowledge";
import { careTasks } from "../data/maintenance";
import fuelPriceHistory from "../data/lebanonFuelHistory.json";
import {
  deadline,
  fuelMeasurements,
  weightedConsumption,
  confirmedMeters,
} from "./calculations";
export type Citation = {
  id: string;
  title: string;
  reference: string;
  url?: string;
  documentId?: string;
  page?: number;
  excerpt?: string;
};
const synonyms: Record<string, string> = {
  mpg: "fuel consumption economy",
  tyre: "tire pressure",
  tires: "tire pressure rotation",
  oil: "oil filter engine maintenance",
  service: "maintenance schedule",
  acc: "accessory ignition",
  battery: "battery electrical starting",
};
export function retrieve(query: string, data: GarageData): Citation[] {
  const terms = [
    ...new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(
          (t) =>
            t.length > 2 &&
            ![
              "the",
              "how",
              "what",
              "should",
              "with",
              "does",
              "can",
              "for",
              "this",
              "car",
              "my",
              "you",
              "and",
              "about",
            ].includes(t),
        ),
    ),
  ];
  for (const term of [...terms])
    for (const alias of (synonyms[term] ?? "").split(" "))
      if (alias && !terms.includes(alias)) terms.push(alias);
  const mechanical =
    /oil|engine|fluid|tire|tyre|pressure|brake|transmission|spark|coolant|wheel|service/i.test(
      query,
    );
  const pageNumber = query.match(/page\s*(\d+)/i)?.[1];
  const score = (text: string) =>
    terms.reduce((sum, t) => sum + (text.toLowerCase().includes(t) ? 1 : 0), 0);
  const candidates: { score: number; source: Omit<Citation, "id"> }[] = [];
  for (const a of articles) {
    const relevance = score(a.title + " " + a.keywords + " " + a.body);
    if (relevance)
      candidates.push({
        score: relevance,
        source: {
          title: a.title,
          reference: a.reference,
          url: a.source,
          excerpt: a.body,
        },
      });
  }
  for (const doc of data.documents) {
    if (
      mechanical &&
      (/nav|connect/i.test(doc.name) || doc.kind === "Navigation manual")
    )
      continue;
    doc.pages.forEach((page, index) => {
      if (pageNumber && index + 1 !== Number(pageNumber)) return;
      const relevance = score(page);
      if (!relevance && !pageNumber) return;
      // Return the matching passage, not just the first words of a PDF page.
      const lower = page.toLowerCase();
      const positions = terms
        .map((t) => lower.indexOf(t))
        .filter((i) => i >= 0);
      const start = Math.max(
        0,
        (positions.length ? Math.min(...positions) : 0) - 300,
      );
      candidates.push({
        score: relevance + score(doc.name),
        source: {
          title: doc.name,
          reference: `${doc.name} · PDF page ${index + 1}`,
          documentId: doc.id,
          page: index + 1,
          excerpt: page.slice(start, start + 5000),
        },
      });
    });
  }
  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((item, i) => ({ id: `S${i + 1}`, ...item.source }));
}
export function buildAssistantContext(data: GarageData, sources: Citation[]) {
  const measurements = fuelMeasurements(data.fuel),
    average = weightedConsumption(measurements);
  const bounded = <T>(items: T[]) => items.slice(-1000);
  return {
    recordedAt: new Date().toISOString(),
    vehicle: {
      specs: data.vehicle.specs,
      distanceUnit: data.vehicle.unit,
      drivingProfile: data.vehicle.driving,
      recommendedColdPsi: data.vehicle.pressure,
      placardVerified: data.vehicle.placardVerified,
    },
    odometer: {
      confirmedMeters: confirmedMeters(data),
      initialApproximateMeters: data.vehicle.initialMeters,
      readings: bounded(data.readings),
    },
    serviceHistory: bounded(data.history).map(
      ({ attachments, ...record }) => record,
    ),
    fuel: {
      entries: bounded(data.fuel),
      measuredCycles: measurements.length,
      averageLitersPer100Km: average,
      averageMpgUS: average === null ? null : 235.214583 / average,
      lebanon95OctaneReference: {
        source: fuelPriceHistory.liveSource,
        sourceUrl: fuelPriceHistory.liveSourceUrl,
        archiveSource: fuelPriceHistory.source,
        archiveSourceUrl: fuelPriceHistory.sourceUrl,
        unit: fuelPriceHistory.unit,
        latestPublishedDate: fuelPriceHistory.latestArchiveDate,
        latestArchivedRate: fuelPriceHistory.records.at(-1) ?? null,
        usdToLbpReference: 89750,
        note: "Dated app reference archive, not a live station quote. Use the latest live price if it is explicitly supplied. USD estimate uses the stated 89,750 LBP/USD reference rate.",
      },
    },
    tires: data.tires,
    reminders: bounded(data.reminders),
    maintenance: careTasks(data).map((task) => {
      const due = deadline(task, data);
      return {
        id: task.id,
        name: task.name,
        official: task.official,
        reason: task.reason,
        reference: task.reference,
        intervalMiles: task.miles,
        intervalMonths: task.months,
        intervalDays: task.days,
        status: due.state,
        nextDueDate: due.date,
        nextDueMeters: due.meters,
        lastService: due.last
          ? { date: due.last.date, meters: due.last.meters }
          : null,
      };
    }),
    documentCatalog: data.documents.map((d) => ({
      id: d.id,
      title: d.name,
      kind: d.kind,
      pages: d.pages.length,
    })),
    counts: {
      services: data.history.length,
      fuel: data.fuel.length,
      readings: data.readings.length,
      reminders: data.reminders.length,
    },
    contextLimits:
      "Up to 1000 records per list; all-time fuel metrics use every recorded fill. Manual sources contain retrieved passages only. VIN, photos, PDF bytes, and secret keys are excluded.",
    sources,
  };
}
