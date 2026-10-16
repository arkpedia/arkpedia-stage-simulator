// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make,enemy,cast,advance,until,near} from './helpers/thumpy-fixture.js';
const physical=f=>f.hits.filter(h=>h.type==='phys'&&!h.dmg.tags.includes('thumpy:field'));
const slow=f=>f.b.addBuff(f.u,{key:'qa:slow',data:{nativeSlowDown:{increment:.5,maxStrength:.5}}});
const free=(f,opts)=>{const t=enemy(f,opts);f.b.addBuff(t,{key:'qa:unblockable',flags:{unblockable:true}});return t;};
for(let skill=1;skill<=3;skill++)for(let rank=1;rank<=10;rank++)test(`Thumpy S${skill}/rank ${rank} applies its mode before the original cast and keeps the full selected account`,()=>{
 const f=make({skill,rank}),{b,u,resources:r,controller:c}=f,atk=u.s.atk;cast(f);assert.equal(c.mode,skill);near(u.s.atk,atk*(1+f.record.bb.atk));
 assert.equal(u.mem.regularFormVisual.clip,`Skill_${skill}_Begin`);assert.equal(u.stats.attacks,0);assert.equal(r.fieldReleased,false);
 if(skill>1){until(f,()=>r.fieldReleased,2);near(b.time,c.model().eventPayloads[`Skill_${skill}_Begin`][0].time,b.dt*2);assert.equal(c.lastTiles.length,5);assert.equal(u.stats.attacks,0);}
 until(f,()=>!u.skill.active,65);assert.equal(c.mode,0);near(u.s.atk,atk);near(b.time,f.record.source.duration,b.dt*2);assert.equal(r.children.size,0);
});
test('Thumpy ordinary input attacks one enemy while blocking three',()=>{
 const f=make({elite:0});Array.from({length:4},()=>enemy(f));until(f,()=>physical(f).length>0,3);assert.equal(f.u.blocking.length,3);assert.equal(physical(f).length,1);assert.equal(f.attacks[0].targets.length,1);
 near(physical(f)[0].time,1+.30000001192092896,f.b.dt*2);assert.equal(f.u.stats.attacks,1);
});
for(const skill of[1,3])test(`Thumpy S${skill} captures all own blockees in one original attack receipt`,()=>{
 const f=make({skill});Array.from({length:7},()=>enemy(f));advance(f.b,.1);cast(f);until(f,()=>physical(f).length>0,3);
 assert.equal(f.attacks.length,1);assert.equal(physical(f).length,skill===1?3:5);assert.equal(f.attacks[0].targets.length,skill===1?3:5);assert.equal(new Set(physical(f).map(h=>h.dmg.attackId)).size,1);
});
test('Thumpy S2 preserves ordinary single-target attacks independently of its periodic area damage',()=>{
 const f=make({skill:2});Array.from({length:4},()=>enemy(f));cast(f);until(f,()=>physical(f).length>0,3);assert.equal(physical(f).length,1);assert.equal(f.attacks[0].targets.length,1);assert.ok(f.hits.some(h=>h.dmg.tags.includes('thumpy:field')));
 near(physical(f)[0].amount,f.u.s.atk);
});
for(const aspd of[-50,0,300])test(`Thumpy ordinary attack uses uncapped ${aspd} ASPD once`,()=>{
 const f=make({elite:0});f.b.addBuff(f.u,{key:'qa:aspd',mods:{aspd}});free(f);until(f,()=>f.controller.phase?.kind==='attack',2);
 const speed=f.u.base.bat/f.u.s.interval,start=f.b.time;near(f.u.mem.regularFormVisual.speed,speed);until(f,()=>physical(f).length>0,3);near(physical(f)[0].time-start,.30000001192092896/speed,f.b.dt*2);
});
test('Thumpy ordinary native slow-down is already included in ASPD rather than applied twice',()=>{
 const f=make({elite:0});slow(f);free(f);until(f,()=>f.controller.phase?.kind==='attack',2);const start=f.b.time;until(f,()=>physical(f).length>0,3);near(physical(f)[0].time-start,.30000001192092896/.5,f.b.dt*2);
});
for(const skill of[2,3])for(const aspd of[-50,300])test(`Thumpy S${skill} fixed Begin ignores ${aspd} ASPD`,()=>{
 const f=make({skill});f.b.addBuff(f.u,{key:'qa:aspd',mods:{aspd}});cast(f);until(f,()=>f.resources.fieldReleased,2);near(f.b.time,f.controller.model().eventPayloads[`Skill_${skill}_Begin`][0].time,f.b.dt*2);
 until(f,()=>f.controller.phase?.kind!=='cast',2);near(f.b.time,f.controller.model().exactDurations[`Skill_${skill}_Begin`],f.b.dt*2);
});
for(const skill of[2,3])test(`Thumpy S${skill} fixed Begin follows current slow-down without restarting its original track`,()=>{
 const f=make({skill});cast(f);advance(f.b,.1);const play=f.u.mem.regularFormVisual.playId;slow(f);advance(f.b,.05);assert.equal(f.u.mem.regularFormVisual.playId,play);near(f.u.mem.regularFormVisual.speed,.5);
 until(f,()=>f.resources.fieldReleased,2);near(f.b.time,.1+(f.controller.model().eventPayloads[`Skill_${skill}_Begin`][0].time-.1)/.5,f.b.dt*3);
});
test('Thumpy S1 root Begin stays unscaled and the accepted mode survives startup control',()=>{
 const f=make();slow(f);cast(f);f.b.applyStatus(f.u,'stun',{duration:.3});advance(f.b,.2);assert.equal(f.resources.mode,1);assert.notEqual(f.u.mem.regularFormVisual.clip,'Skill_1_Begin');assert.equal(f.u.skill.active,true);
});
for(const skill of[2,3])for(const when of['before','after'])test(`Thumpy S${skill} control ${when} marker cancels only unreleased tile work`,()=>{
 const f=make({skill});cast(f);if(when==='after')until(f,()=>f.resources.fieldReleased,2);else advance(f.b,.1);
 f.b.applyStatus(f.u,'stun',{duration:.3});advance(f.b,1);assert.equal(f.u.skill.active,true);assert.equal(f.resources.mode,skill);assert.equal(f.resources.fieldReleased,when==='after');
});
for(const skill of[2,3])test(`Thumpy S${skill} already-disarmed manual tile cast is allowed, but a new short control epoch cancels it`,()=>{
 const f=make({skill});f.b.addBuff(f.u,{key:'qa:disarm',flags:{disarm:true}});cast(f);until(f,()=>f.resources.fieldReleased,2);
 const g=make({skill});cast(g);advance(g.b,.1);g.b.applyStatus(g.u,'stun',{duration:g.b.dt/2});advance(g.b,1);assert.equal(g.resources.fieldReleased,false);
});
test('Thumpy S1 non-missable push is independent of a dodged physical hit',()=>{
 const f=make(),t=enemy(f,{x:5.4});f.b.addBuff(t,{key:'qa:dodge',mods:{dodgePhys:1}});advance(f.b,.1);cast(f);const before=t.x;until(f,()=>f.u.stats.attacks>0,3);assert.equal(physical(f).length,0);assert.ok(t.x>before);assert.equal(f.b.errors.length,0);
});
test('Thumpy S1 force respects live weight and does not move a static body',()=>{
 for(const kind of['heavy','static']){const f=make(),t=enemy(f,{x:5.4});if(kind==='heavy')t.base.massLevel=10;else t.def={...t.def,staticBody:true};t.markDirty();advance(f.b,.1);cast(f);const before=t.x;until(f,()=>physical(f).length>0,3);near(t.x,before);}
});
test('Thumpy lost attack inputs are dropped without selecting replacements at the marker',()=>{
 const f=make({elite:0}),a=free(f);until(f,()=>f.controller.phase?.kind==='attack',2);f.b.kill(a,null);free(f);advance(f.b,.4);assert.equal(physical(f).length,0);
});
test('Thumpy beforeAttack may trim an original group but cannot substitute a foreign target',()=>{
 for(const how of['trim','substitute']){const f=make(),ts=Array.from({length:3},()=>enemy(f));advance(f.b,.1);cast(f);const foreign=enemy(f,{x:8});f.b.on('beforeAttack',c=>{if(c.attacker===f.u)c.targets=how==='trim'?[c.targets[0]]:[foreign];});
  until(f,()=>f.controller.phase?.kind==='attack',2);advance(f.b,.4);assert.equal(physical(f).length,how==='trim'?1:0);assert.ok(!physical(f).some(h=>h.target===foreign));}
});
test('Thumpy reentrant attacks cannot add another receipt, and source retirement during a group stops later recipients',()=>{
 const f=make(),ts=Array.from({length:3},()=>enemy(f));advance(f.b,.1);cast(f);f.b.on('beforeAttack',()=>f.b.forceAttack(f.u,[ts[0]]));f.b.on('damaged',c=>{if(c.source===f.u&&c.type==='phys')f.b.retreat(f.u,{permanent:true});});advance(f.b,1);
 assert.equal(f.attacks.length,1);assert.equal(physical(f).length,1);assert.equal(f.controller.stopped,true);assert.deepEqual(f.b.errors,[]);
});
test('Thumpy keeps positive ordinary cooldown through activation and skill finish',()=>{
 for(const skill of[1,2,3]){const f=make({skill});free(f);until(f,()=>f.controller.phase?.kind==='attack',2);const cd=f.u.atkCd;cast(f);near(f.u.atkCd,cd);f.u.skill.end('external');near(f.u.atkCd,cd);advance(f.b,.4);assert.equal(physical(f).length,0);}
});
for(const skill of[1,2,3])test(`Thumpy S${skill} uses only its native Idle-to-Idle End mix`,()=>{
 const f=make({skill});cast(f);until(f,()=>f.u.mem.regularFormVisual.clip===`Skill_${skill}_Idle`,2);f.u.skill.end('external');assert.equal(f.u.mem.regularFormVisual.clip,`Skill_${skill}_End`);advance(f.b,.2);assert.equal(f.u.mem.regularFormVisual.clip,'Idle');
 const g=make({skill});free(g);cast(g);until(g,()=>g.controller.phase?.kind==='attack',3);g.u.skill.end('external');assert.notEqual(g.u.mem.regularFormVisual.clip,`Skill_${skill}_End`);
});
test('Thumpy selected tile capture reads release-time terrain, then remains fixed until skill end',()=>{
 const f=make({skill:2});cast(f);f.b.grid.tiles[5*f.b.grid.cols+6]={...f.b.grid.tile(5,6),height:'HIGH'};until(f,()=>f.resources.fieldReleased,2);assert.ok(!f.controller.lastTiles.some(([r,c])=>r===5&&c===6));
 const before=structuredClone(f.controller.lastTiles);f.b.grid.tiles[5*f.b.grid.cols+6]={...f.b.grid.tile(5,6),height:'LOW'};advance(f.b,2);assert.deepEqual(f.controller.lastTiles,before);
});
for(const skill of[1,2,3])test(`Thumpy S${skill} charges naturally, waits for a manual request and holds SP through the duration`,()=>{
 const f=make({skill});advance(f.b,f.record.source.spData.spCost-f.record.source.spData.initSp+.1);assert.equal(f.u.skill.ready,true);assert.equal(f.u.skill.activations,0);assert.ok(f.u.skill.activate('manual'));
 f.u.skill.gainSp(10,'gift');near(f.u.skill.spTotal,0);advance(f.b,1);near(f.u.skill.spTotal,0);
});
for(const dir of['UP','DOWN','LEFT','RIGHT'])test(`Thumpy ${dir} keeps deployment facing and original Front/Back tracks`,()=>{
 const f=make({dir});cast(f);advance(f.b,.2);assert.equal(f.u.mem.regularVisualDirection,dir);assert.equal(f.controller.model().exactDurations.Die,dir==='UP'?undefined:1);
});
test('Thumpy rejected mode attachment cannot create a field, and retirement cancels every pending cast',()=>{
 for(const skill of[1,2,3]){const f=make({skill});f.b.on('beforeBuff',c=>{if(c.buff.key===f.resources.modeKey)c.cancel=true;});cast(f);advance(f.b,2);assert.equal(f.resources.mode,0);assert.equal(f.resources.fieldReleased,false);
  const g=make({skill});cast(g);g.b.retreat(g.u,{permanent:true});advance(g.b,2);assert.equal(g.controller.stopped,true);assert.equal(g.controller.handles.length,0);assert.equal(g.resources.handles.length,0);assert.equal(g.u.mem.regularFormVisual,undefined);}
});
test('Thumpy external force attacks and malformed selected inputs cannot bypass the controller',()=>{
 const f=make(),t=enemy(f);assert.equal(f.b.forceAttack(f.u,[t]),false);assert.equal(f.attacks.length,0);assert.throws(()=>make({contract:{}}));
 for(const mutate of[d=>d.stats.atk++,d=>d.skill.bb.atk++,d=>d.skill.spCost++,d=>d.rangeGrid.push([1,0])])assert.throws(()=>make({mutate}));
});
for(const[location,x,y,distance]of[['front',5.4,5,1.7],['behind',4.6,5,.44],['near',5.1,5,.44]])test(`Thumpy S1 ${location} push retains radial direction and native one-level reduction`,()=>{
 const f=make(),t=enemy(f,{x,y}),moves=[];f.b.on('enemyDisplaced',c=>{if(c.unit===t)moves.push(c);});advance(f.b,.1);cast(f);until(f,()=>moves.length>0,3);near(moves[0].distance,distance);assert.equal(moves[0].to.x>moves[0].from.x,x>=5);
});
