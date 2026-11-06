import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
async function setup(page: Page) {
  const state = {
    active: true,
    pending: true,
    read: false,
    banner: null as string | null,
    calls: [] as { path: string; body: unknown }[],
  };
  const user = {
    id: "social-owner",
    username: "social_user",
    name: "Айрат",
    email: "social@example.test",
    avatarUrl: null,
    avatarFrame: "frame-standard",
    profileStyle: "profile-standard",
  };
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      u = new URL(req.url()),
      path = u.pathname;
    if (path === "/api/auth/session")
      return route.fulfill({ json: { user, expires: "2099-01-01" } });
    if (path === "/api/account")
      return route.fulfill({
        json: {
          owner: true,
          moderate: true,
          curate: true,
          beta: false,
          badges: [],
          premium: {
            active: state.active,
            until: "2026-12-07T12:00:00Z",
            balance: 3500,
            bonusTenths: 0,
            price: 2000,
          },
        },
      });
    if (path === "/api/account-badges")
      return route.fulfill({
        json: Object.fromEntries(
          (u.searchParams.get("ids") || "").split(",").map((id) => [
            id,
            state.active
              ? [
                  {
                    roleId: "premium",
                    name: "Premium",
                    icon: "✦",
                    color: "#bba2fa",
                  },
                ]
              : [],
          ]),
        ),
      });
    if (path === "/api/site-theme")
      return route.fulfill({ json: { theme: null } });
    if (path === "/api/popcorn" && u.searchParams.get("action") === "get-quiz")
      return route.fulfill({
        json: {
          limitReached: true,
          dailyUsed: 10,
          dailyLimit: 10,
          dailyAnswered: 10,
          dailyReward: 20,
        },
      });
    if (path === "/api/higher-lower")
      return route.fulfill({
        json: {
          roundId: "mock-round",
          bank: 2,
          phase: "answered",
          limitReached: false,
          attemptsLeft: 4,
          round: 2,
          questionType: "rating",
          rewardForRound: 1,
          leftMovie: {
            id: 1,
            title: "Фильм один",
            posterUrl: null,
            rating: 7,
            year: "2025",
          },
          rightMovie: {
            id: 2,
            title: "Фильм два",
            posterUrl: null,
            rating: 8,
            year: "2026",
          },
        },
      });
    if (path === "/api/notifications") {
      if (req.method() === "PATCH") {
        state.calls.push({ path, body: req.postDataJSON() });
        state.read = true;
      }
      return route.fulfill({
        json: {
          items: [],
          friendRequests:
            state.pending &&
            !(u.searchParams.get("mode") === "unread" && state.read)
              ? [
                  {
                    id: 22,
                    user: {
                      id: "friend-sender",
                      username: "maxim",
                      name: "Максим",
                      avatarUrl: null,
                    },
                    createdAt: "2026-11-07T12:00:00Z",
                    read: state.read,
                  },
                ]
              : [],
          unreadCount: state.pending && !state.read ? 1 : 0,
          latestId: 0,
          latestFriendId: 22,
          nextCursor: null,
          preferences: {
            releaseNotificationsEnabled: true,
            notifyNewShows: false,
            notificationTimeZone: "UTC",
          },
        },
      });
    }
    if (path === "/api/notifications/friends/22") {
      state.calls.push({ path, body: req.postDataJSON() });
      state.pending = false;
      return route.fulfill({ json: { success: true } });
    }
    if (path === "/api/premium") {
      state.calls.push({ path, body: req.postDataJSON() });
      return route.fulfill({ json: { success: true } });
    }
    if (path === "/api/users/social_user/banner") {
      state.calls.push({
        path,
        body: req.headers()["content-type"]?.includes("application/json")
          ? req.postDataJSON()
          : "file",
      });
      state.banner = "/mock-cover.webp";
      return route.fulfill({
        json: { success: true, bannerUrl: state.banner },
      });
    }
    if (path === "/api/users/social_user")
      return route.fulfill({
        json: {
          user: { ...user, bannerUrl: state.active ? state.banner : null },
          isOwnProfile: true,
          friendshipStatus: "none",
          stats: {},
          favorites: [],
          achievements: [],
          completedShows: [],
        },
      });
    return route.fulfill({ json: {} });
  });
  await page.route("**/mock-cover.webp", async (r) =>
    r.fulfill({
      contentType: "image/webp",
      body: await sharp({
        create: { width: 600, height: 200, channels: 3, background: "#8471a2" },
      })
        .webp()
        .toBuffer(),
    }),
  );
  return state;
}
for (const width of [320, 390, 1440])
  test(`grouped menu, weekly plan and incoming request work at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const state = await setup(page);
    await page.goto("/premium");
    await expect(
      page.getByRole("heading", { name: "EpisyHub Premium", exact: true }),
    ).toBeVisible();
    const weekly = page.getByRole("region", { name: "Premium на 7 дней" });
    await expect(weekly).toContainText("1290");
    await expect(weekly).toContainText("+150");
    await weekly.getByRole("button", { name: "Продлить на 7 дней" }).click();
    expect(state.calls.filter((c) => c.path === "/api/premium")).toHaveLength(
      0,
    );
    await page.getByRole("button", { name: "Подтвердить за 1290 🍿" }).click();
    await expect
      .poll(() => state.calls.filter((c) => c.path === "/api/premium").length)
      .toBe(1);
    expect(
      state.calls.find((c) => c.path === "/api/premium")?.body,
    ).toMatchObject({ days: 7, expectedPrice: 1290 });
    await page
      .getByRole("button", { name: "Меню профиля", exact: true })
      .click();
    const menu = page.locator(".profile-menu-panel");
    await expect(
      menu.getByRole("link", { name: "EpisyHub Premium", exact: false }),
    ).toBeVisible();
    await expect(
      menu.locator('a[href="/picks"],a[href="/curation"]'),
    ).toHaveCount(0);
    await expect(
      menu.getByRole("link", { name: "Мой профиль", exact: true }),
    ).toBeVisible();
    await expect(
      menu.getByRole("link", { name: "Друзья", exact: true }),
    ).toBeVisible();
    await expect(
      menu.getByRole("link", { name: "Управление сайтом", exact: true }),
    ).toBeAttached();
    await menu.screenshot({ path: `/workspace/work/social-menu-${width}.png` });
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await page.goto("/notifications");
    const main = page.getByRole("main");
    await expect(
      main.getByRole("article", { name: "Заявка в друзья от Максим" }),
    ).toBeVisible();
    await main
      .getByRole("button", { name: "Принять заявку", exact: true })
      .click();
    await expect(
      main.getByText("Заявка принята. Теперь вы друзья."),
    ).toBeVisible();
    expect(
      state.calls.filter((c) => c.path === "/api/notifications/friends/22"),
    ).toHaveLength(1);
    await expect(
      main.getByRole("article", { name: "Заявка в друзья от Максим" }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
test("read all marks a friendship notice read without accepting it", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto("/notifications");
  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Прочитать все" }).click();
  await expect.poll(() => state.read).toBe(true);
  expect(state.pending).toBe(true);
  expect(
    state.calls.find((c) => c.path === "/api/notifications")?.body,
  ).toEqual({ all: true, throughId: 0, throughFriendId: 22 });
  await main.getByRole("button", { name: "Все", exact: true }).click();
  await expect(
    main.getByRole("button", { name: "Принять заявку" }),
  ).toBeVisible();
  await main.getByRole("button", { name: "Отклонить" }).click();
  await expect.poll(() => state.pending).toBe(false);
});
test("Premium personal cover previews, uploads, hides on expiry and restores on renewal", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto("/u/social_user");
  const edit = page.getByRole("button", {
    name: "▧ Изменить шапку",
    exact: true,
  });
  await edit.click();
  const panel = page.getByRole("region", { name: "Изменение шапки профиля" });
  await panel.locator("input[type=file]").setInputFiles({
    name: "cover.png",
    mimeType: "image/png",
    buffer: await sharp({
      create: { width: 600, height: 300, channels: 3, background: "#8d71ab" },
    })
      .png()
      .toBuffer(),
  });
  await expect(
    panel.getByRole("img", { name: "Предпросмотр шапки" }),
  ).toBeVisible();
  expect(state.calls.filter((c) => c.path.includes("/banner"))).toHaveLength(0);
  await panel.getByRole("button", { name: "Сохранить шапку" }).click();
  await expect(page.locator(".cosmetic-cover img")).toBeVisible();
  expect(state.calls.filter((c) => c.path.includes("/banner"))).toHaveLength(1);
  state.active = false;
  await page.evaluate(() => window.dispatchEvent(new Event("account-updated")));
  await expect(edit).toHaveCount(0);
  await expect(page.locator(".cosmetic-cover img")).toHaveCount(0);
  await expect(page.locator(".profile-theme-header")).toHaveAttribute(
    "data-custom-cover",
    "false",
  );
  state.active = true;
  await page.evaluate(() => window.dispatchEvent(new Event("account-updated")));
  await expect(edit).toBeVisible();
  await expect(page.locator(".cosmetic-cover img")).toBeVisible();
});
test("the desktop bell accepts a request without leaving the page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await setup(page);
  await page.goto("/premium");
  await page
    .getByRole("button", { name: "Уведомления: 1 новых", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Уведомления", exact: true });
  await dialog.getByRole("button", { name: "Принять заявку" }).click();
  await expect(
    dialog.getByText("Заявка принята. Теперь вы друзья."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/premium$/);
});

test("Premium game labels show doubled rewards and the cashout amount follows subscription status", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto("/rewards/quiz");
  await expect(
    page.getByText(/10 кадров в сутки · \+2 🍿 за верный ответ/),
  ).toBeVisible();
  await page.goto("/rewards/higher-lower");
  await expect(
    page.getByRole("button", { name: "💰 Забрать 4 🍿 и завершить" }),
  ).toBeVisible();
  state.active = false;
  await page.evaluate(() => window.dispatchEvent(new Event("account-updated")));
  await expect(
    page.getByRole("button", { name: "💰 Забрать 2 🍿 и завершить" }),
  ).toBeVisible();
});
