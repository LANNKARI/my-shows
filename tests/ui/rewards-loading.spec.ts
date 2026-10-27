import { test, expect } from '@playwright/test';

test('unavailable rewards never masquerade as a zero balance or a claimed daily reward', async ({ page }) => {
  let available = false;
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/session') return route.fulfill({ json: { user: { id: 'loading-user', username: 'loading-user' }, expires: '2099-01-01' } });
    if (path === '/api/popcorn') return route.fulfill(available ? { json: { popcorn: 125, canClaimDaily: true, dailyStreak: 1, nextStreak: 2, streakRewards: { 1: 10, 2: 15 }, quizAttemptsLeft: 10 } } : { status: 503, json: { error: 'Database busy' } });
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto('/rewards');
  const main = page.getByRole('main');
  await expect(main.getByRole('alert')).toContainText('Не удалось загрузить баланс');
  await expect(main.getByText('Сегодня уже получено', { exact: false })).toHaveCount(0);
  await expect(main.getByText('0 🍿', { exact: true })).toHaveCount(0);
  available = true;
  await main.getByRole('button', { name: 'Повторить загрузку' }).click();
  await expect(main.getByText('125 🍿', { exact: true })).toBeVisible();
});
