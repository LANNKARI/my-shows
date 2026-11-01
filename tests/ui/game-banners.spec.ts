import { test, expect, type Page } from "@playwright/test";
async function shell(page: Page, frames = true) {
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/session")
      return route.fulfill({
        json: {
          user: { id: "game-user", username: "game_user" },
          expires: "2099-01-01",
        },
      });
    if (path === "/api/game-banners")
      return route.fulfill({
        status: frames ? 200 : 503,
        json: {
          frames: frames
            ? Array.from(
                { length: 6 },
                (_, i) => `https://image.tmdb.org/t/p/w780/frame${i}.jpg`,
              )
            : [],
        },
      });
    if (path === "/api/popcorn")
      return route.fulfill({ json: { popcorn: 100, canClaimDaily: false } });
    if (path === "/api/popcorn-history")
      return route.fulfill({ json: { items: [] } });
    return route.fulfill({ json: {} });
  });
  await page.route("https://image.tmdb.org/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="780" height="440"><rect width="780" height="440" fill="#344458"/></svg>',
    }),
  );
}
test("both banners rotate every four seconds and support pause and reduced motion", async ({
  page,
}) => {
  await shell(page);
  await page.clock.install();
  await page.goto("/rewards");
  const cards = page
    .getByRole("region", { name: "Мини-игры" })
    .locator("article");
  await expect(cards).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Приостановить смену кадров" }),
  ).toHaveCount(2);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(cards.first().getByRole("button")).toBeDisabled();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(cards.first().getByRole("button")).toBeEnabled();
  const initial = Number(await cards.first().getAttribute("data-frame-index"));
  await page.clock.runFor(3999);
  await expect(cards.first()).toHaveAttribute(
    "data-frame-index",
    String(initial),
  );
  await page.clock.runFor(1);
  await expect(cards.first()).toHaveAttribute(
    "data-frame-index",
    String((initial + 1) % 6),
  );
  await expect(cards.last()).toHaveAttribute(
    "data-frame-index",
    String((initial + 4) % 6),
  );
  await cards.first().getByRole("button").click();
  await page.mouse.move(0, 0);
  await page.clock.runFor(8000);
  await expect(cards.first()).toHaveAttribute(
    "data-frame-index",
    String((initial + 1) % 6),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(cards.last().getByRole("button")).toBeDisabled();
  const active = await cards.last().getAttribute("data-frame-index");
  await page.clock.runFor(8000);
  await expect(cards.last()).toHaveAttribute("data-frame-index", active!);
});
for (const width of [320, 390, 1440])
  test(`banners keep both links usable at ${width}px when catalog is unavailable`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await shell(page, false);
    await page.goto("/rewards");
    const region = page.getByRole("region", { name: "Мини-игры" });
    await expect(
      region.getByRole("link", { name: "Угадай фильм по кадру" }),
    ).toHaveAttribute("href", "/rewards/quiz");
    await expect(
      region.getByRole("link", { name: "Больше или меньше" }),
    ).toHaveAttribute("href", "/rewards/higher-lower");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
test("quiz shows the exhausted daily budget and reset time", async ({
  page,
}) => {
  await shell(page);
  await page.route("**/api/popcorn?action=get-quiz", (route) =>
    route.fulfill({
      json: {
        limitReached: true,
        dailyLimit: 10,
        dailyUsed: 10,
        dailyAnswered: 10,
        dailyReward: 7,
        nextResetAt: new Date(Date.now() + 3600000).toISOString(),
      },
    }),
  );
  await page.goto("/rewards/quiz");
  await expect(
    page.getByRole("region", { name: "Результаты дня" }),
  ).toContainText("Начислено за викторину: 7");
  await expect(page.getByText("Показано: 10 из 10")).toBeVisible();
  await expect(page.getByText(/00:00 UTC/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Загрузить кадр" }),
  ).toHaveCount(0);
});

for (const width of [320, 1440])
  test(`history initially shows five grouped rows and expands without changing rewards at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await shell(page, false);
    const items = Array.from({ length: 8 }, (_, i) => ({
      id: `group-${i}`,
      amount: i === 0 ? 10 : 2,
      reason: i === 0 ? "За мини-игры" : `Начисление ${i}`,
      createdAt: "2026-10-25T00:00:00.000Z",
    }));
    let pages = 0;
    await page.route("**/api/popcorn-history*", (route) => {
      pages++;
      return route.fulfill({
        json: {
          items: route.request().url().includes("cursor=")
            ? [
                {
                  id: "older",
                  amount: 3,
                  reason: "Прошлый день",
                  createdAt: "2026-10-24T00:00:00.000Z",
                },
              ]
            : items,
          nextCursor: route.request().url().includes("cursor=")
            ? null
            : "fixture-cursor",
        },
      });
    });
    await page.goto("/rewards");
    const history = page.getByRole("region", { name: "История операций" });
    await expect(
      history.getByText("За мини-игры", { exact: true }),
    ).toHaveCount(1);
    await expect(history.locator("time")).toHaveCount(5);
    await expect(history.getByText("+10 🍿")).toBeVisible();
    await expect(
      history.getByRole("button", { name: "Показать ещё" }),
    ).toHaveCount(0);
    await history
      .getByRole("button", { name: "Развернуть", exact: true })
      .click();
    await expect(history.locator("time")).toHaveCount(8);
    await expect(
      history.getByRole("button", { name: "Свернуть", exact: true }),
    ).toHaveAttribute("aria-expanded", "true");
    await history.getByRole("button", { name: "Показать ещё" }).click();
    await expect(history.locator("time")).toHaveCount(9);
    expect(pages).toBe(2);
    await history
      .getByRole("button", { name: "Свернуть", exact: true })
      .click();
    await expect(history.locator("time")).toHaveCount(5);
    await history
      .getByRole("button", { name: "Развернуть", exact: true })
      .click();
    await expect(history.locator("time")).toHaveCount(9);
    expect(pages).toBe(2);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });

test.describe("desktop card interaction", () => {
  test.use({ isMobile: false, hasTouch: false });
  test("compact game cards brighten on hover and keyboard focus", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await shell(page);
    await page.goto("/rewards");
    const card = page
      .getByRole("region", { name: "Мини-игры" })
      .locator("article")
      .first();
    await card.scrollIntoViewIfNeeded();
    const frames = card.locator('[aria-hidden="true"]').first();
    await page.mouse.move(0, 0);
    await expect(frames).toHaveCSS("filter", "brightness(0.76)");
    const bounds = await card.boundingBox();
    expect(bounds!.height).toBeLessThan(380);
    await card.hover();
    await expect(frames).toHaveCSS("filter", "brightness(1)");
    await page.mouse.move(0, 0);
    await expect(frames).toHaveCSS("filter", "brightness(0.76)");
    await card.getByRole("link").focus();
    await expect(frames).toHaveCSS("filter", "brightness(1)");
  });
});
