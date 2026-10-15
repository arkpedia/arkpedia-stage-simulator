// SPDX-License-Identifier: GPL-3.0-or-later
// Controlled original-terrain S3 cage check; does not enable the public roster.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createStaticHandler} from '../../server/index.js';
import {createLocalAssets} from '../../scripts/arkpedia-local-assets.mjs';
import {loadTragodiaDelivery} from './verify-tragodia-delivery.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),out=path.join(root,'.cache/arkpedia/tragodia-source/stage-browser');
const executablePath=process.env.ARKPEDIA_REVIEW_CHROME;
if(!executablePath)throw Error('Set ARKPEDIA_REVIEW_CHROME');
const {meta,manifestSha256}=await loadTragodiaDelivery();
const commit='b419b4546a6a59fdf01e7089499f986a454c1a89';
const d=JSON.parse(await readFile(path.join(root,'data/arkpedia-mvp.json')));
const sd=JSON.parse(await readFile(path.join(root,'../arkpedia-sd-assets/manifest.json')));
d.sd.commit=commit;
for(const descriptor of [d.stage.art,d.stage.gates,d.skillEffects])if(descriptor?.repository===d.sd.repository)descriptor.commit=commit;
for(const face of ['front','back']){
 const key=`operator/char_1042_phatm2/default/${face}`;d.sd.models[key]=sd.models[key];
}
const local=createLocalAssets(path.resolve(root,'../arkpedia-sd-assets')),data=await local.snapshot(d);
const assetBase=`/arkpedia-assets/${commit}/effects/native/tragodia/${meta.resourceVersion}/${meta.pack.sha256}/`;
const serve=createStaticHandler({publicDir:path.join(root,'public'),dataDir:path.join(root,'data'),sharedDir:path.join(root,'shared')});
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 try{
  if(url.pathname==='/review.html'){
   res.writeHead(200,{'Content-Type':'text/html'});
   res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/arkpedia/style.css"><script src="/vendor/pixi.min.js"></script><script src="/vendor/pixi-spine.js"></script><style>body{margin:0;overflow:hidden}header{height:40px;padding:8px;font:12px sans-serif}#board{position:relative;height:calc(100dvh - 40px);overflow:hidden}canvas{position:absolute;inset:0}.tile-controls{display:none}</style><header>CONTROLLED CAGE REVIEW · original 0-1 terrain · pinned enemy / test SP / selected S3 · not public coverage</header><div id="board"></div>');return;
  }
  if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
  if(await local.handle(req,res,url))return;
  await serve(req,res,url.pathname,url.search.slice(1));
 }catch(e){console.error(e);if(!res.headersSent)res.writeHead(500);res.end('Review input unavailable');}
});
await mkdir(out,{recursive:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
const reports=[],errors=[],failed=[];
try{
 browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
 for(const [label,width,height]of [['desktop',1280,800],['landscape-phone',844,390]]){
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)failed.push({url:r.url(),status:r.status()});});
  await page.setViewport({width,height});await page.goto(`http://127.0.0.1:${server.address().port}/review.html`);
  const setup=await page.evaluate(async({data,meta,assetBase})=>{
   const T=await import('/vendor/three.module.js');
   const {StageRenderer}=await import('/arkpedia/renderer.js');
   const {createNativeEffectLibrary}=await import('/arkpedia/native-effect-player.js');
   const {createTragodiaStageEffects}=await import('/arkpedia/tragodia-stage-effects.js');
   const {StandardBattle}=await import('/sim/arkpedia.js');
   const {normalizeChess}=await import('/sim/simdata.js');
   const {defaultBuild}=await import('/shared/arkpedia/loadout.js');
   const {selectedTragodiaBuild,TRAGODIA_ID:ID}=await import('/sim/content/arkpedia-tragodia-source.js');
   const {prepareTragodiaCages,TRAGODIA_CAGE_CONTRACT}=await import('/sim/content/arkpedia-tragodia-cage.js');
   const evidence=await(await fetch('/data/arkpedia-tragodia-prefabs.json')).json();
   const hash=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
   async function bytes(e){const r=await fetch(assetBase+e.path);if(!r.ok)throw Error('Missing delivered asset');const b=await r.arrayBuffer();if(b.byteLength!==e.bytes||await hash(b)!==e.sha256)throw Error('Changed delivered asset');return b;}
   const decoded=await new Response(new Blob([await bytes(meta.pack)]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
   if(decoded.byteLength!==meta.pack.decodedBytes||await hash(decoded)!==meta.pack.decodedSha256)throw Error('Changed decoded pack');
   const json=async e=>JSON.parse(new TextDecoder().decode(await bytes(e)));
   const library=createNativeEffectLibrary({three:T,pack:JSON.parse(new TextDecoder().decode(decoded)),animations:await json(meta.animations),shaders:await json(meta.shaders),builtinMeshes:await json(meta.builtinMeshes),
    loadTexture:async e=>{const url=URL.createObjectURL(new Blob([await bytes(e)],{type:'image/webp'}));try{return await new T.TextureLoader().loadAsync(url);}finally{URL.revokeObjectURL(url);}}});
   let stage;const pass=createTragodiaStageEffects({three:T,library,sourcePackSha256:meta.pack.sha256,heightAt:(r,c)=>stage.heightAt(r,c)});
   stage=new StageRenderer(document.querySelector('#board'),data,()=>{},{nativeEffects:pass});
   await Promise.all([stage.artReady,stage.gatesReady,stage.particlesReady]);if(!stage.art)throw Error('Original stage did not load');
   const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
   const battle=new StandardBattle(d,{operators:[defaultBuild(d.operators.char_289_gyuki)]});
   battle.autoFinish=false;battle.recordEvents=true;battle.setViewport('fullscreen-workspace');
   const build={elite:2,level:90,potential:1,trust:0,skillRank:10,skillId:'skchr_phatm2_3'},r=selectedTragodiaBuild(build),c=evidence.tables.character;
   const def=normalizeChess({chessId:ID,charId:ID,name:c.name,profession:c.profession,position:c.position,subProfessionId:c.subProfessionId,
    stats:r.stats,rangeGrid:r.rangeGrid,tags:r.tags,talents:r.talents,arkpedia:build,
    skill:{...r.source,...r.source.spData,skillId:build.skillId,rangeGrid:r.skillRangeGrid,trigger:{rule:'NEVER'}}});
   const owner=battle._makeAlly(battle.getPlayer('arkpedia'),def,'op',4,6,{dir:'UP'});
   const prepared=prepareTragodiaCages(battle,owner,{contract:TRAGODIA_CAGE_CONTRACT});battle._setupUnit(owner,prepared.kit);prepared.controller.install();
   owner.player.dp=99;if(!battle._deploy(owner,{initial:false}))throw Error('Controlled owner deployment failed');
   battle.addBuff(owner,{key:'review:disarm',flags:{disarm:true}});owner.skill.addCharge(1);
   if(!owner.skill.activate('manual'))throw Error('Controlled S3 activation failed');
   const tile=stage.tiles.filter(t=>t.type===2&&prepared.controller.keys().has(battle.grid.key(t.row,t.col))&&!battle.unitAt(t.row,t.col))
    .sort((a,b)=>Math.abs(a.row-3)+Math.abs(a.col-7)-Math.abs(b.row-3)-Math.abs(b.col-7))[0];
   if(!tile)throw Error('Original stage has no cage target tile in range');
   const target=battle.spawnEnemy('enemy_1007_slime',{pos:[tile.row,tile.col]});
   Object.assign(target.base,{maxHp:1e7,atk:100,moveSpeed:0,bat:1});target.markDirty();void target.s;target.hp=1e7;
   battle.addBuff(target,{key:'review:pin',flags:{noMove:true,disarm:true}});battle._buildEnemyIndex();
   battle.dealDamage(null,target,{amount:target.gaugeMax+1,type:'element',element:'neural',canDodge:false});
   const cage=[...prepared.cages.tokens.keys()][0];if(!cage)throw Error('Source cage did not spawn');
   await stage.preload([...Object.keys(battle.bench),ID]);
   async function draw(dt=0){stage.render(battle,dt,battle.drainEvents());await pass.ready();stage.render(battle,0,[]);}
   async function advance(seconds){for(let n=0;n<Math.ceil(seconds/battle.dt-1e-9);n++)battle.step();if(battle.errors.length)throw Error(JSON.stringify(battle.errors));await draw(seconds);}
   await draw();
   window.cageReview={battle,owner,target,cage,prepared,stage,pass,library,draw,advance,
    async retire(){battle.retreat(owner,{permanent:true});await draw();},
    snapshot(){const view=stage.views.get(cage.id),entry=pass.inspect()[0];return{time:battle.time,cageAlive:cage.alive,cageHp:cage.hp,captured:target.blockedBy===cage,
     effectCount:pass.instanceCount,sourceClock:entry?.time,draws:entry?.instance.draws.length,blocked:entry?.instance.blocked.length,
     hudActor:view?.actor.constructor.name,hudChildren:view?.actor.spine.children.length,gauge:view?Object.fromEntries(['x','y','width','height'].map(k=>[k,view.hp.getBounds()[k]])):null,
     position:entry?.position,glError:stage.three.getContext().getError(),errors:battle.errors,libraryInstances:library.instanceCount};}};
   return cageReview.snapshot();
  },{data,meta,assetBase});
  assert.equal(setup.cageAlive,true);assert.equal(setup.captured,true);assert.equal(setup.effectCount,1);
  assert.equal(setup.glError,0);assert.ok(setup.gauge.width>0&&setup.gauge.height>0);
  assert.equal(setup.draws,19);assert.equal(setup.blocked,0);assert.equal(setup.hudActor,'EffectOnlyActor');assert.equal(setup.hudChildren,0);
  await page.evaluate(()=>cageReview.advance(.5));await page.screenshot({path:path.join(out,label+'-cage.png')});
  const paused=await page.evaluate(async()=>{const a=cageReview.snapshot();await cageReview.draw();const b=cageReview.snapshot();if(a.sourceClock!==b.sourceClock)throw Error('Paused clock advanced');return b;});
  const late=await page.evaluate(async()=>{await cageReview.advance(32);return cageReview.snapshot();});
  assert.equal(late.glError,0);assert.equal(late.sourceClock,late.time-setup.time);assert.equal(late.effectCount,1);assert.equal(late.draws,19);assert.deepEqual(late.errors,[]);
  await page.screenshot({path:path.join(out,label+'-late.png')});
  const retired=await page.evaluate(async()=>{await cageReview.retire();return cageReview.snapshot();});
  assert.equal(retired.effectCount,0);assert.equal(retired.libraryInstances,0);assert.equal(retired.cageAlive,false);
  assert.deepEqual(retired.errors,[]);reports.push({label,setup,paused,late,retired});
  await page.evaluate(()=>{cageReview.stage.destroy();cageReview.library.dispose();});await page.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 await writeFile(path.join(out,'report.json'),JSON.stringify({controlled:true,publicBattleTest:false,compiledFrameParity:false,manifestSha256,commit,reports,errors,failed},null,2)+'\n');
 console.log(JSON.stringify({viewports:reports.length,captures:reports.length*2,originalTerrain:true,draws:19,errors,failed}));
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
