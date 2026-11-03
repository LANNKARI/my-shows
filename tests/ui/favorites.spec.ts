import { test, expect, type Page } from '@playwright/test';
const poster='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#514263"/></svg>');
async function setup(page:Page,options:{owner?:boolean;fail?:boolean;empty?:boolean}={}) {
  let items=options.empty?[]:Array.from({length:6},(_,i)=>({id:101+i,showId:11+i,rank:i+1,name:`Тайтл ${i+1}`,posterUrl:poster,year:'2025',kind:i%2?'movie':'series',rating:9}));
  const calls:unknown[]=[];
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/auth/session')return route.fulfill({json:options.owner===false?null:{user:{id:'owner',username:'alex'},expires:'2099-01-01'}});
    if(path==='/api/favorites/order'){
      const body=route.request().postDataJSON();calls.push(body);
      if(options.fail)return route.fulfill({status:409,json:{error:'Список любимых изменился. Обновите его.'}});
      items=body.ids.map((id:number,index:number)=>({...items.find(i=>i.id===id)!,rank:index+1}));return route.fulfill({json:{success:true}});
    }
    if(path==='/api/users/alex/favorites')return route.fulfill({json:{user:{username:'alex',name:'Алекс'},isOwnProfile:options.owner!==false,items}});
    if(path==='/api/users/alex')return route.fulfill({json:{user:{id:'owner',username:'alex',name:'Алекс',createdAt:'2025-01-01'},isOwnProfile:options.owner!==false,favorites:items,achievements:[],completedShows:[],stats:{totalCompleted:0,moviesCount:0,seriesCount:0,ratingsCount:0,hoursWatched:0}}});
    return route.fulfill({json:{}});
  });return calls;
}
for(const width of [320,390,1440])test(`profile limits favorites to five and full list can reorder at ${width}px`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:1000});const calls=await setup(page);await page.goto('/u/alex');
  await expect(page.locator('.favorites-grid .favorite-card')).toHaveCount(5);
  await page.getByRole('link',{name:'Все любимые фильмы и сериалы →',exact:true}).click();
  await expect(page.locator('.favorite-card')).toHaveCount(6);
  await page.getByRole('button',{name:'↕ Изменить порядок'}).click();
  await page.getByRole('button',{name:'Опустить: Тайтл 1',exact:true}).click();
  await expect(page.locator('.favorite-order-row').first()).toContainText('Тайтл 2');expect(calls).toHaveLength(0);
  await page.getByRole('button',{name:'Отмена',exact:true}).click();
  await expect(page.locator('.favorite-card').first()).toHaveAccessibleName('Тайтл 1');
  await page.getByRole('button',{name:'↕ Изменить порядок'}).click();
  await page.getByRole('button',{name:'Поднять: Тайтл 6',exact:true}).click();
  await page.getByRole('button',{name:'Сохранить порядок',exact:true}).click();
  await expect(page.getByRole('main').getByRole('status')).toContainText('Порядок сохранён');expect(calls).toHaveLength(1);
  await page.reload();await expect(page.locator('.favorite-card').nth(4)).toHaveAccessibleName('Тайтл 6');
  await page.getByRole('link',{name:'← Назад в профиль'}).click();
  await expect(page.locator('.favorite-card')).toHaveCount(5);await expect(page.locator('.favorite-card').nth(4)).toHaveAccessibleName('Тайтл 6');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath(`favorites-${width}.png`),fullPage:true});
});
test('visitors see all favorites but cannot edit; an empty list stays meaningful',async({page})=>{
  await setup(page,{owner:false});await page.goto('/u/alex/favorites');await expect(page.locator('.favorite-card')).toHaveCount(6);await expect(page.getByRole('button',{name:/Изменить порядок/})).toHaveCount(0);
});
test('failed saves preserve the draft and offer a confirmed reload',async({page})=>{
  await setup(page,{fail:true});await page.goto('/u/alex/favorites');await page.getByRole('button',{name:/Изменить порядок/}).click();await page.getByRole('button',{name:'Опустить: Тайтл 1',exact:true}).click();await page.getByRole('button',{name:'Сохранить порядок',exact:true}).click();await expect(page.getByRole('main').getByRole('alert')).toContainText('изменился');await expect(page.locator('.favorite-order-row').first()).toContainText('Тайтл 2');await page.getByRole('button',{name:'Обновить список'}).click();await expect(page.locator('.favorite-card').first()).toHaveAccessibleName('Тайтл 1');
});
test('pointer drag moves a title without saving until confirmed',async({page})=>{
  await page.setViewportSize({width:1440,height:1000});const calls=await setup(page);await page.goto('/u/alex/favorites');await page.getByRole('button',{name:/Изменить порядок/}).click();
  const handle=await page.getByRole('button',{name:'Переместить: Тайтл 1',exact:true}).boundingBox(),target=await page.locator('.favorite-order-row').nth(2).boundingBox();
  await page.mouse.move(handle!.x+handle!.width/2,handle!.y+handle!.height/2);await page.mouse.down();await page.mouse.move(target!.x+target!.width/2,target!.y+target!.height/2,{steps:20});await page.mouse.up();
  await expect(page.locator('.favorite-order-row').first()).toContainText('Тайтл 2');expect(calls).toHaveLength(0);await expect(page.getByRole('button',{name:'Сохранить порядок'})).toBeEnabled();
});
test('empty favorites show no edit controls',async({page})=>{await setup(page,{empty:true});await page.goto('/u/alex/favorites');await expect(page.getByText(/Любимых тайтлов пока нет/)).toBeVisible();await expect(page.getByRole('button',{name:/Изменить порядок/})).toHaveCount(0);});

test('touch handle reorders on a phone while arrow controls remain keyboard operable',async({page})=>{
  await page.setViewportSize({width:390,height:1000});await setup(page);await page.goto('/u/alex/favorites');await page.getByRole('button',{name:/Изменить порядок/}).click();
  const handle=await page.getByRole('button',{name:'Переместить: Тайтл 1',exact:true}).boundingBox(),target=await page.locator('.favorite-order-row').nth(2).boundingBox();
  const cdp=await page.context().newCDPSession(page),x=handle!.x+handle!.width/2,y=handle!.y+handle!.height/2,destination=target!.y+target!.height/2;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
  for(let step=1;step<=12;step++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+(destination-y)*step/12,id:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect(page.locator('.favorite-order-row').first()).toContainText('Тайтл 2');
  const arrow=page.getByRole('button',{name:'Поднять: Тайтл 1',exact:true});await arrow.focus();await arrow.press('Enter');await expect(page.getByRole('button',{name:await arrow.isDisabled()?'Опустить: Тайтл 1':'Поднять: Тайтл 1',exact:true})).toBeFocused();
});
