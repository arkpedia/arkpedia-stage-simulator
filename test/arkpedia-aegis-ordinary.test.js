// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import {make as fixture,enemy,advance,near,until} from './helpers/aegis-fixture.js';
import {AEGIS_ORDINARY_CONTRACT,verifyAegisOrdinary} from '../server/sim/content/arkpedia-aegis-ordinary.js';
import {aegisNativeInputs} from '../server/sim/content/arkpedia-aegis-source.js';
const fs=[];const make=opts=>{const f=fixture({ordinary:true,...opts});fs.push(f);return f;};
test.afterEach(()=>{for(const f of fs.splice(0))assert.deepEqual(f.b.errors,[]);});
const hits=f=>f.hits.filter(c=>c.dmg.tags.includes('aegis:ordinary'));
const windup=f=>until(f,()=>!!f.attacks.phase);
test('Ordinary clock requires exact source, flight and explicit skill composition contract',()=>{
 verifyAegisOrdinary();assert.throws(()=>make({ordinaryContract:{...AEGIS_ORDINARY_CONTRACT}}),/exact ordinary contract/);
 assert.throws(()=>make({flight:false}),/original flight/);assert.throws(()=>make({mayBegin:null}),/composition predicate/);
 for(const mutate of[n=>n.modes[0].attack._projectileKey='borrowed',n=>n.modes[0].attack._waitForAttackEvent=0,n=>n.modes[0].attack._affectedBySlowDown=0,
  n=>n.ordinarySelector._targetMotion=3,n=>n.ordinarySelector._maxNum=2,n=>n.artController._animations.find(a=>a.animKey==='Attack').animName='Skill_1_Loop']){
  const n=structuredClone(aegisNativeInputs());mutate(n);assert.throws(()=>verifyAegisOrdinary(n),/Changed original/);
 }
});
for(const [dir,row,col]of[['RIGHT',5,7],['LEFT',5,3],['UP',7,5],['DOWN',3,5]])test(`${dir} preserves literal direct Attack marker, one input/receipt and deployment graphic height`,()=>{
 const f=make({dir}),t=enemy(f,{row,col,motion:'FLY'});advance(f.b,1);assert.equal(f.receipts.length,0);assert.equal(f.u.mem.regularFormVisual.clip,'Start');windup(f);
 const started=f.b.time;assert.equal(f.u.mem.regularFormVisual.clip,'Attack');assert.equal(f.u.mem.regularVisualDirection,dir);advance(f.b,.6);assert.equal(hits(f).length,0);
 until(f,()=>hits(f).length===1);near(f.b.time-started,.6666666865348816,.04);assert.equal(f.receipts.length,1);assert.equal(f.receipts[0].targets.length,1);
 near(t.s.maxHp-t.hp,f.u.s.atk*f.u.s.physDealtMul);assert.equal(hits(f)[0].dmg.isProjectile,false);assert.equal(f.b.projectiles.list.length,0);near(f.u.mem.regularFormVisual.heightOffset,.4000000059604645);
 assert.equal(f.u.mem.regularDeathVisual.hide,dir==='UP'?true:undefined);
});
test('Ordinary damage is one live-ATK direct recipient, with no native projectile or area splash',()=>{
 const f=make(),a=enemy(f,{motion:'FLY'}),air=enemy(f,{col:7.1,motion:'FLY'}),ground=enemy(f,{col:7.05});windup(f);
 f.b.addBuff(f.u,{key:'fixture:late-atk',mods:{atkPct:1,atkScaleMul:1.5}});until(f,()=>hits(f).length===1);
 near(a.s.maxHp-a.hp,f.u.s.atk*1.5*1.1);near(air.hp,air.s.maxHp);near(ground.hp,ground.s.maxHp);assert.equal(f.b.projectiles.list.length,0);assert.equal(f.receipts.length,1);
});
test('Ground inputs do not receive a fabricated ordinary fallback',()=>{
 const f=make(),g=enemy(f);advance(f.b,10);assert.equal(hits(f).length,0);assert.equal(f.receipts.length,0);near(g.hp,g.s.maxHp);
});
test('Own blocked aerial input has priority outside the source attack grid',()=>{
 const f=make(),inRange=enemy(f,{motion:'FLY'}),own=enemy(f,{col:4.2,motion:'FLY'});f.b._refreshRange(f.u);assert.equal(f.u.rangeKeySet.has(5*21+4),false);
 assert.equal(f.b._checkBlock(own),true);windup(f);assert.equal(f.attacks.phase.target.id,own.id);until(f,()=>hits(f).length===1);
 assert.equal(hits(f)[0].target.id,own.id);near(inRange.hp,inRange.s.maxHp);
});
for(const flag of['stealth','untargetable','sleep','camou'])test(`A non-blocked ${flag} aerial input is not acquired`,()=>{
 const f=make(),t=enemy(f,{motion:'FLY',flags:{[flag]:true}});advance(f.b,3);assert.equal(f.receipts.length,0);near(t.hp,t.s.maxHp);
});
for(const change of['death','replacement','hidden','ground','stealth','untargetable'])test(`Input ${change} before the direct strike neither redirects nor invents a damage packet`,()=>{
 const f=make(),t=enemy(f,{motion:'FLY'}),other=enemy(f,{col:7.2,motion:'FLY'});windup(f);
 if(change==='death')f.b.kill(t,null);if(change==='replacement')t.deploySeq++;if(change==='hidden')t.hidden=true;if(change==='ground')t.motion='WALK';
 if(['stealth','untargetable'].includes(change))f.b.addBuff(t,{key:'fixture:change',flags:{[change]:true}});
 advance(f.b,.8);assert.equal(hits(f).length,0);assert.equal(f.receipts.length,0);near(other.hp,other.s.maxHp);
 if(change==='replacement'){t.hidden=true;}until(f,()=>hits(f).length===1);assert.equal(hits(f)[0].target.id,other.id);
});
test('Captured input leaving range remains one retained life and has no distance-dependent travel delay',()=>{
 const f=make(),t=enemy(f,{motion:'FLY'});windup(f);const start=f.b.time;t.x=15;f.b._buildEnemyIndex();until(f,()=>hits(f).length===1);
 near(f.b.time-start,.6666666865348816,.04);assert.equal(hits(f)[0].target.id,t.id);
});
for(const [aspd,speed,delay]of[[300,1,.6666666865348816],[-50,.5,1.3333333730697632]])test(`ASPD modifier${aspd} samples the source capped playback${speed}`,()=>{
 const f=make();enemy(f,{motion:'FLY'});f.b.addBuff(f.u,{key:'fixture:aspd',mods:{aspd}});windup(f);const start=f.b.time;
 near(f.u.mem.regularFormVisual.speed,speed);until(f,()=>hits(f).length===1);near(f.b.time-start,delay,.04);
});
test('Live slow-down modifies elapsed ability time once and updates playback during the captured phase',()=>{
 const f=make();enemy(f,{motion:'FLY'});windup(f);const start=f.b.time;advance(f.b,.2);f.b.addBuff(f.u,{key:'fixture:slowdown',mods:{slowDownMul:.5}});advance(f.b,.4);
 assert.equal(hits(f).length,0);near(f.u.mem.regularFormVisual.speed,.5);until(f,()=>hits(f).length===1);near(f.b.time-start,.2+(.6666666865348816-.2)/.5,.05);
});
test('A zero clock freezes unborn output and resumes the same captured life without queued extra strikes',()=>{
 const f=make();enemy(f,{motion:'FLY'});windup(f);const p=f.attacks.phase;f.b.addBuff(f.u,{key:'fixture:zero',mods:{slowDownMul:0}});advance(f.b,2);
 assert.equal(f.attacks.phase,p);assert.equal(hits(f).length,0);near(f.u.mem.regularFormVisual.speed,0);f.b.removeBuff(f.u,'fixture:zero');until(f,()=>hits(f).length===1);
 assert.equal(f.receipts.length,1);
});
for(const flag of['stun','disarm','hidden'])test(`Brief ${flag} interrupts unborn output while preserving positive ordinary cooldown`,()=>{
 const f=make();enemy(f,{motion:'FLY'});windup(f);const cd=f.u.atkCd;
 if(flag==='hidden'){f.u.hidden=true;advance(f.b,.04);f.u.hidden=false;}else{f.b.applyStatus(f.u,flag,{duration:.01});advance(f.b,.04);}
 assert.equal(f.attacks.phase,null);assert.ok(f.u.atkCd>cd-.1);advance(f.b,.8);assert.equal(hits(f).length,0);until(f,()=>hits(f).length===1);
});
test('Explicit skill composition gating cancels ordinary windup without overwriting the skill presentation',()=>{
 let allowed=true;const f=make({mayBegin:()=>allowed});enemy(f,{motion:'FLY'});windup(f);allowed=false;
 const foreign={clip:'Skill_2_Begin',playId:'skill'};f.u.mem.regularFormVisual=foreign;advance(f.b,1);assert.equal(hits(f).length,0);assert.equal(f.u.mem.regularFormVisual,foreign);
 allowed=true;until(f,()=>hits(f).length===1);
});
for(const mode of['veto','substitute','recursive'])test(`${mode} in beforeAttack cannot manufacture or duplicate the retained direct receipt`,()=>{
 const f=make(),t=enemy(f,{motion:'FLY'}),other=enemy(f,{col:7.2,motion:'FLY'});windup(f);f.b.on('beforeAttack',c=>{
  if(c.attacker!==f.u)return;if(mode==='veto')c.targets=[];if(mode==='substitute')c.targets=[other];if(mode==='recursive')f.b.forceAttack(f.u,[t]);
 });advance(f.b,.8);assert.equal(hits(f).length,mode==='recursive'?1:0);assert.equal(f.receipts.length,mode==='recursive'?1:0);near(other.hp,other.s.maxHp);
});
test('External forceAttack outside a source release window produces no ordinary receipt',()=>{
 const f=make(),t=enemy(f,{motion:'FLY'});f.b.forceAttack(f.u,[t]);assert.equal(hits(f).length,0);assert.equal(f.receipts.length,0);assert.equal(f.u.stats.attacks,0);
});
for(const reason of['retreat','death','replacement','battleEnd','stop'])test(`${reason} drains only the old ordinary clock and cannot fire an unborn strike`,()=>{
 const f=make();enemy(f,{motion:'FLY'});windup(f);
 if(reason==='retreat')f.b.retreat(f.u);if(reason==='death')f.b.kill(f.u,null);
 if(reason==='replacement'){f.u.deploySeq++;f.u.mem.regularFormVisual={clip:'Idle',playId:'replacement'};advance(f.b,.1);}
 if(reason==='battleEnd'){f.b.finished=true;f.b.emit('battleEnd',{});}if(reason==='stop')f.attacks.stop();advance(f.b,3);
 assert.equal(hits(f).length,0);assert.equal(f.attacks.handles.length,0);assert.equal(f.attacks.phase,null);assert.equal(f.attacks.stopped,true);
 if(reason==='replacement')assert.equal(f.u.mem.regularFormVisual.playId,'replacement');assert.throws(()=>f.attacks.install(),/cannot be reinstalled/);
});
test('Replacement inside beforeAttack rejects old-life work and preserves the replacement presentation',()=>{
 const f=make();enemy(f,{motion:'FLY'});windup(f);f.b.on('beforeAttack',c=>{if(c.attacker===f.u){f.u.deploySeq++;f.u.mem.regularFormVisual={clip:'Idle',playId:'replacement'};}});
 advance(f.b,.8);assert.equal(hits(f).length,0);assert.equal(f.receipts.length,0);assert.equal(f.attacks.stopped,true);assert.equal(f.u.mem.regularFormVisual.playId,'replacement');
});
test('Duplicate deployment does not restart Born or rebind an old source after replacement',()=>{
 const f=make();enemy(f,{motion:'FLY'});windup(f);const p=f.attacks.phase;f.b.emit('deploy',{unit:f.u});assert.equal(f.attacks.phase,p);
 f.u.deploySeq++;f.b.emit('deploy',{unit:f.u});assert.equal(f.attacks.stopped,true);assert.equal(f.attacks.handles.length,0);
});
test('Source retirement during an accepted direct packet leaves one claimed attempt and no future output',()=>{
 const f=make();enemy(f,{motion:'FLY'});f.b.on('outputDamage',c=>{if(c.dmg.tags.includes('aegis:ordinary'))f.b.retreat(f.u);});advance(f.b,4);
 assert.equal(f.receipts.length,1);assert.equal(hits(f).length,1);assert.equal(f.attacks.stopped,true);assert.equal(f.flight.handles.length,0);assert.equal(f.talent.handles.length,0);
});
test('Cleanup does not delete a foreign visual attached after the last owned ordinary frame',()=>{
 const f=make(),foreign={clip:'Idle',playId:'foreign'};f.u.mem.regularFormVisual=foreign;f.attacks.stop();assert.equal(f.u.mem.regularFormVisual,foreign);
});
