import {test,expect,type Page} from '@playwright/test';
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="800" height="450" fill="#476c73"/><circle cx="520" cy="150" r="80" fill="#d5b982"/></svg>';
const poster='data:image/svg+xml,'+encodeURIComponent(svg.replace('height="450"','height="1200"'));
async function setup(page:Page,empty=false){let fail=false;const originals:string[]=[];
 await page.route('https://res.cloudinary.com/**',route=>{if(route.request().url().includes('/original/'))originals.push(route.request().url());return route.fulfill({contentType:'image/svg+xml',body:svg})});
 const show={id:10,title:'Тестовый фильм',name:'Тестовый фильм',kind:'movie',posterUrl:poster,description:'Описание фильма',year:'2026',genres:[],cast:[],comments:[]};
 const userShow={id:100,showId:10,kind:'series',status:'watching',isFavorite:false,isBookmarked:false,userRating:null};
 await page.route('**/api/**',route=>{const path=new URL(route.request().url()).pathname;
 if(path==='/api/auth/session')return route.fulfill({json:{user:{id:'image-user',username:'image_user'},expires:'2099-01-01'}});
 if(path==='/api/account')return route.fulfill({json:{owner:false,premium:{active:false},badges:[]}});
 if(path==='/api/shows/10/images')return route.fulfill({status:fail?503:200,json:fail?{error:'Unavailable'}:{images:empty?[]:[1,2,3].map(i=>({thumbnail:`https://image.tmdb.org/t/p/w780/frame${i}.jpg`,original:`https://image.tmdb.org/t/p/original/frame${i}.jpg`,width:1600,height:900}))}});
 if(path==='/api/shows/10')return route.fulfill({json:{show,userShow}});
 if(path==='/api/user-shows/10')return route.fulfill({json:{show:{...show,kind:'series'},userShow,stats:{totalEpisodes:1,watchedEpisodesCount:0,progressPercent:0},seasons:[{seasonNumber:1,totalEpisodes:1,watchedEpisodes:0,isCompleted:false,episodes:[{id:1,season:1,episode:1,watched:false,stoppedAt:null}]}]}});
 if(path.endsWith('/note'))return route.fulfill({json:{text:'',updatedAt:null}});
 return route.fulfill({json:{}});
 });return {originals,setFail:(value:boolean)=>{fail=value}};
}
for(const width of [390,1440])test(`poster and stills open, navigate and restore focus at ${width}px`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:1000});const state=await setup(page);await page.goto('/show/10');
 const gallery=page.getByRole('region',{name:'Кадры из фильма или сериала'});await expect(gallery.locator('.ti-grid button')).toHaveCount(3);expect(state.originals).toHaveLength(0);
 const trigger=gallery.getByRole('button',{name:'Открыть кадр 1: Тестовый фильм',exact:true});await trigger.click();
 const dialog=page.getByRole('dialog',{name:'Просмотр изображений'});await expect(dialog).toBeVisible();await expect(dialog.locator('img')).toHaveAttribute('src',/original\/frame1.jpg/);
 await page.keyboard.press('ArrowRight');await expect(dialog.locator('img')).toHaveAttribute('src',/original\/frame2.jpg/);
 await dialog.locator('.ti-stage').evaluate(element=>{element.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[new Touch({identifier:1,target:element,clientX:300,clientY:200})]}));element.dispatchEvent(new TouchEvent('touchend',{bubbles:true,changedTouches:[new Touch({identifier:1,target:element,clientX:100,clientY:205})]}))});await expect(dialog.locator('img')).toHaveAttribute('src',/original\/frame3.jpg/);
 await dialog.getByRole('button',{name:'Следующий кадр'}).click();await expect(dialog.locator('img')).toHaveAttribute('src',/original\/frame1.jpg/);
 await expect(dialog.locator('img')).toHaveCSS('opacity','1');await dialog.screenshot({path:testInfo.outputPath(`viewer-${width}.png`)});
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
 expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe('hidden');
 await page.getByRole('button',{name:'Открыть постер: Тестовый фильм',exact:true}).click();await expect(dialog).toBeVisible();await expect(dialog.getByRole('button',{name:'Следующий кадр'})).toHaveCount(0);await dialog.getByRole('button',{name:'Закрыть изображение'}).click();await expect(dialog).toHaveCount(0);
 await gallery.screenshot({path:testInfo.outputPath(`gallery-${width}.png`)});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.goto('/library/10');await page.getByRole('button',{name:'Открыть постер: Тестовый фильм',exact:true}).filter({visible:true}).click();await expect(dialog).toBeVisible();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
});
test('empty stills are hidden and failed metadata can be retried',async({page})=>{
 const state=await setup(page,true);await page.goto('/show/10');await expect(page.getByRole('region',{name:'Кадры из фильма или сериала'})).toHaveCount(0);
 state.setFail(true);await page.reload();const gallery=page.getByRole('region',{name:'Кадры из фильма или сериала'});await expect(gallery.getByRole('alert')).toBeVisible();state.setFail(false);await gallery.getByRole('button',{name:'Повторить'}).click();await expect(gallery).toHaveCount(0);
});
