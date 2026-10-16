// SPDX-License-Identifier: GPL-3.0-or-later
// Controlled public UI fixture; original waves/natural DP are separate tests.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {publicReviewDriver} from './public-review-driver.mjs';
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3182',ID='char_4227_gallus',out=`.cache/arkpedia/cn-operators/${ID}/public-browser/`,candidate=process.argv.includes('--candidate');
const data=candidate?JSON.parse(await readFile('.cache/arkpedia/arkpedia-gallus-candidate.json')):await(await fetch(origin+'/data/arkpedia-mvp.json')).json();assert.equal(data.operators[ID].name,'Gallus²');data.stage.geometry.waves[0].spawns=[];data.stage.battle.initial_dp=99;data.stage.battle.dp_per_second=0;
const hook=`
globalThis.cnReview={get battle(){return battle;},get renderer(){return renderer;},get owner(){return battle.bench['${ID}'].unit;},get controller(){return this.owner.mem.gallus;},hits:[],attacks:[],targets:[],
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();this.render();},
 setup(){paused=true;battle.autoFinish=false;battle.timeLimit=1000;battle.on('damaged',x=>{if(x.source===this.owner)this.hits.push({time:battle.time,target:x.target.id,amount:x.amount,type:x.type});});battle.on('attack',x=>{if(x.attacker===this.owner)this.attacks.push({time:battle.time,targets:x.targets.map(t=>t.id),skill:x.isSkill});});
 const label=document.createElement('div');label.textContent='CONTROLLED UI CHECK · original terrain / legal ranged tile / 99 DP / empty waves / pinned targets';label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);this.render();},
 target(row,col){for(const dc of[0,.35]){const t=battle.spawnEnemy('enemy_1007_slime',{pos:[row,col+dc]});Object.assign(t.base,{maxHp:1e9,atk:0,def:0,res:50,moveSpeed:0});t.markDirty();void t.s;t.hp=t.s.maxHp;battle.addBuff(t,{key:'qa:pin',flags:{noMove:true,disarm:true,noDisplace:true}});this.targets.push(t);}battle._buildEnemyIndex();},
 untilMarks(n){const end=battle.time+20;while(this.controller.marks.size<n&&battle.time<end)battle.step();if(this.controller.marks.size!==n)throw Error('Missing source recipient marks');this.render();},
 snapshot(){const u=this.owner,c=this.controller,v=renderer.views.get(u.id);return{time:battle.time,window:c.inWindow(),stopped:c.stopped,noSkill:u.skill.noSkill,hud:skillHud(u.skill),slots:battle.deployedSlots(),marks:c.marks.size,flights:c.flights.size,watchers:c.watchers.length,handles:c.handles.length,hits:this.hits,attacks:this.attacks,
 owner:{hp:u.hp,maxHp:u.s.maxHp,model:v?.key,track:v?.actor.spine.state.tracks[0]?.animation.name},targets:this.targets.map(t=>({id:t.id,res:t.s.res,marked:!!t.findBuff(c.key())})),errors:battle.errors,glError:renderer.three.getContext().getError()};}
};`;
const driver=await publicReviewDriver({origin,out,data,hook}),reports=[];
try{for(const mobile of[false,true]){
 const label=mobile?'phone-back':'desktop-front',dir=mobile?'UP':'DOWN';const{page,deploy,capture}=await driver.open({label,mobile,operators:[ID]});await page.evaluate(()=>cnReview.setup());await deploy(ID,mobile?1:4,5,dir);await page.evaluate(()=>cnReview.advance(1.1));await page.click(`#deployment [data-id="${ID}"]`);await capture('deployed');
 const born=await page.evaluate(()=>cnReview.snapshot());assert.equal(born.slots,0);assert.equal(born.noSkill,true);assert.equal(born.hud,null);assert.ok(born.owner.model.endsWith(mobile?'/back':'/front'));assert.equal(await page.$('#skill'),null);
 await page.evaluate((r,c)=>cnReview.target(r,c),mobile?2:3,5);await page.evaluate(()=>cnReview.untilMarks(1));const first=await page.evaluate(()=>cnReview.snapshot());await capture('first-mark');assert.equal(first.marks,1);assert.equal(first.targets.filter(t=>t.res===42.5).length,1);assert.ok(first.attacks.every(a=>a.targets.length===1&&!a.skill));
 await page.evaluate(()=>cnReview.untilMarks(2));const spread=await page.evaluate(()=>cnReview.snapshot());await capture('spread');assert.notEqual(spread.attacks[0].targets[0],spread.attacks[1].targets[0]);assert.ok(spread.targets.every(t=>t.res===42.5));
 await page.evaluate(()=>cnReview.advance(Math.max(0,20.1-cnReview.battle.time)));const expired=await page.evaluate(()=>cnReview.snapshot());await capture('window-ended');assert.equal(expired.window,false);assert.equal(expired.hud,null);assert.equal(await page.$('#skill'),null);
 await page.evaluate(()=>cnReview.advance(10.1));const restored=await page.evaluate(()=>cnReview.snapshot());await capture('recipients-restored');assert.equal(restored.marks,0);assert.ok(restored.targets.every(t=>t.res===50));
 await page.click(`#deployment [data-id="${ID}"]`);await page.click('#retreat');await page.evaluate(()=>cnReview.advance(11));const retired=await page.evaluate(()=>cnReview.snapshot());await capture('retired');assert.equal(retired.stopped,true);assert.equal(retired.handles,0);assert.equal(retired.watchers,0);assert.equal(retired.flights,0);assert.equal(retired.slots,0);
 for(const s of[born,first,spread,expired,restored,retired]){assert.deepEqual(s.errors,[]);assert.equal(s.glError,0);}assert.deepEqual(driver.errors,[]);assert.deepEqual(driver.failedResources,[]);reports.push({label,born,first,spread,expired,restored,retired});await page.close();console.log(label+': real drop/separate swipe, source passive UI, original models, preference/window/recipient expiry and cleanup passed');
 }
 await writeFile(out+'report.json',JSON.stringify({candidate,originalWaves:false,browserVersion:driver.browserVersion,cacheDisabled:driver.cacheDisabled,fixtureTransport:'loopback app/data overrides; external HTTPS unintercepted',sourceOrigin:driver.sourceOrigin,fixtureOrigin:driver.fixtureOrigin,reports,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources},null,2)+'\n');console.log(JSON.stringify({cases:reports.length,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources}));
}finally{await driver.close();}
