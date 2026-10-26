import { expect, test, type Page } from '@playwright/test';
import type { LibraryItem } from '../../src/lib/library';

function fixture(movie = false, lastEpisode = false): LibraryItem {
  return { id: 10, userShowId: 100, showId: 10, title: movie ? 'Тестовый фильм' : 'Тестовый сериал', kind: movie ? 'movie' : 'series', status: 'watching', totalEpisodes: lastEpisode ? 1 : 2, updatedAt: '2026-10-26T10:00:00.000Z', userRating: 8, show: { id: 10, episodes: [{ id: 101, season: 1, episode: 1 }, ...(lastEpisode ? [] : [{ id: 102, season: 1, episode: 2 }])] }, progress: [{ episodeId: 101, watched: false, stoppedAt: '18:42' }], ratings: [] };
}

async function setup(page: Page, options: { movie?: boolean; last?: boolean; failMark?: boolean; failUndo?: boolean; conflictUndo?: boolean; expiredUndo?: boolean; delay?: boolean; extra?: boolean } = {}) {
  const original = fixture(options.movie, options.last);
  let item = structuredClone(original);
  const calls: Record<string, unknown>[] = [];
  let marks = 0; let undos = 0; let loads = 0;
  await page.route('**/api/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    if (path === '/api/auth/session') return route.fulfill({ json: { user: { id: 'ui-user', username: 'ui_user' }, expires: '2099-01-01T00:00:00Z' } });
    if (path === '/api/users/counts') return route.fulfill({ json: { watchingCount: item.status === 'watching' ? 1 : 0, plannedCount: 0 } });
    if (path === '/api/popcorn') return route.fulfill({ json: { popcorn: 0, canClaimDaily: false } });
    if (path === '/api/user-shows') { loads++; return route.fulfill({ json: [item, ...(options.extra ? [{ ...fixture(), id: 20, userShowId: 200, showId: 20, title: 'Другой сериал', updatedAt: '2026-10-26T10:00:00.500Z', show: { id: 20, episodes: [{ id: 201, season: 1, episode: 1 }, { id: 202, season: 1, episode: 2 }] }, progress: [{ episodeId: 201, watched: false, stoppedAt: null }] }] : [])] }); }
    if (path === '/api/user-shows/100/quick-progress') {
      const body = request.postDataJSON(); calls.push(body);
      if (options.delay) await new Promise(resolve => setTimeout(resolve, 500));
      if (body.action === 'mark') {
        marks++;
        expect(body.expectedUpdatedAt).toBe(original.updatedAt);
        if (!options.movie) expect(body.expectedEpisodeId).toBe(101);
        if (options.failMark && marks === 1) return route.fulfill({ status: 500, json: { error: 'Не удалось сохранить изменение. Попробуйте ещё раз.' } });
        item = { ...item, status: options.movie || options.last ? 'completed' : 'watching', updatedAt: '2026-10-26T10:00:01.000Z', progress: [{ episodeId: 101, watched: true, stoppedAt: null }] };
        return route.fulfill({ json: { item, undoToken: 'ui-fixture-undo', undoExpiresAt: Date.now() + 600000, message: options.movie ? 'Фильм отмечен просмотренным' : 'Серия отмечена' } });
      }
      expect(body).toEqual({ action: 'undo', token: 'ui-fixture-undo' }); undos++;
      if (options.expiredUndo) return route.fulfill({ status: 400, json: { error: 'Отмена недоступна или срок её действия истёк' } });
      if (options.conflictUndo) return route.fulfill({ status: 409, json: { error: 'Прогресс уже изменился. Обновите библиотеку.' } });
      if (options.failUndo && undos === 1) return route.fulfill({ status: 500, json: { error: 'Не удалось сохранить изменение. Попробуйте ещё раз.' } });
      item = { ...structuredClone(original), updatedAt: '2026-10-26T10:00:02.000Z' };
      return route.fulfill({ json: { item, message: 'Отметка отменена' } });
    }
    return route.fulfill({ status: 404, json: { error: 'UI fixture' } });
  });
  return { calls, loads: () => loads, title: original.title };
}
const main = (page: Page) => page.getByRole('main');
const notice = (page: Page) => page.getByRole('complementary', { name: 'Последнее изменение прогресса' });

test('a quick mark advances one episode, clears its timecode and undo restores both', async ({ page }, testInfo) => {
  const api = await setup(page); await page.goto('/watching');
  await expect(main(page).getByText(/Остановились на 18:42/)).toBeVisible();
  await main(page).getByRole('button', { name: `Отметить следующую серию: ${api.title}` }).click();
  await expect(main(page).getByText('Следующая: сезон 1, серия 2')).toBeVisible();
  await expect(main(page).getByText('Отмечено: 1 из 2 серий')).toBeVisible();
  await expect(main(page).getByText(/Остановились на/)).toHaveCount(0);
  await expect(notice(page).getByRole('status')).toHaveText('Серия отмечена');
  await expect(main(page).getByRole('article', { name: api.title }).getByRole('complementary', { name: 'Последнее изменение прогресса' })).toBeVisible();
  expect(await notice(page).evaluate(element => getComputedStyle(element).position)).not.toBe('fixed');
  await notice(page).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('quick-mark-mobile.png') });
  await notice(page).getByRole('button', { name: `Отменить отметку: ${api.title}` }).click();
  await expect(main(page).getByText('Отмечено: 0 из 2 серий')).toBeVisible();
  await expect(main(page).getByText(/Остановились на 18:42/)).toBeVisible();
  expect(api.calls.map(call => call.action)).toEqual(['mark', 'undo']); expect(api.loads()).toBe(1);
});

test('double clicks and busy controls do not send a second mark', async ({ page }) => {
  const api = await setup(page, { delay: true }); await page.goto('/watching');
  const button = main(page).getByRole('button', { name: `Отметить следующую серию: ${api.title}` });
  await button.dblclick(); await expect(button).toBeDisabled();
  await expect(button).toHaveAttribute('aria-busy', 'true');
  await expect(notice(page).getByText('Серия отмечена', { exact: true })).toBeVisible();
  expect(api.calls).toHaveLength(1); await expect(button).toBeEnabled();
});

test('a failed save leaves progress and timecode intact and allows retry', async ({ page }) => {
  const api = await setup(page, { failMark: true }); await page.goto('/watching');
  const button = main(page).getByRole('button', { name: `Отметить следующую серию: ${api.title}` });
  await button.click(); await expect(notice(page).getByRole('alert')).toContainText('Не удалось сохранить');
  await expect(main(page).getByText('Отмечено: 0 из 2 серий')).toBeVisible();
  await expect(main(page).getByText(/Остановились на 18:42/)).toBeVisible();
  await button.click(); await expect(main(page).getByText('Отмечено: 1 из 2 серий')).toBeVisible();
  expect(api.calls).toHaveLength(2);
});

test('the last episode moves to completed but its undo remains accessible', async ({ page }) => {
  const api = await setup(page, { last: true }); await page.goto('/watching');
  await main(page).getByRole('button', { name: `Отметить следующую серию: ${api.title}` }).click();
  await expect(main(page).getByRole('article')).toHaveCount(0);
  const undo = notice(page).getByRole('button', { name: `Отменить отметку: ${api.title}` });
  await expect(undo).toBeFocused();
  await expect(main(page).getByRole('link', { name: 'Просмотрено 1', exact: true })).toBeVisible();
  await undo.click(); await expect(main(page).getByRole('article', { name: api.title })).toBeVisible();
});

test('movie completion and undo work in poster mode', async ({ page }) => {
  const api = await setup(page, { movie: true }); await page.goto('/watching?view=posters');
  await main(page).getByRole('button', { name: `Отметить фильм просмотренным: ${api.title}` }).click();
  await expect(main(page).getByRole('article')).toHaveCount(0);
  await expect(notice(page).getByRole('status')).toHaveText('Фильм отмечен просмотренным');
  await notice(page).getByRole('button', { name: `Отменить отметку: ${api.title}` }).click();
  await expect(main(page).getByRole('article', { name: api.title })).toBeVisible();
  await expect(main(page).getByText(/Остановились на 18:42/)).toBeVisible();
});

test('failed undo keeps the saved mark and can be retried', async ({ page }) => {
  const api = await setup(page, { failUndo: true }); await page.goto('/watching');
  await main(page).getByRole('button', { name: `Отметить следующую серию: ${api.title}` }).click();
  const undo = notice(page).getByRole('button', { name: `Отменить отметку: ${api.title}` });
  await undo.click(); await expect(notice(page).getByRole('alert')).toContainText('Не удалось сохранить');
  await expect(main(page).getByText('Отмечено: 1 из 2 серий')).toBeVisible();
  await undo.click(); await expect(main(page).getByText('Отмечено: 0 из 2 серий')).toBeVisible();
});

test('a conflicting undo does not reset progress and requests a refresh', async ({ page }) => {
  const api = await setup(page, { conflictUndo: true }); await page.goto('/watching');
  await main(page).getByRole('button', { name: `Отметить следующую серию: ${api.title}` }).click();
  await notice(page).getByRole('button', { name: `Отменить отметку: ${api.title}` }).click();
  await expect(notice(page).getByRole('alert')).toContainText('Прогресс уже изменился');
  await expect(main(page).getByText('Отмечено: 1 из 2 серий')).toBeVisible();
  await expect(notice(page).getByRole('button', { name: /Отменить отметку/ })).toHaveCount(0);
  await notice(page).getByRole('button', { name: 'Обновить библиотеку' }).click();
  await expect(main(page).getByText('Отмечено: 1 из 2 серий')).toBeVisible();
  expect(api.loads()).toBe(2);
});

test('an expired undo cannot be retried or erase the saved mark', async ({ page }) => {
  const api = await setup(page, { expiredUndo: true }); await page.goto('/watching');
  await main(page).getByRole('button', { name: `Отметить следующую серию: ${api.title}` }).click();
  await notice(page).getByRole('button', { name: `Отменить отметку: ${api.title}` }).click();
  await expect(notice(page).getByRole('alert')).toContainText('срок её действия истёк');
  await expect(notice(page).getByRole('button', { name: /Отменить отметку/ })).toHaveCount(0);
  await expect(main(page).getByText('Отмечено: 1 из 2 серий')).toBeVisible();
});

test('the marked row and its undo stay visible when recent-update sorting moves it', async ({ page }) => {
  const api = await setup(page, { extra: true }); await page.goto('/watching');
  await expect(main(page).getByRole('article').first()).toHaveAttribute('aria-label', 'Другой сериал');
  const button = main(page).getByRole('button', { name: `Отметить следующую серию: ${api.title}` });
  await button.click();
  await expect(main(page).getByRole('article').first()).toHaveAttribute('aria-label', api.title);
  await expect(notice(page)).toBeInViewport();
  await expect(button).toBeInViewport();
});
