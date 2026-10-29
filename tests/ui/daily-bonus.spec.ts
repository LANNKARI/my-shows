import { test, expect, type Page } from "@playwright/test";
async function setup(
  page: Page,
  options = { streak: 5, next: 5, available: false },
) {
  let available = options.available;
  let calls = 0;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/session")
      return route.fulfill({
        json: {
          user: { id: "daily-ui", username: "daily_ui" },
          expires: "2099-01-01",
        },
      });
    if (path === "/api/popcorn-history")
      return route.fulfill({ json: { items: [], nextCursor: null } });
    if (path === "/api/popcorn") {
      if (route.request().method() === "POST") {
        expect(route.request().postDataJSON()).toEqual({
          action: "claim-daily",
        });
        calls++;
        available = false;
        return route.fulfill({ json: { success: true, reward: 30 } });
      }
      return route.fulfill({
        json: {
          popcorn: 100,
          canClaimDaily: available,
          dailyStreak: available ? options.streak : options.next,
          nextStreak: options.next,
          tasks: [],
        },
      });
    }
    return route.fulfill({ json: { watchingCount: 0, plannedCount: 0 } });
  });
  return () => calls;
}
for (const width of [320, 390, 1440]) {
  test(`daily bonus highlights five claimed days at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await setup(page);
    await page.goto("/rewards");
    const panel = page.getByRole("region", { name: "🍿 Ежедневный бонус" });
    await expect(panel).toContainText("Серия: 5 из 7 дней");
    await expect(panel.locator('[data-state="received"]')).toHaveCount(4);
    await expect(panel.locator('[data-state="today"]')).toContainText("День 5");
    await expect(panel.locator('[data-state="today"]')).toContainText(
      "Сегодня получено",
    );
    await expect(panel.locator('[data-state="future"]')).toHaveCount(2);
    await expect(panel).toContainText("Следующая награда: +40");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 1440)
      await panel.screenshot({
        path: "/workspace/scratch/rewards-refresh/actual-desktop.png",
      });
    if (width === 390)
      await panel.screenshot({
        path: "/workspace/scratch/rewards-refresh/actual-mobile.png",
      });
  });
}
test("today's tile claims once and updates the received state", async ({
  page,
}) => {
  const calls = await setup(page, { streak: 4, next: 5, available: true });
  await page.goto("/rewards");
  const panel = page.getByRole("region", { name: "🍿 Ежедневный бонус" });
  await expect(panel).toContainText("Серия: 4 из 7 дней");
  await panel.getByRole("button", { name: "Получить бонус за день 5" }).click();
  await expect(panel).toContainText("Серия: 5 из 7 дней");
  await expect(panel).toContainText("Сегодня бонус уже получен");
  await expect(panel.getByRole("button")).toHaveCount(0);
  expect(calls()).toBe(1);
});
test("a broken streak does not highlight stale received days", async ({
  page,
}) => {
  await setup(page, { streak: 5, next: 1, available: true });
  await page.goto("/rewards");
  const panel = page.getByRole("region", { name: "🍿 Ежедневный бонус" });
  await expect(panel).toContainText("Серия: 0 из 7 дней");
  await expect(panel.locator('[data-state="received"]')).toHaveCount(0);
  await expect(
    panel.getByRole("button", { name: "Получить бонус за день 1" }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Забрать +10 🍿", exact: true }),
  ).toBeVisible();
});
test("seventh received day shows the first reward of the next cycle", async ({
  page,
}) => {
  await setup(page, { streak: 7, next: 7, available: false });
  await page.goto("/rewards");
  const panel = page.getByRole("region", { name: "🍿 Ежедневный бонус" });
  await expect(panel).toContainText("Серия: 7 из 7 дней");
  await expect(panel.locator('[data-state="received"]')).toHaveCount(6);
  await expect(panel).toContainText("Следующая награда: +10");
});
