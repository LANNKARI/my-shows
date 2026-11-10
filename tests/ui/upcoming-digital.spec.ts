import {test,expect,type Page} from '@playwright/test';
const art='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="780" height="500"><rect width="780" height="500" fill="#3d5372"/></svg>');
async function setup(page:Page,options:{fail?:boolean;empty?:boolean}={}){
 await page.clock.setFixedTime(new Date('2026-11-04T12:00:00Z'));let failed=!!options.fail;
 await page.route('**/api/**',route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/auth/session')return route.fulfill({json:null});
  if(path==='/api/home')return route.fulfill({json:{heroSlides:[],recentOnline:[],latestDiscoveries:[],currentlyAiring:[],topRated:[],popularMovies:[],popularSeries:[],universes:[],directors:[]}});
  if(path==='/api/upcoming-digital'){
   if(failed){failed=false;return route.fulfill({status:503,json:{error:'Unavailable'}})}
   return route.fulfill({json:{items:options.empty?[]:Array.from({length:10},(_,i)=>({id:i+1,title:`Тайтл ${i+1}`,kind:i===9?'series':'movie',date:`2026-11-${String(i+5).padStart(2,'0')}`,country:i===9?null:'US',platform:i===9?'Netflix':null,imageUrl:art})),checkedAt:'2026-11-04T12:00:00Z'}});
  }
  return route.fulfill({json:{}});
 });
}
for(const width of [320,390,1440])test(`digital rail fits ${width}px with 4:3 cards and no page overflow`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:1000});await setup(page);await page.goto('/');
 const section=page.getByRole('region',{name:'Скоро онлайн',exact:true});await expect(section.locator('.digital-card')).toHaveCount(10);
 const card=await section.locator('.digital-card').first().boundingBox();expect(Math.abs(card!.width/card!.height-4/3)).toBeLessThan(.01);
 await expect(section.locator('time').first()).toHaveAttribute('datetime','2026-11-05');
 await expect(section.getByRole('link').first()).toHaveAttribute('href','/show/1?source=tmdb&type=movie');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await section.screenshot({path:testInfo.outputPath(`digital-${width}.png`)});
});
test('dragging scrolls without opening a title, while clicking and keyboard navigation still work',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await setup(page);await page.goto('/');const rail=page.locator('.digital-track');await rail.waitFor();await rail.scrollIntoViewIfNeeded();const box=await rail.boundingBox();
 await page.mouse.move(box!.x+600,box!.y+110);await page.mouse.down();await page.mouse.move(box!.x+100,box!.y+110,{steps:20});await page.mouse.up();
 // Release between card boundaries: it must stay at the exact dragged position.
 await expect.poll(()=>rail.evaluate(el=>el.scrollLeft)).toBeCloseTo(500,0);
 await page.waitForTimeout(700);expect(await rail.evaluate(el=>el.scrollLeft)).toBeCloseTo(500,0);await expect(page).toHaveURL('/');
 await rail.focus();await rail.press('End');await expect.poll(()=>rail.evaluate(el=>el.scrollLeft)).toBeGreaterThan(500);
 const link=page.getByRole('link',{name:/^Тайтл 10,/});await link.focus();await link.press('Enter');await expect(page).toHaveURL(/\/show\/10\?source=tmdb&type=tv/);
});
test('a regular mouse click opens the movie card',async({page})=>{await setup(page);await page.goto('/');await page.getByRole('link',{name:/^Тайтл 1,/}).click();await expect(page).toHaveURL(/\/show\/1\?source=tmdb&type=movie/);});
test('touch swipes scroll the rail naturally',async({page})=>{
 await page.setViewportSize({width:390,height:1000});await setup(page);await page.goto('/');const rail=page.locator('.digital-track');await rail.waitFor();await rail.scrollIntoViewIfNeeded();const box=await rail.boundingBox(),x=box!.x+270,y=box!.y+100;const cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});for(let i=1;i<=12;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-210*i/12,y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect.poll(()=>rail.evaluate(el=>el.scrollLeft)).toBeGreaterThan(50);await expect(page).toHaveURL('/');
});
test('failed TMDB loading offers retry and empty confirmed data is a distinct state',async({page})=>{
 await setup(page,{fail:true});await page.goto('/');const section=page.getByRole('region',{name:'Скоро онлайн',exact:true});await expect(section.getByRole('alert')).toContainText('Не удалось');await section.getByRole('button',{name:'Повторить загрузку'}).click();await expect(section.locator('.digital-card')).toHaveCount(10);
});
test('empty confirmed data and expired cached titles are not displayed as upcoming',async({page})=>{
 await setup(page,{empty:true});await page.goto('/');await expect(page.getByText(/Подтверждённых цифровых премьер/)).toBeVisible();
 await page.route('**/api/upcoming-digital',route=>route.fulfill({json:{items:[{id:1,title:'Уже вышел',kind:'movie',date:'2026-11-03',country:'US',platform:null,imageUrl:art}]}}));await page.reload();await expect(page.getByText(/Подтверждённых цифровых премьер/)).toBeVisible();await expect(page.locator('.digital-card')).toHaveCount(0);
});
