import { test, expect } from "@playwright/test";
test("production app, records, real photographs and manual work offline", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore first", exact: true })
    .click();
  const ready = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return false;
    return await Promise.race([
      navigator.serviceWorker.ready.then(() => true),
      new Promise<boolean>((resolve) =>
        setTimeout(() => resolve(false), 10000),
      ),
    ]);
  });
  test.skip(
    !ready,
    "Production service worker is not enabled on the dev server.",
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Every mile, considered." }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByText("You’re offline.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Update mileage", exact: true })
    .click();
  await page.locator("dialog input[name=odometer]").fill("32500");
  await page.getByRole("button", { name: "Save reading", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("32,500", { exact: false })).toBeVisible();
  expect(
    await page
      .locator(".hero-photo img")
      .evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
  ).toBe(true);
  const pdf = await page.evaluate(async () => {
    const r = await fetch("/manuals/2019-mazda3-maintenance.pdf");
    return r.ok && (await r.blob()).size > 100000;
  });
  expect(pdf).toBe(true);
});
test("onboarding preserves an unknown odometer when skipped", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Make it yours", exact: true })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Enter my garage", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("History incomplete", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".odometer-stat .stat-value")).toHaveText("—mi");
});
test("custom reminders snooze and export calendar without false completion", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore first", exact: true })
    .click();
  await page.goto("/?tab=care&section=reminders");
  await page.getByRole("button", { name: "New reminder", exact: true }).click();
  await page.locator("dialog input[name=title]").fill("Renew insurance");
  await page.locator("dialog input[name=date]").fill("2026-01-01");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const alert = page
    .locator(".reminder-row")
    .filter({ hasText: "Renew insurance" });
  await expect(alert).toBeVisible();
  await alert
    .getByRole("button", { name: "Snooze 7 days", exact: true })
    .click();
  await expect(alert).toHaveCount(0);
  await expect(
    page.locator(".custom-reminder").filter({ hasText: "Renew insurance" }),
  ).toHaveCount(1);
  const file = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export care calendar", exact: true })
    .click();
  expect((await file).suggestedFilename()).toBe("my-garage-reminders.ics");
});
test("notification permission denial gives an actionable error", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "Notification", {
      value: class {
        static permission = "denied";
        static requestPermission() {
          return Promise.resolve("denied");
        }
      },
      configurable: true,
    });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore first", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open garage settings", exact: true })
    .click();
  await page.getByRole("button", { name: "Enable", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Permission was not granted",
  );
  await expect(page.getByRole("dialog")).toBeVisible();
});
test("invalid backup leaves current records intact", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore first", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open garage settings", exact: true })
    .click();
  page.on("dialog", (d) => d.accept());
  await page
    .locator('input[accept="application/json,.json"]')
    .setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"schema":2}'),
    });
  await expect(page.getByRole("alert")).toContainText("not a supported");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect(page.getByText("~32,000", { exact: false })).toBeVisible();
});
