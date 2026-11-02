import { test, expect, type Page } from "@playwright/test";

const lightLabel = "Светлая тема — Мята";
const darkLabel = "Тёмная тема — Космос";

async function openAppearance(page: Page, signedIn = false) {
  await page.getByRole("button", { name: signedIn ? "Меню профиля" : "Настройки оформления", exact: true }).click();
  await expect(page.getByRole("group", { name: "Тема оформления" })).toBeVisible();
}

test("Cosmos is default and explicit Mint persists across navigation, reload and tabs", async ({ page, context }) => {
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await openAppearance(page);
  await page.getByRole("button", { name: lightLabel, exact: true }).click();
  await expect(page.getByRole("button", { name: lightLabel, exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("link", { name: "Зарегистрироваться", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const other = await context.newPage();
  await other.goto("/login");
  await expect(other.locator("html")).toHaveAttribute("data-theme", "light");
  await openAppearance(other);
  await other.getByRole("button", { name: darkLabel, exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await other.evaluate(() => localStorage.removeItem("episyhub.theme.v1"));
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await other.close();
});

test("theme switch works with keyboard and Escape even if storage is blocked", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error("Storage blocked"); };
    Storage.prototype.setItem = () => { throw new Error("Storage blocked"); };
  });
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await openAppearance(page);
  const mint = page.getByRole("button", { name: lightLabel, exact: true });
  await mint.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(mint).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("group", { name: "Тема оформления" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Настройки оформления", exact: true })).toBeFocused();
});

for (const width of [320, 390, 1280, 1440, 1640]) {
  test(`profile appearance menu and wider search fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/auth/session", route => route.fulfill({ json: { user: { id: "theme-ui", username: "alex" }, expires: "2099-01-01" } }));
    await page.route("**/api/popcorn", route => route.fulfill({ json: { popcorn: 1240 } }));
    await page.goto("/login");
    await expect(page.getByRole("link", { name: "🍿 1240", exact: true })).toBeVisible();
    await expect(page.getByRole("group", { name: "Тема оформления" })).toHaveCount(0);
    if (width >= 1280) {
      const search = page.locator("header input[type='search']");
      await expect(search).toBeVisible();
      expect((await search.boundingBox())!.width).toBeGreaterThanOrEqual(width >= 1440 ? 320 : 280);
    }
    await openAppearance(page, true);
    for (const label of [lightLabel, darkLabel]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      await expect(page.getByRole("button", { name: label, exact: true })).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.getByRole("group", { name: "Тема оформления" }).getByRole("button")).toHaveCount(2);
    }
    await page.getByRole("button", { name: darkLabel, exact: true }).focus();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Меню профиля", exact: true })).toBeFocused();
  });
}

test("a saved Mint preference is respected on first load", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("episyhub.theme.v1", "light"));
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await openAppearance(page);
  await expect(page.getByRole("button", { name: lightLabel, exact: true })).toHaveAttribute("aria-pressed", "true");
});
