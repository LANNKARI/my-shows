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

for (const width of [390, 1440])
  test(`changing the period preserves scroll and the library while only rhythm is loading at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    let release: () => void = () => {};
    let requested = false;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/statistics?**", async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("days") !== "90") return route.fallback();
      requested = true;
      await gate;
      const report = statisticsFixture(90);
      report.totals.minutes = 999999;
      await route.fulfill({ json: report }).catch(() => {});
    });
    await page.goto("/statistics");
    const rhythm = page.getByRole("region", {
      name: "Ваш ритм просмотра",
      exact: true,
    });
    await expect(rhythm).toBeVisible();
    const library = await page
      .getByRole("heading", { name: "Вся ваша библиотека" })
      .elementHandle();
    const heat = await page
      .getByRole("heading", { name: "Календарь активности" })
      .elementHandle();
    const button = page.getByRole("button", { name: "90 дней", exact: true });
    await button.scrollIntoViewIfNeeded();
    const position = await page.evaluate(() => scrollY);
    await button.click();
    await expect.poll(() => requested).toBe(true);
    await expect(rhythm).toHaveAttribute("aria-busy", "true");
    await expect(rhythm.getByRole("status")).toHaveText(
      "Обновляем активность…",
    );
    expect(await library!.evaluate((e) => e.isConnected)).toBe(true);
    expect(await heat!.evaluate((e) => e.isConnected)).toBe(true);
    expect(
      Math.abs((await page.evaluate(() => scrollY)) - position),
    ).toBeLessThan(3);
    await expect(page.getByText("Собираем вашу киноисторию…")).toHaveCount(0);
    release();
    await expect(rhythm).toHaveAttribute("aria-busy", "false");
    await expect(rhythm).toContainText("дней из 90");
    expect(await library!.evaluate((e) => e.isConnected)).toBe(true);
    expect(await heat!.evaluate((e) => e.isConnected)).toBe(true);
    await expect(page.getByText("16 666,7", { exact: true })).toHaveCount(0);
    expect(
      Math.abs((await page.evaluate(() => scrollY)) - position),
    ).toBeLessThan(3);
  });

test("a failed period request leaves the report in place and retries within rhythm", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/statistics");
  const rhythm = page.getByRole("region", {
    name: "Ваш ритм просмотра",
    exact: true,
  });
  await expect(rhythm).toBeVisible();
  let fail = true;
  await page.route("**/api/statistics?**", (route) =>
    new URL(route.request().url()).searchParams.get("days") === "90"
      ? route.fulfill(
          fail
            ? { status: 503, json: { error: "Не удалось обновить период" } }
            : { json: statisticsFixture(90) },
        )
      : route.fallback(),
  );
  await page.getByRole("button", { name: "90 дней", exact: true }).click();
  await expect(rhythm.getByRole("alert")).toContainText(
    "Не удалось обновить период",
  );
  await expect(
    page.getByRole("heading", { name: "Вся ваша библиотека" }),
  ).toBeAttached();
  fail = false;
  await rhythm.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(rhythm).toHaveAttribute("aria-busy", "false");
  await expect(rhythm.getByRole("alert")).toHaveCount(0);
  await expect(rhythm).toContainText("дней из 90");
});

test("a slower earlier period response cannot replace the latest selected range", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/statistics");
  const rhythm = page.getByRole("region", {
    name: "Ваш ритм просмотра",
    exact: true,
  });
  await expect(rhythm).toBeVisible();
  let release: () => void = () => {};
  let requested = false;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/statistics?**", async (route) => {
    const days = Number(
      new URL(route.request().url()).searchParams.get("days"),
    );
    if (days !== 90) return route.fallback();
    requested = true;
    await gate;
    await route.fulfill({ json: statisticsFixture(90) }).catch(() => {});
  });
  await page.getByRole("button", { name: "90 дней", exact: true }).click();
  await expect.poll(() => requested).toBe(true);
  await page.getByRole("button", { name: "365 дней", exact: true }).click();
  await expect(rhythm).toHaveAttribute("aria-busy", "false");
  await expect(rhythm).toContainText("дней из 365");
  release();
  await expect(
    page.getByRole("button", { name: "365 дней", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(rhythm).toContainText("дней из 365");
});
