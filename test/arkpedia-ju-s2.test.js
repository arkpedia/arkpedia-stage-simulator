// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make as fixture, enemy, advance, until, near} from './helpers/ju-fixture.js';
import {prepareJuS2, JU_S2_CONTRACT, verifyJuS2} from '../server/sim/content/arkpedia-ju-s2.js';
import {juNativeInputs} from '../server/sim/content/arkpedia-ju-source.js';
const make=opts=>fixture({skill:2,...opts,prepare:(b,u)=>prepareJuS2(b,u,{contract:JU_S2_CONTRACT})});
const target=(f,{ratio=.9,...opts}={})=>{const t=enemy(f,{hp:1e7,...opts});t.hp=t.s.maxHp*ratio;return t;};
const cast=f=>{f.u.skill.setSpTotal(f.u.skill.spCost);assert.ok(f.u.skill.activate());};
const mode=f=>until(f,()=>!!f.controller.mode);
const phase=f=>until(f,()=>f.controller.phase?.kind==='s2');
const hits=f=>f.hits.filter(h=>h.dmg.tags.includes('ju:s2:attack'));
const airborne=f=>until(f,()=>f.controller.flights.size>0);

test('S2 requires original selected inputs, manual controller and exact source flags',()=>{
  assert.throws(()=>make({skill:1}),/selected Ju S2/);
  assert.throws(()=>fixture({skill:2,prepare:(b,u)=>prepareJuS2(b,u,{contract:{...JU_S2_CONTRACT}})}),/exact controller contract/);
  for(const mutate of [n=>n.s2._attackBlackboardModeIndex=0,n=>n.s2Projectile._lifeTime=10,
    n=>n.s2Selector._maxTargetKey='max_target',n=>n.s2._canCastDuringBorn=0]){
    const n=structuredClone(juNativeInputs());mutate(n);assert.throws(()=>verifyJuS2(n),/Changed original/);
  }
});

test('S2 waits for a manual command even with full SP and eligible enemies',()=>{
  const f=make();target(f);f.u.skill.setSpTotal(f.u.skill.spCost);advance(f.b,4);
  assert.equal(f.u.skill.activations,0);assert.equal(f.controller.mode,false);assert.equal(hits(f).length,0);
  assert.ok(f.hits.some(h=>h.dmg.tags.includes('ju:ordinary')));
});

test('Original Begin can interrupt born presentation and holds the timed account before granting mode',()=>{
  const f=make();cast(f);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_Begin');
  assert.equal(f.controller.mode,false);const atk=f.u.s.atk;advance(f.b,.4);near(f.u.s.atk,atk);
  mode(f);near(f.u.s.atk,atk*(1+f.record.bb.atk));assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_Idle');
  assert.ok(f.u.skill.timeLeft<f.record.source.duration);assert.equal(f.u.skill.gainSp(100,'fixture'),0);
});

for(let rank=1;rank<=10;rank++)test(`S2 rank ${rank} retains the original ATK and two heaviest inputs`,()=>{
  const f=make({rank}),a=target(f),b=target(f),c=target(f);const atk=f.u.s.atk;
  a.base.massLevel=1;b.base.massLevel=5;c.base.massLevel=3;for(const t of[a,b,c])t.markDirty();
  cast(f);phase(f);assert.deepEqual(f.controller.phase.targets,[b,c]);near(f.u.s.atk,atk*(1+f.record.bb.atk));
  airborne(f);assert.equal(f.receipts.length,1);assert.equal(f.controller.flights.size,2);
  for(const p of f.controller.flights.keys()){near(p.flightTime,.16699999570846558);assert.equal(p.visual,'none');assert.equal(p.attached,true);}
  until(f,()=>hits(f).length===2);assert.equal(new Set(hits(f).map(h=>h.dmg.attackId)).size,1);
  assert.deepEqual(new Set(hits(f).map(h=>h.target)),new Set([b,c]));near(hits(f)[0].amount,f.u.s.atk);
  near(a.hp,a.s.maxHp*.9);
});

test('S2 windup uses the original capped marker and samples the attack interval',()=>{
  const f=make();target(f);f.b.addBuff(f.u,{key:'fixture:aspd',mods:{aspd:100}});cast(f);phase(f);
  const p=f.controller.phase;near(p.speed,1);near(p.releaseAge,.5333333611488342);near(p.untilAge,1.2);
  advance(f.b,.4);assert.equal(f.receipts.length,0);airborne(f);assert.equal(f.receipts.length,1);
});

test('A captured live input stays selected when a heavier newcomer enters the range',()=>{
  const f=make(),a=target(f),b=target(f);cast(f);phase(f);const newcomer=target(f);newcomer.base.massLevel=99;newcomer.markDirty();
  until(f,()=>hits(f).length===2);assert.deepEqual(new Set(hits(f).map(h=>h.target)),new Set([a,b]));
});

test('Losing one captured input still fires once at the retained other life',()=>{
  const f=make(),a=target(f),b=target(f);cast(f);phase(f);f.b.kill(a);
  until(f,()=>hits(f).length===1);assert.equal(hits(f)[0].target,b);assert.equal(f.receipts.length,1);
});

test('Replacing a captured input cannot redirect an old shot into its new life',()=>{
  const f=make(),a=target(f);cast(f);phase(f);a.deploySeq++;advance(f.b,1);
  assert.equal(hits(f).length,0);assert.equal(f.receipts.length,0);
});

test('An attack callback cannot inject a new target outside the captured selection',()=>{
  const f=make();target(f);cast(f);phase(f);const other=target(f);
  f.b.on('beforeAttack',c=>{if(c.attacker===f.u)c.targets=[other];});advance(f.b,1);
  assert.equal(hits(f).length,0);assert.equal(f.receipts.length,0);
});

test('An explicit beforeAttack veto spends no receipt and creates no short projectile',()=>{
  const f=make();target(f);cast(f);phase(f);f.b.on('beforeAttack',c=>{if(c.attacker===f.u)c.cancel=true;});advance(f.b,1);
  assert.equal(f.receipts.length,0);assert.equal(f.controller.flights.size,0);
});

test('A rejected mode buff leaves normal attacks and cannot grant ATK or the aura',()=>{
  const f=make();target(f,{ratio:.4});const atk=f.u.s.atk;
  f.b.on('beforeBuff',c=>{if(c.buff.key==='ju_s_2[switch]')c.cancel=true;});cast(f);advance(f.b,2);
  assert.equal(f.controller.mode,false);near(f.u.s.atk,atk);assert.equal(f.extra.pending.size,0);assert.equal(hits(f).length,0);
  assert.ok(f.hits.some(h=>h.dmg.tags.includes('ju:ordinary')));
});

test('Mode removal cancels an unfired S2 phase while preserving positive cooldown',()=>{
  const f=make();target(f);cast(f);phase(f);const cd=f.u.atkCd;f.b.removeBuff(f.u,f.controller.modeBuff);advance(f.b,.2);
  assert.equal(hits(f).length,0);assert.equal(f.controller.mode,false);assert.ok(f.u.atkCd>0&&f.u.atkCd<cd);
});

test('A transient control cancels an unfired S2 phase without ending the timed skill',()=>{
  const f=make();target(f);cast(f);phase(f);f.b.applyStatus(f.u,'stun',{duration:.01});advance(f.b,.3);
  assert.equal(f.u.skill.active,true);assert.equal(f.controller.mode,true);assert.equal(f.receipts.length,0);assert.ok(f.u.atkCd>0);
});

test('Accepted short projectiles survive mode end and source withdrawal with their own ATK snapshot',()=>{
  const f=make();target(f);cast(f);phase(f);airborne(f);const atk=f.u.s.atk;
  f.b.retreat(f.u);f.u.base.atk=99999;f.u.markDirty();until(f,()=>hits(f).length===1);near(hits(f)[0].amount,atk);
  assert.equal(f.controller.watchers.length,0);assert.equal(f.controller.handles.length,0);assert.equal(f.extra.handles.length,0);
});

test('Ending an idle mode uses only the original recorded End transition',()=>{
  const f=make();cast(f);mode(f);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_Idle');
  f.u.skill.end('fixture');assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_End');advance(f.b,.2);
  assert.equal(f.u.mem.regularFormVisual.clip,'Idle');assert.equal(f.controller.mode,false);
});

test('The S2 account expires, removes its ATK/mode and resumes SP without removing target-owned delays',()=>{
  const f=make(),e=target(f);cast(f);mode(f);f.u.skill.timeLeft=.3;e.hp=e.s.maxHp*.4;
  until(f,()=>f.extra.pending.size>0);until(f,()=>!f.u.skill.active);near(f.u.s.atk,f.record.stats.atk);
  until(f,()=>f.hits.some(h=>h.dmg.tags.includes('ju_s2_extra')));assert.equal(f.controller.mode,false);
  advance(f.b,.3);assert.ok(f.u.skill.spTotal>0);
});

test('Reentrant forceAttack cannot double either recipient or the accepted attack receipt',()=>{
  const f=make();target(f);target(f);cast(f);phase(f);
  f.b.on('beforeAttack',c=>{if(c.attacker===f.u)f.b.forceAttack(f.u,c.targets);});
  until(f,()=>hits(f).length===2);assert.equal(f.receipts.length,1);
});

for(const [dir,row,col]of[['RIGHT',5,7],['LEFT',5,3],['UP',7,5],['DOWN',3,5]])test(`S2 retains original mode clocks and direction ${dir}`,()=>{
  const f=make({dir});target(f,{row,col});cast(f);phase(f);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_Loop');
  assert.equal(f.u.mem.regularVisualDirection,dir);near(f.controller.phase.releaseAge,.5333333611488342);until(f,()=>hits(f).length===1);
});

test('A lethal S2 projectile preserves the accepted wound talent rather than killing immediately',()=>{
  const f=make(),e=enemy(f,{hp:100});cast(f);phase(f);until(f,()=>hits(f).length===1);
  assert.equal(e.alive,true);assert.equal(e.hp,1);assert.ok(e.findBuff('cripple'));
});

test('Ending the skill inside mode-buff admission cannot leave a late ATK buff or aura',()=>{
  const f=make();target(f);let entered=false;
  f.b.on('beforeBuff',c=>{if(!entered&&c.buff.key==='ju_s_2[switch]'){entered=true;f.u.skill.end('fixture');}});
  cast(f);advance(f.b,1);assert.equal(f.u.skill.active,false);assert.equal(f.u.findBuff('ju_s_2[switch]'),null);
  near(f.u.s.atk,f.record.stats.atk);assert.equal(f.extra.auras.size,0);assert.equal(f.extra.pending.size,0);
});

test('Withdrawal during mode admission cleans the late buff and all component handles',()=>{
  const f=make();let entered=false;
  f.b.on('beforeBuff',c=>{if(!entered&&c.buff.key==='ju_s_2[switch]'){entered=true;f.b.retreat(f.u);}});
  cast(f);advance(f.b,1);assert.equal(f.u.findBuff('ju_s_2[switch]'),null);assert.equal(f.controller.handles.length,0);
  assert.equal(f.extra.handles.length,0);assert.equal(f.wounds.handles.length,0);
});

test('Replacing the source during mode admission cannot attach old mode to the new life',()=>{
  const f=make();let entered=false;
  f.b.on('beforeBuff',c=>{if(!entered&&c.buff.key==='ju_s_2[switch]'){entered=true;f.u.deploySeq++;}});
  cast(f);advance(f.b,1);assert.equal(f.u.findBuff('ju_s_2[switch]'),null);assert.equal(f.controller.stopped,true);
  near(f.u.s.atk,f.record.stats.atk);assert.equal(f.extra.handles.length,0);
});

test('A foreign mode is not adopted, boosted, or removed by the selected controller',()=>{
  const f=make(),foreign=f.b.addBuff(f.u,{key:'ju_s_2[switch]',source:{}});cast(f);advance(f.b,1);
  assert.equal(f.controller.mode,false);near(f.u.s.atk,f.record.stats.atk);f.controller.clearMode();
  assert.equal(f.u.findBuff('ju_s_2[switch]'),foreign);assert.notEqual(foreign.data?.juMode,f.controller);
});

test('Born S2 transport retains the old recipient life after target replacement',()=>{
  const f=make(),e=target(f);cast(f);phase(f);airborne(f);e.deploySeq++;advance(f.b,.4);
  assert.equal(hits(f).length,0);assert.equal(f.controller.flights.size,0);assert.equal(f.controller.watchers.length,0);
});

test('Battle end clears pending S2 arrows and every source/target watcher',()=>{
  const f=make();target(f,{ratio:.4});cast(f);phase(f);airborne(f);f.b.finished=true;f.b.emit('battleEnd',{});
  assert.equal(f.controller.flights.size,0);assert.equal(f.controller.watchers.length,0);assert.equal(f.extra.pending.size,0);
  assert.equal(f.extra.watchers.length,0);assert.equal(f.extra.handles.length,0);assert.equal(f.wounds.watchers.length,0);
});

test('The original uninterruptible Begin completes through temporary control without a stale attack',()=>{
  const f=make();target(f);cast(f);advance(f.b,.2);f.b.applyStatus(f.u,'stun',{duration:1});
  mode(f);assert.equal(f.u.canAct,false);assert.equal(f.u.skill.active,true);assert.equal(f.receipts.length,0);
  until(f,()=>hits(f).length===1);assert.equal(f.controller.mode,true);
});
