import { test, expect, type Page } from "@playwright/test";
import { statisticsFixture } from "./fixtures/statistics";
async function setup(
  page: Page,
  options: { premium?: boolean; empty?: boolean; failure?: boolean } = {},
) {
  const requests: string[] = [];
  await page.route("**/api/**", (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === "/api/auth/session")
      return route.fulfill({
        json: {
          user: { id: "stats-user", username: "stats_user", name: "Зритель" },
          expires: "2099-01-01",
        },
      });
    if (u.pathname === "/api/account")
      return route.fulfill({
        json: {
          owner: false,
          moderate: false,
          curate: false,
          beta: false,
          badges: [],
          premium: {
            active: options.premium !== false,
            until: "2099-01-01",
            balance: 2000,
            bonusTenths: 0,
            price: 2000,
          },
        },
      });
    if (u.pathname === "/api/site-theme")
      return route.fulfill({ json: { theme: null } });
    if (u.pathname === "/api/statistics") {
      requests.push(u.search);
      if (options.failure)
        return route.fulfill({
          status: 503,
          json: { error: "Не удалось загрузить статистику" },
        });
      return route.fulfill({
        json: statisticsFixture(
          Number(u.searchParams.get("days")) || 30,
          options.empty,
        ),
      });
    }
    return route.fulfill({ json: {} });
  });
  return requests;
}
for (const width of [320, 390, 1440])
  test(`statistics layout, chart details and theme colors at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await setup(page);
    await page.goto("/statistics");
    await expect(
      page.getByRole("heading", { name: "Ваша статистика просмотров" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Календарь активности" }),
    ).toBeVisible();
    const heat = page.getByRole("button", { name: /фильмов, .*серий,/ });
    await expect(heat).toHaveCount(365);
    await heat.last().focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByText("7 ноября 2026 г.", { exact: false }).first(),
    ).toBeAttached();
    await page.getByLabel("Группировка динамики").selectOption("years");
    await expect(
      page.getByRole("button", { name: /2026: .* ч/ }).first(),
    ).toBeVisible();
    await page
      .getByRole("group", { name: "Группировка активности" })
      .getByRole("button", { name: "Дни", exact: true })
      .click();
    await expect(
      page
        .getByRole("group", { name: "Группировка активности" })
        .getByRole("button", { name: "Дни", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    for (const theme of ["dark", "light", "autumn-2026", "obsidian"]) {
      await page.evaluate((t) => {
        document.documentElement.dataset.theme =
          t === "light" || t === "autumn-2026" ? "light" : "dark";
        document.documentElement.dataset.siteTheme = t;
      }, theme);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (theme === "dark" || theme === "autumn-2026") {
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({
          path: `/workspace/work/statistics-${width}-${theme}.png`,
          fullPage: true,
        });
      }
    }
  });
test("period selection sends browser timezone, replaces the report, and supports all three ranges", async ({
  page,
}) => {
  const calls = await setup(page);
  await page.goto("/statistics");
  await expect(
    page.getByRole("heading", { name: "Календарь активности" }),
  ).toBeVisible();
  for (const days of [90, 365, 30]) {
    await page
      .getByRole("button", { name: `${days} дней`, exact: true })
      .click();
    await expect
      .poll(() =>
        calls.some((q) => new URLSearchParams(q).get("days") === String(days)),
      )
      .toBe(true);
    await expect(
      page.getByRole("heading", { name: "Календарь активности" }),
    ).toBeVisible();
  }
  expect(calls.every((q) => !!new URLSearchParams(q).get("timeZone"))).toBe(
    true,
  );
});
test("empty statistics avoid invented averages, personal ratings and percentile", async ({
  page,
}) => {
  await setup(page, { empty: true });
  await page.goto("/statistics");
  await expect(page.getByText("Начало вашей истории")).toBeVisible();
  await expect(
    page.getByText("Отметьте первый просмотр — здесь появятся ваши жанры."),
  ).toBeVisible();
  await expect(
    page.getByText("Оцените фильм или сериал, чтобы увидеть распределение."),
  ).toBeVisible();
  await expect(
    page.getByText("Пока нет данных", { exact: true }),
  ).toBeVisible();
});
test("non-Premium accounts do not request private statistics", async ({
  page,
}) => {
  const calls = await setup(page, { premium: false });
  await page.goto("/statistics");
  await expect(page.getByRole("link", { name: "О Premium →" })).toBeVisible();
  expect(calls).toHaveLength(0);
});
test("failed statistics can be retried", async ({ page }) => {
  const options = { failure: true };
  await setup(page, options);
  await page.goto("/statistics");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Не удалось загрузить статистику" }),
  ).toContainText("Не удалось загрузить статистику");
  options.failure = false;
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Календарь активности" }),
  ).toBeVisible();
});
