// Isolated UI tests only: application APIs stay real, external providers are fixtures.
if(process.env.MOBILE_UI_UPSTREAM_FIXTURES==='1'){
 const original=globalThis.fetch;
 globalThis.fetch=async(input,init)=>{
  const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
  if(url.hostname!=='api.themoviedb.org')return original(input,init);
  if(!url.pathname.startsWith('/3/discover/'))return Response.json({error:'Unexpected fixture endpoint'},{status:404});
  const empty=Number(url.searchParams.get('vote_average.gte'))>8.5||Number((url.searchParams.get('primary_release_date.gte')||url.searchParams.get('first_air_date.gte')||'0').slice(0,4))>2014;
  return Response.json({page:1,total_pages:1,total_results:empty?0:1,results:empty?[]:[{id:42424266,title:'Фильм из подборки',name:'Фильм из подборки',release_date:'2014-11-06',first_air_date:'2014-11-06',vote_average:8.5,vote_count:500,genre_ids:[878],overview:'Описание тестового варианта.',popularity:100,poster_path:null}]});
 };
 const {PassThrough,Readable}=require('node:stream');
 const https=require('node:https');const request=https.request;
 https.request=function(options,callback){
  const host=typeof options==='string'?new URL(options).hostname:options.hostname||options.host;
  if(host!=='api.cloudinary.com')return request.apply(this,arguments);
  const req=new PassThrough();req.resume();req.setTimeout=()=>req;req.abort=()=>req.destroy();
  req.on('finish',()=>process.nextTick(()=>{const res=Readable.from([JSON.stringify({secure_url:'https://episyhub.space/uploads/mobile-ui-avatar.png'})]);res.statusCode=200;res.headers={};if(callback)callback(res);req.emit('response',res);}));
  return req;
 };
}
