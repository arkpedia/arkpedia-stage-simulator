// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import {make as fixture,enemy,ally,advance,near,until} from './helpers/yukari-fixture.js';
import {YukariOrdinaryAttacks,YUKARI_ORDINARY_CONTRACT,verifyYukariOrdinary} from '../server/sim/content/arkpedia-yukari-ordinary.js';
import {yukariNativeInputs,yukariSourceComponent} from '../server/sim/content/arkpedia-yukari-source.js';
const fs=[],make=opts=>{const f=fixture({ordinary:true,...opts});fs.push(f);return f;};test.afterEach(()=>{for(const f of fs.splice(0))assert.deepEqual(f.b.errors,[]);});
const hits=f=>f.hits.filter(c=>c.dmg.tags.includes('yukari:ordinary'));
const begun=f=>until(f,()=>!!f.attacks.phase),airborne=f=>until(f,()=>f.attacks.flights.size>0);
test('Ordinary composition requires a fresh selected Yukari, exact original contract and explicit skill gate',()=>{
 verifyYukariOrdinary();assert.throws(()=>make({ordinaryContract:{...YUKARI_ORDINARY_CONTRACT}}),/exact ordinary contract/);assert.throws(()=>make({mayBegin:null}),/composition predicate/);
 const f=make();assert.throws(()=>new YukariOrdinaryAttacks(f.b,f.u,{contract:YUKARI_ORDINARY_CONTRACT,mayBegin:()=>true}),/Fresh selected/);assert.throws(()=>f.attacks.install(),/reinstalled/);
});
for(const what of['mode','deathProjectiles','trigger','attack','source','time','slowdown','cached','projectile','motion','count','selector','speed','inertia','lifetime','sourceBound','oneHit','mix','alias'])test(`Changed ${what} cannot retain the original ordinary contract`,()=>{
 const n=structuredClone(yukariNativeInputs()),p=n.projectiles.projectile_chr_yukari.flatMap(r=>r.components.map(c=>c.data)),projectile=p.find(d=>d._lifeTime!=null),move=p.find(d=>d._speed!=null),read=(...args)=>{const v=structuredClone(yukariSourceComponent(...args));if(args[2]==='9047055651020743433'&&what==='trigger')v._keepTarget=1;return v;};
 if(what==='mode')n.root._modes=[];if(what==='deathProjectiles')n.root._clearProjectileWhenDead=1;if(what==='attack')n.ordinary._animKey='Attack';if(what==='source')n.ordinary._selectTargetSource=1;
 if(what==='time')n.ordinary._timeMode=1;if(what==='slowdown')n.ordinary._affectedBySlowDown=0;if(what==='cached')n.ordinary._useCachedAtkOnly=1;if(what==='projectile')n.ordinary._projectileKey='borrowed';
 if(what==='motion')n.ordinarySelector._targetMotion=1;if(what==='count')n.ordinarySelector._maxNum=2;if(what==='selector')n.ordinarySelector._postFilter=27;
 if(what==='speed')move._speed=10;if(what==='inertia')move._addInertia=1;if(what==='lifetime')projectile._lifeTime=Infinity;if(what==='sourceBound')projectile._stopWhenSourceInvalid=1;
 if(what==='oneHit')projectile._maxHitNum=2;if(what==='mix')n.artController._mixSettings.pop();if(what==='alias')n.artController._animations.find(a=>a.animKey==='Attack_Loop').animName='Skill_1';
 assert.throws(()=>verifyYukariOrdinary(n,read),/Changed original/);
});
for(const[dir,row,col,family]of[['RIGHT',5,7,'Attack'],['LEFT',5,3,'Attack'],['UP',7,5,'Attack'],['DOWN',3,5,'Attack_Down']])test(`${dir} keeps original Start, opening mix and separate single Physical arrow release`,()=>{
 const f=make({dir}),t=enemy(f,{row,col}),other=enemy(f,{row,col:col+.1});advance(f.b,1);assert.equal(f.receipts.length,0);assert.equal(f.u.mem.regularFormVisual.clip,'Start');begun(f);const start=f.b.time;
 assert.equal(f.u.mem.regularFormVisual.clip,family+'_Begin');assert.equal(f.u.mem.regularVisualDirection,dir);advance(f.b,.16);assert.equal(f.receipts.length,0);
 airborne(f);near(f.b.time-start,.2,.04);assert.equal(f.u.mem.regularFormVisual.clip,family+'_Loop');assert.equal(f.receipts.length,1);assert.equal(f.receipts[0].targets.length,1);near(t.hp,t.s.maxHp);
 const p=[...f.attacks.flights.keys()][0];near(p.speed,20);near(p.maxAge,10);assert.equal(p.data.projectileKey,'projectile_chr_yukari');until(f,()=>hits(f).length===1);
 near(hits(f)[0].amount,f.u.s.atk);assert.equal(hits(f)[0].type,'phys');assert.equal(hits(f)[0].dmg.isProjectile,true);assert.equal(hits(f)[0].dmg.isSkill,false);assert.equal(hits(f)[0].dmg.applyWay,'ranged');near(other.hp,other.s.maxHp);
 assert.equal(f.u.mem.regularDeathVisual.hide,dir==='UP'?true:undefined);
});
test('A continuing chain omits Begin; exhaustion plays its exact End before a fresh opening',()=>{
 const f=make(),t=enemy(f);airborne(f);const first=f.receipts[0].time;until(f,()=>f.receipts.length===2);assert.equal(f.attacks.phase.beginAge,0);near(f.receipts[1].time-first,2.1-.1666666716337204,.05);
 until(f,()=>f.receipts.length===3);near(f.receipts[2].time-f.receipts[1].time,2.1,.04);f.b.kill(t,null);until(f,()=>!!f.attacks.ending);
 assert.equal(f.u.mem.regularFormVisual.clip,'Attack_End');const end=f.b.time;enemy(f);advance(f.b,.12);assert.equal(f.u.mem.regularFormVisual.clip,'Attack_End');until(f,()=>!!f.attacks.phase);near(f.b.time-end,.1666666716337204,.04);assert.ok(f.attacks.phase.beginAge>0);
});
test('Downward exhaustion uses Down End; a new Back chain never borrows missing Down or death clips',()=>{
 const f=make({dir:'DOWN'}),t=enemy(f,{row:3,col:5});airborne(f);f.b.kill(t,null);until(f,()=>!!f.attacks.ending);assert.equal(f.u.mem.regularFormVisual.clip,'Attack_Down_End');
 const g=make({dir:'UP'});enemy(g,{row:7,col:5});begun(g);assert.equal(g.attacks.model().exactDurations.Attack_Down_Begin,undefined);assert.equal(g.u.mem.regularDeathVisual.hide,true);
});
for(const motion of['WALK','FLY'])test(`Ordinary acquisition accepts ${motion} and shared path priority, without Arts or skill-heal riders`,()=>{
 const f=make(),t=enemy(f,{motion});f.u.hp=100;ally(f);until(f,()=>hits(f).length===2);assert.ok(t.hp<t.s.maxHp);assert.equal(f.heals.length,0);assert.equal(f.hits.filter(h=>h.type==='arts'||h.type==='element').length,0);
});
test('Own blocked input remains eligible outside the original range',()=>{
 const f=make(),t=enemy(f,{col:4});t.blockedBy=f.u;f.u.blocking.push(t);begun(f);assert.equal(f.attacks.phase.target.id,t.id);until(f,()=>hits(f).length===1);
});
for(const flag of['stealth','camou','untargetable','sleep'])test(`A new ${flag} enemy is not acquired`,()=>{const f=make(),t=enemy(f,{flags:{[flag]:true}});advance(f.b,4);assert.equal(f.receipts.length,0);near(t.hp,t.s.maxHp);});
for(const change of['death','replacement','hidden'])test(`An input ${change} before release cannot redirect the unborn arrow`,()=>{
 const f=make(),t=enemy(f),other=enemy(f,{col:7.2});begun(f);if(change==='death')f.b.kill(t,null);if(change==='replacement')t.deploySeq++;if(change==='hidden')t.hidden=true;
 advance(f.b,.5);assert.equal(f.receipts.length,0);near(other.hp,other.s.maxHp);
});
test('Retained inputs leaving range or becoming target-free keep their one accepted arrow',()=>{
 for(const state of['range','stealth','untargetable']){const f=make(),t=enemy(f);begun(f);if(state==='range'){t.x=15;f.b._buildEnemyIndex();}else f.b.addBuff(t,{key:'fixture:late',flags:{[state]:true}});until(f,()=>hits(f).length===1);assert.equal(hits(f)[0].target.id,t.id);assert.equal(f.receipts.length,1);}
});
for(const[aspd,speed,release]of[[300,1,.2],[-50,.5,.4]])test(`ASPD${aspd} samples capped speed${speed} including the opening mix`,()=>{
 const f=make();enemy(f);f.b.addBuff(f.u,{key:'fixture:aspd',mods:{aspd}});begun(f);const start=f.b.time;near(f.u.mem.regularFormVisual.speed,speed);airborne(f);near(f.b.time-start,release,.04);
});
test('Current slow-down updates Begin/Loop playback once and can freeze/resume the retained phase',()=>{
 const f=make();enemy(f);begun(f);const p=f.attacks.phase;advance(f.b,.08);f.b.addBuff(f.u,{key:'fixture:slow',mods:{slowDownMul:.5}});advance(f.b,.08);near(f.u.mem.regularFormVisual.speed,.5);assert.equal(f.receipts.length,0);
 f.b.addBuff(f.u,{key:'fixture:freeze',mods:{slowDownMul:0}});const age=p.age;advance(f.b,2);near(p.age,age);assert.equal(f.attacks.phase,p);assert.equal(f.receipts.length,0);near(f.u.mem.regularFormVisual.speed,0);
 f.b.removeBuff(f.u,'fixture:freeze');airborne(f);assert.equal(f.receipts.length,1);
});
test('The independent End clock uses live slowdown without spawning a late arrow',()=>{
 const f=make(),t=enemy(f);airborne(f);f.b.kill(t,null);until(f,()=>!!f.attacks.ending);f.b.addBuff(f.u,{key:'fixture:freeze',mods:{slowDownMul:0}});const e=f.attacks.ending;advance(f.b,1);near(e.age,0);near(f.u.mem.regularFormVisual.speed,0);f.b.removeBuff(f.u,'fixture:freeze');until(f,()=>!f.attacks.ending);assert.equal(f.receipts.length,1);
});
for(const flag of['stun','disarm','hidden'])test(`Brief ${flag} invalidates unborn output and preserves positive cooldown`,()=>{
 const f=make();enemy(f);begun(f);const cd=f.u.atkCd;if(flag==='hidden'){f.u.hidden=true;advance(f.b,.04);f.u.hidden=false;}else{f.b.applyStatus(f.u,flag,{duration:.01});advance(f.b,.04);}
 assert.equal(f.attacks.phase,null);assert.ok(f.u.atkCd>cd-.1);advance(f.b,.3);assert.equal(f.receipts.length,0);airborne(f);assert.ok(f.attacks.phase.beginAge>0);
});
test('The explicit skill gate yields the ordinary clock and preserves foreign skill presentation',()=>{
 let enabled=true;const f=make({mayBegin:()=>enabled});enemy(f);begun(f);enabled=false;const foreign={clip:'Skill_1',playId:'foreign'};f.u.mem.regularFormVisual=foreign;advance(f.b,.5);assert.equal(f.attacks.phase,null);assert.equal(f.u.mem.regularFormVisual,foreign);assert.equal(f.receipts.length,0);
 enabled=true;airborne(f);assert.ok(f.attacks.phase.beginAge>0);
});
for(const mode of['veto','substitute','recursive','sourceReplacement'])test(`${mode} during beforeAttack cannot fabricate or duplicate a receipt`,()=>{
 const f=make(),t=enemy(f),other=enemy(f,{col:7.2});begun(f);f.b.on('beforeAttack',c=>{if(c.attacker!==f.u)return;if(mode==='veto')c.targets=[];if(mode==='substitute')c.targets=[other];if(mode==='recursive')f.b.forceAttack(f.u,[t]);if(mode==='sourceReplacement'){f.u.deploySeq++;f.u.mem.regularFormVisual={clip:'Idle',playId:'new-life'};}});
 advance(f.b,.6);assert.equal(f.receipts.length,mode==='recursive'?1:0);assert.equal(hits(f).length,mode==='recursive'?1:0);near(other.hp,other.s.maxHp);if(mode==='sourceReplacement')assert.equal(f.u.mem.regularFormVisual.playId,'new-life');
});
test('External forceAttack outside a source release window emits neither damage nor attack credit',()=>{const f=make(),t=enemy(f);f.b.forceAttack(f.u,[t]);assert.equal(f.receipts.length,0);assert.equal(f.u.stats.attacks,0);assert.equal(f.b.projectiles.list.length,0);});
test('Same-life live ATK, typed output and penetration are evaluated at projectile impact',()=>{
 const f=make(),t=enemy(f);t.base.def=100;t.markDirty();airborne(f);f.b.addBuff(f.u,{key:'fixture:live',mods:{atkPct:1,atkScaleMul:1.5,dmgDealtMul:2,physDealtMul:1.5,defIgnoreFlat:50}});until(f,()=>hits(f).length===1);near(hits(f)[0].amount,(f.u.s.atk*1.5-50)*3);
});
for(const why of['retreat','death','replacement','stop'])test(`A born arrow survives source ${why} using its original launch attributes and ledger`,()=>{
 const f=make(),t=enemy(f);f.b.addBuff(f.u,{key:'fixture:launch',mods:{dmgDealtMul:2,physDealtMul:1.5}});airborne(f);const atk=f.u.s.atk,ledger=f.u.stats;
 if(why==='retreat')f.b.retreat(f.u);if(why==='death')f.b.kill(f.u,null);if(why==='replacement')f.u.deploySeq++;if(why==='stop')f.attacks.stop();f.u.base.atk=99999;f.u.stats={...ledger,dmg:0};f.u.ownerId='new-owner';f.u.markDirty();advance(f.b,.04);until(f,()=>hits(f).length===1);
 near(hits(f)[0].amount,atk*3);assert.notEqual(hits(f)[0].source,f.u);assert.equal(hits(f)[0].source.stats,ledger);assert.ok(ledger.dmg>0);near(f.u.stats.dmg,0);assert.equal(f.attacks.flights.size,0);assert.equal(f.attacks.watchers.length,0);
});
for(const change of['death','replacement','hidden'])test(`A born recipient ${change} cannot redirect or fabricate impact`,()=>{
 const f=make(),t=enemy(f),other=enemy(f,{col:7.2});airborne(f);if(change==='death')f.b.kill(t,null);if(change==='replacement')t.deploySeq++;if(change==='hidden')t.hidden=true;advance(f.b,.5);assert.equal(hits(f).length,0);near(other.hp,other.s.maxHp);assert.equal(f.attacks.flights.size,0);assert.equal(f.attacks.watchers.length,0);
});
test('A projectile impact is claimed before reentrant damage callbacks can replay it',()=>{
 const f=make(),t=enemy(f);airborne(f);const p=[...f.attacks.flights.keys()][0];f.b.on('outputDamage',c=>{if(c.dmg.tags.includes('yukari:ordinary'))p.onHit({target:t});});until(f,()=>hits(f).length===1);assert.equal(f.receipts.length,1);assert.equal(f.attacks.flights.size,0);
});
for(const event of['outputDamage','hit','damageFinal','calculatedDamage'])test(`Recipient replacement inside ${event} rejects the accepted old-life packet`,()=>{
 const f=make(),t=enemy(f);airborne(f);f.b.on(event,c=>{if(c.dmg.tags.includes('yukari:ordinary'))t.deploySeq++;});advance(f.b,.5);near(t.hp,t.s.maxHp);assert.equal(hits(f).length,0);
});
for(const how of['intercept','remove','battleEnd','expire'])test(`${how} drains finite projectile ownership and cannot replay a late hit`,()=>{
 const f=make(),t=enemy(f);airborne(f);const p=[...f.attacks.flights.keys()][0];if(how==='intercept')f.b.projectiles.registerInterceptor({owner:f.u,intercept:()=>true});if(how==='remove')f.b.removeProjectiles(x=>x===p);
 if(how==='battleEnd'){f.b.finished=true;f.b.emit('battleEnd',{});}if(how==='expire'){t.x=1000;p.tx=1000;p.maxAge=.04;}
 advance(f.b,.5);assert.equal(f.attacks.flights.size,0);assert.equal(f.attacks.watchers.length,0);assert.equal(hits(f).length,how==='expire'?1:0);
 p.onHit({target:t});assert.equal(hits(f).length,how==='expire'?1:0);
});
for(const how of['retreat','death','replacement','stop','battleEnd'])test(`Source ${how} before release drains only its own unborn work`,()=>{
 const f=make();enemy(f);begun(f);const foreign={clip:'Idle',playId:'foreign'};f.u.mem.regularFormVisual=foreign;
 if(how==='retreat')f.b.retreat(f.u);if(how==='death')f.b.kill(f.u,null);if(how==='replacement')f.u.deploySeq++;if(how==='stop')f.attacks.stop();if(how==='battleEnd'){f.b.finished=true;f.b.emit('battleEnd',{});}advance(f.b,.6);
 assert.equal(f.attacks.phase,null);assert.equal(f.attacks.ending,null);assert.equal(f.attacks.handles.length,0);assert.equal(f.receipts.length,0);assert.equal(f.u.mem.regularFormVisual,foreign);
});
test('Duplicate deployment does not restart Start or rebind an old source after replacement',()=>{
 const f=make();enemy(f);begun(f);const p=f.attacks.phase;f.b.emit('deploy',{unit:f.u});assert.equal(f.attacks.phase,p);f.u.deploySeq++;f.b.emit('deploy',{unit:f.u});assert.equal(f.attacks.stopped,true);assert.equal(f.attacks.handles.length,0);
});
for(const elite of[0,1,2])test(`Selected E${elite} ordinary inputs retain promotion stats independently of either diagnostic skill`,()=>{
 for(const skill of elite===0?[1]:[1,2]){const f=make({elite,skill}),t=enemy(f);until(f,()=>hits(f).length===1);near(hits(f)[0].amount,f.record.stats.atk);near(f.u.base.bat,2.1);assert.equal(f.heals.length,0);assert.ok(t.hp<t.s.maxHp);}
});
test('A brief control during End clears only that mix clock and forces a fresh opening',()=>{
 const f=make(),t=enemy(f);airborne(f);f.b.kill(t,null);until(f,()=>!!f.attacks.ending);f.b.applyStatus(f.u,'stun',{duration:.01});advance(f.b,.04);assert.equal(f.attacks.ending,null);assert.equal(f.u.mem.regularFormVisual.clip,'Idle');enemy(f);begun(f);assert.ok(f.attacks.phase.beginAge>0);
});
