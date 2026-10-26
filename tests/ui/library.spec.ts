import { expect, test, type Page } from '@playwright/test';

const records = [
  {
    id: 10,
    userShowId: 100,
    showId: 10,
    title: 'Разделение',
    originalTitle: 'Severance',
    kind: 'series',
    status: 'watching',
    totalEpisodes: 19,
    year: '2022',
    userRating: 7,
    tmdbRating: 9.1,
    updatedAt: '2026-10-20T12:00:00Z',
    posterUrl: null,
    show: {
      id: 10,
      episodes: [
        { id: 103, season: 2, episode: 4 },
        { id: 101, season: 1, episode: 1 },
        { id: 102, season: 2, episode: 3 },
      ],
    },
    progress: [
      { episodeId: 101, watched: true, stoppedAt: null },
      { episodeId: 102, watched: true, stoppedAt: null },
      { episodeId: 103, watched: false, stoppedAt: '18:42' },
    ],
    ratings: [
      { episodeId: 103, score: 10 },
      { episodeId: null, score: 7 },
    ],
  },
  {
    id: 20,
    userShowId: 200,
    showId: 20,
    title: 'Дюна',
    originalTitle: 'Dune',
    kind: 'movie',
    status: 'watching',
    totalEpisodes: 1,
    year: '2021',
    userRating: 9,
    tmdbRating: 8,
    updatedAt: '2026-10-21T12:00:00Z',
    posterUrl: null,
    show: { id: 20, episodes: [] },
    progress: [],
    ratings: [{ episodeId: null, score: 9 }],
  },
  {
    id: 30,
    userShowId: 300,
    showId: 30,
    title: 'Андор',
    originalTitle: 'Andor',
    kind: 'series',
    status: 'watching',
    totalEpisodes: 0,
    year: '2022',
    userRating: null,
    tmdbRating: 9.9,
    updatedAt: '2026-10-19T12:00:00Z',
    posterUrl: null,
    show: { id: 30, episodes: [] },
    progress: [],
    ratings: [{ episodeId: 999, score: 10 }],
  },
  {
    id: 40,
    userShowId: 400,
    showId: 40,
    title: 'Тьма',
    originalTitle: 'Dark',
    kind: 'series',
    status: 'planned',
    totalEpisodes: 26,
    year: '2017',
    userRating: null,
    updatedAt: '2026-10-19T12:00:00Z',
    posterUrl: null,
    show: { id: 40, episodes: [] },
    progress: [],
    ratings: [],
  },
  {
    id: 50,
    userShowId: 500,
    showId: 50,
    title: 'Интерстеллар',
    kind: 'movie',
    status: 'completed',
    totalEpisodes: 1,
    userRating: 10,
    updatedAt: '2026-10-19T12:00:00Z',
    posterUrl: null,
    show: { id: 50, episodes: [] },
    progress: [],
    ratings: [],
  },
  {
    id: 60,
    userShowId: 600,
    showId: 60,
    title: 'Брошенный сериал',
    kind: 'series',
    status: 'dropped',
    totalEpisodes: 10,
    userRating: null,
    updatedAt: '2026-10-19T12:00:00Z',
    posterUrl: null,
    show: { id: 60, episodes: [] },
    progress: [],
    ratings: [],
  },
];

async function setup(
  page: Page,
  options: { guest?: boolean; failure?: boolean; empty?: boolean } = {},
) {
  let loads = 0;
  const writes: string[] = [];
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== 'GET') writes.push(url.pathname);
    if (url.pathname === '/api/auth/session')
      return route.fulfill({
        json: options.guest
          ? null
          : {
              user: {
                id: 'library-user',
                username: 'library_user',
                name: 'Тестовый профиль',
              },
              expires: '2099-01-01T00:00:00Z',
            },
      });
    if (url.pathname === '/api/user-shows') {
      expect(url.searchParams.get('status')).toBe('library');
      loads++;
      if (options.failure && loads === 1)
        return route.fulfill({ status: 503, json: { error: 'Unavailable' } });
      return route.fulfill({ json: options.empty ? [] : records });
    }
    if (url.pathname === '/api/users/counts')
      return route.fulfill({ json: { watchingCount: 3, plannedCount: 1 } });
    if (url.pathname === '/api/popcorn')
      return route.fulfill({ json: { popcorn: 0, canClaimDaily: false } });
    return route.fulfill({ status: 404, json: { error: 'UI fixture' } });
  });
  return { loads: () => loads, writes };
}

const main = (page: Page) => page.getByRole('main');
const tabs = (page: Page) =>
  main(page).getByRole('navigation', { name: 'Статусы библиотеки' });
const titles = (page: Page) => main(page).getByRole('article');

test('all four status tabs include accurate counts and use one read-only snapshot', async ({
  page,
}) => {
  const api = await setup(page);
  await page.goto('/watching');
  await expect(
    tabs(page).getByRole('link', { name: 'Смотрю 3' }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(titles(page)).toHaveCount(3);
  for (const [label, name] of [
    ['В планах 1', 'Тьма'],
    ['Просмотрено 1', 'Интерстеллар'],
    ['Брошено 1', 'Брошенный сериал'],
  ]) {
    await tabs(page).getByRole('link', { name: label, exact: true }).click();
    await expect(titles(page)).toHaveCount(1);
    await expect(titles(page)).toHaveAttribute('aria-label', name);
  }
  expect(api.loads()).toBe(1);
  expect(api.writes).toEqual([]);
});

test('library search finds original names and combines with media filters without extra API requests', async ({
  page,
}) => {
  const api = await setup(page);
  await page.goto('/watching');
  await expect(titles(page)).toHaveCount(3);
  await main(page).getByRole('searchbox').pressSequentially('severance');
  await expect(titles(page)).toHaveCount(1);
  await expect(titles(page)).toHaveAttribute('aria-label', 'Разделение');
  await main(page)
    .getByLabel('Тип тайтла', { exact: true })
    .selectOption('movie');
  await expect(
    main(page).getByRole('heading', { name: 'Ничего не найдено', exact: true }),
  ).toBeVisible();
  await main(page).getByRole('button', { name: 'Сбросить фильтры' }).click();
  await expect(titles(page)).toHaveCount(3);
  await main(page)
    .getByLabel('Тип тайтла', { exact: true })
    .selectOption('movie');
  await expect(titles(page)).toHaveAttribute('aria-label', 'Дюна');
  expect(api.loads()).toBe(1);
  expect(api.writes).toEqual([]);
});

test('sorting uses whole-title personal scores rather than TMDB or episode ratings', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/watching');
  await expect(titles(page)).toHaveCount(3);
  await expect(titles(page).first()).toHaveAttribute('aria-label', 'Дюна');
  await main(page)
    .getByLabel('Сортировка', { exact: true })
    .selectOption('title');
  await expect(titles(page).first()).toHaveAttribute('aria-label', 'Андор');
  await main(page)
    .getByLabel('Сортировка', { exact: true })
    .selectOption('rating');
  await expect(titles(page).first()).toHaveAttribute('aria-label', 'Дюна');
  await expect(titles(page).last()).toHaveAttribute('aria-label', 'Андор');
  await expect(
    titles(page)
      .filter({
        has: page.getByRole('link', { name: 'Разделение', exact: true }),
      })
      .getByLabel('Моя оценка: 7'),
  ).toBeVisible();
  await expect(
    titles(page)
      .filter({ has: page.getByRole('link', { name: 'Андор', exact: true }) })
      .getByLabel(/Моя оценка/),
  ).toHaveCount(0);
});

test('progress, next episode, timestamp and local links are preserved without marking anything watched', async ({
  page,
}) => {
  const api = await setup(page);
  await page.goto('/watching');
  const item = page.getByRole('article', { name: 'Разделение', exact: true });
  await expect(item.getByText('Следующая: сезон 2, серия 4')).toBeVisible();
  await expect(item.getByText('Отмечено: 2 из 19 серий')).toBeVisible();
  await expect(item.getByText(/Остановились на 18:42/)).toBeVisible();
  await expect(
    item.getByRole('link', { name: 'Открыть трекер: Разделение' }),
  ).toHaveAttribute('href', '/library/10');
  await expect(
    item.getByRole('link', { name: 'Разделение', exact: true }),
  ).toHaveAttribute('href', '/show/10?type=tv');
  await expect(
    page
      .getByRole('article', { name: 'Андор', exact: true })
      .getByText('Отмечено: 0 из — серий'),
  ).toBeVisible();
  expect(api.writes).toEqual([]);
});

test('view and filters survive reload, status changes and browser back', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/watching');
  await expect(titles(page)).toHaveCount(3);
  await main(page)
    .getByLabel('Сортировка', { exact: true })
    .selectOption('rating');
  await main(page)
    .getByRole('button', { name: 'Постеры', exact: true })
    .click();
  await expect(
    main(page).getByRole('button', { name: 'Постеры', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await tabs(page).getByRole('link', { name: 'В планах 1' }).click();
  await expect(titles(page)).toHaveCount(1);
  await expect(titles(page)).toHaveAttribute('aria-label', 'Тьма');
  await page.goBack();
  await expect(titles(page)).toHaveCount(3);
  await expect(
    main(page).getByRole('button', { name: 'Постеры', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(titles(page)).toHaveCount(3);
  await expect(
    main(page).getByLabel('Сортировка', { exact: true }),
  ).toHaveValue('rating');
  await expect(
    main(page).getByRole('button', { name: 'Постеры', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('a restored dropped tab remains visible on a narrow screen', async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/watching?status=dropped');
  await expect(titles(page)).toHaveAttribute('aria-label', 'Брошенный сериал');
  const active = tabs(page).getByRole('link', { name: 'Брошено 1' });
  await expect(active).toHaveAttribute('aria-current', 'page');
  await expect(async () => {
    const item = await active.boundingBox();
    const container = await tabs(page).boundingBox();
    expect(item!.x).toBeGreaterThanOrEqual(container!.x - 1);
    expect(item!.x + item!.width).toBeLessThanOrEqual(container!.x + container!.width + 1);
  }).toPass();
});

test('network errors are distinguishable from an empty library and can be retried', async ({
  page,
}) => {
  await setup(page, { failure: true });
  await page.goto('/watching');
  await expect(main(page).getByRole('alert')).toContainText(
    'Не удалось загрузить библиотеку',
  );
  await main(page).getByRole('button', { name: 'Повторить загрузку' }).click();
  await expect(titles(page)).toHaveCount(3);
});

test('guests see a login link and no cached private library', async ({
  page,
}) => {
  const api = await setup(page, { guest: true });
  await page.goto('/watching?status=completed');
  await expect(
    main(page).getByRole('heading', {
      name: 'Войдите, чтобы открыть свою библиотеку',
    }),
  ).toBeVisible();
  await expect(titles(page)).toHaveCount(0);
  expect(api.loads()).toBe(0);
  await expect(
    main(page).getByRole('link', { name: 'Войти', exact: true }),
  ).toHaveAttribute(
    'href',
    '/login?callbackUrl=%2Fwatching%3Fstatus%3Dcompleted',
  );
});

test('a genuinely empty list offers catalog search rather than an error', async ({
  page,
}) => {
  await setup(page, { empty: true });
  await page.goto('/watching');
  await expect(
    main(page).getByRole('heading', { name: 'Вы пока ничего не смотрите' }),
  ).toBeVisible();
  await expect(
    main(page).getByRole('link', { name: 'Найти фильм или сериал' }),
  ).toHaveAttribute('href', '/search');
  await expect(main(page).getByRole('alert')).toHaveCount(0);
});

test('list and poster views fit small screens and keep the last action above the mobile bar', async ({
  page,
}, testInfo) => {
  await setup(page);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/watching');
    await expect(titles(page)).toHaveCount(3);
    for (const mode of ['Список', 'Постеры']) {
      await main(page).getByRole('button', { name: mode, exact: true }).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (width === 390 && mode === 'Список')
        await page.screenshot({
          path: testInfo.outputPath('library-mobile.png'),
        });
      if (width === 1440 && mode === 'Список')
        await page.screenshot({
          path: testInfo.outputPath('library-desktop.png'),
        });
    }
    if (width < 1280) {
      const lastAction = titles(page)
        .last()
        .getByRole('link', { name: /Открыть трекер/ });
      await lastAction.scrollIntoViewIfNeeded();
      await page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight),
      );
      const bar = await page
        .getByRole('navigation', { name: 'Мобильная навигация', exact: true })
        .boundingBox();
      const action = await lastAction.boundingBox();
      expect(action!.y + action!.height).toBeLessThanOrEqual(bar!.y);
    }
  }
});
