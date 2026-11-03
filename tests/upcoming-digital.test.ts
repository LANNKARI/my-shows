import {test} from 'node:test';
import assert from 'node:assert/strict';
import {firstDigitalRelease,streamingSeries,upcomingDigital} from '../src/lib/upcoming-digital';
const today='2026-11-04',until='2027-02-02';
test('only the earliest global digital release counts, not later streaming or theatrical dates',()=>{
 assert.equal(firstDigitalRelease([{iso_3166_1:'US',release_dates:[{type:4,release_date:'2026-06-30T00:00:00Z'},{type:4,release_date:'2026-11-09T00:00:00Z'}]}],today,until),null);
 assert.equal(firstDigitalRelease([{iso_3166_1:'US',release_dates:[{type:3,release_date:'2026-11-09T00:00:00Z'}]}],today,until),null);
 assert.deepEqual(firstDigitalRelease([{iso_3166_1:'US',release_dates:[{type:3,release_date:'2026-10-23T00:00:00Z'},{type:4,release_date:'2026-12-07T00:00:00Z'}]},{iso_3166_1:'GB',release_dates:[{type:4,release_date:'2026-11-09T00:00:00Z'}]}],today,until),{date:'2026-11-09',country:'GB'});
 assert.equal(firstDigitalRelease([{release_dates:[{type:4,release_date:'2026-02-30'},{type:4,release_date:'2027-04-01'}]}],today,until),null);
});
test('series require a future premiere and exclusively streaming networks',()=>{
 const series={id:3,name:'Rauls',first_air_date:'2026-12-09',networks:[{name:'Netflix'}]};
 assert.deepEqual(streamingSeries(series,today,until),{date:'2026-12-09',platform:'Netflix'});
 assert.equal(streamingSeries({...series,networks:[{name:'FOX'}]},today,until),null);
 assert.equal(streamingSeries({...series,networks:[{name:'Netflix'},{name:'BBC One'}]},today,until),null);
 assert.equal(streamingSeries({...series,first_air_date:'2026-09-01'},today,until),null);
 assert.equal(streamingSeries({...series,networks:[]},today,until),null);
});
test('TMDB discovery is verified, deduplicated across pages and sorted by actual digital date',async()=>{
 const urls:URL[]=[];const response=(value:unknown)=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
 const fetcher:typeof fetch=async(input)=>{
  const url=new URL(String(input));urls.push(url);const path=url.pathname;
  if(path.endsWith('/discover/movie'))return response({results:[{id:1,title:'Позже',backdrop_path:'/a.jpg'},{id:2,title:'Уже вышел',backdrop_path:'/b.jpg'},{id:3,title:'Раньше',backdrop_path:'/c.jpg'}]});
  if(path.endsWith('/discover/tv'))return response({results:[{id:4,name:'Стриминг',backdrop_path:'/d.jpg'},{id:5,name:'Эфир',backdrop_path:'/e.jpg'}]});
  if(path.endsWith('/movie/1/release_dates'))return response({results:[{iso_3166_1:'US',release_dates:[{type:4,release_date:'2026-12-07T00:00:00Z'}]}]});
  if(path.endsWith('/movie/2/release_dates'))return response({results:[{iso_3166_1:'US',release_dates:[{type:4,release_date:'2026-01-01T00:00:00Z'},{type:4,release_date:'2026-11-09T00:00:00Z'}]}]});
  if(path.endsWith('/movie/3/release_dates'))return response({results:[{iso_3166_1:'GB',release_dates:[{type:4,release_date:'2026-11-09T00:00:00Z'}]}]});
  if(path.endsWith('/tv/4'))return response({id:4,name:'Стриминг',first_air_date:'2026-11-20',networks:[{name:'Netflix'}],backdrop_path:'/d.jpg'});
  if(path.endsWith('/tv/5'))return response({id:5,name:'Эфир',first_air_date:'2026-11-07',networks:[{name:'FOX'}]});
  throw Error('Unexpected request');
 };
 const result=await upcomingDigital({apiKey:'test-key',fetcher,now:new Date(today+'T12:00:00Z')});
 assert.deepEqual(result.items.map(i=>i.id),[3,4,1]);assert.equal(urls.filter(u=>u.pathname.endsWith('/movie/1/release_dates')).length,1);
 assert.equal(urls.find(u=>u.pathname.endsWith('/discover/movie'))!.searchParams.get('with_release_type'),'4');
 assert.equal(result.items[0].country,'GB');assert.equal(result.items[1].platform,'Netflix');
});
test('an upstream outage is not reported as a legitimate empty calendar',async()=>{
 const unavailable:typeof fetch=async()=>new Response('{}',{status:503});
 await assert.rejects(upcomingDigital({apiKey:'test-key',fetcher:unavailable}));
 const empty:typeof fetch=async()=>new Response(JSON.stringify({results:[]}));
 assert.deepEqual((await upcomingDigital({apiKey:'test-key',fetcher:empty})).items,[]);
});
