import { test, expect } from "@playwright/test";
test("opens directly on the immersive monochrome hero and keeps garage tools reachable", async ({
  page,
}) => {
  await page.route("https://static.sketchfab.com/**", (r) => r.abort());
  await page.goto("/");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "MAZDA3", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Exterior", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const palette = await page
    .getByRole("button", { name: "Enter my garage", exact: true })
    .evaluate((el) => ({
      bg: getComputedStyle(el).backgroundColor,
      color: getComputedStyle(el).color,
    }));
  expect(palette.color).toBe("rgb(16, 16, 16)");
  await page
    .getByRole("button", { name: "Enter my garage", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Every mile, considered.", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Log fuel", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Log a fill-up");
});
test("applies black to all paint workflows before revealing the viewer and switches cabin without reloading", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = {
      initializations: 0,
      material: null as unknown,
      cameras: [] as unknown[],
    };
    (window as unknown as { viewerTest: typeof state }).viewerTest = state;
    (window as unknown as { Sketchfab: unknown }).Sketchfab = class {
      init(_id: string, options: { success: (api: unknown) => void }) {
        state.initializations++;
        let ready = () => {};
        const api = {
          start() {
            queueMicrotask(() => ready());
          },
          stop() {},
          addEventListener(_name: string, fn: () => void) {
            ready = fn;
          },
          getCameraLookAt(cb: (e: null, c: unknown) => void) {
            cb(null, { position: [20, -5, 5], target: [0, 0, 0] });
          },
          getMaterialList(cb: (e: null, m: unknown[]) => void) {
            cb(null, [
              {
                name: "body",
                stateSetID: 1,
                channels: {
                  DiffuseColor: {
                    enable: true,
                    color: [1, 0, 0],
                    texture: { id: "red" },
                  },
                  AlbedoPBR: { enable: true, color: [1, 0, 0] },
                  DiffusePBR: { color: [1, 0, 0] },
                  RoughnessPBR: { factor: 1 },
                  MetalnessPBR: { factor: 0 },
                },
              },
            ]);
          },
          setMaterial(m: unknown, cb?: () => void) {
            state.material = m;
            cb?.();
          },
          setBackground() {},
          setEnableCameraConstraints() {},
          setFov() {},
          setCameraLookAt(position: unknown, target: unknown) {
            state.cameras.push({ position, target });
          },
        };
        options.success(api);
      }
    };
  });
  await page.goto("/");
  await expect(page.locator("iframe.ready")).toBeVisible();
  const paint = await page.evaluate(
    () =>
      (
        window as unknown as {
          viewerTest: {
            material: {
              channels: Record<string, { color: number[]; texture?: unknown }>;
            };
          };
        }
      ).viewerTest.material.channels,
  );
  for (const channel of ["DiffuseColor", "AlbedoPBR", "DiffusePBR"])
    expect(paint[channel].color).toEqual([0.006, 0.006, 0.006]);
  expect(paint.DiffuseColor.texture).toBeUndefined();
  await page.getByRole("button", { name: "Interior", exact: true }).click();
  await page.getByRole("button", { name: "Rear cabin", exact: true }).click();
  const state = await page.evaluate(
    () =>
      (
        window as unknown as {
          viewerTest: {
            initializations: number;
            cameras: { position: number[] }[];
          };
        }
      ).viewerTest,
  );
  expect(state.initializations).toBe(1);
  expect(state.cameras.at(-1)?.position).toEqual([0.0035, 0.012, 0.009]);
});
test("phone showroom has a working compact menu with no horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("https://static.sketchfab.com/**", (r) => r.abort());
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "MAZDA3", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Open showroom menu", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Showroom mobile navigation" })
    .getByRole("button", { name: "Care", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ahead of the next mile." }),
  ).toBeVisible();
});
