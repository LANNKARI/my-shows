import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {Writable} from 'node:stream';
import {v2 as cloudinary} from 'cloudinary';
import sharp from 'sharp';
import {uploadProfileBanner} from '../src/lib/profile-banner';
import {encodeBanner} from '../src/lib/banner-image';
test('banner upload uses persistent Cloudinary image storage with server-chosen ownership and WEBP bytes',async()=>{
 const input=await sharp({create:{width:100,height:50,channels:3,background:'#926fa9'}}).png().toBuffer();const encoded=await encodeBanner(input);let options:Record<string,unknown>|undefined;const chunks:Buffer[]=[];
 const stub=mock.method(cloudinary.uploader,'upload_stream',(provided:Record<string,unknown>,complete:(error:unknown,result:unknown)=>void)=>{options=provided;return new Writable({write(chunk,_,done){chunks.push(Buffer.from(chunk));done()},final(done){complete(null,{secure_url:'https://res.cloudinary.com/demo/image/upload/banner.webp'});done()}})});
 try{const url=await uploadProfileBanner(encoded,'owner-fixture');assert.equal(url,'https://res.cloudinary.com/demo/image/upload/banner.webp');assert.equal(options?.resource_type,'image');assert.equal(options?.folder,'episyhub/banners');assert.match(String(options?.public_id),/^owner-fixture-[\w-]+$/);assert.deepEqual(Buffer.concat(chunks),encoded);assert.equal((await sharp(encoded).metadata()).format,'webp');}finally{stub.mock.restore()}
});
test('invalid image payloads and SVG cannot become uploaded cover images',async()=>{await assert.rejects(encodeBanner(Buffer.from('not an image')));await assert.rejects(encodeBanner(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>')))});
