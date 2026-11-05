import { test, expect } from "@playwright/test";
async function begin(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Personalize your garage", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Explore first", exact: true })
    .click();
}
test("essential care stays short and full inspection catalog remains reachable", async ({
  page,
}) => {
  await begin(page);
  await page.goto("/?tab=care");
  await expect(page.locator(".maintenance-item")).toHaveCount(6);
  await expect(
    page.getByText("Automatic transmission fluid", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: /Show all .* care & inspection/ })
    .click();
  expect(await page.locator(".maintenance-item").count()).toBeGreaterThan(35);
  await expect(
    page.getByText("Automatic transmission fluid", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Show essential care only", exact: true })
    .click();
  await expect(page.locator(".maintenance-item")).toHaveCount(6);
});
test("all four tire measurements save in one short form with no invented mileage", async ({
  page,
}) => {
  await begin(page);
  await page.getByRole("button", { name: "Check tires", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Four tires. One quick check.",
  );
  for (let i = 0; i < 4; i++)
    await page
      .locator(`dialog input[name=pressure-${i}]`)
      .fill(String(35 + i * 0.5));
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/?tab=care&section=tires");
  await expect(page.locator(".tire-node strong")).toHaveText([
    "35PSI",
    "35.5PSI",
    "36PSI",
    "36.5PSI",
  ]);
  await page.goto("/?tab=garage&section=timeline");
  await expect(
    page.getByText("tire pressure inspection", { exact: false }),
  ).toHaveCount(4);
  await expect(page.getByText("Odometer log", { exact: true })).toHaveCount(0);
});
test("short fuel form keeps optional information available", async ({
  page,
}) => {
  await begin(page);
  await page.getByRole("button", { name: "Log fuel", exact: true }).click();
  await expect(page.locator("dialog input[name=liters]")).toBeVisible();
  await expect(page.locator("dialog input[name=pricePerLiter]")).toBeHidden();
  await page
    .getByText("Price per liter, driving & notes (optional)", { exact: true })
    .click();
  await expect(page.locator("dialog input[name=pricePerLiter]")).toBeVisible();
});
test("switching miles and kilometers preserves the newly entered odometer", async ({
  page,
}) => {
  await begin(page);
  await page
    .getByRole("button", { name: "Update mileage", exact: true })
    .click();
  await page.locator("dialog input[name=odometer]").fill("32050");
  await page
    .getByRole("dialog")
    .getByRole("combobox", { name: "Distance unit" })
    .selectOption("km");
  await expect(page.locator("dialog input[name=odometer]")).toHaveValue(
    "51579.475",
  );
  await page
    .getByRole("dialog")
    .getByRole("combobox", { name: "Distance unit" })
    .selectOption("mi");
  await expect(page.locator("dialog input[name=odometer]")).toHaveValue(
    "32050",
  );
  await page.getByRole("button", { name: "Save reading", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("32,050", { exact: false })).toBeVisible();
});
test("3D hero has an offline photo fallback", async ({ page, context }) => {
  let requests = 0;
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "onLine", { get: () => false }),
  );
  page.on("request", (r) => {
    if (r.url().includes("sketchfab")) requests++;
  });
  await begin(page);
  expect(requests).toBe(0);
  await context.setOffline(true);
  await expect(
    page.getByText("Your photos are always here.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Reference model by", { exact: false }),
  ).toBeVisible();
  expect(requests).toBe(0);
  await page
    .getByRole("button", { name: "Back to my photos", exact: true })
    .click();
  await expect(page.locator(".hero-photo img")).toBeVisible();
});
test("3D connection errors give a usable fallback and model-source links", async ({
  page,
}) => {
  await page.route("https://static.sketchfab.com/**", (route) => route.abort());
  await begin(page);
  await expect(
    page.getByText("The 3D studio could not connect.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Ddiaz Design · Sketchfab/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Back to my photos", exact: true })
    .click();
  await expect(page.locator(".hero-photo img")).toBeVisible();
});
