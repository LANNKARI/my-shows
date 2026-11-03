import {test,expect,type Page} from '@playwright/test';
async function setup(page:Page,options:{failure?:boolean;delayed?:boolean}={}){
 let balance=100;const calls:unknown[]=[];
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/auth/session')return route.fulfill({json:{user:{id:'polish-user',username:'alex'},expires:'2099-01-01'}});
  if(path==='/api/users/me')return route.fulfill({json:{id:'polish-user',username:'alex',email:'alex@example.test',name:'Алекс',bio:'',avatarUrl:null}});
  if(path==='/api/popcorn')return route.fulfill({json:{popcorn:balance,canClaimDaily:false,dailyStreak:3,nextStreak:4,streakRewards:{1:10,2:15,3:20,4:25,5:30,6:40,7:50},tasks:[]}});
  if(path==='/api/popcorn-history')return route.fulfill({json:{items:[],nextCursor:null}});
  if(path==='/api/promo-codes/redeem'){
    calls.push(route.request().postDataJSON());if(options.delayed)await new Promise(r=>setTimeout(r,400));
    if(options.failure)return route.fulfill({status:409,json:{error:'Вы уже активировали этот промокод.'}});
    balance+=100;return route.fulfill({json:{success:true,amount:100,balance}});
  }
  return route.fulfill({json:{}});
 });return calls;
}
for(const width of [320,390,1440])test(`promo activation updates balance and VK footer fits ${width}px`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:1000});const calls=await setup(page);await page.goto('/rewards');
 const form=page.getByRole('form',{name:'Активация промокода'});await expect(form.getByRole('button',{name:'Активировать'})).toBeDisabled();await form.getByLabel('Промокод',{exact:true}).fill('DEMO_100');await form.getByRole('button',{name:'Активировать'}).click();
 await expect(page.locator('.promo-code-feedback')).toContainText('+100');await expect(page.locator('.theme-reward-balance')).toContainText('200');expect(calls).toEqual([{code:'DEMO_100'}]);
 const vk=page.getByRole('link',{name:'EpisyHub ВКонтакте — открыть сообщество'});await expect(vk).toHaveAttribute('href','https://vk.ru/episyhub');await expect(vk).toHaveAttribute('target','_blank');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath(`promo-${width}.png`),fullPage:true});
});
test('promo error preserves code and rapid submits send one activation',async({page})=>{
 const calls=await setup(page,{failure:true,delayed:true});await page.goto('/rewards');const input=page.getByLabel('Промокод',{exact:true});await input.fill('USED');const button=page.getByRole('button',{name:'Активировать',exact:true});await button.dblclick();await expect(page.locator('.promo-code-panel').getByRole('alert')).toContainText('уже активировали');await expect(input).toHaveValue('USED');expect(calls).toHaveLength(1);
});
test('settings offer a Russian file button and preserve native upload selection',async({page})=>{
 await setup(page);let uploaded=false;await page.route('**/api/upload',async route=>{uploaded=true;return route.fulfill({json:{url:'https://example.test/avatar.webp'}})});await page.goto('/settings');const button=page.getByRole('button',{name:'Выбрать изображение',exact:true});await expect(button).toBeVisible();const chooser=page.waitForEvent('filechooser');await button.click();await(await chooser).setFiles({name:'avatar.png',mimeType:'image/png',buffer:Buffer.from('image fixture')});await expect(page.getByText('avatar.png',{exact:true})).toBeVisible();await expect.poll(()=>uploaded).toBe(true);
});
