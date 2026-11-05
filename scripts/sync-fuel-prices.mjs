import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "src/data/lebanonFuelHistory.json");
const endpoint = "https://www.thefuelprice.com/Flb/en";

const saved = await readFile(output, "utf8").catch(() => "");
try {
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`TheFuelPrice returned HTTP ${response.status}`);
  const html = await response.text();
  const chart = html.match(/<script[^>]*id="chartData"[^>]*>([\s\S]*?)<\/script>/);
  if (!chart) throw new Error("TheFuelPrice chart data was missing");
  const series = JSON.parse(chart[1]).series.find((entry) => entry.name === "Gasoline 95");
  const history = series.data
    .map(([date, lbpPer20L]) => ({ date, lbpPer20L: Number(lbpPer20L) }))
    .filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry.date) && entry.lbpPer20L > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (history.length < 2) throw new Error("The historical price series was incomplete");

  const dataset = {
    source: "TheFuelPrice.com historical archive (reference data)",
    sourceUrl: endpoint,
    liveSource: "IPT weekly retail price page",
    liveSourceUrl: "https://www.iptgroup.com.lb/ipt/en/our-stations/fuel-prices",
    fuel: "95-octane gasoline",
    unit: "LBP per 20 liters",
    fetchedAt: new Date().toISOString(),
    latestArchiveDate: history.at(-1).date,
    records: history,
  };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(dataset, null, 2)}\n`);
  console.log(
    `Saved ${history.length} 95-octane archive records through ${dataset.latestArchiveDate}.`,
  );
} catch (error) {
  if (saved) {
    console.warn(`Could not refresh Ministry fuel prices: ${error.message}`);
    console.warn("Using the last saved official price snapshot.");
  } else {
    throw error;
  }
}
