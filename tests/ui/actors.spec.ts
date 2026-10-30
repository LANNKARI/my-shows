import { test, expect, type Page } from "@playwright/test";
const picture =
  "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";
const credits = [
  {
    id: 10,
    kind: "series",
    title: "Первый сериал",
    year: "2025",
    releaseDate: "2025-01-01",
    popularity: 100,
    roles: ["Главный герой"],
    rating: 8,
    posterUrl: picture,
  },
  {
    id: 10,
    kind: "movie",
    title: "Первый фильм",
    year: "2020",
    releaseDate: "2020-01-01",
    popularity: 90,
    roles: ["Первая роль", "Вторая роль"],
    rating: 7,
    posterUrl: picture,
  },
  {
    id: 12,
    kind: "movie",
    title: "Очень длинное название фильма ".repeat(6),
    year: null,
    releaseDate: null,
    popularity: 80,
    roles: [],
    rating: null,
    posterUrl: null,
  },
  {
    id: 13,
    kind: "series",
    title: "Старый сериал",
    year: "2000",
    releaseDate: "2000-01-01",
    popularity: 70,
    roles: ["Другая роль"],
    rating: 6,
    posterUrl: picture,
  },
];
const actor = {
  id: 123,
  name: "Майкл С. Холл",
  originalName: "Michael C. Hall",
  biography: "Биография актёра. ".repeat(60),
  biographyLanguage: "ru",
  profileUrl: picture,
  birthday: "1971-02-01",
  deathday: null,
  birthplace: "Роли, США",
  credits,
};
async function setup(
  page: Page,
  options: {
    guest?: boolean;
    missing?: boolean;
    fail?: boolean;
    empty?: boolean;
    english?: boolean;
    badgesFail?: boolean;
    many?: boolean;
  } = {},
) {
  let publicCalls = 0,
    libraryCalls = 0;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/session")
      return route.fulfill({
        json: options.guest
          ? null
          : {
              user: { id: "actor-user", username: "actor_user" },
              expires: "2099-01-01",
            },
      });
    if (path === "/api/actors/123") {
      publicCalls++;
      if (options.missing)
        return route.fulfill({
          status: 404,
          json: { error: "Актёр не найден" },
        });
      if (options.fail && publicCalls === 1)
        return route.fulfill({
          status: 503,
          json: { error: "Источник недоступен" },
        });
      return route.fulfill({
        json: {
          ...actor,
          biography: options.empty ? "" : actor.biography,
          biographyLanguage: options.english ? "en" : "ru",
          credits: options.empty
            ? []
            : options.many
              ? Array.from({ length: 30 }, (_, i) => ({
                  ...credits[0],
                  id: i + 100,
                  title: `Работа ${i}`,
                }))
              : credits,
        },
      });
    }
    if (path === "/api/actors/123/library") {
      libraryCalls++;
      if (options.badgesFail)
        return route.fulfill({
          status: 503,
          json: { error: "База недоступна" },
        });
      return route.fulfill({ json: { keys: ["series:10"] } });
    }
    return route.fulfill({
      json: { popcorn: 100, watchingCount: 1, plannedCount: 0 },
    });
  });
  return { libraryCalls: () => libraryCalls, publicCalls: () => publicCalls };
}
for (const width of [320, 390, 1440]) {
  test(`actor profile fits ${width}px with long titles and private badges`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await setup(page);
    await page.goto("/actors/123");
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 1 })).toHaveText(
      actor.name,
    );
    const series = main.getByRole("link", {
      name: "Первый сериал, сериал",
      exact: true,
    });
    const movie = main.getByRole("link", {
      name: "Первый фильм, фильм",
      exact: true,
    });
    await expect(series).toContainText("В библиотеке");
    await expect(movie).not.toContainText("В библиотеке");
    await expect(series).toHaveAttribute(
      "href",
      "/show/10?type=tv&source=tmdb",
    );
    await expect(movie).toHaveAttribute(
      "href",
      "/show/10?type=movie&source=tmdb",
    );
    await expect(movie).toContainText("Первая роль / Вторая роль");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await main.screenshot({
      path: `/workspace/scratch/actor-preview/actual-${width}.png`,
    });
  });
}
test("biography expands and filters and sorting preserve media identities", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/actors/123");
  const main = page.getByRole("main");
  const expand = main.getByRole("button", { name: "Читать полностью ↓" });
  await expand.click();
  await expect(
    main.getByRole("button", { name: "Свернуть ↑" }),
  ).toHaveAttribute("aria-expanded", "true");
  await main.getByRole("button", { name: "Фильмы (2)", exact: true }).click();
  const links = main.locator('a[href*="source=tmdb"]');
  await expect(links).toHaveCount(2);
  await main.getByRole("button", { name: "Все (4)", exact: true }).click();
  await main.getByLabel("Сортировка").selectOption("old");
  await expect(links.first()).toContainText("Старый сериал");
  await main.getByLabel("Сортировка").selectOption("new");
  await expect(links.first()).toContainText("Первый сериал");
  await expect(links.last()).toContainText("Очень длинное");
});
test("guests read public biographies without requesting private library data", async ({
  page,
}) => {
  const calls = await setup(page, { guest: true, english: true });
  await page.goto("/actors/123");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("main")).toContainText("Биография на английском");
  expect(calls.libraryCalls()).toBe(0);
});
test("missing biography and filmography show an honest empty state", async ({
  page,
}) => {
  await setup(page, { empty: true, guest: true });
  await page.goto("/actors/123");
  await expect(page.getByRole("main")).toContainText(
    "Биография пока не добавлена",
  );
  await expect(page.getByRole("main")).toContainText(
    "В этой категории пока нет работ",
  );
});
test("source failures offer retry rather than claiming that an actor does not exist", async ({
  page,
}) => {
  await setup(page, { fail: true });
  await page.goto("/actors/123");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Источник недоступен",
  );
  await expect(
    page.getByRole("heading", { name: "Актёр не найден" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Повторить загрузку" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(actor.name);
});
test("a 404 is distinct from a transient failure", async ({ page }) => {
  await setup(page, { missing: true });
  await page.goto("/actors/123");
  await expect(
    page.getByRole("heading", { name: "Актёр не найден" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Повторить загрузку" }),
  ).toHaveCount(0);
});
test("private database failures do not block the public actor profile", async ({
  page,
}) => {
  await setup(page, { badgesFail: true });
  await page.goto("/actors/123");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(actor.name);
  await expect(page.getByRole("main")).toContainText(
    "Не удалось проверить отметки библиотеки",
  );
  await expect(
    page.getByRole("main").locator('a[href*="source=tmdb"]'),
  ).toHaveCount(4);
});
test("long filmographies render in batches and filtering resets pagination", async ({
  page,
}) => {
  await setup(page, { many: true });
  await page.goto("/actors/123");
  const links = page.getByRole("main").locator('a[href*="source=tmdb"]');
  await expect(links).toHaveCount(24);
  await page.getByRole("button", { name: "Показать ещё (6)" }).click();
  await expect(links).toHaveCount(30);
  await page.getByRole("button", { name: "Фильмы (0)", exact: true }).click();
  await expect(links).toHaveCount(0);
});
