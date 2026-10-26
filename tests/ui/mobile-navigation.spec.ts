import { expect, test, type Page } from '@playwright/test';

async function mockApi(page: Page, signedIn = false) {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/session') return route.fulfill({ json: signedIn ? { user: { id: 'ui-user', username: 'ui_user', name: 'Тестовый профиль', email: 'ui@example.test' }, expires: '2099-01-01T00:00:00Z' } : null });
    if (path === '/api/home') return route.fulfill({ json: { heroSlides: [], recentOnline: [], universes: [], directors: [] } });
    if (path === '/api/users/counts') return route.fulfill({ json: { watchingCount: 2, plannedCount: 3 } });
    if (path === '/api/user-shows' || path === '/api/collections') return route.fulfill({ json: [] });
    if (path === '/api/users/me') return route.fulfill({ json: { username: 'ui_user', email: 'ui@example.test', name: 'Тестовый профиль', bio: '', avatarUrl: null } });
    if (path === '/api/popcorn') return route.fulfill({ json: { popcorn: 0, canClaimDaily: false } });
    if (path === '/api/recommendations/global') return route.fulfill({ json: { recommendations: [] } });
    return route.fulfill({ status: 404, json: { error: 'Not found in UI fixture' } });
  });
}

const navigation = (page: Page) => page.getByRole('navigation', { name: 'Мобильная навигация', exact: true });
const searchInput = (page: Page) => page.getByRole('main').getByRole('searchbox', { name: 'Поиск фильмов и сериалов' });

test('mobile navigation provides all five destinations, library sections and guest login', async ({ page }, testInfo) => {
  await mockApi(page);
  await page.goto('/');
  const nav = navigation(page);
  await expect(nav).toBeVisible();
  await expect(nav.getByRole('link')).toHaveCount(5);
  await expect(nav.getByRole('link', { name: 'Главная' })).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('link', { name: 'Поиск', exact: true }).click();
  await expect(page).toHaveURL(/\/search$/);
  await expect(nav.getByRole('link', { name: 'Поиск', exact: true })).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('link', { name: 'Библиотека' }).click();
  await expect(page).toHaveURL(/\/watching$/);
  await expect(page.getByRole('heading', { name: 'Войдите, чтобы открыть свою библиотеку' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Библиотека' })).toHaveAttribute('aria-current', 'page');
  await page.screenshot({ path: testInfo.outputPath('mobile-library.png') });
  await nav.getByRole('link', { name: 'Профиль' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(nav.getByRole('link', { name: 'Профиль' })).toHaveAttribute('aria-current', 'page');
});

test('profile points to the authenticated user and remains active on settings', async ({ page }) => {
  await mockApi(page, true);
  await page.goto('/settings');
  await expect(navigation(page).getByRole('link', { name: 'Профиль' })).toHaveAttribute('href', '/u/ui_user');
  await expect(navigation(page).getByRole('link', { name: 'Профиль' })).toHaveAttribute('aria-current', 'page');
});

test('small screens and tablets have no overflow, safe padding or content obscured by the bottom bar', async ({ page }) => {
  await mockApi(page);
  for (const width of [320, 390, 768, 1279]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/login');
    await expect(navigation(page)).toBeVisible();
    const geometry = await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      const nav = document.querySelector('nav[aria-label="Мобильная навигация"]')!;
      const footer = document.querySelector('footer')!;
      return { document: document.documentElement.scrollWidth, viewport: innerWidth, padding: parseFloat(getComputedStyle(document.body).paddingBottom), barHeight: nav.getBoundingClientRect().height, footerBottom: footer.getBoundingClientRect().bottom, barTop: nav.getBoundingClientRect().top };
    });
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport);
    expect(geometry.padding).toBeGreaterThanOrEqual(geometry.barHeight);
    expect(geometry.footerBottom).toBeLessThanOrEqual(geometry.barTop + 1);
    for (const link of await navigation(page).getByRole('link').all()) {
      const box = await link.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
  }
});

test('search displays empty, loading and populated states, and clears the query', async ({ page }, testInfo) => {
  await mockApi(page);
  await page.route('**/api/tmdb/search?**', async route => {
    await new Promise(resolve => setTimeout(resolve, 200));
    await route.fulfill({ json: { results: [{ id: 101, title: 'Разделение', type: 'tv', year: '2022', rating: 8.7 }] } });
  });
  await page.goto('/search');
  await expect(page.getByText('Что хочется посмотреть?')).toBeVisible();
  await searchInput(page).fill('Разделение');
  await expect(page.getByRole('status')).toContainText('Ищем');
  await expect(page.getByRole('button', { name: /Разделение.*Сериал/ })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Найдено: 1');
  await page.screenshot({ path: testInfo.outputPath('mobile-search.png') });
  await page.getByRole('button', { name: 'Очистить поиск' }).click();
  await expect(searchInput(page)).toHaveValue('');
  await expect(searchInput(page)).toBeFocused();
  await expect(page.getByText('Что хочется посмотреть?')).toBeVisible();
});

test('search distinguishes no matches from a service failure and allows retry', async ({ page }) => {
  await mockApi(page);
  let calls = 0;
  await page.route('**/api/tmdb/search?**', route => {
    calls++;
    return route.fulfill(calls === 1 ? { status: 503, json: { error: 'service unavailable' } } : { json: { results: [] } });
  });
  await page.goto('/search');
  await searchInput(page).fill('фильм');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Поиск временно недоступен');
  await page.getByRole('button', { name: 'Повторить поиск' }).click();
  await expect(page.getByText('Ничего не найдено', { exact: true })).toBeVisible();
  expect(calls).toBe(2);
});

test('late responses cannot overwrite results of a newer search', async ({ page }) => {
  await mockApi(page);
  await page.route('**/api/tmdb/search?**', async route => {
    const query = new URL(route.request().url()).searchParams.get('query');
    if (query === 'старый') await new Promise(resolve => setTimeout(resolve, 900));
    await route.fulfill({ json: { results: [{ id: 101, title: query === 'старый' ? 'Старый результат' : 'Новый результат', type: 'movie' }] } }).catch(() => undefined);
  });
  await page.goto('/search');
  await searchInput(page).fill('старый');
  await page.waitForRequest('**/api/tmdb/search?query=*');
  await searchInput(page).fill('новый');
  await expect(page.getByRole('button', { name: /Новый результат/ })).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(page.getByRole('button', { name: /Старый результат/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Новый результат/ })).toBeVisible();
});

test('results support keyboard selection and retain media type after import', async ({ page }) => {
  await mockApi(page);
  await page.route('**/api/tmdb/search?**', route => route.fulfill({ json: { results: [{ id: 101, title: 'Разделение', type: 'tv' }] } }));
  await page.route('**/api/tmdb/import', async route => {
    expect(route.request().postDataJSON()).toEqual({ tmdbId: 101, type: 'tv' });
    await route.fulfill({ json: { show: { id: 4321 } } });
  });
  await page.goto('/search');
  await searchInput(page).fill('Разделение');
  const result = page.getByRole('button', { name: /Разделение/ });
  await expect(result).toBeVisible();
  await searchInput(page).press('ArrowDown');
  await expect(result).toBeFocused();
  await result.press('Enter');
  await expect(page).toHaveURL(/\/show\/4321\?type=tv$/);
});

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 1000 }, isMobile: false, hasTouch: false });
  test('desktop search remains available and the bottom bar is hidden', async ({ page }) => {
    await mockApi(page);
    await page.route('**/api/tmdb/search?**', route => route.fulfill({ json: { results: [{ id: 7, title: 'Дюна', type: 'movie' }] } }));
    await page.goto('/login');
    await expect(navigation(page)).toBeHidden();
    const input = page.getByRole('banner').getByRole('searchbox');
    await input.fill('Дюна');
    await expect(page.getByRole('button', { name: /Дюна/ })).toBeVisible();
    await input.press('Escape');
    await expect(page.getByRole('button', { name: /Дюна/ })).toBeHidden();
    await expect(page.getByRole('banner').getByRole('link', { name: 'Библиотека' })).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});
