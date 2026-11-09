// Diagnostic benchmark; isolated local schema only. Never touches production data.
import { PrismaClient } from '@prisma/client';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
const url = new URL(process.env.DATABASE_URL!);
if (!['localhost','127.0.0.1'].includes(url.hostname)) throw Error('Local database required');
url.searchParams.set('schema', `bench_progress_${process.pid}`);
const client = new PrismaClient({datasourceUrl:url.toString(),log:[{emit:'event',level:'query'}]});
let queries:{query:string;duration:number}[]=[];
client.$on('query',event=>queries.push({query:event.query,duration:event.duration}));
(globalThis as unknown as {prisma:PrismaClient}).prisma=client;
const schema=url.searchParams.get('schema')!;
try {
 await client.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
 const result=spawnSync(process.execPath,['node_modules/prisma/build/index.js','db','push','--skip-generate'],{env:{...process.env,DATABASE_URL:url.toString()},encoding:'utf8'});
 if(result.status!==0)throw Error(result.stderr);
 const user=await client.user.create({data:{email:'bench@example.test',username:`bench_${process.pid}`}});
 const show=await client.show.create({data:{name:'Benchmark',kind:'series',episodes:{create:Array.from({length:8},(_,i)=>({season:1,episode:i+1}))}},include:{episodes:true}});
 await client.userShow.create({data:{userId:user.id,showId:show.id,status:'watching',kind:'series',totalEpisodes:8}});
 const {saveProgress}=await import('../src/lib/library-mutations');
 for(const [label,watched] of [['first-mark',true],['unmark',false],['repeat-mark',true]] as const){
  queries=[];const start=performance.now();
  await saveProgress(user.id,show.id,{episodeId:show.episodes[0].id,watched});
  console.log(JSON.stringify({label,ms:Math.round(performance.now()-start),statements:queries.length,sqlMs:queries.reduce((sum,q)=>sum+q.duration,0),operations:queries.map(q=>q.query.split(' ').slice(0,3).join(' '))}));
 }
} finally {await client.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await client.$disconnect();}
