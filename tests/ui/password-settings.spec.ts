import { test, expect, type Page } from '@playwright/test';

async function settings(page: Page, fail = false) {
  const writes: object[] = [];
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/session') return route.fulfill({ json: { user: { id: 'password-user', username: 'password_user' }, expires: '2099-01-01' } });
    if (path === '/api/users/me') return route.fulfill({ json: { id: 'password-user', username: 'password_user', email: 'test@example.test', name: 'Тест', bio: '', avatarUrl: null } });
    if (path === '/api/users/me/password') {
      writes.push(route.request().postDataJSON());
      await new Promise(resolve => setTimeout(resolve, 150));
      return route.fulfill(fail ? { status: 400, json: { error: 'Текущий пароль неверен' } } : { json: { success: true } });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Безопасность' })).toBeVisible();
  return writes;
}

test('login can reveal and hide a password without submitting or changing its value', async ({ page }) => {
  let submissions = 0;
  await page.route('**/api/**', route => {
    if (route.request().method() === 'POST') submissions++;
    return route.fulfill({ json: null });
  });
  await page.goto('/login');
  const password = page.getByLabel('Пароль', { exact: true });
  await password.fill('typed-test-password');
  await expect(password).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Показать пароль' }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await expect(password).toHaveValue('typed-test-password');
  await page.getByRole('button', { name: 'Скрыть пароль' }).click();
  await expect(password).toHaveAttribute('type', 'password');
  expect(submissions).toBe(0);
});

test('settings validate confirmation, send one password change and clear secrets on success', async ({ page }, testInfo) => {
  const writes = await settings(page);
  await page.getByLabel('Текущий пароль', { exact: true }).fill('old-test-password');
  await page.getByLabel('Новый пароль', { exact: true }).fill('new-test-password');
  await page.getByLabel('Повторите новый пароль').fill('different-password');
  await page.getByRole('button', { name: 'Изменить пароль', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Новые пароли не совпадают');
  expect(writes).toHaveLength(0);
  await page.getByLabel('Повторите новый пароль').fill('new-test-password');
  await page.getByRole('button', { name: 'Изменить пароль', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Пароль изменён');
  expect(writes).toEqual([{ currentPassword: 'old-test-password', newPassword: 'new-test-password' }]);
  for (const label of ['Текущий пароль', 'Новый пароль', 'Повторите новый пароль']) await expect(page.getByLabel(label, { exact: true })).toHaveValue('');
  await page.getByRole('region', { name: 'Безопасность' }).screenshot({ path: testInfo.outputPath('password-settings.png') });
});

test('incorrect current password shows an error and keeps the form available', async ({ page }) => {
  await settings(page, true);
  await page.getByLabel('Текущий пароль', { exact: true }).fill('wrong-password');
  await page.getByLabel('Новый пароль', { exact: true }).fill('new-test-password');
  await page.getByLabel('Повторите новый пароль').fill('new-test-password');
  await page.getByRole('button', { name: 'Изменить пароль', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Текущий пароль неверен');
  await expect(page.getByRole('button', { name: 'Изменить пароль', exact: true })).toBeEnabled();
  await expect(page.getByRole('status')).toHaveCount(0);
});
