// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make,enemy,advance,near,until} from './helpers/mcnist-s3-owner-fixture.js';
import {normalizeToken} from '../server/sim/simdata.js';
import {selectedMcGrafBuild} from '../server/sim/content/arkpedia-mcgraf-source.js';
import {MCGRAF_ID as TOKEN} from '../server/sim/content/arkpedia-mcnist-source.js';
import {prepareMcGrafS3Aura,MCGRAF_S3_AURA_CONTRACT} from '../server/sim/content/arkpedia-mcgraf-s3-aura.js';
import {MCNIST_S3_OWNER_CONTRACT as CONTRACT} from '../server/sim/content/arkpedia-mcnist-s3-owner.js';
import {effectiveProfile} from '../server/sim/ai.js';
const cast=f=>{f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.u.skill.activate('fixture'),true);};
const target=(f,o={})=>enemy(f,{x:6,y:5,...o});
function token(f,row=5,col=11){const r=selectedMcGrafBuild(f.build),def=normalizeToken(TOKEN,{name:r.source.appellation,position:r.source.position,profession:r.source.profession,
 stats:r.stats,rangeGrid:r.rangeGrid,talents:r.talents,arkpedia:{...r.build},skill:null});
 return f.b.spawnToken(f.u,TOKEN,row,col,{dir:'RIGHT',def,kit:{trait:{noAttack:true},talents:[],skill:null,install:(_b,t)=>{t.deploymentSlotCost=0;f.resources.registerToken(t);}}});}
for(let rank=1;rank<=10;rank++)test(`Mechanist S3 owner rank ${rank} adds selected ATK/BAT and releases one cross-tile Arts receipt`,()=>{
 const f=make({rank}),atk=f.u.s.atk,t=target(f);cast(f);near(f.u.s.atk,atk*(1+f.record.bb.atk));near(f.u.s.bat,3.5);
 until(f,()=>f.attacks.length===1,3);assert.equal(f.attacks[0].targets.length,1);assert.equal(f.attacks[0].isSkill,true);assert.equal(f.controller.bursts,1);near(t.s.maxHp-t.hp,atk*(1+f.record.bb.atk)*f.record.bb['attack@atk_scale']);assert.equal(f.hits[0].dmg.type,'arts');assert.equal(f.controller.flights.size,0);assert.deepEqual(f.b.errors,[]);
});
test('Original x-6 cross hits its four two-tile arms and centre, excludes diagonals/third cells, and yields one attack event',()=>{
 const f=make(),primary=target(f),positions=[[6,5],[7,5],[8,5],[5,5],[4,5],[6,6],[6,7],[6,4],[6,3],[7,6],[9,5]],ts=[];
 f.b.addBuff(f.u,{key:'fixture:no-block',flags:{noBlock:true}});f.b.addBuff(primary,{key:'fixture:primary',mods:{taunt:100}});
 for(const[x,y]of positions)ts.push(enemy(f,{x,y}));cast(f);until(f,()=>f.attacks.length===1,3);
 assert.equal(f.attacks[0].targets[0],primary);assert.equal(f.hits.length,10);for(let i=0;i<ts.length;i++)assert.equal(ts[i].hp<ts[i].s.maxHp,i<9);assert.equal(new Set(f.hits.map(h=>h.dmg.attackId)).size,1);
});
for(const flag of['camou','stealth','untargetable','sleep','air'])test(`S3 cross ${flag} collateral obeys its original area selection`,()=>{
 const f=make();target(f);const z=enemy(f,{x:7,y:5,fly:flag==='air'});if(flag!=='air')f.b.addBuff(z,{key:'fixture:flag',flags:{[flag]:true}});cast(f);until(f,()=>f.attacks.length===1,3);
 assert.equal(z.hp<z.s.maxHp,['camou','air'].includes(flag));
});
test('An unblocked camouflaged primary cannot begin S3 while a normal target can',()=>{
 const f=make(),t=target(f,{x:7});f.b.addBuff(t,{key:'fixture:camou',flags:{camou:true}});cast(f);advance(f.b,2);assert.equal(f.attacks.length,0);
 const z=target(f,{x:6});until(f,()=>f.attacks.length===1,2);assert.equal(f.attacks[0].targets[0],z);
});
for(const dir of['UP','DOWN','LEFT','RIGHT'])test(`S3 ${dir} uses original Begin/Loop/End tracks without fabricating downward variants`,()=>{
 const f=make({dir});target(f,{x:dir==='LEFT'?4:dir==='RIGHT'?6:5,y:dir==='UP'?6:dir==='DOWN'?4:5});cast(f);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_3_Begin');
 until(f,()=>f.attacks.length===1,3);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_3_Loop');f.u.skill.end('fixture');assert.equal(f.u.mem.regularFormVisual.clip,'Skill_3_End');advance(f.b,.3);assert.equal(f.u.mem.regularFormVisual.clip,'Idle');
});
test('S3 can begin without an enemy during birth, but preserves the full original birth reservation',()=>{
 const f=make();cast(f);target(f);advance(f.b,.9);assert.equal(f.attacks.length,0);until(f,()=>f.attacks.length===1,2);assert.ok(f.attacks[0].time>=1.4);
});
test('Ending during Begin keeps the remaining birth reservation and removes both mode stats',()=>{
 const f=make(),atk=f.u.s.atk;cast(f);f.u.skill.end('fixture');near(f.u.s.atk,atk);near(f.u.s.bat,1.2);target(f);advance(f.b,.9);assert.equal(f.attacks.length,0);until(f,()=>f.attacks.length===1,2);assert.equal(f.hits[0]?.dmg.isSkill??false,false);
});
test('S3 retains a forty-second duration and restores ordinary physical attacks without resetting positive cooldown',()=>{
 const f=make(),t=target(f),atk=f.u.s.atk;cast(f);until(f,()=>f.attacks.length===1,3);const cd=f.u.atkCd;f.u.skill.end('fixture');near(f.u.atkCd,cd);near(f.u.s.atk,atk);near(f.u.s.bat,1.2);until(f,()=>f.hits.some(h=>h.dmg.type==='phys'),5);assert.ok(t.hp<t.s.maxHp);
 const g=make();cast(g);advance(g.b,40.1);assert.equal(g.u.skill.active,false);assert.equal(g.controller.modeBuff,null);near(g.u.s.bat,1.2);
});
test('S3 can choose a current McGraf-blocked enemy outside owner range and ignore unrelated blockers',()=>{
 const f=make(),t=token(f),e=enemy(f,{x:11.2,y:5}),outside=enemy(f,{x:13,y:5});cast(f);until(f,()=>f.attacks.length===1,3);
 assert.equal(e.blockedBy,t);assert.equal(f.attacks[0].targets[0],e);assert.equal(outside.blockedBy,null);assert.ok(e.hp<e.s.maxHp);
});
test('Removed or changed token lives cannot extend the S3 primary selector',()=>{
 const f=make(),t=token(f),e=enemy(f,{x:11.2,y:5});advance(f.b,.1);assert.equal(e.blockedBy,t);t.deploySeq++;cast(f);advance(f.b,3);assert.equal(f.attacks.length,0);
});
test('S3 owner mode and the separately admitted McGraf aura compose and clean independently',()=>{
 const f=make(),t=token(f),e=enemy(f,{x:11.2,y:5});e.base.atk=1000;e.markDirty();cast(f);
 const aura=prepareMcGrafS3Aura(f.b,t,{contract:MCGRAF_S3_AURA_CONTRACT,barriers:f.resources});assert.equal(aura.install(),true);near(e.s.atk,500);until(f,()=>f.attacks.length===1,3);
 f.u.skill.end('fixture');assert.equal(aura.stopped,true);near(e.s.atk,1000);assert.equal(f.resources.tokens.has(t),true);assert.equal(t.alive,true);
});
for(const status of['stun','freeze','disarm'])test(`S3 ${status} before release cancels pending output and preserves cooldown`,()=>{
 const f=make();target(f);cast(f);until(f,()=>f.controller.phase?.kind==='attack',2);const cd=f.u.atkCd;f.b.applyStatus(f.u,status,{duration:1});advance(f.b,.5);assert.equal(f.attacks.length,0);assert.equal(f.controller.bursts,0);assert.ok(f.u.atkCd>0&&f.u.atkCd<=cd);
});
for(const aspd of[50,100,200,400])test(`S3 original release clock remains capped under ${aspd} ASPD`,()=>{
 const f=make();target(f);f.b.addBuff(f.u,{key:'fixture:aspd',mods:{aspd:aspd-100}});cast(f);until(f,()=>f.controller.phase?.kind==='attack',2);const p=f.controller.phase;near(p.speed,Math.min(1,aspd/100));near(p.releaseAt-p.startedAt,.4333333373069763/p.speed);until(f,()=>f.attacks.length===2,10);assert.ok(f.attacks[1].time-f.attacks[0].time+1e-7>=3.5/(aspd/100));
});
for(const mode of['veto','duplicate','substitute','recursive'])test(`S3 ${mode} attack callbacks cannot manufacture extra accepted area receipts`,()=>{
 const f=make(),t=target(f),z=target(f,{x:7});cast(f);let callbacks=0;f.b.on('beforeAttack',c=>{if(c.attacker!==f.u)return;callbacks++;if(mode==='veto')c.cancel=true;if(mode==='duplicate')c.targets=[t,t];if(mode==='substitute')c.targets=[z];if(mode==='recursive')f.b.forceAttack(f.u,[t]);});
 advance(f.b,2);assert.equal(f.attacks.length,mode==='recursive'?1:0);assert.equal(f.controller.bursts,mode==='recursive'?1:0);assert.equal(callbacks,1);
});
for(const mode of['retire','death','life'])test(`S3 source ${mode} before release leaves no pending owner burst or mode hooks`,()=>{
 const f=make();target(f);cast(f);until(f,()=>f.controller.phase?.kind==='attack',2);if(mode==='retire')f.b.retreat(f.u,{permanent:true});if(mode==='death')f.b.kill(f.u,null);if(mode==='life')f.u.deploySeq++;advance(f.b,1);assert.equal(f.hits.length,0);assert.equal(f.controller.handles.length,0);assert.equal(f.controller.modeBuff,null);
});
test('S3 rejected mode admission cannot leave ATK/BAT bonuses or a live activation',()=>{
 const f=make(),atk=f.u.s.atk;f.b.on('beforeBuff',c=>{if(c.buff.key===f.controller.modeKey)c.cancel=true;});cast(f);assert.equal(f.u.skill.active,false);assert.equal(f.controller.modeBuff,null);near(f.u.s.atk,atk);near(f.u.s.bat,1.2);assert.equal(f.b.regularSummons?.size??0,0);
});
test('S3 loss of the captured primary before release does not select a substitute or create a tile burst',()=>{
 const f=make(),t=target(f);cast(f);until(f,()=>f.controller.phase?.kind==='attack',2);f.b.kill(t,null);target(f,{x:7});advance(f.b,.5);assert.equal(f.controller.bursts,0);assert.equal(f.attacks.length,0);
});
test('S3 uses the captured primary current root tile at release and snapshots the area once',()=>{
 const f=make(),t=target(f),z=target(f,{x:8});cast(f);until(f,()=>f.controller.phase?.kind==='attack',2);t.x=7;
 until(f,()=>f.attacks.length===1,1);assert.equal(f.hits.length,2);assert.ok(z.hp<z.s.maxHp);assert.equal(f.attacks[0].targets[0],t);
});
test('S3 body overlap includes a huge recipient once even when several cross tiles touch it',()=>{
 const f=make();target(f);const z=enemy(f,{x:8,y:6});z.hitArea={w:3,h:3,dx:0,dy:0};cast(f);until(f,()=>f.attacks.length===1,3);assert.equal(f.hits.filter(h=>h.target===z).length,1);
});
test('An accepted S3 burst can finish after source withdrawal using its captured ATK fallback',()=>{
 const f=make(),t=target(f),z=target(f,{x:7});cast(f);const atk=f.u.s.atk;let once=false;
 f.b.on('damaged',c=>{if(c.source===f.u&&!once){once=true;f.b.retreat(f.u,{permanent:true});}});
 until(f,()=>f.hits.length===2,3);near(t.s.maxHp-t.hp,atk*2.6);near(z.s.maxHp-z.hp,atk*2.6);assert.equal(f.controller.stopped,true);
});
test('S3 skips a later recipient whose source life changes in an earlier damage callback',()=>{
 const f=make(),t=target(f),z=target(f,{x:7});cast(f);f.b.on('damaged',c=>{if(c.target===t)z.deploySeq++;});until(f,()=>f.attacks.length===1,3);assert.equal(f.hits.length,1);near(z.hp,z.s.maxHp);
});
test('S3 native live slow-down changes the pending ability clock once without recapturing ASPD',()=>{
 const f=make();target(f);cast(f);until(f,()=>f.controller.phase?.kind==='attack',2);advance(f.b,.2);const age=f.controller.phase.age;
 f.b.addBuff(f.u,{key:'fixture:slow',mods:{slowDownMul:.5}});advance(f.b,.3);assert.equal(f.attacks.length,0);assert.ok(f.controller.phase.age>age);near(f.u.mem.regularFormVisual.speed,.5);
 f.b.removeBuff(f.u,'fixture:slow');until(f,()=>f.attacks.length===1,1);near(f.u.mem.regularFormVisual.speed,1);
});
test('S3 pending sub-tick control is remembered after the visible flag has been removed',()=>{
 const f=make();target(f);cast(f);until(f,()=>f.controller.phase?.kind==='attack',2);f.b.applyStatus(f.u,'stun',{duration:1});f.b.removeStatus(f.u,'stun');advance(f.b,.5);assert.equal(f.attacks.length,0);
});
for(const mode of['end','retreat','stop'])test(`S3 mode ${mode} during buff admission leaves no stale mode stats`,()=>{
 const f=make(),atk=f.u.s.atk;let called=false;f.b.on('beforeBuff',c=>{if(c.buff.key!==f.controller.modeKey||called)return;called=true;
  if(mode==='end')f.u.skill.end('fixture');if(mode==='retreat')f.b.retreat(f.u,{permanent:true});if(mode==='stop')f.controller.stop();
 });cast(f);assert.equal(called,true);assert.equal(f.controller.modeBuff,null);assert.equal(f.u.findBuff(f.controller.modeKey),null);near(f.u.s.atk,atk);near(f.u.s.bat,1.2);assert.deepEqual(f.b.errors,[]);
});
test('A new S3 activation during old buff admission retains only the new mode and lease',()=>{
 const f=make(),atk=f.u.s.atk;let once=false;f.b.on('beforeBuff',c=>{if(c.buff.key!==f.controller.modeKey||once)return;once=true;f.u.skill.end('fixture');cast(f);});cast(f);
 assert.equal(f.u.skill.activations,2);assert.equal(f.u.skill.active,true);assert.equal(f.u.buffs.filter(b=>b.key===f.controller.modeKey).length,1);assert.equal(f.u.findBuff(f.controller.modeKey),f.controller.modeBuff);near(f.u.s.atk,atk*3.8);near(f.u.s.bat,3.5);assert.deepEqual(f.b.errors,[]);
});
test('Removing the accepted S3 mode ends its owner skill and cleans a separately admitted token aura',()=>{
 const f=make(),t=token(f),e=enemy(f,{x:11.2,y:5});cast(f);const a=prepareMcGrafS3Aura(f.b,t,{contract:MCGRAF_S3_AURA_CONTRACT,barriers:f.resources});a.install();
 f.b.removeBuff(f.u,f.controller.modeBuff);assert.equal(f.u.skill.active,false);assert.equal(f.controller.modeBuff,null);assert.equal(a.stopped,true);assert.equal(a.entries.size,0);assert.equal(e.buffs.some(b=>b.status==='weaken'),false);
});
test('S3 refuses unreviewed contracts, wrong skill and altered source stats without public admission',()=>{
 assert.throws(()=>make({contract:{...CONTRACT}}));assert.throws(()=>make({skill:2}));assert.throws(()=>make({mutate:d=>d.stats.atk++}));
});
test('The shared effective attack profile reports S3 Arts mode and returns to physical after exit',()=>{
 const f=make();assert.equal(effectiveProfile(f.u).dmgType,'phys');cast(f);assert.equal(effectiveProfile(f.u).dmgType,'arts');f.u.skill.end('fixture');assert.equal(effectiveProfile(f.u).dmgType,'phys');
});
