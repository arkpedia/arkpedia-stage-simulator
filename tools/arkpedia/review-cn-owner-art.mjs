// SPDX-License-Identifier: GPL-3.0-or-later
// Recipe-driven original artwork compatibility only; never gameplay admission.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
const {values}=parseArgs({options:{recipe:{type:'string'},clocks:{type:'string'}}});
if(!values.recipe||!values.clocks||!process.env.ARKPEDIA_REVIEW_CHROME)throw Error('Set browser executable and provide --recipe and --clocks');
const recipe=JSON.parse(await readFile(values.recipe)),clocks=JSON.parse(await readFile(values.clocks)),owner=recipe.operator,id=recipe.model??owner,modelClocks=id===owner?clocks:clocks.tokens?.[id];
assert.equal(clocks.operator,owner);assert.ok(modelClocks?.models);assert.equal(clocks.receiptSha256,recipe.foundationSha256);
assert.match(owner,/^char_\d+_[a-z0-9]+$/);assert.match(id,/^(?:char|token)_\d+_[a-z0-9_]+$/);assert.ok(!/[<>]/.test(recipe.name));
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3182',route='/arkpedia/original-owner-art-review.html';
const out=`.cache/arkpedia/cn-operators/${owner}/${id===owner?'':'tokens/'+id+'/'}art-browser/`,manifest=JSON.parse(await readFile('../arkpedia-sd-assets/manifest.json'));
const rows=['front','back'].map(face=>{const r=manifest.models[`operator/${id}/default/${face}`];
 assert.equal(r.premultipliedAlpha,true);assert.deepEqual(r.animationRoles,recipe.roles[face==='front'?'Front':'Back']);
 const empty=recipe.emptyClips?.[face==='front'?'Front':'Back']??[];assert.ok(Array.isArray(empty)&&new Set(empty).size===empty.length&&empty.every(k=>r.animations[k]===0));
 return {id,face,empty,pma:r.premultipliedAlpha,durations:r.animations,files:Object.fromEntries([r.skeleton,r.atlas,...r.textures].map(f=>[f.path.split('/').at(-1),'../arkpedia-sd-assets/'+f.path])),
  hashes:[r.skeleton,r.atlas,...r.textures].map(({path,sha256})=>({path,sha256}))};});
await mkdir(out,{recursive:true});
const html=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="/vendor/pixi.min.js"></script><script src="/vendor/pixi-spine.js"></script>
<style>body{margin:0;background:#10191d;color:#dae9ed;font:14px sans-serif}header{padding:12px}#scene{height:calc(100dvh - 52px)}canvas{display:block}</style>
<header></header><div id="scene"></div><script>(async()=>{
 const name=${JSON.stringify(recipe.name)},P=PIXI,rows=${JSON.stringify(rows.map(({files,...r})=>({...r,names:Object.keys(files)})))},host=document.querySelector('#scene');
 document.querySelector('header').textContent='CONTROLLED ART REVIEW · '+name+' · original Front / Back clips · not a battle';
 const app=new P.Application({width:innerWidth,height:host.clientHeight,backgroundColor:0x10191d,autoStart:false,antialias:true});host.append(app.view);const actors=[];
 for(const[i,a]of rows.entries()){
  const skel=a.names.find(k=>k.endsWith('.skel')),atlas=a.names.find(k=>k.endsWith('.atlas')),prefix='/owner-art-review-assets/'+i+'/';
  const loaded=await P.Assets.load({src:prefix+skel,data:{spineAtlasFile:prefix+atlas,imageMetadata:{alphaMode:P.ALPHA_MODES.PMA}}});
  const s=new P.spine.Spine(loaded.spineData);s.autoUpdate=false;app.stage.addChild(s);const label=new P.Text('',{fontFamily:'sans-serif',fontSize:14,fill:0xdbeaed});label.anchor.set(.5);app.stage.addChild(label);actors.push({...a,s,label});
 }
 function draw(phase='Idle',age=.35){app.renderer.resize(innerWidth,host.clientHeight);const w=innerWidth/2,h=host.clientHeight;
  return actors.map((a,i)=>{const cx=(i+.5)*w,clip=Object.hasOwn(a.durations,phase)?phase:null;a.s.visible=clip!=null;a.label.text=name+' · '+a.face+' · '+(clip??'absent '+phase);a.label.position.set(cx,h-18);
   if(clip==null)return {id:a.id,face:a.face,clip,age,absent:true};
   a.s.skeleton.setToSetupPose();a.s.state.clearTracks();a.s.state.setAnimation(0,clip,phase==='Idle');a.s.scale.set(1);a.s.position.set(0);a.s.update(Math.min(age,a.durations[clip]/2));
   const b=a.s.getLocalBounds();if(b.width===0&&b.height===0&&a.durations[clip]===0&&a.empty.includes(clip)){a.s.visible=false;a.label.text+=' · empty original track';return{id:a.id,face:a.face,clip,age,empty:true,width:0,height:0};}if(!(b.width>0&&b.height>0))throw Error('Undeclared empty original clip '+a.face+'/'+clip);const scale=Math.min((w-40)/b.width,(h-44)/b.height);a.s.scale.set(scale);a.s.position.set(cx-(b.x+b.width/2)*scale,(h-24)/2-(b.y+b.height/2)*scale);
   return {id:a.id,face:a.face,clip,age,width:b.width,height:b.height,scale};});}
 window.ownerArtReview={actors,app,draw,ready:true};draw();app.renderer.render(app.stage);
})().catch(e=>{window.reviewError=e.stack;console.error(e)});</script>`;
const browser=await puppeteer.launch({executablePath:process.env.ARKPEDIA_REVIEW_CHROME,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const errors=[],failed=[],report={operator:id,artworkOnly:true,publicBattleTest:false,sources:rows.map(({id,face,pma,hashes})=>({id,face,pma,hashes})),clips:[],captures:[]};
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)failed.push({url:r.url(),status:r.status()});});
 await page.setRequestInterception(true);page.on('request',async r=>{
  const url=new URL(r.url());if(url.pathname===route)return r.respond({status:200,contentType:'text/html',body:html});if(url.pathname==='/favicon.ico')return r.respond({status:204});
  const match=/^\/owner-art-review-assets\/(\d+)\/([^/]+)$/.exec(url.pathname),file=match&&rows[Number(match[1])]?.files[match[2]];
  if(file)return r.respond({status:200,contentType:file.endsWith('.png')?'image/png':file.endsWith('.atlas')?'text/plain':'application/octet-stream',body:await readFile(file)});return r.continue();
 });
 const phases=recipe.reviewPhases??['Start','Idle','Die','Attack','Attack_Down','Skill_1_Begin','Skill_1_Loop','Skill_Down_1_Loop','Skill_1_Idle','Skill_1_End','Skill_2_Begin','Skill_2_Loop','Skill_Down_2_Loop','Skill_2_Idle','Skill_2_End'];
 assert.ok(Array.isArray(phases)&&phases.length>0&&new Set(phases).size===phases.length);
 for(const phase of phases)assert.ok(typeof phase==='string'&&rows.some(r=>Object.hasOwn(r.durations,phase))||!recipe.reviewPhases,'Invalid declared review phase');
 for(const[name,width,height,touch]of[['desktop',1280,720,false],['landscape-phone',844,390,true]]){
  await page.setViewport({width,height,hasTouch:touch,isMobile:touch,deviceScaleFactor:1});await page.goto(origin+route,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.ownerArtReview?.ready||window.reviewError,{timeout:60000});assert.equal(await page.evaluate(()=>window.reviewError),undefined);
  const clips=await page.evaluate(()=>ownerArtReview.actors.flatMap(a=>a.s.spineData.animations.filter(c=>c.name!=='Default').map(c=>{a.s.skeleton.setToSetupPose();a.s.state.clearTracks();a.s.state.setAnimation(0,c.name,false);a.s.update(Math.min(.5,c.duration/2));const b=a.s.getLocalBounds();return {id:a.id,face:a.face,clip:c.name,duration:c.duration,width:b.width,height:b.height};})));
  assert.equal(clips.length,rows.reduce((n,r)=>n+Object.keys(r.durations).filter(c=>c!=='Default').length,0));
  for(const c of clips){const declared=rows.find(r=>r.face===c.face).empty.includes(c.clip);if(declared){assert.equal(c.duration,0);assert.equal(c.width,0);assert.equal(c.height,0);c.empty=true;}else assert.ok(Number.isFinite(c.width+c.height)&&c.width>0&&c.height>0,JSON.stringify(c));assert.equal(c.duration,modelClocks.models[c.face==='front'?'Front':'Back'].exactDurations[c.clip]);}
  report.clips.push(...clips.map(c=>({viewport:name,...c})));
  for(const phase of phases){const states=await page.evaluate(phase=>{const s=ownerArtReview.draw(phase);ownerArtReview.app.renderer.render(ownerArtReview.app.stage);return s;},phase);assert.ok(states.every(s=>s.absent||s.empty||s.scale>0&&Number.isFinite(s.scale)));
   const file=out+name+'-'+phase.toLowerCase()+'.png';await page.screenshot({path:file});report.captures.push({name,width,height,touch,phase,file,states});}
 }
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);await writeFile(out+'report.json',JSON.stringify({...report,errors,failed},null,2)+'\n');console.log(JSON.stringify({clipsPerViewport:report.clips.length/2,captures:report.captures.length,errors,failed}));
}finally{await browser.close();}
