import {test} from 'node:test';import assert from 'node:assert/strict';
import {titleImages} from '../src/lib/title-images';import {originalImageUrl} from '../src/lib/tmdb-image';
test('posters upgrade only recognized TMDB sizes and preserve uploads',()=>{
 assert.equal(originalImageUrl('https://image.tmdb.org/t/p/w500/abc.jpg'),'https://image.tmdb.org/t/p/original/abc.jpg');
 for(const url of ['/local.webp','https://example.test/a.jpg','data:image/png,test'])assert.equal(originalImageUrl(url),url);
});
test('image metadata uses correct TMDB type, excludes unsafe paths, deduplicates and limits results',async()=>{
 for(const kind of ['movie','series']){
  const result=await titleImages(15,kind,{apiKey:'fixture',fetcher:async input=>{
   const url=new URL(String(input));assert.equal(url.pathname,`/3/${kind==='movie'?'movie':'tv'}/15/images`);assert.equal(url.searchParams.get('include_image_language'),'ru,en,null');
   return new Response(JSON.stringify({backdrops:[{file_path:'/a.jpg',width:1600,height:900},{file_path:'/a.jpg'},{file_path:'https://evil.test/a.jpg'},...Array.from({length:30},(_,i)=>({file_path:`/img${i}.jpg`}))],posters:[{file_path:'/poster.jpg'}]}));
  }});assert.equal(result.length,24);assert.equal(result[0].original,'https://image.tmdb.org/t/p/original/a.jpg');assert.equal(result[0].thumbnail,'https://image.tmdb.org/t/p/w780/a.jpg');assert.equal(result[0].width,1600);
 }
});
test('missing images are empty, upstream failures stay distinguishable',async()=>{
 assert.deepEqual(await titleImages(1,'movie',{apiKey:'fixture',fetcher:async()=>new Response('{"backdrops":[]}')}),[]);
 await assert.rejects(titleImages(1,'movie',{apiKey:'fixture',fetcher:async()=>new Response('{}',{status:503})}));
});
