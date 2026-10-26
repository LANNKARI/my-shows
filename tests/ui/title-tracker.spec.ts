import { test, expect, type Page } from "@playwright/test";

const poster = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750"><defs><linearGradient id="a" x2="1" y2="1"><stop stop-color="#344356"/><stop offset="1" stop-color="#11131a"/></linearGradient></defs><rect width="500" height="750" fill="url(#a)"/><circle cx="250" cy="280" r="140" fill="#6c788b" opacity=".35"/><text x="250" y="560" text-anchor="middle" font-size="34" fill="white">MY SHOWS</text></svg>')}`;
function tracker() {
  return {
    userShow: {
      id: 100,
      showId: 10,
      status: "watching",
      kind: "series",
      updatedAt: "2026-10-26T10:00:00.000Z",
      isFavorite: false,
      dubbing: "Дубляж",
      watchSite: "Сервис",
      userRating: 6,
    },
    show: {
      id: 10,
      title: "Тихий отдел",
      originalTitle: "The Quiet Office",
      kind: "series",
      posterUrl: poster,
      year: "2025",
      genres: ["Драма", "Триллер"],
      tmdbRating: 8.4,
    },
    stats: { totalEpisodes: 16, watchedEpisodesCount: 3, progressPercent: 19 },
    seasons: [1, 2].map((season) => ({
      seasonNumber: season,
      totalEpisodes: 8,
      watchedEpisodes: season === 1 ? 3 : 0,
      isCompleted: false,
      episodes: Array.from({ length: 8 }, (_, index) => ({
        id: season * 100 + index + 1,
        season,
        episode: index + 1,
        watched: season === 1 && index < 3,
        stoppedAt:
          season === 1 && index === 3 ? "18:42" : (null as string | null),
      })),
    })),
  };
}
async function setup(
  page: Page,
  options: {
    guest?: boolean;
    fail?: boolean;
    delay?: boolean;
    last?: boolean;
  } = {},
) {
  const initial = tracker();
  if (options.last) {
    initial.seasons = [initial.seasons[0]];
    initial.seasons[0].episodes = initial.seasons[0].episodes.slice(0, 4);
    initial.seasons[0].totalEpisodes = 4;
    initial.stats.totalEpisodes = 4;
    initial.stats.progressPercent = 75;
  }
  await page.route("https://www.youtube-nocookie.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<html><body>Тестовый трейлер</body></html>",
    }),
  );
  let data = structuredClone(initial);
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
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
      return route.fulfill({ json: { watchingCount: 1, plannedCount: 0 } });
    if (path === "/api/popcorn")
      return route.fulfill({ json: { popcorn: 0, canClaimDaily: false } });
    if (request.method() === "GET" && path === "/api/shows/10")
      return route.fulfill({
        json: {
          show: {
            ...data.show,
            name: data.show.title,
            kind: "movie",
            runtime: 132,
            trailers: {
              russian: {
                id: "fixture",
                key: "fixture",
                name: "Тестовый трейлер",
                site: "YouTube",
                type: "Trailer",
              },
              english: null,
            },
            description: "История о выборе и поиске своего места.",
            cast: [{ id: 1, name: "Тестовый актёр" }],
            comments: [],
          },
          userShow: options.guest
            ? null
            : {
                ...data.userShow,
                ratings: [
                  { episodeId: 101, score: 10 },
                  { episodeId: null, score: data.userShow.userRating },
                ],
              },
        },
      });
    if (request.method() === "GET" && path === "/api/user-shows/10")
      return route.fulfill({ json: data });
    if (request.method() !== "GET") {
      const body = request.postDataJSON();
      calls.push({ path, body });
      if (options.delay)
        await new Promise((resolve) => setTimeout(resolve, 400));
      if (options.fail)
        return route.fulfill({
          status: 500,
          json: { error: "Сохранение недоступно" },
        });
      if (path.endsWith("/quick-progress")) {
        if (body.action === "undo") data = structuredClone(initial);
        else {
          data.seasons[0].episodes[3].watched = true;
          data.seasons[0].episodes[3].stoppedAt = null;
        }
        if (body.action === "mark" && options.last)
          data.userShow.status = "completed";
        data.userShow.updatedAt = "2026-10-26T10:01:00.000Z";
        return route.fulfill({
          json: {
            item: {
              userShowId: 100,
              status: data.userShow.status,
              updatedAt: data.userShow.updatedAt,
              progress: data.seasons.flatMap((season) =>
                season.episodes.map((episode) => ({
                  episodeId: episode.id,
                  watched: episode.watched,
                  stoppedAt: episode.stoppedAt,
                })),
              ),
            },
            undoToken: "fixture-token",
            undoExpiresAt: Date.now() + 600000,
            message: "Серия отмечена",
          },
        });
      }
      if (body.status === "completed")
        data.seasons.forEach((season) =>
          season.episodes.forEach((episode) => {
            episode.watched = true;
            episode.stoppedAt = null;
          }),
        );
      if (body.episodeId) {
        const episode = data.seasons
          .flatMap((season) => season.episodes)
          .find((episode) => episode.id === body.episodeId)!;
        if ("stoppedAt" in body)
          episode.stoppedAt = body.stoppedAt as string | null;
        if ("watched" in body) episode.watched = !!body.watched;
      }
      if (body.seasonNumber)
        data.seasons
          .find((season) => season.seasonNumber === body.seasonNumber)!
          .episodes.forEach((episode) => {
            episode.watched = !!body.markSeasonWatched;
          });
      if (
        request.method() === "POST" &&
        (body.watched !== undefined || body.markSeasonWatched !== undefined)
      ) {
        const all = data.seasons.every((season) =>
          season.episodes.every((episode) => episode.watched),
        );
        if (all) data.userShow.status = "completed";
        else if (data.userShow.status === "completed")
          data.userShow.status = "watching";
      }
      data.userShow = {
        ...data.userShow,
        ...body,
        ...(body.score ? { userRating: Number(body.score) } : {}),
      };
      data.seasons.forEach((season) => {
        season.watchedEpisodes = season.episodes.filter(
          (episode) => episode.watched,
        ).length;
        season.isCompleted = season.watchedEpisodes === season.episodes.length;
      });
      data.stats.watchedEpisodesCount = data.seasons.reduce(
        (sum, season) => sum + season.watchedEpisodes,
        0,
      );
      data.stats.progressPercent = Math.round(
        (data.stats.watchedEpisodesCount / 16) * 100,
      );
      return route.fulfill({
        json: {
          success: true,
          item: {
            ...data.userShow,
            progress: data.seasons.flatMap((season) =>
              season.episodes.map((episode) => ({
                episodeId: episode.id,
                watched: episode.watched,
                stoppedAt: episode.stoppedAt,
              })),
            ),
          },
        },
      });
    }
    return route.fulfill({ status: 404, json: { error: "Test fixture" } });
  });
  return calls;
}
const main = (page: Page) => page.getByRole("main");
const current = (page: Page) =>
  main(page).getByRole("region", { name: "Текущая серия" });

for (const width of [320, 390, 1440]) {
  test(`movie and tracker layout fit ${width}px and keep primary actions visible`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    await page.goto("/show/10");
    await expect(
      main(page).getByRole("heading", { name: "Тихий отдел" }),
    ).toBeVisible();
    const primary = main(page).getByRole("button", {
      name: "Отметить просмотренным",
    });
    await expect(primary).toBeInViewport();
    await expect(
      main(page).getByRole("combobox", { name: "Моя оценка" }),
    ).toHaveValue("6");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`movie-${width}.png`),
      fullPage: true,
    });
    await page.goto("/library/10");
    await expect(current(page).getByText("Сезон 1 · Серия 4")).toBeVisible();
    await expect(
      current(page).getByRole("button", { name: "Отметить серию" }),
    ).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`tracker-${width}.png`),
      fullPage: true,
    });
  });
}

test("film sections preserve discussion and status survives rating, favorite and notes edits", async ({
  page,
}) => {
  const calls = await setup(page);
  await page.goto("/show/10");
  await main(page)
    .getByRole("button", { name: "Отметить просмотренным" })
    .click();
  await expect(
    main(page).getByRole("combobox", { name: "Статус просмотра" }),
  ).toHaveValue("completed");
  await main(page)
    .getByRole("combobox", { name: "Моя оценка" })
    .selectOption("9");
  await expect(
    main(page).getByRole("combobox", { name: "Моя оценка" }),
  ).toHaveValue("9");
  await main(page)
    .getByRole("button", { name: "В избранное", exact: true })
    .click();
  await expect(
    main(page).getByRole("button", { name: "Убрать из избранного" }),
  ).toHaveAttribute("aria-pressed", "true");
  await main(page)
    .getByRole("button", { name: "Изменить: Озвучка", exact: true })
    .click();
  await main(page)
    .getByRole("textbox", { name: "Озвучка", exact: true })
    .fill("Новая озвучка");
  await main(page)
    .getByRole("button", { name: "Сохранить", exact: true })
    .click();
  await expect(
    main(page).getByText("Новая озвучка", { exact: true }),
  ).toBeVisible();
  await main(page).getByRole("button", { name: "Актёры", exact: true }).click();
  await expect(main(page).getByText("Тестовый актёр")).toBeVisible();
  await main(page)
    .getByRole("button", { name: "Обсуждение", exact: true })
    .click();
  await expect(main(page).getByRole("textbox")).toBeVisible();
  await main(page)
    .getByRole("button", { name: "О фильме", exact: true })
    .click();
  await expect(
    main(page).getByText("История о выборе и поиске своего места."),
  ).toBeVisible();
  expect(calls.map((call) => call.body)).toEqual([
    { status: "completed" },
    { score: 9 },
    { isFavorite: true },
    { dubbing: "Новая озвучка" },
  ]);
  await expect(
    main(page).getByRole("combobox", { name: "Статус просмотра" }),
  ).toHaveValue("completed");
});

test("failed film edits keep the confirmed rating, favorite and note and keep the draft", async ({
  page,
}) => {
  await setup(page, { fail: true });
  await page.goto("/show/10");
  await main(page)
    .getByRole("combobox", { name: "Моя оценка" })
    .selectOption("9");
  await expect(main(page).getByRole("alert")).toContainText(
    "Сохранение недоступно",
  );
  await expect(
    main(page).getByRole("combobox", { name: "Моя оценка" }),
  ).toHaveValue("6");
  await main(page)
    .getByRole("button", { name: "В избранное", exact: true })
    .click();
  await expect(
    main(page).getByRole("button", { name: "В избранное", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await main(page)
    .getByRole("button", { name: "Изменить: Озвучка", exact: true })
    .click();
  await main(page)
    .getByRole("textbox", { name: "Озвучка", exact: true })
    .fill("Не сохранено");
  await main(page)
    .getByRole("button", { name: "Сохранить", exact: true })
    .click();
  await expect(
    main(page).getByRole("textbox", { name: "Озвучка", exact: true }),
  ).toHaveValue("Не сохранено");
});

test("guest reads film details and personal actions lead to login without writes", async ({
  page,
}) => {
  const calls = await setup(page, { guest: true });
  await page.goto("/show/10");
  await expect(
    main(page).getByText("История о выборе и поиске своего места."),
  ).toBeVisible();
  await main(page)
    .getByRole("button", { name: "Отметить просмотренным" })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  expect(calls).toHaveLength(0);
});

test("tracker quick mark uses library ID, advances progress and undo restores time", async ({
  page,
}) => {
  const calls = await setup(page);
  await page.goto("/library/10");
  await current(page).getByRole("button", { name: "Отметить серию" }).click();
  await expect(current(page).getByText("Сезон 1 · Серия 5")).toBeVisible();
  await expect(main(page).getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "25",
  );
  await main(page).getByRole("button", { name: "Отменить отметку" }).click();
  await expect(current(page).getByText("Время остановки: 18:42")).toBeVisible();
  expect(calls[0]).toEqual({
    path: "/api/user-shows/100/quick-progress",
    body: {
      action: "mark",
      expectedUpdatedAt: "2026-10-26T10:00:00.000Z",
      expectedEpisodeId: 104,
    },
  });
  expect(calls[1].body).toEqual({ action: "undo", token: "fixture-token" });
});

test("tracker confirms whole seasons and cancellation never changes progress", async ({
  page,
}) => {
  const calls = await setup(page);
  await page.goto("/library/10");
  const season = main(page).getByRole("region", {
    name: "Сезон 1",
    exact: true,
  });
  await season
    .getByRole("button", { name: "Отметить сезон", exact: true })
    .click();
  expect(calls).toHaveLength(0);
  await season.getByRole("button", { name: "Отмена", exact: true }).click();
  expect(calls).toHaveLength(0);
  await season
    .getByRole("button", { name: "Отметить сезон", exact: true })
    .click();
  await season.getByRole("button", { name: "Подтвердить" }).click();
  await expect(
    season.getByRole("button", { name: "Снять отметки сезона" }),
  ).toBeVisible();
  expect(calls).toEqual([
    {
      path: "/api/user-shows/10",
      body: { seasonNumber: 1, markSeasonWatched: true },
    },
  ]);
});

test("tracker validates time and preserves the open season after saving", async ({
  page,
}) => {
  const calls = await setup(page);
  await page.goto("/library/10");
  await current(page)
    .getByRole("button", { name: "Изменить время", exact: true })
    .click();
  const input = main(page).getByRole("textbox", {
    name: /Время остановки: сезон 1, серия 4/,
  });
  await input.fill("18:99");
  await main(page).getByRole("button", { name: "Сохранить время" }).click();
  await expect(main(page).getByRole("alert")).toContainText("формате");
  expect(calls).toHaveLength(0);
  await input.fill("90:05");
  await main(page).getByRole("button", { name: "Сохранить время" }).click();
  await expect(current(page).getByText("Время остановки: 90:05")).toBeVisible();
  await expect(
    main(page)
      .getByRole("region", { name: "Сезон 1", exact: true })
      .getByRole("button", { name: /Сезон 1.*просмотрено/ }),
  ).toHaveAttribute("aria-expanded", "true");
  expect(calls[0]).toEqual({
    path: "/api/user-shows/10",
    body: { episodeId: 104, stoppedAt: "90:05" },
  });
});

test("tracker failures do not change progress and rapid marks send one request", async ({
  page,
}) => {
  const calls = await setup(page, { fail: true, delay: true });
  await page.goto("/library/10");
  await current(page)
    .getByRole("button", { name: "Отметить серию" })
    .dblclick();
  await expect(main(page).getByRole("alert")).toContainText(
    "Сохранение недоступно",
  );
  await expect(current(page).getByText("Время остановки: 18:42")).toBeVisible();
  await expect(main(page).getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "19",
  );
  expect(calls).toHaveLength(1);
});

test("seasons start compact, can expand and remain keyboard operable", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/library/10");
  const first = main(page).getByRole("region", {
    name: "Сезон 1",
    exact: true,
  });
  await expect(first.getByRole("checkbox")).toHaveCount(5);
  await first.getByRole("button", { name: "Показать все 8 серий" }).click();
  await expect(first.getByRole("checkbox")).toHaveCount(8);
  const second = main(page).getByRole("region", {
    name: "Сезон 2",
    exact: true,
  });
  const toggle = second.getByRole("button", { name: /Сезон 2.*просмотрено/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(second.getByRole("checkbox").first()).toBeVisible();
});

test("last episode keeps undo accessible and restores the watching status", async ({
  page,
}) => {
  await setup(page, { last: true });
  await page.goto("/library/10");
  await current(page).getByRole("button", { name: "Отметить серию" }).click();
  await expect(
    current(page).getByRole("heading", {
      name: "Все доступные серии просмотрены",
    }),
  ).toBeVisible();
  const undo = main(page).getByRole("button", { name: "Отменить отметку" });
  await expect(undo).toBeFocused();
  await undo.click();
  await expect(current(page).getByText("Время остановки: 18:42")).toBeVisible();
  await expect(
    main(page).getByRole("combobox", { name: "Статус просмотра" }),
  ).toHaveValue("watching");
});

test("trailer opens above the card and Escape returns keyboard focus", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/show/10");
  const trigger = main(page).getByRole("button", { name: "▷ Трейлер" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Трейлер", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toBeFocused();
  expect(
    await dialog.evaluate(
      (element) => element.parentElement?.parentElement === document.body,
    ),
  ).toBe(true);
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "✕" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("guest cannot see private tracker data", async ({ page }) => {
  const calls = await setup(page, { guest: true });
  await page.goto("/library/10");
  await expect(
    main(page).getByRole("heading", { name: "Войдите, чтобы открыть трекер" }),
  ).toBeVisible();
  await expect(main(page).getByText("Дубляж", { exact: true })).toHaveCount(0);
  expect(calls).toHaveLength(0);
});

test("explicit completion updates all tracker checkboxes and counts immediately", async ({
  page,
}) => {
  const calls = await setup(page);
  await page.goto("/library/10");
  await main(page)
    .getByRole("combobox", { name: "Статус просмотра" })
    .selectOption("completed");
  await expect(main(page).getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  await expect(
    current(page).getByRole("heading", {
      name: "Все доступные серии просмотрены",
    }),
  ).toBeVisible();
  const first = main(page).getByRole("region", {
    name: "Сезон 1",
    exact: true,
  });
  await expect(first.getByRole("checkbox").first()).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(
    first.getByRole("button", {
      name: "Изменить время: сезон 1, серия 1",
      exact: true,
    }),
  ).toBeDisabled();
  expect(calls[0]).toEqual({
    path: "/api/user-shows/10",
    body: { status: "completed" },
  });
});

test("unmarking a completed episode resumes watching and status selection preserves marks", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/library/10");
  const status = main(page).getByRole("combobox", { name: "Статус просмотра" });
  await status.selectOption("completed");
  await expect(main(page).getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  await status.selectOption("watching");
  await expect(status).toHaveValue("watching");
  await expect(main(page).getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  await status.selectOption("completed");
  await main(page)
    .getByRole("checkbox", {
      name: "Сезон 1, серия 1: просмотрено",
      exact: true,
    })
    .click();
  await expect(status).toHaveValue("watching");
  await expect(current(page).getByText("Сезон 1 · Серия 1")).toBeVisible();
  await expect(main(page).getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "94",
  );
});
