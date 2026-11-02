import { test, expect } from "@playwright/test";

const lightLabel = "Светлая тема — Мята";
const darkLabel = "Тёмная тема — Космос";

test("theme persists through navigation and reload, and synchronizes between tabs", async ({ page, context }) => {
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: darkLabel, exact: true }).click();
  await expect(page.getByRole("button", { name: darkLabel, exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("link", { name: "Зарегистрироваться", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const other = await context.newPage();
  await other.goto("/login");
  await expect(other.locator("html")).toHaveAttribute("data-theme", "dark");
  await other.getByRole("button", { name: lightLabel, exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await other.close();
});

test("theme switch works with keyboard even if storage is blocked", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error("Storage blocked"); };
    Storage.prototype.setItem = () => { throw new Error("Storage blocked"); };
  });
  await page.goto("/login");
  const dark = page.getByRole("button", { name: darkLabel, exact: true });
  await dark.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(dark).toHaveAttribute("aria-pressed", "true");
});

for (const width of [320, 390, 1440]) {
  test(`both themes fit the header at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/auth/session", route => route.fulfill({ json: { user: { id: "theme-ui", username: "alex" }, expires: "2099-01-01" } }));
    await page.route("**/api/popcorn", route => route.fulfill({ json: { popcorn: 1240 } }));
    await page.goto("/login");
    await expect(page.getByRole("link", { name: "🍿 1240", exact: true })).toBeVisible();
    for (const label of [darkLabel, lightLabel]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      await expect(page.getByRole("button", { name: label, exact: true })).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const buttons = page.getByRole("group", { name: "Тема оформления" }).getByRole("button");
      await expect(buttons).toHaveCount(2);
    }
  });
}
