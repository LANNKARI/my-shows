import { test, expect } from "@playwright/test";

async function shell(page: import("@playwright/test").Page) {
  await page.route("**/api/**", (route) => route.fulfill({ json: null }));
}

test("profile service failures show a retry action instead of claiming the account does not exist", async ({
  page,
}) => {
  await shell(page);
  let available = false;
  await page.route("**/api/users/alex", (route) =>
    route.fulfill(
      available
        ? {
            json: {
              user: { id: "alex", username: "alex", name: "Alex" },
              stats: {},
              achievements: [],
              completedShows: [],
              favoriteShows: [],
            },
          }
        : { status: 503, json: { error: "Database unavailable" } },
    ),
  );
  await page.goto("/u/alex");
  const main = page.getByRole("main");
  await expect(
    main.getByRole("heading", { name: "Не удалось загрузить профиль" }),
  ).toBeVisible();
  await expect(
    main.getByText("Профиль не найден", { exact: true }),
  ).toHaveCount(0);
  available = true;
  await main.getByRole("button", { name: "Повторить загрузку" }).click();
  await expect(
    main.getByRole("heading", { name: "Alex", exact: true }),
  ).toBeVisible();
});

test("genuinely missing profiles still show not found without automatic retries", async ({
  page,
}) => {
  await shell(page);
  let calls = 0;
  await page.route("**/api/users/missing", (route) => {
    calls++;
    return route.fulfill({ status: 404, json: { error: "Not found" } });
  });
  await page.goto("/u/missing");
  await expect(
    page.getByRole("heading", { name: "Профиль не найден" }),
  ).toBeVisible();
  expect(calls).toBe(1);
});
