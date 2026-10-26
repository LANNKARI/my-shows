import { test, expect, type Page } from "@playwright/test";
const poster = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#293247"/><circle cx="100" cy="100" r="60" fill="#55657a"/><text x="100" y="240" text-anchor="middle" fill="white" font-size="18">MY SHOWS</text></svg>')}`;
async function setup(
  page: Page,
  options: {
    guest?: boolean;
    fail?: boolean;
    noDates?: boolean;
    sync?: boolean;
    failSync?: boolean;
    failSave?: boolean;
    delay?: boolean;
  } = {},
) {
  await page.clock.setFixedTime(new Date("2026-10-28T07:00:00Z"));
  let enabled = false,
    synced = !options.sync,
    read = false;
  const preferences = {
    releaseNotificationsEnabled: true,
    notifyNewShows: false,
    notificationTimeZone: "UTC",
  };
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  let gets = 0;
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname;
    if (path === "/api/auth/session")
      return route.fulfill({
        json: options.guest
          ? null
          : {
              user: { id: "ui-user", username: "ui_user" },
              expires: "2099-01-01T00:00:00Z",
            },
      });
    if (path === "/api/users/counts")
      return route.fulfill({ json: { watchingCount: 2, plannedCount: 1 } });
    if (path === "/api/popcorn")
      return route.fulfill({ json: { popcorn: 0, canClaimDaily: false } });
    if (path === "/api/calendar" && request.method() === "GET") {
      gets++;
      if (options.delay && gets === 1)
        await new Promise((resolve) => setTimeout(resolve, 500));
      if (options.fail)
        return route.fulfill({
          status: 503,
          json: { error: "Расписание временно недоступно" },
        });
      const all = [
        {
          id: 101,
          showId: 10,
          userShowId: 100,
          title: "Тихий отдел",
          posterUrl: poster,
          season: 2,
          episode: 4,
          date: "2026-10-28",
          notifyReleases: enabled,
          watched: false,
        },
        {
          id: 102,
          showId: 10,
          userShowId: 100,
          title: "Тихий отдел",
          posterUrl: poster,
          season: 2,
          episode: 5,
          date: "2026-10-29",
          notifyReleases: enabled,
          watched: false,
        },
      ];
      const status = url.searchParams.get("status");
      const events =
        options.noDates || status === "planned"
          ? []
          : all.filter(
              (event) =>
                event.date >= url.searchParams.get("from")! &&
                event.date <= url.searchParams.get("to")!,
            );
      return route.fulfill({
        json: {
          events,
          truncated: false,
          series: [
            {
              userShowId: 100,
              showId: 10,
              title: "Тихий отдел",
              notifyReleases: enabled,
              hasSource: true,
              syncedAt: synced ? "2026-10-28T06:00:00Z" : null,
              needsSync: !synced,
            },
          ],
          syncIds: synced ? [] : [10],
        },
      });
    }
    if (path === "/api/calendar/sync") {
      calls.push({ path, body: request.postDataJSON() });
      synced = true;
      return route.fulfill({
        json: { results: [{ showId: 10, ok: !options.failSync }] },
      });
    }
    if (path === "/api/release-preferences") {
      if (request.method() === "GET")
        return route.fulfill({ json: preferences });
      const body = request.postDataJSON();
      calls.push({ path, body });
      if (options.delay)
        await new Promise((resolve) => setTimeout(resolve, 400));
      if (options.failSave)
        return route.fulfill({
          status: 503,
          json: { error: "Не удалось сохранить настройки" },
        });
      if ("notifyReleases" in body) {
        enabled = body.notifyReleases;
        return route.fulfill({
          json: { success: true, notifyReleases: enabled },
        });
      }
      Object.assign(preferences, body);
      return route.fulfill({ json: preferences });
    }
    if (path === "/api/notifications") {
      if (request.method() === "PATCH") {
        calls.push({ path, body: request.postDataJSON() });
        if (options.failSave)
          return route.fulfill({
            status: 503,
            json: { error: "Не удалось сохранить прочтение" },
          });
        read = true;
        return route.fulfill({ json: { success: true, updated: 1 } });
      }
      const items =
        read && url.searchParams.get("mode") === "unread"
          ? []
          : [
              {
                id: 501,
                showId: 10,
                title: "Тихий отдел",
                posterUrl: poster,
                season: 2,
                episode: 4,
                date: "2026-10-28",
                read,
              },
            ];
      return route.fulfill({
        json: {
          items,
          unreadCount: read ? 0 : 1,
          latestId: 501,
          nextCursor: null,
          preferences,
        },
      });
    }
    return route.fulfill({ status: 404, json: { error: "Fixture" } });
  });
  return { calls, gets: () => gets };
}
const main = (page: Page) => page.getByRole("main");

for (const width of [320, 390, 1440])
  test(`calendar week and month fit ${width}px, keep day cells usable and show real dates`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    await page.goto("/calendar?date=2026-10-28");
    await expect(
      main(page).getByRole("heading", { name: "Календарь серий" }),
    ).toBeVisible();
    await expect(
      main(page).getByRole("heading", { name: "Сегодня · 28 октября" }),
    ).toBeVisible();
    await expect(
      main(page).getByText("Выход сегодня", { exact: true }),
    ).toBeVisible();
    await expect(
      main(page).getByText("Завтра · 29 октября", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`calendar-week-${width}.png`),
      fullPage: true,
    });
    await main(page)
      .getByRole("button", { name: "Месяц", exact: true })
      .click();
    await expect(page).toHaveURL(/view=month/);
    await expect(
      main(page).getByRole("button", {
        name: "четверг, 1 октября, серий: 0",
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const selected = main(page).getByRole("button", {
      name: "среда, 28 октября, серий: 1",
      exact: true,
    });
    await expect(selected).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({
      path: testInfo.outputPath(`calendar-month-${width}.png`),
      fullPage: true,
    });
  });

test("month selection and filters survive reload and back without shifting a release date", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/calendar?date=2026-10-28&view=month");
  const nextDay = main(page).getByRole("button", {
    name: "четверг, 29 октября, серий: 1",
    exact: true,
  });
  await nextDay.click();
  await expect(page).toHaveURL(/date=2026-10-29/);
  await expect(main(page).getByText("Сезон 2 · Серия 5")).toBeVisible();
  await page.reload();
  await expect(nextDay).toHaveAttribute("aria-pressed", "true");
  await main(page)
    .getByRole("button", { name: "В планах", exact: true })
    .click();
  await expect(page).toHaveURL(/status=planned/);
  await expect(
    main(page).getByRole("heading", {
      name: "На эти даты серии пока не запланированы",
    }),
  ).toBeVisible();
  await page.goBack();
  await expect(main(page).getByText("Сезон 2 · Серия 5")).toBeVisible();
});

test("calendar subscriptions update every row and persist only after server confirmation", async ({
  page,
}) => {
  const api = await setup(page, { delay: true });
  await page.goto("/calendar?date=2026-10-28");
  const first = main(page).getByRole("article", {
    name: "Тихий отдел: сезон 2, серия 4",
    exact: true,
  });
  const toggle = first.getByRole("button", {
    name: "Включить уведомления: Тихий отдел",
  });
  await toggle.dblclick();
  await expect(
    first.getByRole("button", { name: "Отключить уведомления: Тихий отдел" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    main(page)
      .getByRole("article", {
        name: "Тихий отдел: сезон 2, серия 5",
        exact: true,
      })
      .getByRole("button", { name: "Отключить уведомления: Тихий отдел" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    api.calls.filter((call) => call.path === "/api/release-preferences"),
  ).toHaveLength(1);
  await page.reload();
  await expect(
    main(page)
      .getByRole("article", {
        name: "Тихий отдел: сезон 2, серия 4",
        exact: true,
      })
      .getByRole("button", { name: "Отключить уведомления: Тихий отдел" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("failed subscription keeps its old state and shows a retryable error", async ({
  page,
}) => {
  await setup(page, { failSave: true });
  await page.goto("/calendar?date=2026-10-28");
  const first = main(page).getByRole("article", {
    name: "Тихий отдел: сезон 2, серия 4",
    exact: true,
  });
  await first
    .getByRole("button", { name: "Включить уведомления: Тихий отдел" })
    .click();
  await expect(first.getByRole("alert")).toContainText("Не удалось сохранить");
  await expect(
    first.getByRole("button", { name: "Включить уведомления: Тихий отдел" }),
  ).toHaveAttribute("aria-pressed", "false");
});

test("schedule refresh is bounded and a failed source preserves cached events", async ({
  page,
}) => {
  const api = await setup(page, { sync: true, failSync: true });
  await page.goto("/calendar?date=2026-10-28");
  await expect(
    main(page).getByText(/Часть расписания недоступна/),
  ).toBeVisible();
  await expect(
    main(page).getByRole("article", {
      name: "Тихий отдел: сезон 2, серия 4",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    api.calls.filter((call) => call.path === "/api/calendar/sync"),
  ).toEqual([{ path: "/api/calendar/sync", body: { showIds: [10] } }]);
});

test("calendar distinguishes unavailable schedules from an empty date range", async ({
  page,
}) => {
  await setup(page, { fail: true });
  await page.goto("/calendar?date=2026-10-28");
  await expect(main(page).getByRole("alert")).toContainText(
    "Расписание временно недоступно",
  );
  await expect(
    main(page).getByRole("heading", {
      name: "На эти даты серии пока не запланированы",
    }),
  ).toHaveCount(0);
});

test("unknown dates stay out of the calendar while their subscriptions remain accessible", async ({
  page,
}) => {
  await setup(page, { noDates: true });
  await page.goto("/calendar?date=2026-10-28");
  await expect(
    main(page).getByRole("heading", {
      name: "На эти даты серии пока не запланированы",
    }),
  ).toBeVisible();
  await expect(
    main(page).getByRole("button", {
      name: "Включить уведомления: Тихий отдел",
    }),
  ).toBeVisible();
  await expect(main(page).getByRole("article")).toHaveCount(0);
});

test("mobile bell opens inbox, read-all clears badge, settings persist and five navigation items fit", async ({
  page,
}, testInfo) => {
  const api = await setup(page);
  await page.goto("/calendar?date=2026-10-28");
  await page
    .getByRole("banner")
    .getByRole("button", { name: "Уведомления: 1 новых" })
    .click();
  await expect(page).toHaveURL(/\/notifications$/);
  await expect(
    main(page).getByRole("article", { name: "Тихий отдел: сезон 2, серия 4" }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("notifications-mobile.png"),
    fullPage: true,
  });
  await main(page)
    .getByRole("button", { name: "Прочитать все", exact: true })
    .click();
  await expect(
    main(page).getByRole("heading", { name: "Новых уведомлений нет" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("banner")
      .getByRole("button", { name: "Уведомления", exact: true }),
  ).toBeVisible();
  expect(
    api.calls.find((call) => call.path === "/api/notifications")?.body,
  ).toEqual({ all: true, throughId: 501 });
  const automatic = main(page).getByRole("switch", {
    name: "Включать для новых сериалов",
  });
  await automatic.click();
  await expect(automatic).toHaveAttribute("aria-checked", "true");
  await page.reload();
  await expect(automatic).toHaveAttribute("aria-checked", "true");
  const nav = page.getByRole("navigation", { name: "Мобильная навигация" });
  await expect(nav.getByRole("link")).toHaveCount(5);
  await nav.getByRole("link", { name: "Календарь", exact: true }).click();
  await expect(
    nav.getByRole("link", { name: "Календарь", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});

test("failed notification writes preserve the unread badge and confirmed settings", async ({
  page,
}) => {
  await setup(page, { failSave: true });
  await page.goto("/notifications");
  await main(page)
    .getByRole("button", { name: "Прочитать все", exact: true })
    .click();
  await expect(main(page).getByRole("alert")).toContainText(
    "Не удалось сохранить прочтение",
  );
  await expect(main(page).getByRole("article")).toHaveCount(1);
  const notifications = main(page).getByRole("switch", {
    name: "Новые серии",
    exact: true,
  });
  await notifications.click();
  await expect(notifications).toHaveAttribute("aria-checked", "true");
  await expect(main(page).getByRole("alert").last()).toContainText(
    "Не удалось сохранить настройки",
  );
});

test("desktop inbox supports Escape and returns focus to the bell", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await setup(page);
  await page.goto("/calendar?date=2026-10-28&view=month");
  const trigger = page
    .getByRole("banner")
    .getByRole("button", { name: "Уведомления: 1 новых" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Уведомления", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toBeFocused();
  await page.screenshot({
    path: testInfo.outputPath("notifications-desktop.png"),
    fullPage: true,
  });
  await dialog.getByRole('button', { name: 'Все', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Все', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: /^Новые/ }).click();
  await expect(dialog.getByRole('button', { name: /^Новые/ })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("guests see a sign-in prompt and no personal calendar or notification content", async ({
  page,
}) => {
  const api = await setup(page, { guest: true });
  await page.goto("/calendar");
  await expect(
    main(page).getByRole("link", { name: "Войти", exact: true }),
  ).toBeVisible();
  expect(api.gets()).toBe(0);
  await page.goto("/notifications");
  await expect(
    main(page).getByRole("link", { name: "Войти", exact: true }),
  ).toBeVisible();
  await expect(main(page).getByRole("article")).toHaveCount(0);
});

test("calendar keeps an original air date when the viewer timezone is on the previous day", async ({
  browser,
}) => {
  const context = await browser.newContext({
    timezoneId: "America/Los_Angeles",
    viewport: { width: 390, height: 900 },
  });
  const page = await context.newPage();
  await setup(page);
  await page.clock.setFixedTime(new Date("2026-10-28T01:00:00Z"));
  await page.goto("/calendar?date=2026-10-28");
  await expect(
    main(page).getByRole("heading", { name: "Завтра · 28 октября" }),
  ).toBeVisible();
  await expect(
    main(page).getByRole("button", {
      name: "среда, 28 октября, серий: 1",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await context.close();
});
