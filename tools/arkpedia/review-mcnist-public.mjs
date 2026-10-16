// SPDX-License-Identifier: GPL-3.0-or-later
// Controlled UI check; unmodified original-wave completions are tested separately.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {publicReviewDriver} from './public-review-driver.mjs';
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3182',ID='char_4230_mcnist',CARD=`summon:${ID}`,out=`.cache/arkpedia/cn-operators/${ID}/public-browser/`,candidate=process.argv.includes('--candidate');
const data=candidate?JSON.parse(await readFile('.cache/arkpedia/arkpedia-mcnist-candidate.json')):await(await fetch(origin+'/data/arkpedia-mvp.json')).json();
assert.equal(data.operators[ID].name,'Mechanist');data.stage.geometry.waves[0].spawns=[];data.stage.battle.initial_dp=99;data.stage.battle.dp_per_second=0;
const hook=`
globalThis.cnReview={get battle(){return battle;},get renderer(){return renderer;},get owner(){return battle.bench['${ID}'].unit;},get controller(){return this.owner.mem.mcnist;},hits:[],attacks:[],get debug(){return {selected,pending,battleError};},
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();this.render();},
 setup(){paused=true;battle.autoFinish=false;battle.timeLimit=1000;
  battle.on('damaged',x=>{if(x.source===this.owner||x.credit===this.owner)this.hits.push({time:battle.time,amount:x.amount,type:x.type,tags:x.dmg.tags,skill:x.dmg.isSkill});});
  battle.on('attack',x=>{if(x.attacker===this.owner)this.attacks.push({time:battle.time,skill:x.isSkill,targets:x.targets.length});});
  const label=document.createElement('div');label.textContent='CONTROLLED UI CHECK · original terrain / legal tiles / 99 DP / empty waves / pinned target / scripted S2 shield hit';
  label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);this.render();},
 target(row,col){const e=battle.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=e.s.maxHp;battle.addBuff(e,{key:'qa:pin',flags:{noMove:true,disarm:true,noDisplace:true}});this.enemy=e;battle._buildEnemyIndex();},
 until(kind){const end=battle.time+100,pred=()=>kind==='ready'?this.owner.skill.ready:kind==='cast'?this.owner.skill.active:kind==='burst'?this.hits.some(h=>h.tags?.includes('mcnist:s1-burst')):kind==='arrived'?this.controller.deck.arrivals===1:!this.owner.skill.active;
  while(!pred()&&battle.time<end)battle.step();if(!pred())throw Error('Missing natural '+kind);this.render();},
 breakShield(){const t=this.controller.deck.point.unit;const shield=t.buffs.find(b=>b.key.startsWith('mcnist:s2:'));if(!shield)throw Error('Missing source S2 shield');battle.dealDamage(this.enemy,t,{amount:100000,type:'true',canDodge:false});this.advance(.1);},
 snapshot(){const u=this.owner,c=this.controller,d=c.deck,t=d.point?.unit,v=renderer.views.get(u.id),tv=t&&renderer.views.get(t.id);return{time:battle.time,sp:u.skill.spTotal,active:u.skill.active,hud:skillHud(u.skill),activations:u.skill.activations,stopped:c.stopped,deployed:battle.deployedSlots(),hits:this.hits,attacks:this.attacks,
  hidden:d.state.hidden??false,arrivals:d.arrivals??0,flight:d.flight?{alias:d.flight.alias,x:d.flight.projectile.x,y:d.flight.projectile.y,startDelay:d.flight.projectile.startDelay}:null,
  token:t?{id:t.id,life:t.deploySeq,hp:t.hp,maxHp:t.s.maxHp,hud:skillHud(t.skill),row:t.tileR,col:t.tileC,dir:t.dir,model:tv?.key,track:tv?.actor.spine.state.tracks[0]?.animation.name,slot:t.deploymentSlotCost,aura:!!t.mem.mcgrafS3Aura?.active()}:null,
  owner:{id:u.id,hp:u.hp,maxHp:u.s.maxHp,atk:u.s.atk,model:v?.key,track:v?.actor.spine.state.tracks[0]?.animation.name},errors:battle.errors,glError:renderer.three.getContext().getError()};}
};`;
const driver=await publicReviewDriver({origin,out,data,hook}),reports=[];
try{
 for(const mobile of[false,true])for(const skill of[1,2,3]){
  const dir=mobile?'UP':'RIGHT',label=`${mobile?'phone':'desktop'}-s${skill}`;
  const {page,deploy,capture,tile,drag}=await driver.open({label,mobile,operators:[ID],skillId:`skchr_mcnist_${skill}`});
  await page.evaluate(()=>cnReview.setup());await deploy(ID,mobile?2:3,mobile?5:3,dir);await page.evaluate(()=>cnReview.advance(1.1));
  const card=await page.$(`#deployment [data-id="${CARD}"]`),box=await card.boundingBox();assert.ok(box);
  await drag({x:box.x+box.width/2,y:box.y+box.height/2},await tile(3,mobile?3:5));try{await page.waitForSelector('.facing-picker:not([hidden])',{timeout:3000});}catch(error){await capture('deployment-failed');console.error(JSON.stringify({errors:driver.errors,failedResources:driver.failedResources}));console.error(JSON.stringify(await page.evaluate(()=>({debug:cnReview.debug,point:cnReview.controller.deck.point?.unit.id,body:document.querySelector('#battle-hint')?.textContent,card:document.querySelector('#deployment').innerText,config:cnReview.controller.deck.state.config}))));throw error;}
  assert.equal(await page.evaluate(()=>cnReview.controller.deck.point),null);
  const handle=await(await page.$('.facing-handle')).boundingBox(),from={x:handle.x+handle.width/2,y:handle.y+handle.height/2},to={x:from.x+(mobile?65:-65),y:from.y};
  if(mobile){await page.touchscreen.touchStart(from.x,from.y);await page.touchscreen.touchMove(to.x,to.y);}else{await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:8});}
  assert.equal(await page.evaluate(()=>cnReview.controller.deck.point),null);if(mobile)await page.touchscreen.touchEnd();else await page.mouse.up();
  await page.waitForFunction(()=>cnReview.controller.deck.point?.unit.alive);await page.evaluate(()=>cnReview.advance(1.1));
  const tokenBefore=await page.evaluate(()=>cnReview.snapshot());assert.equal(tokenBefore.token.slot,0);assert.ok(tokenBefore.token.model?.includes('/'+'token_10069_mcnist_mcgraf'+'/') );assert.equal(tokenBefore.token.hud.ready,false);assert.ok(tokenBefore.token.hud.text.startsWith('Deployment remaining'));
  const pos=await tile(3,mobile?3:5);if(mobile)await page.touchscreen.tap(pos.x,pos.y);else await page.mouse.click(pos.x,pos.y);await capture('mcgraf-lifetime');
  assert.ok(await page.$eval('#command',e=>e.textContent.includes('Deployment remaining')));
  await page.click(`#deployment [data-id="${ID}"]`);await page.evaluate((r,c)=>cnReview.target(r,c),3,mobile?5:4);await capture('deployed');
  if(skill===1)await page.evaluate(()=>cnReview.until('cast'));else await page.evaluate(()=>cnReview.until('ready'));
  const ready=await page.evaluate(()=>cnReview.snapshot());await capture('ready');assert.equal(ready.owner.model.endsWith(mobile?'/back':'/front'),true);
  if(skill!==1){assert.equal(ready.hud.canActivate,true);await page.click('#skill');await page.evaluate(()=>cnReview.render());}
  const cast=await page.evaluate(()=>cnReview.snapshot());await capture('cast');assert.equal(cast.active,true);
  if(skill===3){assert.equal(cast.hidden,true);assert.equal(cast.token,null);assert.ok(cast.flight);assert.equal(await page.$eval(`#deployment [data-id="${CARD}"]`,e=>e.hidden),true);
   await page.evaluate(()=>cnReview.advance(.2));const delayed=await page.evaluate(()=>cnReview.snapshot());assert.equal(delayed.arrivals,0);await capture('charge-delay');await page.evaluate(()=>cnReview.until('arrived'));
  }else if(skill===2)await page.evaluate(()=>cnReview.breakShield());else await page.evaluate(()=>cnReview.until('burst'));
  const released=await page.evaluate(()=>cnReview.snapshot());await capture('released');
  if(skill===3){assert.equal(released.arrivals,1);assert.ok(released.token.aura);assert.ok(released.token.model?.includes('/token_10069_mcnist_mcgraf/'));assert.notEqual(released.token.id,tokenBefore.token.id);assert.ok(released.token.hud.fraction>.99);assert.equal(released.hidden,false);assert.equal(await page.$eval(`#deployment [data-id="${CARD}"]`,e=>e.hidden),false);}
  if(skill===2){await page.click('#skill');await page.evaluate(()=>cnReview.render());}else await page.evaluate(()=>cnReview.until('finish'));const ended=await page.evaluate(()=>cnReview.snapshot());await capture('ended');assert.equal(ended.active,false);
  await page.click(`#deployment [data-id="${ID}"]`);await page.click('#retreat');await page.evaluate(()=>cnReview.render());const retired=await page.evaluate(()=>cnReview.snapshot());await capture('retired');assert.equal(retired.stopped,true);assert.equal(retired.deployed,0);assert.equal(await page.$(`#deployment [data-id="${CARD}"]`),null);
  for(const s of[tokenBefore,ready,cast,released,ended,retired]){assert.deepEqual(s.errors,[]);assert.equal(s.glError,0);}assert.deepEqual(driver.errors,[]);assert.deepEqual(driver.failedResources,[]);reports.push({label,tokenBefore,ready,cast,released,ended,retired});await page.close();console.log(label+': real drag/drop, separate facing swipe, original portrait/models, natural SP, lifetime, selected skill and cleanup passed');
 }
 const report={candidate,originalWaves:false,browserVersion:driver.browserVersion,cacheDisabled:driver.cacheDisabled,fixtureTransport:'loopback app/data overrides; external HTTPS unintercepted',sourceOrigin:driver.sourceOrigin,fixtureOrigin:driver.fixtureOrigin,reports,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources};
 await writeFile(out+'report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({cases:reports.length,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources}));
}finally{await driver.close();}
