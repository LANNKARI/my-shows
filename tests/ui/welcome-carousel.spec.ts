import { expect, test, type Page } from '@playwright/test';
async function setup(page: Page) {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({json:path === '/api/auth/session' ? null : path === '/api/home' ? {heroSlides:[],recentOnline:[],universes:[],directors:[]} : {items:[]}});
  });
  await page.goto('/');
  return page.getByRole('region', {name:'Новости и приветствие EpisyHub'});
}
for(const width of [320,390,1440]) test(`welcome and VK slides keep their size at ${width}px`, async ({page}) => {
  await page.setViewportSize({width,height:1000});
  const banner=await setup(page);
  await expect(banner.getByRole('link',{name:'В мою библиотеку'})).toBeVisible();
  const before=await banner.boundingBox();
  await banner.getByRole('button',{name:'Показать слайд: Группа ВК'}).click();
  const link=banner.getByRole('link',{name:'Перейти в группу'});
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href','https://vk.ru/episyhub');
  await expect(link).toHaveAttribute('target','_blank');
  await expect(banner.getByRole('link',{name:'В мою библиотеку'})).toHaveCount(0);
  expect((await banner.boundingBox())!.height).toBe(before!.height);
  for(const theme of ['dark','light','autumn-2026','obsidian']) {
    await page.evaluate(t=>{document.documentElement.dataset.theme=t==='light'||t==='autumn-2026'?'light':'dark';document.documentElement.dataset.siteTheme=t;},theme);
    await expect(banner.locator('[aria-hidden="false"]')).toHaveCSS('opacity','1');
    await expect(banner.locator('[aria-roledescription="слайд"][aria-hidden="true"]')).toHaveCSS('opacity','0');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await banner.screenshot({path:`/workspace/work/welcome-${width}-${theme}.png`});
  }
});
test('autoplay pauses on focus and resumes after leaving the banner',async({page})=>{
  await page.clock.install();
  const banner=await setup(page);
  await expect(banner).toHaveAttribute('data-slide','0');
  await page.clock.runFor(8100);
  await expect(banner).toHaveAttribute('data-slide','1');
  await banner.getByRole('link',{name:'Перейти в группу'}).focus();
  await page.clock.runFor(16000);
  await expect(banner).toHaveAttribute('data-slide','1');
  await page.evaluate(()=> (document.activeElement as HTMLElement)?.blur());
  await page.clock.runFor(8100);
  await expect(banner).toHaveAttribute('data-slide','0');
});
test('reduced motion keeps manual slide selection without autoplay',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.clock.install();
  const banner=await setup(page);
  await page.clock.runFor(20000);
  await expect(banner).toHaveAttribute('data-slide','0');
  await expect(banner.getByRole('button',{name:'Приостановить смену баннеров'})).toHaveCount(0);
  await banner.getByRole('button',{name:'Показать слайд: Группа ВК'}).click();
  await expect(banner).toHaveAttribute('data-slide','1');
});
