// SPDX-License-Identifier: GPL-3.0-or-later
// Controlled public UI scenario: drop/swipe, the deck re-sorted by cost around his Eye of the Snowstorm card, the Eye refused
// as a marker outside S3, S1's discount, S2's cold strike and a stored deploy cast from a card left of the Eye, and in S3
// the base-cost swap and the Eye dragged onto a deployed operator. Original-wave clears are separate tests.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {publicReviewDriver} from './public-review-driver.mjs';
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3182',ID='char_1045_svash2',G='char_122_beagle',Mel='char_208_melan',Ch='char_010_chen',Yak='char_199_yak',candidate=process.argv.includes('--candidate');
const out=`.cache/arkpedia/cn-operators/${ID}/public-browser/${candidate?'candidate':'normal'}/`;
const data=JSON.parse(await readFile(candidate?'.cache/arkpedia/arkpedia-svash2-candidate.json':'data/arkpedia-mvp.json'));
assert.ok(!data.sd.localBase&&!data.stage.art?.localBase,'Review must use original HTTPS assets');
assert.deepEqual(data.reviewCandidates,candidate?[ID]:undefined);assert.equal(data.operators[ID].name,'SilverAsh the Reignfrost');
data.stage.geometry.waves[0].spawns=[];data.stage.battle.initial_dp=99;data.stage.battle.dp_per_second=0;
const hook=`
globalThis.cnReview={get battle(){return battle;},get renderer(){return renderer;},get owner(){return battle.bench['${ID}'].unit;},enemies:[],hits:[],
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();this.render();},
 setup(){paused=true;battle.autoFinish=false;battle.timeLimit=1000;
  battle.on('damaged',h=>{if(h.dmg.tags?.some(t=>String(t).startsWith('svash2')))this.hits.push({time:battle.time,type:h.dmg.type,tags:h.dmg.tags,sourceless:!!h.dmg.sourceless});});
  const label=document.createElement('div');label.textContent='CONTROLLED UI CHECK · original terrain / legal deployment / 99 DP / empty waves / pinned healthy targets';
  label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);this.render();},
 targets(row,col){const e=battle.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=e.s.maxHp;
  battle.addBuff(e,{key:'qa:pin',flags:{noMove:true,disarm:true,noDisplace:true}});this.enemies.push(e);battle._buildEnemyIndex();this.render();},
 until(kind){const o=this.owner?.mem.svash2Owner,end=battle.time+100,p=()=>kind==='ready'?this.owner.skill.ready:kind==='cast'?this.owner.skill.activations>0:kind==='s2'?this.hits.some(h=>h.tags.includes('svash2:s2')&&!h.sourceless):kind==='stored'?this.hits.some(h=>h.sourceless):kind==='s3'?this.hits.some(h=>h.tags.includes('svash2:s3')):false;
  while(!p()&&battle.time<end)battle.step();if(!p())throw Error('Missing natural '+kind+' at '+battle.time);this.render();},
 snapshot(){const u=this.owner,v=u&&renderer.views.get(u.id),o=u?.mem.svash2Owner;return{time:battle.time,dp:battle.dp,active:u?.skill.active,activations:u?.skill.activations,hud:u&&skillHud(u.skill),
  dom:Array.from(document.querySelectorAll('#deployment button')).filter(b=>!b.hidden).map(b=>b.dataset.id),labels:Object.fromEntries(Array.from(document.querySelectorAll('#deployment button')).map(b=>[b.dataset.id,b.querySelector('.cost')?.textContent])),
  order:battle.regularDeckOrder?.()??null,deck:o?.deck()??null,left:o?.leftOfEye()??[],nearest:o?.nearest()??null,casts:o?[...o.casts].map(([k,c])=>[k,c.count]):[],swapped:o?.swappedCards??null,eye:o?.eyeHolder?.defId??null,
  owner:{model:v?.key,track:v?.actor?.spine.state.tracks[0]?.animation.name},hits:this.hits,
  images:Array.from(document.querySelectorAll('.operator-portrait img,.skill-icon,.bench-portrait')).map(i=>({url:i.src,loaded:i.complete&&i.naturalWidth>0})),errors:battle.errors,glError:renderer.three.getContext().getError()};}
};`;
const driver=await publicReviewDriver({origin,out,data,hook}),reports=[];
try{for(const mobile of[false,true])for(const skill of[1,2,3]){
 const label=`${mobile?'phone':'desktop'}-s${skill}`;
 const {page,deploy,capture,tile,drag}=await driver.open({label,mobile,operators:[ID,G,Mel,Ch,Yak],skillId:`skchr_svash2_${skill}`});
 const card=async id=>{const c=await page.$(`#deployment [data-id="${id}"]`),b=await c.boundingBox();assert.ok(b);return{x:b.x+b.width/2,y:b.y+b.height/2};};
 await page.evaluate(()=>cnReview.setup());const before=await page.evaluate(()=>cnReview.snapshot());assert.equal(before.order,null);assert.ok(!before.dom.includes('summon:char_1045_svash2'));
 await deploy(ID,3,4,'RIGHT');await page.evaluate(()=>cnReview.advance(.3));const sorted=await page.evaluate(()=>cnReview.snapshot());await capture('sorted');
 // The DOM follows the sorted deck: the deck part in cost order, then deployed cards.
 assert.deepEqual(sorted.dom.slice(0,sorted.deck.length),sorted.deck);assert.ok(sorted.dom.includes('summon:char_1045_svash2'));assert.ok(sorted.owner.model?.includes(ID)&&sorted.owner.track);
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.operator-portrait img,.skill-icon,.bench-portrait')).every(i=>i.complete&&i.naturalWidth>0));
 const extra={};
 if(skill<3){assert.match(await page.evaluate(()=>cnReview.battle.regularSummons.get('summon:char_1045_svash2').deck.placementError(3,4))??'',/only during/);assert.notEqual(sorted.labels['summon:char_1045_svash2'],'—');}
 if(skill===1){const n=sorted.nearest,cost0=sorted.labels[n];await page.evaluate(()=>cnReview.until('cast'));const s=extra.cast=await page.evaluate(()=>cnReview.snapshot());await capture('discount');
  assert.equal(Number(s.labels[n]),Number(cost0)-5);assert.deepEqual(s.dom.slice(0,s.deck.length),s.deck);}
 if(skill===2){await page.evaluate(()=>cnReview.targets(3,5));await page.click(`#deployment [data-id="${ID}"]`);await page.evaluate(()=>cnReview.until('ready'));await page.click('#skill');
  await page.evaluate(()=>cnReview.until('s2'));const s=extra.cast=await page.evaluate(()=>cnReview.snapshot());await capture('cast');assert.ok(s.casts.length>0,'a card left of the Eye stores a cast');
  const id=s.casts[0][0];await deploy(id,3,3,'RIGHT');await page.evaluate(()=>cnReview.until('stored'));const t=extra.stored=await page.evaluate(()=>cnReview.snapshot());await capture('stored');
  assert.ok(t.hits.some(h=>h.sourceless&&h.tags.includes('svash2:s2')));}
 if(skill===3){await page.evaluate(()=>cnReview.targets(3,6));await page.click(`#deployment [data-id="${ID}"]`);await page.evaluate(()=>cnReview.until('ready'));const pre=await page.evaluate(()=>cnReview.snapshot());await page.click('#skill');
  await page.evaluate(()=>cnReview.until('s3'));const s=extra.cast=await page.evaluate(()=>cnReview.snapshot());await capture('swap');
  assert.ok(s.swapped);const [hi,lo]=s.swapped;assert.equal(Number(s.labels[hi]),Number(pre.labels[lo]));assert.equal(Number(s.labels[lo]),Number(pre.labels[hi]));
  await deploy(G,2,5,'RIGHT');await page.evaluate(()=>cnReview.advance(.1));assert.equal((await page.evaluate(()=>cnReview.snapshot())).eye,G);
  await deploy(Yak,2,3,'RIGHT');await drag(await card('summon:char_1045_svash2'),await tile(2,3));await page.evaluate(()=>cnReview.advance(.2));const e=extra.eye=await page.evaluate(()=>cnReview.snapshot());await capture('eye');
  assert.equal(e.eye,Yak);}
 await page.click(`#deployment [data-id="${ID}"]`);await page.click('#retreat');await page.evaluate(()=>cnReview.advance(2));
 const retired=await page.evaluate(()=>({order:cnReview.battle.regularDeckOrder?.()??null,eye:!!document.querySelector('#deployment [data-id="summon:char_1045_svash2"]:not([hidden])'),errors:cnReview.battle.errors,glError:cnReview.renderer.three.getContext().getError()}));await capture('retired');
 assert.equal(retired.order,null);
 for(const s of[sorted,retired,...Object.values(extra)]){assert.deepEqual(s.errors,[]);assert.equal(s.glError,0);}
 assert.deepEqual(driver.errors,[]);assert.deepEqual(driver.failedResources,[]);reports.push({label,before,sorted,extra,retired});await page.close();
 console.log(label+': drop/swipe, cost-sorted deck with the Eye, '+['marker Eye and S1 discount','S2 cold strike and stored deploy cast','S3 cost swap and Eye moved onto an operator'][skill-1]+', cleanup passed');
}
 await writeFile(out+'report.json',JSON.stringify({candidate,originalWaves:false,browserVersion:driver.browserVersion,cacheDisabled:driver.cacheDisabled,
  fixtureTransport:'loopback app/data overrides; external HTTPS unintercepted',reports,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources},null,2)+'\n');
 console.log(JSON.stringify({cases:reports.length,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources}));
}catch(error){console.error(JSON.stringify({errors:driver.errors,failedResources:driver.failedResources,completedCases:reports.length}));throw error;}finally{await driver.close();}
