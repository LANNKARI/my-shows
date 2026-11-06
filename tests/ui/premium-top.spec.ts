import { test, expect, type Page } from "@playwright/test";
const users = [
  {
    id: "top-premium",
    username: "premium_user",
    name: "Айрат",
    score: 343,
    showsCount: 2,
    ratingsCount: 3,
    commentsCount: 1,
    avatarUrl: null,
  },
  {
    id: "top-pioneer",
    username: "pioneer_user",
    name: "Максим",
    score: 55,
    showsCount: 20,
    ratingsCount: 1,
    commentsCount: 2,
    avatarUrl: null,
  },
  {
    id: "top-basic",
    username: "basic_user",
    name: "Лан, пусть будет Карри",
    score: 1,
    showsCount: 1,
    ratingsCount: 2,
    commentsCount: 0,
    avatarUrl: null,
  },
];
async function setup(page: Page) {
  let active = true;
  const batches: string[][] = [];
  await page.route("**/api/**", (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === "/api/auth/session")
      return route.fulfill({ json: null });
    if (u.pathname === "/api/top") return route.fulfill({ json: users });
    if (u.pathname === "/api/account-badges") {
      const ids = (u.searchParams.get("ids") || "").split(",");
      batches.push(ids);
      return route.fulfill({
        json: Object.fromEntries(
          ids.map((id) => [
            id,
            id === "top-premium"
              ? [
                  {
                    roleId: "owner",
                    name: "Администратор",
                    color: "#ff0000",
                    icon: "♛",
                  },
                  ...(active
                    ? [
                        {
                          roleId: "premium",
                          name: "Premium",
                          color: "#d5af69",
                          icon: "✦",
                        },
                      ]
                    : []),
                ]
              : id === "top-pioneer"
                ? [
                    {
                      roleId: "pioneer",
                      name: "Первопроходец",
                      color: "#d5af69",
                      icon: "★",
                    },
                  ]
                : [],
          ]),
        ),
      });
    }
    return route.fulfill({ json: {} });
  });
  return {
    batches,
    expire: () => {
      active = false;
    },
  };
}
for (const width of [320, 390, 1440])
  test(`Premium highlights the row, preserves badges and uses plain names at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const { batches } = await setup(page);
    await page.goto("/top");
    const premium = page.locator('[data-user-id="top-premium"]');
    await expect(premium).toHaveAttribute("data-premium", "true");
    await expect(page.locator('[data-premium="true"]')).toHaveCount(1);
    await expect(
      premium.getByRole("img", { name: "EpisyHub Premium" }),
    ).toBeVisible();
    await expect(
      premium.getByRole("img", { name: "Администратор" }),
    ).toBeVisible();
    await expect(
      page
        .locator('[data-user-id="top-pioneer"]')
        .getByRole("img", { name: "Первопроходец" }),
    ).toBeVisible();
    expect(batches.flat().filter((id) => id === "top-premium")).toHaveLength(1);
    for (const theme of ["dark", "light", "autumn-2026", "obsidian"]) {
      await page.evaluate((t) => {
        document.documentElement.dataset.theme =
          t === "light" || t === "autumn-2026" ? "light" : "dark";
        document.documentElement.dataset.siteTheme = t;
      }, theme);
      const colors = await premium.evaluate((row) => ({
        row: getComputedStyle(row).color,
        name: getComputedStyle(row.querySelector(".account-name")!).color,
        filter: getComputedStyle(row.querySelector(".account-name-text")!)
          .filter,
      }));
      expect(colors.name).toBe(colors.row);
      expect(colors.filter).toBe("none");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (width === 390 || width === 1440)
        await page.screenshot({
          path: `/workspace/work/top-premium-${width}-${theme}.png`,
          fullPage: true,
        });
    }
    await page.getByRole("button", { name: "📚 Коллекционеры" }).click();
    await expect(page.locator("[data-user-id]").first()).toHaveAttribute(
      "data-user-id",
      "top-pioneer",
    );
    await expect(premium).toHaveAttribute("data-premium", "true");
    await expect(premium.getByRole("link").last()).toHaveAttribute(
      "href",
      "/u/premium_user",
    );
  });
test("Premium expiration removes the row highlight while keeping unrelated roles", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto("/top");
  const row = page.locator('[data-user-id="top-premium"]');
  await expect(row).toHaveAttribute("data-premium", "true");
  state.expire();
  await page.evaluate(() => window.dispatchEvent(new Event("account-updated")));
  await expect(row).toHaveAttribute("data-premium", "false");
  await expect(row.getByRole("img", { name: "EpisyHub Premium" })).toHaveCount(
    0,
  );
  await expect(row.getByRole("img", { name: "Администратор" })).toBeVisible();
});
test("reduced motion makes the Premium gradient static", async ({ page }) => {
  await setup(page);
  await page.goto("/top");
  const row = page.locator('[data-user-id="top-premium"]');
  await expect(row).toHaveAttribute("data-premium", "true");
  expect(
    await row.evaluate((e) => getComputedStyle(e, "::before").animationName),
  ).not.toBe("none");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() =>
      row.evaluate((e) => getComputedStyle(e, "::before").animationName),
    )
    .toBe("none");
});
