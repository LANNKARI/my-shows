import {statisticsFixture} from "./fixtures/statistics";
import { test, expect, type Page } from "@playwright/test";
const user = {
  id: "account-fixture",
  username: "cinema_fan",
  name: "Киноман",
  email: "fixture@example.test",
};
const access = (owner = false, active = false) => ({
  owner,
  moderate: owner,
  curate: owner,
  beta: owner,
  badges: [],
  premium: {
    active,
    until: active ? "2026-12-06T12:00:00.000Z" : null,
    balance: 3500,
    bonusTenths: 0,
    price: 2000,
  },
});
async function setup(
  page: Page,
  options: {
    owner?: boolean;
    moderator?: boolean;
    guest?: boolean;
    active?: boolean;
    balance?: number;
  } = {},
) {
  const account = access(!!options.owner, !!options.active);
  if (options.moderator) account.moderate = true;
  if (options.balance !== undefined) account.premium.balance = options.balance;
  const calls: Record<string, unknown>[] = [];
  const role = {
    id: "moderator",
    name: "Модератор",
    color: "#90763f",
    icon: "◆",
    permissions: ["moderate_comments"],
  };
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname;
    if (path === "/api/auth/session")
      return route.fulfill({
        json: options.guest ? null : { user, expires: "2099-01-01" },
      });
    if (path === "/api/account") return route.fulfill({ json: account });
    if (path === "/api/account-badges")
      return route.fulfill({
        json: {
          [user.id]: account.premium.active
            ? [
                {
                  roleId: "premium",
                  name: "Premium",
                  color: "#d5af69",
                  icon: "✦",
                },
              ]
            : [],
        },
      });
    if (path === "/api/site-theme")
      return route.fulfill({ json: { theme: null, ownsAutumn: false } });
    if (path === "/api/popcorn")
      return route.fulfill({ json: { popcorn: account.premium.balance } });
    if (path === "/api/users/counts")
      return route.fulfill({ json: { watching: 0 } });
    if (path === "/api/premium") {
      calls.push(req.postDataJSON());
      account.premium = {
        ...account.premium,
        active: true,
        until: "2026-12-06T12:00:00.000Z",
        balance: 2000,
      };
      return route.fulfill({ json: { success: true, ...account.premium } });
    }
    if (path === "/api/admin") {
      if (req.method() === "POST") {
        calls.push(req.postDataJSON());
        return route.fulfill({ json: { success: true } });
      }
      const tab = url.searchParams.get("tab");
      return route.fulfill({
        json: {
          roles: [role],
          hasMore: false,
          items:
            tab === "users"
              ? [
                  {
                    id: user.id,
                    username: user.username,
                    name: user.name,
                    siteOwner: options.owner ? { id: 1 } : null,
                    roles: [{ role, expiresAt: null }],
                    premiumPeriods: [],
                  },
                ]
              : tab === "comments"
                ? [
                    {
                      id: 1,
                      text: "Комментарий для проверки",
                      user: { username: "viewer" },
                      show: { id: 1, name: "Тайтл" },
                    },
                  ]
                : [],
        },
      });
    }
    if (path === "/api/comments/1") {
      calls.push({ action: "commentDelete" });
      return route.fulfill({ json: { ok: true } });
    }
    if (path === "/api/statistics")
      return route.fulfill({
        json: statisticsFixture(Number(url.searchParams.get("days"))||30),
      });
    return route.fulfill({ json: {} });
  });
  return { account, calls };
}
for (const width of [320, 390, 1440])
  test(`Premium layout and explicit purchase confirmation at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const api = await setup(page);
    await page.goto("/premium");
    await expect(
      page.getByRole("button", { name: "Подключить Premium", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Подключить Premium", exact: true })
      .click();
    expect(api.calls).toHaveLength(0);
    await page.getByRole("button", { name: "Подтвердить за 2000 🍿" }).click();
    await expect(
      page.getByText("Premium подключён.", { exact: false }),
    ).toBeVisible();
    expect(api.calls).toHaveLength(1);
    expect(api.calls[0].expectedPrice).toBe(2000);
    expect(api.calls[0].expectedUntil).toBe(null);
    await expect(
      page.getByRole("button", { name: "Продлить на 30 дней" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`premium-${width}.png`),
      fullPage: true,
    });
  });
test("Premium cannot be purchased by a guest or with an insufficient displayed balance", async ({
  page,
}) => {
  await setup(page, { guest: true });
  await page.goto("/premium");
  await expect(
    page.getByRole("link", { name: "Войти для покупки" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Подключить Premium" }),
  ).toHaveCount(0);
  await page.unroute("**/api/**");
  await setup(page, { balance: 1999 });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Подключить Premium", exact: true }),
  ).toBeDisabled();
});
for (const width of [390, 1440])
  test(`administrator can configure roles and create a promo at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const api = await setup(page, { owner: true });
    await page.goto("/admin");
    await page.getByRole("button", { name: "+ Создать роль" }).click();
    await page
      .getByRole("textbox", { name: "Название", exact: true })
      .fill("Помощник");
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect.poll(() => api.calls.length).toBe(1);
    expect(api.calls[0].action).toBe("roleSave");
    await page.getByRole("button", { name: "Изменить роли" }).click();
    await page
      .getByRole("combobox", { name: "Роль", exact: true })
      .selectOption("moderator");
    await page.getByRole("button", { name: "Выдать роль" }).click();
    await expect.poll(() => api.calls.length).toBe(2);
    expect(api.calls[1].expiresAt).toBe(null);
    await page.getByRole("button", { name: "Промокоды", exact: true }).click();
    await page.getByLabel("Код", { exact: true }).fill("EPISY2026");
    await page.getByLabel("Награда, 🍿").fill("100");
    await page.getByLabel("Лимит активаций").fill("50");
    await page
      .getByRole("button", { name: "Создать промокод", exact: true })
      .click();
    await expect.poll(() => api.calls.length).toBe(3);
    expect(api.calls[2]).toMatchObject({
      action: "promoCreate",
      code: "EPISY2026",
      reward: 100,
      maxActivations: 50,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`admin-${width}.png`),
      fullPage: true,
    });
  });
test("moderators only see moderation and ordinary users cannot open administration", async ({
  page,
}) => {
  await setup(page, { moderator: true });
  await page.goto("/admin");
  await expect(page.getByText("Комментарий для проверки")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Промокоды", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "+ Создать роль" }),
  ).toHaveCount(0);
  await page.unroute("**/api/**");
  await setup(page);
  await page.reload();
  await expect(
    page.getByText("Доступ только для администратора или модератора."),
  ).toBeVisible();
});
test("viewing statistics is Premium only and date ranges refresh the report", async ({
  page,
}) => {
  await setup(page, { active: true });
  await page.goto("/statistics");
  await expect(page.getByText("Драма", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "90 дней" }).click();
  await expect(page.getByText("Драма", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Календарь активности" }),
  ).toBeVisible();
  await page.unroute("**/api/**");
  await setup(page);
  await page.reload();
  await expect(page.getByRole("link", { name: "О Premium →" })).toBeVisible();
});
