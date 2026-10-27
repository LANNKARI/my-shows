import { test, expect, type Page } from "@playwright/test";
const session = {
  user: { id: "feature-user", username: "feature_user" },
  expires: "2099-01-01",
};
async function shell(page: Page, guest = false) {
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/session")
      return route.fulfill({ json: guest ? null : session });
    if (path === "/api/home")
      return route.fulfill({
        json: {
          heroSlides: [],
          recentOnline: [],
          universes: [],
          directors: [],
        },
      });
    if (path === "/api/users/me")
      return route.fulfill({
        json: {
          id: "feature-user",
          username: "feature_user",
          email: "test@example.test",
          bio: "",
          name: "Тест",
          avatarUrl: null,
        },
      });
    if (path === "/api/users/counts")
      return route.fulfill({ json: { watchingCount: 1, plannedCount: 0 } });
    if (path === "/api/popcorn")
      return route.fulfill({ json: { popcorn: 100, canClaimDaily: false } });
    return route.fulfill({ status: 404, json: { error: "UI fixture" } });
  });
}
for (const width of [320, 390, 1440])
  test(`continue watching fits ${width}px without changing progress`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await shell(page);
    let writes = 0;
    await page.route("**/api/continue-watching", (route) => {
      if (route.request().method() !== "GET") writes++;
      return route.fulfill({
        json: [
          {
            showId: 10,
            title: "Разделение",
            kind: "series",
            posterUrl: null,
            next: { season: 2, episode: 4 },
            stoppedAt: "18:42",
            total: 19,
            watched: 12,
            percent: 63,
          },
        ],
      });
    });
    await page.goto("/");
    const shelf = page.getByRole("region", { name: "Продолжить просмотр" });
    await expect(shelf.getByText("Остановились на 18:42")).toBeVisible();
    await expect(
      shelf.getByRole("link", { name: "Открыть трекер →" }),
    ).toHaveAttribute("href", "/library/10");
    expect(writes).toBe(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await shelf.screenshot({
      path: testInfo.outputPath(`continue-${width}.png`),
    });
  });
test("guests do not request a private continue-watching shelf", async ({
  page,
}) => {
  await shell(page, true);
  let reads = 0;
  await page.route("**/api/continue-watching", (route) => {
    reads++;
    return route.fulfill({ json: [] });
  });
  await page.goto("/");
  await expect(
    page.getByRole("region", { name: "Продолжить просмотр" }),
  ).toHaveCount(0);
  expect(reads).toBe(0);
});

test("import requires preview and explicit confirmation, then resumes a failed batch", async ({
  page,
}) => {
  await shell(page);
  let commits = 0;
  const rows = Array.from({ length: 6 }, (_, index) => ({
    index,
    title: "Тайтл " + index,
    state: "new",
    reason: "Готово к добавлению",
    showId: null,
    candidates: [],
  }));
  await page.route("**/api/library-import", (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "preview")
      return route.fulfill({
        json: {
          jobId: "job-1",
          rows,
          warnings: [],
          cursor: 0,
          total: 6,
          completed: false,
          result: { added: 0, skipped: 0, collections: 0, messages: [] },
        },
      });
    commits++;
    if (commits === 2)
      return route.fulfill({
        status: 503,
        json: { error: "Временная ошибка" },
      });
    return route.fulfill({
      json: {
        jobId: "job-1",
        cursor: commits === 1 ? 5 : 6,
        total: 6,
        completed: commits !== 1,
        result: {
          added: commits === 1 ? 5 : 6,
          skipped: 0,
          collections: 0,
          messages: [],
        },
      },
    });
  });
  await page.goto("/settings");
  const region = page.getByRole("region", { name: "Импорт библиотеки" });
  await region
    .getByLabel("Файл резервной копии")
    .setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          meta: { version: 2, generator: "EpisyHub" },
          userShows: [],
        }),
      ),
    });
  expect(commits).toBe(0);
  await region.getByRole("button", { name: "Проверить файл" }).click();
  await expect(
    region.getByText("Готово к добавлению: 6", { exact: false }),
  ).toBeVisible();
  expect(commits).toBe(0);
  await region.getByRole("button", { name: "Подтвердить импорт" }).click();
  await expect(region.getByRole("alert")).toContainText(
    "Уже обработанные пакеты сохранены",
  );
  await expect(region.getByText("Обработано 5 из 6")).toBeVisible();
  await region.getByRole("button", { name: "Продолжить импорт" }).click();
  await expect(region.getByRole("status")).toContainText("добавлено 6");
  expect(commits).toBe(3);
  const nextPreview=page.waitForRequest(request=>new URL(request.url()).pathname==='/api/library-import'&&request.postDataJSON().action==='preview');
  await region.getByRole('button',{name:'Проверить файл для нового импорта'}).click();
  expect((await nextPreview).postDataJSON().newRun).toBe(true);
  await expect(region.getByRole('button',{name:'Подтвердить импорт'})).toBeEnabled();
  expect(commits).toBe(3);
});

test("task rewards show server-confirmed balance and disable a claimed reward", async ({
  page,
}, testInfo) => {
  await shell(page);
  let claimed = false,
    calls = 0;
  await page.route("**/api/popcorn", (route) => {
    if (route.request().method() === "POST") {
      calls++;
      expect(route.request().postDataJSON()).toEqual({
        action: "claim-task",
        taskId: "episodes",
      });
      claimed = true;
      return route.fulfill({ json: { reward: 10 } });
    }
    return route.fulfill({
      json: {
        popcorn: claimed ? 110 : 100,
        canClaimDaily: false,
        dailyStreak: 3,
        nextStreak: 4,
        streakRewards: { 1: 10, 2: 15, 3: 20, 4: 25, 5: 30, 6: 40, 7: 50 },
        activityEarned: 6,
        activityLimit: 60,
        gameEarned: 20,
        gameLimit: 50,
        tasks: [
          {
            id: "episodes",
            name: "Просмотреть 2 серии",
            count: 2,
            target: 2,
            reward: 10,
            claimed,
          },
        ],
        allTasksClaimed: false,
      },
    });
  });
  await page.route("**/api/popcorn-history", (route) =>
    route.fulfill({ json: { items: [], nextCursor: null } }),
  );
  await page.goto("/rewards");
  const main = page.getByRole("main");
  await main
    .getByRole("button", { name: "Забрать +10 🍿", exact: true })
    .click();
  await expect(main.getByText("110 🍿", { exact: true })).toBeVisible();
  await expect(
    main.getByRole("button", { name: "Получено", exact: true }),
  ).toBeDisabled();
  expect(calls).toBe(1);
  await main.screenshot({ path: testInfo.outputPath("rewards-economy.png") });
});

test("quiz submits a server round instead of a user-selected target and recovers after an uncertain response", async ({
  page,
}) => {
  await shell(page);
  let attempts = 0;
  await page.route("**/api/popcorn*", (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (req.method() === "POST") {
      const body = req.postDataJSON();
      expect(body).toEqual({
        action: "submit-quiz",
        roundId: "server-round",
        selectedTitle: "Верный фильм",
      });
      attempts++;
      if (attempts === 1) return route.abort();
      return route.fulfill({
        json: {
          isCorrect: true,
          correctTitle: "Верный фильм",
          reward: 0,
          alreadyAnswered: true,
        },
      });
    }
    if (url.searchParams.get("action") === "get-quiz")
      return route.fulfill({
        json: {
          roundId: "server-round",
          options: ["Верный фильм", "Другой фильм"],
          backdropUrl: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
        },
      });
    return route.fulfill({ json: { popcorn: 100 } });
  });
  await page.goto("/rewards/quiz");
  await page.getByRole("button", { name: "Верный фильм", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Повтор ответа не начисляет награду дважды",
  );
  await page.getByRole("button", { name: "Повторить проверку ответа" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText(
    "Начислено 0",
  );
  expect(attempts).toBe(2);
});
