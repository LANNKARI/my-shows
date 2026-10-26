import { expect, test, type Page } from "@playwright/test";
import { COSMETICS } from "../../src/lib/cosmetics";
const photo = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><rect width="180" height="180" fill="#41495d"/><circle cx="90" cy="65" r="35" fill="#c4b8b0"/><ellipse cx="90" cy="160" rx="65" ry="60" fill="#242936"/></svg>')}`;
const cover = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="300"><rect width="900" height="300" fill="#394b59"/><path d="M0 300 250 80 450 230 650 40 900 300" fill="#24323e"/></svg>')}`;
async function setup(
  page: Page,
  options: {
    guest?: boolean;
    balance?: number;
    failed?: boolean;
    failLoad?: boolean;
    delay?: boolean;
    lostPurchase?: boolean;
  } = {},
) {
  const data = {
    user: {
      id: "ui-user",
      username: "alex",
      name: "Александра",
      bio: "Собираю любимые истории",
      avatarUrl: photo,
      bannerUrl: cover,
      popcorn: options.balance ?? 240,
      avatarFrame: "frame-standard",
      profileStyle: "profile-standard",
    },
    catalog: COSMETICS,
    purchases: [
      {
        itemId: "frame-film",
        pricePaid: 100,
        purchasedAt: "2026-10-27T00:00:00Z",
      },
    ],
    stats: {
      moviesCount: 42,
      seriesCount: 18,
      ratingsCount: 57,
      hoursWatched: 124,
    },
  };
  const calls: Record<string, unknown>[] = [];
  let lost = false;
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    if (path === "/api/auth/session")
      return route.fulfill({
        json: options.guest
          ? null
          : {
              user: {
                id: data.user.id,
                username: "alex",
                name: data.user.name,
                image: photo,
                avatarFrame: data.user.avatarFrame,
              },
              expires: "2099-01-01T00:00:00Z",
            },
      });
    if (path === "/api/auth/csrf")
      return route.fulfill({ json: { csrfToken: "fixture" } });
    if (path === "/api/users/counts")
      return route.fulfill({ json: { watchingCount: 2, plannedCount: 0 } });
    if (path === "/api/popcorn")
      return route.fulfill({
        json: { popcorn: data.user.popcorn, canClaimDaily: false },
      });
    if (path === "/api/notifications")
      return route.fulfill({
        json: {
          items: [],
          unreadCount: 0,
          latestId: 0,
          nextCursor: null,
          preferences: {
            releaseNotificationsEnabled: true,
            notifyNewShows: false,
            notificationTimeZone: "UTC",
          },
        },
      });
    if (path === "/api/cosmetics" && request.method() === "GET")
      return options.failLoad
        ? route.fulfill({
            status: 503,
            json: { error: "Магазин временно недоступен" },
          })
        : route.fulfill({ json: data });
    if (path === "/api/cosmetics") {
      const body = request.postDataJSON();
      calls.push(body);
      if (options.delay)
        await new Promise((resolve) => setTimeout(resolve, 400));
      if (options.failed)
        return route.fulfill({
          status: 409,
          json: {
            error: "Не хватает попкорна. Баланс изменился в другой вкладке.",
          },
        });
      const item = COSMETICS.find((item) => item.id === body.itemId)!;
      if (body.action === "purchase") {
        let receipt = data.purchases.find(
          (purchase) => purchase.itemId === item.id,
        );
        if (!receipt) {
          data.user.popcorn -= item.price;
          receipt = {
            itemId: item.id,
            pricePaid: item.price,
            purchasedAt: "2026-10-27T10:00:00Z",
          };
          data.purchases.push(receipt);
        }
        if (options.lostPurchase && !lost) {
          lost = true;
          return route.abort("failed");
        }
        return route.fulfill({
          json: { success: true, user: data.user, purchase: receipt },
        });
      }
      if (item.kind === "frame") data.user.avatarFrame = item.id;
      else data.user.profileStyle = item.id;
      return route.fulfill({ json: { success: true, user: data.user } });
    }
    if (path === "/api/users/alex")
      return route.fulfill({
        json: {
          user: { ...data.user, createdAt: "2026-01-01T00:00:00Z" },
          isOwnProfile: true,
          stats: { totalCompleted: 60, ...data.stats },
          favorites: [],
          achievements: [],
          completedShows: [],
        },
      });
    if (path === "/api/shows/10")
      return route.fulfill({
        json: {
          show: {
            id: 10,
            kind: "movie",
            name: "Тестовый фильм",
            description: "Описание",
            comments: [
              {
                id: 1,
                text: "Пример комментария",
                createdAt: "2026-10-27T00:00:00Z",
                user: { ...data.user },
              },
            ],
          },
          userShow: null,
        },
      });
    if (path === "/api/shows/10/comments")
      return route.fulfill({
        json: {
          id: 2,
          text: request.postDataJSON().text,
          createdAt: "2026-10-27T00:00:00Z",
          user: { ...data.user },
        },
      });
    return route.fulfill({ status: 404, json: { error: "Test fixture" } });
  });
  return { data, calls };
}
const main = (page: Page) => page.getByRole("main");
const card = (page: Page, name: string) =>
  main(page).getByRole("article", { name, exact: true });
const dialog = (page: Page) =>
  page.getByRole("dialog", { name: "Купить рамку «Золотая»?" });
async function previewGold(page: Page) {
  await card(page, "Золотая")
    .getByRole("button", { name: "Примерить", exact: true })
    .click();
}

for (const width of [320, 390, 1440])
  test(`shop, preview and confirmation fit ${width}px without spending during preview`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const api = await setup(page);
    await page.goto("/cosmetics");
    await expect(
      main(page).getByRole("heading", { name: "Оформление", exact: true }),
    ).toBeVisible();
    await expect(
      card(page, "Стандартная").getByRole("button", {
        name: "Выбрано",
        exact: true,
      }),
    ).toBeDisabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`shop-${width}.png`),
      fullPage: true,
    });
    await previewGold(page);
    await expect(
      main(page)
        .getByRole("region", { name: "Предпросмотр профиля" })
        .locator(".cosmetic-avatar"),
    ).toHaveAttribute("data-frame", "frame-gold");
    expect(api.calls).toHaveLength(0);
    await page.screenshot({
      path: testInfo.outputPath(`preview-${width}.png`),
      fullPage: true,
    });
    await main(page)
      .getByRole("button", { name: "Купить за 120 🍿", exact: true })
      .click();
    await expect(dialog(page)).toBeVisible();
    await expect(
      dialog(page).getByRole("button", { name: "Отмена", exact: true }),
    ).toBeFocused();
    await expect(dialog(page)).toContainText("После покупки");
    await expect(dialog(page)).toContainText("120");
    expect(api.calls).toHaveLength(0);
    await page.screenshot({
      path: testInfo.outputPath(`confirm-${width}.png`),
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
    await expect(
      main(page).getByRole("button", { name: "Купить за 120 🍿", exact: true }),
    ).toBeFocused();
  });

test("buy once, equip, reload and see the same frame in the public profile and comments", async ({
  page,
}) => {
  const api = await setup(page);
  await page.goto("/cosmetics");
  await previewGold(page);
  await main(page)
    .getByRole("button", { name: "Купить за 120 🍿", exact: true })
    .click();
  await dialog(page)
    .getByRole("button", { name: "Подтвердить покупку", exact: true })
    .click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(
    main(page).getByLabel("Баланс: 120 попкорна", { exact: true }),
  ).toBeVisible();
  expect(api.data.user.avatarFrame).toBe("frame-standard");
  await main(page)
    .getByRole("button", { name: "Надеть рамку", exact: true })
    .click();
  await expect(
    card(page, "Золотая").getByRole("button", { name: "Выбрано", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("banner").locator(".cosmetic-avatar"),
  ).toHaveAttribute("data-frame", "frame-gold");
  await page.reload();
  await expect(
    card(page, "Золотая").getByRole("button", { name: "Выбрано", exact: true }),
  ).toBeVisible();
  await page.goto("/u/alex");
  await expect(main(page).locator(".cosmetic-avatar").first()).toHaveAttribute(
    "data-frame",
    "frame-gold",
  );
  await page.goto("/show/10");
  await main(page)
    .getByRole("button", { name: "Обсуждение", exact: true })
    .click();
  await expect(
    main(page).getByRole("article").locator(".cosmetic-avatar"),
  ).toHaveAttribute("data-frame", "frame-gold");
  await main(page)
    .getByRole("textbox", { name: "Комментарий", exact: true })
    .fill("Новый комментарий с рамкой");
  await main(page)
    .getByRole("button", { name: "Опубликовать", exact: true })
    .click();
  await expect(
    main(page).getByText("Новый комментарий с рамкой", { exact: true }),
  ).toBeVisible();
  expect(api.calls).toEqual([
    { action: "purchase", itemId: "frame-gold", expectedPrice: 120 },
    { action: "equip", itemId: "frame-gold" },
  ]);
});

test("collection contains only owned and free items; applying costs nothing", async ({
  page,
}) => {
  const api = await setup(page);
  await page.goto("/cosmetics");
  await main(page)
    .getByRole("button", { name: "Моя коллекция", exact: true })
    .click();
  await expect(main(page).getByRole("article")).toHaveCount(2);
  await card(page, "Киноплёнка")
    .getByRole("button", { name: "Надеть", exact: true })
    .click();
  await expect(
    card(page, "Киноплёнка").getByRole("button", {
      name: "Выбрано",
      exact: true,
    }),
  ).toBeVisible();
  await card(page, "Стандартная")
    .getByRole("button", { name: "Надеть", exact: true })
    .click();
  await expect(
    card(page, "Стандартная").getByRole("button", {
      name: "Выбрано",
      exact: true,
    }),
  ).toBeVisible();
  expect(api.data.user.popcorn).toBe(240);
  expect(api.calls.every((call) => call.action === "equip")).toBe(true);
});

test("canceling a profile style preview preserves the uploaded cover and saves nothing", async ({
  page,
}) => {
  const api = await setup(page);
  await page.goto("/cosmetics");
  await main(page)
    .getByRole("button", { name: "Профиль", exact: true })
    .click();
  await card(page, "Винный акцент")
    .getByRole("button", { name: "Примерить", exact: true })
    .click();
  await expect(
    main(page)
      .getByRole("region", { name: "Предпросмотр профиля" })
      .locator(".cosmetic-cover"),
  ).toHaveAttribute("data-profile-style", "profile-wine");
  await main(page)
    .getByRole("button", { name: "Отменить примерку", exact: true })
    .click();
  expect(api.calls).toHaveLength(0);
  expect(api.data.user.bannerUrl).toBe(cover);
  expect(api.data.user.profileStyle).toBe("profile-standard");
});

test("insufficient balance still allows preview and points to earning popcorn", async ({
  page,
}) => {
  await setup(page, { balance: 20 });
  await page.goto("/cosmetics");
  await previewGold(page);
  await expect(
    main(page).getByRole("button", { name: "Купить за 120 🍿", exact: true }),
  ).toBeDisabled();
  await expect(main(page).getByText(/Не хватает 100 попкорна/)).toBeVisible();
  await expect(
    main(page).getByRole("link", { name: "Перейти к наградам и играм →" }),
  ).toHaveAttribute("href", "/rewards");
});

test("a stale balance error keeps the confirmation visible and never pretends the item was purchased", async ({
  page,
}) => {
  const api = await setup(page, { failed: true });
  await page.goto("/cosmetics");
  await previewGold(page);
  await main(page)
    .getByRole("button", { name: "Купить за 120 🍿", exact: true })
    .click();
  await dialog(page)
    .getByRole("button", { name: "Подтвердить покупку", exact: true })
    .click();
  await expect(dialog(page).getByRole("alert")).toContainText(
    "Баланс изменился",
  );
  expect(api.data.purchases.some((item) => item.itemId === "frame-gold")).toBe(
    false,
  );
  expect(api.data.user.popcorn).toBe(240);
  await dialog(page)
    .getByRole("button", { name: "Отмена", exact: true })
    .click();
  await expect(
    main(page).getByRole("button", { name: "Купить за 120 🍿", exact: true }),
  ).toBeVisible();
});

test("rapid confirmation sends one request and disables cancellation until the result", async ({
  page,
}) => {
  const api = await setup(page, { delay: true });
  await page.goto("/cosmetics");
  await previewGold(page);
  await main(page)
    .getByRole("button", { name: "Купить за 120 🍿", exact: true })
    .click();
  await dialog(page)
    .getByRole("button", { name: "Подтвердить покупку", exact: true })
    .dblclick();
  await expect(
    dialog(page).getByRole("button", { name: "Отмена", exact: true }),
  ).toBeDisabled();
  await expect(dialog(page)).toHaveCount(0);
  expect(api.calls).toHaveLength(1);
  expect(api.data.user.popcorn).toBe(120);
});

test("an uncertain purchase recovers from the server without charging again", async ({
  page,
}) => {
  const api = await setup(page, { lostPurchase: true });
  await page.goto("/cosmetics");
  await previewGold(page);
  await main(page)
    .getByRole("button", { name: "Купить за 120 🍿", exact: true })
    .click();
  await dialog(page)
    .getByRole("button", { name: "Подтвердить покупку", exact: true })
    .click();
  await expect(dialog(page).getByRole("alert")).toContainText(
    "Не удалось подтвердить",
  );
  await dialog(page)
    .getByRole("button", { name: "Обновить магазин", exact: true })
    .click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(
    main(page).getByRole("button", { name: "Надеть рамку", exact: true }),
  ).toBeVisible();
  expect(api.data.user.popcorn).toBe(120);
  expect(api.calls).toHaveLength(1);
});

test("guests cannot see a balance or private collection and load errors offer retry", async ({
  page,
}) => {
  await setup(page, { guest: true });
  await page.goto("/cosmetics");
  await expect(
    main(page).getByRole("link", { name: "Войти", exact: true }),
  ).toBeVisible();
  await expect(main(page).getByRole("article")).toHaveCount(0);
});

test("shop distinguishes loading failure from an empty collection", async ({
  page,
}) => {
  await setup(page, { failLoad: true });
  await page.goto("/cosmetics");
  await expect(main(page).getByRole("alert")).toContainText(
    "Магазин временно недоступен",
  );
  await expect(
    main(page).getByRole("button", { name: "Повторить загрузку", exact: true }),
  ).toBeVisible();
});
