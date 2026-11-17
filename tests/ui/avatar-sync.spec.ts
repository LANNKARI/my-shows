import {test,expect,type Page} from '@playwright/test';
const picture=(color:string)=>'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="${color}"/></svg>`);
const oldPhoto=picture('#514a76'),newPhoto=picture('#39a463');
async function setup(page:Page, freshSession=false){
 const state={photo:oldPhoto as string|null,failSave:false,saves:0};
 const user=()=>({id:'avatar-user',username:'avatar_user',name:'Киноман',email:'avatar@example.test',bio:'',avatarUrl:state.photo,avatarFrame:'frame-gold-light',profileStyle:'profile-standard',popcorn:10});
 await page.route('**/api/**',route=>{const path=new URL(route.request().url()).pathname;
  if(path==='/api/auth/session')return route.fulfill({json:{user:{...user(),image:freshSession?state.photo:oldPhoto},expires:'2099-01-01'}});
  if(path==='/api/account')return route.fulfill({json:{owner:false,premium:{active:false},badges:[]}});
  if(path==='/api/account-badges')return route.fulfill({json:{badges:{'avatar-user':[]},frames:{'avatar-user':'frame-gold-light'},avatars:{'avatar-user':state.photo}}});
  if(path==='/api/users/me'){
   if(route.request().method()==='PATCH'){state.saves++;if(state.failSave)return route.fulfill({status:503,json:{error:'Не удалось сохранить'}});state.photo=route.request().postDataJSON().avatarUrl;}
   return route.fulfill({json:user()});
  }
  if(path==='/api/upload')return route.fulfill({json:{url:newPhoto}});
  if(path==='/api/users/avatar_user')return route.fulfill({json:{user:user(),isOwnProfile:true,stats:{},favorites:[],achievements:[],completedShows:[]}});
  return route.fulfill({json:{}});
 });return state;
}
for(const width of [390,1440])test(`header replaces a stale session photo, refreshes on focus and handles removal at ${width}px`,async({page})=>{
 const state=await setup(page);state.photo=newPhoto;await page.setViewportSize({width,height:900});await page.goto('/u/avatar_user');
 const avatar=page.getByRole('button',{name:'Меню профиля'}).locator('.cosmetic-avatar');
 await expect(avatar.locator('img')).toHaveAttribute('src',newPhoto);
 await expect(avatar).toHaveAttribute('data-frame','frame-gold-light');
 state.photo=oldPhoto;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(avatar.locator('img')).toHaveAttribute('src',oldPhoto);
 state.photo=null;await page.evaluate(()=>window.dispatchEvent(new Event('account-updated')));
 await expect(avatar.locator('img')).toHaveCount(0);await expect(avatar).toContainText('A');
});
test('avatar upload previews locally, updates the header only after saving, and survives stale session data',async({page})=>{
 const state=await setup(page);await page.goto('/settings');
 const header=page.getByRole('button',{name:'Меню профиля'}).locator('.cosmetic-avatar img');
 const preview=page.getByRole('main').locator('.cosmetic-avatar img');
 await expect(header).toHaveAttribute('src',oldPhoto);
 await page.getByLabel('Выбрать изображение',{exact:true}).setInputFiles({name:'avatar.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jU1sAAAAASUVORK5CYII=','base64')});
 await expect(preview).toHaveAttribute('src',newPhoto);await expect(header).toHaveAttribute('src',oldPhoto);expect(state.saves).toBe(0);
 state.failSave=true;await page.getByRole('button',{name:'Сохранить',exact:true}).click();
 await expect(page.getByText('Не удалось сохранить',{exact:true})).toBeVisible();await expect(header).toHaveAttribute('src',oldPhoto);
 state.failSave=false;await page.getByRole('button',{name:'Сохранить',exact:true}).click();
 await expect(header).toHaveAttribute('src',newPhoto);await expect(page.getByText('✓ Сохранено',{exact:true})).toBeVisible();
 await page.goto('/u/avatar_user');await expect(page.getByRole('button',{name:'Меню профиля'}).locator('img')).toHaveAttribute('src',newPhoto);
});

test('first header photo is current even while appearance data is still loading',async({page})=>{
 const state=await setup(page,true);state.photo=newPhoto;
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve});
 await page.route('**/api/account-badges?*',async route=>{await gate;await route.fallback()});
 await page.addInitScript(()=>{
  (window as unknown as {seenAvatarSources:string[]}).seenAvatarSources=[];
  const observe=()=>{const img=document.querySelector('[aria-label="Меню профиля"] .cosmetic-avatar img');const src=img?.getAttribute('src');if(src)(window as unknown as {seenAvatarSources:string[]}).seenAvatarSources.push(src)};
  new MutationObserver(observe).observe(document,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
 });
 await page.goto('/u/avatar_user');
 await expect(page.getByRole('button',{name:'Меню профиля'}).locator('img')).toHaveAttribute('src',newPhoto);
 expect(await page.evaluate(()=>(window as unknown as {seenAvatarSources:string[]}).seenAvatarSources)).not.toContain(oldPhoto);
 release();await expect(page.getByRole('button',{name:'Меню профиля'}).locator('img')).toHaveAttribute('src',newPhoto);
});
