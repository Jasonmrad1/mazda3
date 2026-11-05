import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "src/data/officialFuelPrices.json");
const endpoint = "https://www.energyandwater.gov.lb/ajax/pricesCtrl.php";
const form = (page) =>
  new URLSearchParams({
    action: "RenderPrices",
    priceTypeId: "1",
    page: String(page),
    fromDate: "",
    toDate: "",
  });
const headers = {
  accept: "application/json, text/javascript, */*; q=0.01",
  "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
  "x-requested-with": "XMLHttpRequest",
  origin: "https://www.energyandwater.gov.lb",
  referer: "https://www.energyandwater.gov.lb/ar/prices?type=1",
};
const months = new Map([
  ["كانون الثاني", "01"],
  ["كانون ثاني", "01"],
  ["كانون الأول", "12"],
  ["كانون اول", "12"],
  ["شباط", "02"],
  ["آذار", "03"],
  ["اذار", "03"],
  ["نيسان", "04"],
  ["أيار", "05"],
  ["ايار", "05"],
  ["حزيران", "06"],
  ["تموز", "07"],
  ["آب", "08"],
  ["اب", "08"],
  ["أيلول", "09"],
  ["ايلول", "09"],
  ["تشرين الأول", "10"],
  ["تشرين أول", "10"],
  ["تشرين اول", "10"],
  ["تشرين الثاني", "11"],
  ["تشرين ثاني", "11"],
]);

function strip(value) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDate(value) {
  const match = value.match(/(?:,\s*)?(\d{1,2})\s+(.+?)\s+(\d{4})/u);
  if (!match) return null;
  const month = months.get(match[2].trim());
  if (!month) return null;
  return `${match[3]}-${month}-${match[1].padStart(2, "0")}`;
}

async function getPage(page) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: form(page),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Ministry returned HTTP ${response.status}`);
  return JSON.parse((await response.text()).replace(/^\uFEFF/, ""));
}

const saved = await readFile(output, "utf8").catch(() => "");
try {
  const first = await getPage(0);
  const lastPage = Math.max(
    0,
    ...Array.from(first.html.matchAll(/loadPrices\((\d+)/g), (match) =>
      Number(match[1]),
    ),
  );
  const pages = [first];
  for (let page = 1; page <= lastPage; page += 1) pages.push(await getPage(page));

  const records = new Map();
  for (const result of pages) {
    for (const row of result.html.matchAll(/<tr[^>]*>(.*?)<\/tr>/gis)) {
      const cells = [...row[1].matchAll(/<td[^>]*>(.*?)<\/td>/gis)].map(
        (cell) => strip(cell[1]),
      );
      if (cells.length < 3) continue;
      const date = parseDate(cells[0]);
      const lbpPer20L = Number(cells[2].replace(/[^\d]/g, ""));
      if (date && lbpPer20L > 0)
        records.set(date, { date, lbpPer20L });
    }
  }
  const history = [...records.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (history.length < 2) throw new Error("The Ministry history was incomplete");

  const dataset = {
    source: "Lebanon Ministry of Energy and Water",
    sourceUrl: "https://www.energyandwater.gov.lb/ar/prices?type=1",
    fuel: "95-octane gasoline",
    unit: "LBP per 20 liters",
    fetchedAt: new Date().toISOString(),
    latestPublishedDate: history.at(-1).date,
    records: history,
  };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(dataset, null, 2)}\n`);
  console.log(
    `Saved ${history.length} official 95-octane price records through ${dataset.latestPublishedDate}.`,
  );
} catch (error) {
  if (saved) {
    console.warn(`Could not refresh Ministry fuel prices: ${error.message}`);
    console.warn("Using the last saved official price snapshot.");
  } else {
    throw error;
  }
}
