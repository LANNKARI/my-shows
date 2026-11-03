import { test, expect, type Page } from "@playwright/test";
async function shell(page: Page) {
  await page.route("**/api/**", (route) => route.fulfill({ json: null }));
}
test("registration waits for mailbox verification and never signs in automatically", async ({
  page,
}) => {
  await shell(page);
  let calls = 0;
  await page.route("**/api/register", (route) => {
    calls++;
    return route.fulfill({
      status: 202,
      json: { verificationRequired: true, message: "Проверьте почту" },
    });
  });
  await page.goto("/register");
  await page.getByLabel("Email", { exact: true }).fill("new@example.test");
  await page.getByLabel("Username").fill("new_user");
  await page.getByLabel("Пароль", { exact: true }).fill("secure-password-123");
  await page.getByLabel("Имя *", { exact: true }).fill("Киноман");
  await page.getByLabel("Повторите пароль *", { exact: true }).fill("secure-password-123");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Зарегистрироваться", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Подтвердите почту" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
  expect(calls).toBe(1);
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
    "new@example.test",
  );
});
test("opening a verification link does not consume it until the user confirms", async ({
  page,
}) => {
  await shell(page);
  let calls = 0;
  const token = "a".repeat(64);
  await page.route("**/api/email-verification/confirm", (route) => {
    calls++;
    expect(route.request().postDataJSON()).toEqual({ token });
    return route.fulfill({ json: { success: true } });
  });
  await page.goto("/verify-email#token=" + token);
  await expect(
    page.getByRole("button", { name: "Подтвердить почту", exact: true }),
  ).toBeVisible();
  expect(calls).toBe(0);
  await expect(page).toHaveURL(/\/verify-email$/);
  await page
    .getByRole("button", { name: "Подтвердить почту", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Почта подтверждена" }),
  ).toBeVisible();
  expect(calls).toBe(1);
  await expect(
    page.getByRole("main").getByRole("link", { name: "Войти", exact: true }),
  ).toHaveAttribute("href", "/login");
});
test("expired links offer resend and resend does not expose account existence", async ({
  page,
}) => {
  await shell(page);
  await page.route("**/api/email-verification/confirm", (route) =>
    route.fulfill({
      status: 400,
      json: { error: "Ссылка недействительна или устарела" },
    }),
  );
  await page.route("**/api/email-verification/request", (route) =>
    route.fulfill({
      json: {
        message:
          "Если регистрация ожидает подтверждения, письмо будет отправлено.",
      },
    }),
  );
  await page.goto("/verify-email#token=" + "b".repeat(64));
  await page
    .getByRole("button", { name: "Подтвердить почту", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "устарела",
  );
  await page.getByLabel("Email", { exact: true }).fill("pending@example.test");
  await page.getByRole("button", { name: "Отправить письмо повторно" }).click();
  await expect(page.getByRole("status")).toContainText("Если регистрация");
  await expect(
    page.getByRole("button", { name: "Повторить можно через минуту" }),
  ).toBeDisabled();
});
test("a mail delivery error retains a recovery screen instead of creating a signed-in profile", async ({
  page,
}) => {
  await shell(page);
  await page.route("**/api/register", (route) =>
    route.fulfill({
      status: 503,
      json: {
        verificationRequired: true,
        error: "Письмо не удалось отправить. Данные сохранены.",
      },
    }),
  );
  await page.goto("/register");
  await page.getByLabel("Email", { exact: true }).fill("retry@example.test");
  await page.getByLabel("Username").fill("retry_user");
  await page.getByLabel("Пароль", { exact: true }).fill("secure-password-123");
  await page.getByLabel("Имя *", { exact: true }).fill("Киноман");
  await page.getByLabel("Повторите пароль *", { exact: true }).fill("secure-password-123");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Зарегистрироваться", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Подтвердите почту" }),
  ).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Данные сохранены",
  );
  await expect(
    page.getByRole("button", { name: "Отправить письмо повторно" }),
  ).toBeVisible();
});

test("login shows resend only after a valid pending-account response", async ({
  page,
}) => {
  await shell(page);
  await page.route("**/api/auth/providers", (route) =>
    route.fulfill({
      json: {
        credentials: {
          id: "credentials",
          name: "credentials",
          type: "credentials",
          signinUrl: "",
          callbackUrl: "",
        },
      },
    }),
  );
  await page.route("**/api/auth/csrf", (route) =>
    route.fulfill({ json: { csrfToken: "fixture" } }),
  );
  let pending = false;
  await page.route("**/api/auth/callback/credentials*", (route) =>
    route.fulfill({
      json: {
        url:
          "http://127.0.0.1:3320/login?error=CredentialsSignin&code=" +
          (pending ? "EmailUnverified" : "credentials"),
      },
    }),
  );
  await page.goto("/login");
  const main = page.getByRole("main");
  await expect(
    main.getByRole("link", { name: /письмо подтверждения/ }),
  ).toHaveCount(0);
  await page.getByLabel("Email", { exact: true }).fill("pending@example.test");
  await page.getByLabel("Пароль", { exact: true }).fill("fixture-password");
  await main.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(main).toContainText("Неверный email или пароль");
  await expect(
    main.getByRole("link", { name: /письмо подтверждения/ }),
  ).toHaveCount(0);
  pending = true;
  await main.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(
    main.getByRole("link", { name: "Отправить письмо подтверждения повторно" }),
  ).toBeVisible();
});

test("registration requires name, matching passwords and explicit consent", async ({ page }) => {
  await shell(page);
  let calls = 0;
  await page.route("**/api/register", route => {
    calls++;
    expect(route.request().postDataJSON()).toMatchObject({ name: "Киноман", consent: true, confirmPassword: "secure-password-123" });
    return route.fulfill({ status: 400, json: { error: "Имя пользователя занято" } });
  });
  await page.goto("/register");
  await expect(page.getByRole("link", { name: "Регистрация", exact: true })).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill("new@example.test");
  await page.getByLabel("Username").fill("cinefan_24");
  await page.getByLabel("Пароль", { exact: true }).fill("secure-password-123");
  await page.getByLabel("Повторите пароль *", { exact: true }).fill("different-password");
  const submit = page.getByRole("button", { name: "Зарегистрироваться", exact: true });
  await expect(page.getByText("Пароли не совпадают", { exact: true })).toBeVisible();
  await page.getByRole("checkbox").check();
  await expect(submit).toBeDisabled();
  await page.getByLabel("Повторите пароль *", { exact: true }).fill("secure-password-123");
  await expect(submit).toBeDisabled();
  await page.getByLabel("Имя *", { exact: true }).fill("Киноман");
  await expect(submit).toBeEnabled();
  await page.getByRole("checkbox").uncheck();
  await expect(submit).toBeDisabled();
  expect(calls).toBe(0);
  await page.getByRole("checkbox").check();
  await submit.click();
  await expect(page.getByText("Имя пользователя занято")).toBeVisible();
  expect(calls).toBe(1);
  await page.goto("/login");
  await expect(page.getByLabel("Email", { exact: true })).not.toHaveAttribute("placeholder", /.+/);
});
