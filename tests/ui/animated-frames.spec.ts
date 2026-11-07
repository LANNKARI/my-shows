import {test,expect,type Page} from '@playwright/test';
import {COSMETICS} from '../../src/lib/cosmetics';
async function setup(page:Page){const state={premium:true,frame:'frame-premium-orbit',balance:240,purchases:[] as {itemId:string;pricePaid:number;purchasedAt:string}[],currentAppearance:false,calls:[] as Record<string,unknown>[]};const user=()=>({id:'frames-user',username:'frames',name:'Киноман',avatarUrl:null,bannerUrl:null,avatarFrame:state.frame,profileStyle:'profile-standard',popcorn:state.balance,siteTheme:null});
 await page.route('**/api/**',route=>{const request=route.request(),url=new URL(request.url()),path=url.pathname;
 if(path==='/api/auth/session')return route.fulfill({json:{user:{...user(),image:null},expires:'2099-01-01'}});
 if(path==='/api/account')return route.fulfill({json:{owner:false,moderate:false,curate:false,beta:false,badges:[],premium:{active:state.premium,until:null,balance:state.balance,bonusTenths:0,price:2000}}});
 if(path==='/api/account-badges'){const ids=(url.searchParams.get('ids')||'').split(',');const badges=Object.fromEntries(ids.map(id=>[id,state.premium?[{roleId:'premium',name:'Premium',color:'#e0b85a',icon:'✦'}]:[]]));return route.fulfill({json:state.currentAppearance?{badges,frames:Object.fromEntries(ids.map(id=>[id,state.frame]))}:badges})}
 if(path==='/api/site-theme')return route.fulfill({json:{theme:null}});
 if(path==='/api/cosmetics'&&request.method()==='GET')return route.fulfill({json:{user:{...user(),avatarFrame:state.frame==='frame-premium-orbit'&&!state.premium?'frame-standard':state.frame},catalog:COSMETICS,purchases:state.purchases,entitlements:state.premium?['frame-premium-orbit','theme-obsidian']:[],stats:{moviesCount:4,seriesCount:2,ratingsCount:3,hoursWatched:20}}});
 if(path==='/api/cosmetics'){const body=request.postDataJSON();state.calls.push(body);if(body.action==='purchase'&&!state.purchases.some(p=>p.itemId===body.itemId)){const item=COSMETICS.find(i=>i.id===body.itemId)!;state.balance-=item.price;const purchase={itemId:item.id,pricePaid:item.price,purchasedAt:'2026-11-07T12:00:00Z'};state.purchases.push(purchase);return route.fulfill({json:{success:true,user:user(),purchase}})}if(body.action==='equip')state.frame=body.itemId;return route.fulfill({json:{success:true,user:user()}})}
 if(path==='/api/top')return route.fulfill({json:[{...user(),score:20,showsCount:2,ratingsCount:1,commentsCount:1}]});
 if(path==='/api/users/frames')return route.fulfill({json:{user:user(),isOwnProfile:true,stats:{},favorites:[],achievements:[],completedShows:[]}});
 return route.fulfill({json:{}});
 });return state;
}
for(const width of [320,390,1440])test(`animated frames preview at ${width}px without moving the portrait or spending`,async({page})=>{
 await page.setViewportSize({width,height:900});const state=await setup(page);await page.goto('/cosmetics');const orbit=page.getByRole('article',{name:'Золотая орбита',exact:true});const light=page.getByRole('article',{name:'Золотой свет',exact:true});await expect(orbit.getByText('Анимация',{exact:true})).toBeVisible();await expect(light.getByText('Анимация',{exact:true})).toBeVisible();
 const motion=orbit.locator('.cosmetic-frame-motion');await expect(motion).toBeVisible();const position=await motion.evaluate(e=>getComputedStyle(e).transform);await expect.poll(()=>motion.evaluate(e=>getComputedStyle(e).transform)).not.toBe(position);await expect(orbit.locator('.cosmetic-avatar-face')).toHaveCSS('transform','none');
 for(const theme of ['dark','light','autumn-2026','obsidian']){await page.evaluate(t=>{document.documentElement.dataset.theme=t==='light'||t==='autumn-2026'?'light':'dark';document.documentElement.dataset.siteTheme=t},theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);if(width===390||width===1440)await light.screenshot({path:`/workspace/work/animated-light-${width}-${theme}.png`});}
 await light.getByRole('button',{name:'Примерить',exact:true}).click();await expect(page.getByRole('region',{name:'Предпросмотр рамки в комментарии'}).locator('[data-small="true"] .cosmetic-frame-motion')).toBeVisible();expect(state.calls).toHaveLength(0);await page.emulateMedia({reducedMotion:'reduce'});await expect(page.getByRole('region',{name:'Предпросмотр рамки в комментарии'}).locator('.cosmetic-frame-motion')).toHaveCSS('animation-name','none');
});
test('golden light is a permanent 120-popcorn purchase and remains usable without Premium',async({page})=>{const state=await setup(page);state.premium=false;state.frame='frame-standard';await page.goto('/cosmetics');await page.getByRole('article',{name:'Золотой свет',exact:true}).getByRole('button',{name:'Примерить',exact:true}).click();await page.getByRole('button',{name:'Купить за 120 🍿',exact:true}).click();expect(state.calls).toHaveLength(0);await page.getByRole('dialog').getByRole('button',{name:'Подтвердить покупку',exact:true}).click();await page.getByRole('button',{name:'Надеть рамку',exact:true}).click();expect(state.balance).toBe(120);expect(state.frame).toBe('frame-gold-light');await page.goto('/u/frames');await expect(page.getByRole('main').locator('.cosmetic-avatar[data-frame="frame-gold-light"]').first()).toBeVisible();});
test('Premium orbit stops being available when Premium expires while the saved selection remains',async({page})=>{const state=await setup(page);await page.goto('/u/frames');const avatar=page.getByRole('main').locator('.cosmetic-avatar').first();await expect(avatar).toHaveAttribute('data-frame','frame-premium-orbit');state.premium=false;await page.evaluate(()=>window.dispatchEvent(new Event('account-updated')));await expect(avatar).toHaveAttribute('data-frame','frame-standard');expect(state.frame).toBe('frame-premium-orbit');state.premium=true;await page.evaluate(()=>window.dispatchEvent(new Event('account-updated')));await expect(avatar).toHaveAttribute('data-frame','frame-premium-orbit');});

test('current frame replaces stale session and profile values everywhere without signing in again',async({page})=>{
 const state=await setup(page);state.frame='frame-stars';state.currentAppearance=true;
 await page.goto('/u/frames');
 const menu=page.getByRole('button',{name:'Меню профиля'}).locator('.cosmetic-avatar');
 const profile=page.getByRole('main').locator('.cosmetic-avatar').first();
 await expect(menu).toHaveAttribute('data-frame','frame-stars');
 state.frame='frame-premium-orbit';await page.evaluate(()=>window.dispatchEvent(new Event('cosmetics-updated')));
 await expect(menu).toHaveAttribute('data-frame','frame-premium-orbit');
 await expect(profile).toHaveAttribute('data-frame','frame-premium-orbit');
 await expect(menu.locator('.cosmetic-frame-motion')).toBeVisible();
 const before=await menu.locator('.cosmetic-frame-motion').evaluate(e=>getComputedStyle(e).transform);
 await expect.poll(()=>menu.locator('.cosmetic-frame-motion').evaluate(e=>getComputedStyle(e).transform)).not.toBe(before);
 await page.goto('/top');const top=page.locator('[data-user-id="frames-user"] .cosmetic-avatar');await expect(top).toHaveAttribute('data-frame','frame-premium-orbit');await expect(top.locator('.cosmetic-frame-motion')).toBeVisible();
 state.premium=false;await page.evaluate(()=>window.dispatchEvent(new Event('account-updated')));
 await expect(menu).toHaveAttribute('data-frame','frame-standard');
 await expect(top).toHaveAttribute('data-frame','frame-standard');
});
