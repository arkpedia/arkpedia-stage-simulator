// SPDX-License-Identifier: GPL-3.0-or-later
// Controlled public UI scenario: drop/swipe, the skill's own device placed from its card with a facing swipe, S1's inspector
// block and DEF with hits on every blocked enemy, S2's supervisor barrier and SP with her own shield, and S3's platform: built
// in front of the engineer, refusing a ranged card before its first upgrade and taking it after, blocking while it hosts,
// staying when she retreats at level 6 and dropping its guest when it falls. Original-wave clears are separate tests.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {publicReviewDriver} from './public-review-driver.mjs';
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3182',ID='char_4212_nasti',G='char_122_beagle',Ex='char_103_angel',candidate=process.argv.includes('--candidate');
const out=`.cache/arkpedia/cn-operators/${ID}/public-browser/${candidate?'candidate':'normal'}/`;
const data=JSON.parse(await readFile(candidate?'.cache/arkpedia/arkpedia-nasti-candidate.json':'data/arkpedia-mvp.json'));
assert.ok(!data.sd.localBase&&!data.stage.art?.localBase,'Review must use original HTTPS assets');
assert.deepEqual(data.reviewCandidates,candidate?[ID]:undefined);assert.equal(data.operators[ID].name,'Nasti');
data.stage.geometry.waves[0].spawns=[];data.stage.battle.initial_dp=99;data.stage.battle.dp_per_second=0;
const hook=`
globalThis.cnReview={get battle(){return battle;},get renderer(){return renderer;},get owner(){return battle.bench['${ID}'].unit;},enemies:[],hits:[],
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();this.render();},
 setup(){paused=true;battle.autoFinish=false;battle.timeLimit=1000;
  battle.on('damaged',h=>{if(h.source===this.owner)this.hits.push({time:battle.time,target:h.target?.id});});
  const label=document.createElement('div');label.textContent='CONTROLLED UI CHECK · original terrain / legal deployment / 99 DP / empty waves / pinned healthy targets';
  label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);this.render();},
 targets(row,col){const e=battle.spawnEnemy('enemy_1007_slime',{pos:[row,Math.round(col)]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=e.s.maxHp;e.x=col;
  battle.addBuff(e,{key:'qa:pin',flags:{noMove:true,disarm:true,noDisplace:true}});this.enemies.push(e);battle._buildEnemyIndex();this.render();return e.id;},
 dp(){battle.getPlayer('arkpedia').dp=99;const s=battle.regularSummons.get('summon:${ID}');if(s)s.readyAt=0;this.render();},
 until(kind){const o=this.owner?.mem.nastiOwner,end=battle.time+400,p=()=>kind==='ready'?this.owner.skill.ready:kind==='both'?this.enemies.every(e=>this.hits.some(h=>h.target===e.id)):kind==='m4'?o.platform?.mem.nastiLevel>=4:kind==='m6'?o.platform?.mem.nastiLevel>=6:kind==='ended'?!this.owner.skill.active:false;
  while(!p()&&battle.time<end)battle.step();if(!p())throw Error('Missing natural '+kind+' at '+battle.time);this.render();},
 snapshot(){const u=this.owner,v=u&&renderer.views.get(u.id),o=u?.mem.nastiOwner??this.o,g=battle.bench['${G}'].unit,x=battle.bench['${Ex}'].unit,p=o?.platform;if(o)this.o=o;
  return{time:battle.time,dp:battle.dp,active:u?.skill.active,hud:u&&skillHud(u.skill),
  owner:{alive:!!u?.alive,model:v?.key,track:v?.actor?.spine.state.tracks[0]?.animation.name,shield:u?.findBuff('nasti:s2:shield:'+u.id)?.shield??0},
  devices:battle.allyUnits.filter(t=>t.alive&&['token_10059_nasti_nstdef','token_10060_nasti_nstchr','token_10061_nasti_nstbld'].includes(t.defId)&&!t.mem.nastiPlatform).map(t=>({id:t.defId,model:renderer.views.get(t.id)?.key})),
  mate:g?{alive:g.alive,block:g.s.blockCnt,inspector:g.buffs.some(b=>b.key.startsWith('nasti:inspector')),shield:g.buffs.find(b=>b.key.startsWith('nasti:supervisor:shield'))?.shield??0}:null,
  guest:x?{alive:x.alive,tile:[x.tileR,x.tileC],ground:x.ground,hosted:p?.mem.regularHost?.guest===x}:null,
  platform:p?{alive:p.alive,level:p.mem.nastiLevel,tile:[p.tileR,p.tileC],blocking:p.blocking?.length??0}:null,hits:this.hits.length,
  images:Array.from(document.querySelectorAll('.operator-portrait img,.skill-icon,.bench-portrait')).map(i=>({url:i.src,loaded:i.complete&&i.naturalWidth>0})),errors:battle.errors,glError:renderer.three.getContext().getError()};}
};`;
const driver=await publicReviewDriver({origin,out,data,hook}),reports=[];
const swipe=async(page,mobile,dx)=>{await page.waitForSelector('.facing-picker:not([hidden])');const hb=await (await page.$('.facing-handle')).boundingBox(),hx=hb.x+hb.width/2,hy=hb.y+hb.height/2;
 if(mobile){await page.touchscreen.touchStart(hx,hy);await page.touchscreen.touchMove(hx+dx,hy);await page.touchscreen.touchEnd();}else{await page.mouse.move(hx,hy);await page.mouse.down();await page.mouse.move(hx+dx,hy,{steps:8});await page.mouse.up();}};
try{for(const mobile of[false,true])for(const skill of[1,2,3]){
 const label=`${mobile?'phone':'desktop'}-s${skill}`;
 const {page,deploy,capture,tile,drag}=await driver.open({label,mobile,operators:[ID,G,Ex],skillId:`skchr_nasti_${skill}`});
 const card=async id=>{const c=await page.$(`#deployment [data-id="${id}"]`),b=await c.boundingBox();assert.ok(b);return{x:b.x+b.width/2,y:b.y+b.height/2};};
 const place=async(r,c)=>{await page.evaluate(()=>cnReview.dp());await drag(await card('summon:'+ID),await tile(r,c));await swipe(page,mobile,65);await page.evaluate(()=>cnReview.advance(.3));};
 await page.evaluate(()=>cnReview.setup());const extra={};
 if(skill<3){
  await deploy(ID,3,4,'RIGHT');await deploy(G,3,6,'LEFT');await place(3,5);const s=extra.device=await page.evaluate(()=>cnReview.snapshot());await capture('device');
  assert.equal(s.devices.length,1);assert.ok(s.devices[0].model?.includes(['token_10059_nasti_nstdef','token_10060_nasti_nstchr'][skill-1]));assert.ok(s.owner.model?.includes(ID)&&s.owner.track);
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('.operator-portrait img,.skill-icon,.bench-portrait')).every(i=>i.complete&&i.naturalWidth>0));
  await page.click(`#deployment [data-id="${ID}"]`);await page.evaluate(()=>cnReview.until('ready'));
  if(skill===1){const before=s.mate.block;assert.equal(s.mate.inspector,true);await page.evaluate(()=>{cnReview.targets(3,4.3);cnReview.targets(3,4.45);});await page.click('#skill');await page.evaluate(()=>cnReview.advance(.3));
   const t=extra.skill=await page.evaluate(()=>cnReview.snapshot());await capture('skill');assert.equal(t.active,true);assert.equal(t.mate.block,before+1);
   await page.evaluate(()=>cnReview.until('both'));extra.both=await page.evaluate(()=>cnReview.snapshot());await capture('both');}
  else{await page.click('#skill');await page.evaluate(()=>cnReview.advance(1.1));const t=extra.skill=await page.evaluate(()=>cnReview.snapshot());await capture('skill');
   assert.equal(t.active,true);assert.ok(t.owner.shield>0);assert.ok(t.mate.shield>0);await page.evaluate(()=>cnReview.until('ended'));await page.evaluate(()=>cnReview.advance(.2));
   const e=extra.ended=await page.evaluate(()=>cnReview.snapshot());await capture('ended');assert.equal(e.devices.length,0,'activated supervisors leave');}
 } else {
  await deploy(ID,2,1,'RIGHT');await place(3,3);const s=extra.platform=await page.evaluate(()=>cnReview.snapshot());await capture('platform');
  assert.deepEqual(s.platform?.tile,[3,4]);assert.equal(s.platform.level,3);
  await page.evaluate(()=>cnReview.dp());await drag(await card(Ex),await tile(3,4));await page.evaluate(()=>cnReview.advance(.1));
  assert.equal((await page.evaluate(()=>cnReview.snapshot())).guest?.alive??false,false,'refused before the first upgrade');await page.keyboard.press('Escape').catch(()=>{});
  await page.evaluate(()=>cnReview.until('m4'));await page.evaluate(()=>cnReview.dp());await deploy(Ex,3,4,'RIGHT');
  const h=extra.hosted=await page.evaluate(()=>cnReview.snapshot());await capture('hosted');assert.equal(h.guest.alive,true);assert.equal(h.guest.hosted,true);assert.equal(h.guest.ground,false);
  await page.evaluate(()=>{cnReview.targets(3,4.3);cnReview.advance(.3);});const k=extra.block=await page.evaluate(()=>cnReview.snapshot());await capture('block');assert.equal(k.platform.blocking,1);
  await page.click(`#deployment [data-id="${ID}"]`);await page.evaluate(()=>cnReview.until('ready'));await page.click('#skill');await page.evaluate(()=>cnReview.until('m6'));
  await page.click(`#deployment [data-id="${ID}"]`);await page.click('#retreat');await page.evaluate(()=>cnReview.advance(1));
  const r=extra.retired=await page.evaluate(()=>cnReview.snapshot());await capture('kept');assert.equal(r.owner.alive,false);assert.equal(r.platform.alive,true);assert.equal(r.platform.level,6);
  await page.evaluate(()=>{const p=cnReview.o.platform;cnReview.battle.dealDamage(null,p,{amount:1e9,type:'true',sourceless:true});cnReview.advance(.5);});
  const f=extra.fallen=await page.evaluate(()=>cnReview.snapshot());await capture('fallen');assert.equal(f.guest.alive,false);
 }
 const final=await page.evaluate(()=>cnReview.snapshot());
 for(const s of[final,...Object.values(extra)]){assert.deepEqual(s.errors,[]);assert.equal(s.glError,0);}
 assert.deepEqual(driver.errors,[]);assert.deepEqual(driver.failedResources,[]);reports.push({label,extra});await page.close();
 console.log(label+': drop/swipe, the device from its card, '+['S1 block, DEF and hits on every blocked enemy','S2 barriers, SP and supervisors leaving','S3 platform build, ranged guest after the upgrade, block, level 6 kept, guest dropped'][skill-1]+' passed');
}
 await writeFile(out+'report.json',JSON.stringify({candidate,originalWaves:false,browserVersion:driver.browserVersion,cacheDisabled:driver.cacheDisabled,
  fixtureTransport:'loopback app/data overrides; external HTTPS unintercepted',reports,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources},null,2)+'\n');
 console.log(JSON.stringify({cases:reports.length,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources}));
}catch(error){console.error(JSON.stringify({errors:driver.errors,failedResources:driver.failedResources,completedCases:reports.length}));throw error;}finally{await driver.close();}
