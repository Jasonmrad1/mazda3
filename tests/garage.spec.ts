import { test, expect, type Page } from "@playwright/test";
async function begin(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Personalize your garage", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Explore first", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Every mile, considered." }),
  ).toBeVisible();
}
async function openFuel(page: Page) {
  await page.getByRole("button", { name: "Log fuel", exact: true }).click();
}
test("keeps empty states honest and mileage persistent", async ({ page }) => {
  await begin(page);
  await expect(
    page.getByText("History incomplete", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("~32,000", { exact: false })).toBeVisible();
  await page
    .getByRole("button", { name: "Update mileage", exact: true })
    .click();
  await page.locator("dialog input[name=odometer]").fill("32050");
  await page.getByRole("button", { name: "Save reading", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("32,050", { exact: false })).toBeVisible();
  await expect(page.getByText("User-recorded reading")).toBeVisible();
});
test("records oil service and recalculates next due thresholds", async ({
  page,
}) => {
  await begin(page);
  await page
    .getByRole("button", { name: "Record service", exact: true })
    .first()
    .click();
  await page.locator("dialog select[name=taskId]").selectOption("oil");
  await page.locator("dialog input[name=odometer]").fill("32000");
  await page.locator("dialog input[name=cost]").fill("65");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Showroom navigation" })
    .getByRole("button", { name: "Care", exact: true })
    .click();
  await expect(
    page.getByText("42,000 mi", { exact: false }).first(),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("42,000 mi", { exact: false }).first(),
  ).toBeVisible();
});
test("records all four manual tire pressures without inventing odometer", async ({
  page,
}) => {
  await begin(page);
  await page.goto("/?tab=care&section=tires");
  for (const [i, position] of [
    "Front left",
    "Front right",
    "Rear left",
    "Rear right",
  ].entries()) {
    await page.locator(`.tire-node.tire-${i}`).click();
    await page.locator("dialog input[name=psi]").fill("36");
    await page
      .getByRole("button", { name: "Save record", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await page.reload();
  await expect(page.locator(".tire-node strong")).toHaveText([
    "36PSI",
    "36PSI",
    "36PSI",
    "36PSI",
  ]);
  await page.goto("/?tab=garage&section=timeline");
  await expect(
    page.getByText("tire pressure inspection", { exact: false }),
  ).toHaveCount(4);
  await expect(page.getByText("Odometer log", { exact: true })).toHaveCount(0);
});
test("handles full and partial fuel fills accurately", async ({ page }) => {
  await begin(page);
  const entries = [
    { odo: "32000", liters: "40", date: "2026-01-01", full: true },
    { odo: "32100", liters: "10", date: "2026-01-02", full: false },
    { odo: "32300", liters: "25", date: "2026-01-03", full: true },
  ];
  for (const e of entries) {
    await openFuel(page);
    await page.locator("dialog input[name=odometer]").fill(e.odo);
    await page.locator("dialog input[name=date]").fill(e.date);
    await page.locator("dialog input[name=liters]").fill(e.liters);
    await page.locator("dialog input[name=full]").setChecked(e.full);
    await page
      .getByRole("button", { name: "Save fill-up", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await page.goto("/?tab=fuel");
  await expect(page.locator(".stat-value").first()).toContainText("32.4");
  await expect(page.getByText("Partial fill", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator("tbody tr")).toHaveCount(3);
});
test("exports complete service CSV and PDF", async ({ page }) => {
  await begin(page);
  await page.goto("/?tab=garage&section=timeline");
  const csv = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV", exact: true }).click();
  expect((await csv).suggestedFilename()).toBe("my-garage-history.csv");
  const pdf = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  expect((await pdf).suggestedFilename()).toBe("my-garage-service-history.pdf");
});
test("supports phone navigation, light mode and source-based answers", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await begin(page);
  await page.waitForTimeout(350);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("button", { name: "Assistant", exact: true })
    .click();
  await page
    .getByRole("button", { name: "When should I replace my oil?", exact: true })
    .click();
  await expect(
    page.getByText("No oil-change history has been entered", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open garage settings", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("combobox")
    .first()
    .selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.screenshot({ path: "tests/mobile-assistant.png", fullPage: true });
});
test("extracts searchable text from an imported official PDF", async ({
  page,
}) => {
  await begin(page);
  await page.goto("/?tab=assistant");
  await page.getByRole("button", { name: "Add manual", exact: true }).click();
  await page
    .locator("dialog input[type=file]")
    .setInputFiles("public/manuals/2019-mazda3-maintenance.pdf");
  await expect(
    page.getByText("7 searchable pages", { exact: false }),
  ).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page
    .getByRole("button", { name: "Your digital handbook", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Search handbook" })
    .fill("spark plug");
  await expect(
    page.getByText("From your uploaded manuals", { exact: true }),
  ).toBeVisible();
});
