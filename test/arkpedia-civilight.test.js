// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
const ID='char_4134_cetsyr', ALLY='char_208_melan';
const near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps,`${a} != ${z}`);
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function make({skill=0,rank=10,elite=2,potential=1,trust=0,allyId=ALLY}={}){
  const d=structuredClone(data),op=d.operators[ID];
  d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
  d.stage.geometry.rows=19;d.stage.geometry.cols=21;
  d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
  const build={...defaultBuild(op),elite,potential,trust,level:op.phases[elite].maxLevel,
    skillId:op.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
  const b=new StandardBattle(d,{operators:[build,defaultBuild(d.operators[allyId])]});
  b.autoFinish=false;b.recordEvents=true;b.setViewport('fullscreen-workspace');
  b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
  b.addDp('arkpedia',99);const u=b.deployOperator(ID,5,5,'RIGHT');u.skill.rule='NEVER';
  const ally=(row=5,col=6)=>{b.addDp('arkpedia',99);const a=b.deployOperator(allyId,row,col,'RIGHT');
    a.atkCd=10000;a.skill.rule='NEVER';return a;};
  const activate=()=>{u.skill.setSpTotal(u.skill.spCost);
    if(skill===0){u.skill.rule='SP_FULL';advance(b,b.dt);assert.equal(u.skill.active,true);}
    else assert.equal(b.activateOperator(ID),true);};
  const receipts=[];b.on('damaged',c=>receipts.push(c));
  return {b,u,ally,activate,receipts,build};
}
function enemy(b,{x=6.15,y=5,fly=false,free=false,stealth=false,invulnerable=false}={}){
  const e=b.spawnEnemy('enemy_1007_slime',{pos:[y,x]});
  Object.assign(e.base,{maxHp:100000,def:10000,res:95,moveSpeed:0});e.markDirty();void e.s;e.hp=100000;
  e.x=x;e.y=y;if(fly)e.motion='FLY';
  b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true,untargetable:free,stealth,invulnerable}});
  b._buildEnemyIndex();return e;
}
const mark=(u,a)=>a.findBuff(`cetsyr:mark:${u.id}`);
test('all thirty selected ranks retain SP, mode, regeneration and Inspiration values',()=>{
  for(const skill of [0,1,2])for(let rank=1;rank<=10;rank++){
    const {b,u,ally,activate}=make({skill,rank}),a=ally(5,7),source=data.operators[ID].skills[skill].levels[rank-1];
    assert.equal(u.skill.spCost,source.spData.spCost);assert.equal(u.skill.spTotal,source.spData.initSp);
    const atk=a.s.atk,hp=a.s.maxHp,e=skill===1?enemy(b):null;a.hp=10;activate();
    if(skill===0){assert.equal(u.skill.kind,'toggle');assert.equal(u.mem.cetsyrOrbit.cooldown,3);}
    if(skill===1)near(a.s.atk,atk+u.s.atk*u.skill.bb['attack@atk']);
    if(skill===2){near(a.s.maxHp,hp+u.s.maxHp*u.skill.bb.max_hp);near(u.s.maxHp,u.base.maxHp);}
    if(e){advance(b,b.dt);near(e.hp,100000-u.s.atk*u.skill.bb.atk_scale);}
    a.hp=100;u.hp=100;advance(b,1.034);
    const ratio=skill===1?.1:u.skill.bb['attack@atk_to_hp_recovery_ratio'];
    near(a.hp,100+u.s.atk*ratio);near(u.hp,100+u.s.atk*ratio);
    assert.deepEqual(b.errors,[]);
  }
});
test('promotion, trust and potential use original stats, trait multiplier and E2-only resistance',()=>{
  for(const elite of [0,1,2]){
    const {u}=make({elite});near(u.mem.cetsyrOrbit.radius,1.15);
    near(u.def.talents[0].bb['attack@trait_mul'],elite?1.5:1.2);
    assert.equal(u.def.talents.some(t=>t.bb.damage_resistance!=null),elite===2);
  }
  const {u,b}=make({potential:6,trust:200});near(u.s.maxHp,1928);near(u.s.atk,399);
  near(b.data.getChess(ID).stats.cost,7);near(b.data.getChess(ID).stats.respawnTime,70);
  near(u.def.talents[1].bb.damage_resistance,.15);
});
test('ordinary particles orbit counterclockwise at source radius with even spacing and no ordinary attacks',()=>{
  const {b,u}=make(),o=u.mem.cetsyrOrbit,e=enemy(b,{x:5,y:5});
  assert.equal(o.particles.length,3);near(o.speed,Math.PI/6);
  for(const p of o.particles)near(Math.hypot(p.x-u.x,p.y-u.y),1.15);
  advance(b,3);near(o.angle,Math.PI/2);near(o.particles[0].x,u.x);near(o.particles[0].y,u.y-1.15);
  near(e.hp,100000);near(u.stats.dmg,0);assert.equal(b.projectiles.list.length,0);
  assert.equal(b.civilightParticles.length,3);assert.equal(b.deployedSlots(),1);
});
test('collision consumes one particle, marks only its recipient and recovers that slot independently after six seconds',()=>{
  const {b,u,ally}=make(),a=ally(),o=u.mem.cetsyrOrbit;a.hp=100;
  advance(b,.1);assert.ok(mark(u,a));assert.equal(o.particles.filter(p=>p.alive).length,2);
  assert.equal(o.particles[0].readyAt,6);near(a.hp,100);
  advance(b,.8);near(a.hp,100);advance(b,.134);near(a.hp,100+u.s.atk*.1*1.5);
  advance(b,4.8);assert.equal(o.particles[0].alive,false);
  advance(b,.2);assert.equal(o.particles[0].alive,true);assert.equal(mark(u,a),null);
  assert.equal(o.particles.filter(p=>p.alive).length,3);
});
test('regeneration uses live ATK, self recovery, no-heal exceptions and only the same producer mark',()=>{
  const {b,u,ally}=make(),a=ally(5,7);a.hp=100;u.hp=100;
  b.addBuff(a,{key:'test:no-heal',flags:{healFree:true,noHeal:true,untargetable:true},
    mods:{healingTakenMul:.01,hpRegenMul:2}});
  b.addBuff(a,{key:'cetsyr:mark:other-owner',duration:100});
  advance(b,1.034);near(a.hp,100+u.s.atk*.1*2);near(u.hp,100+u.s.atk*.1);
  b.addBuff(u,{key:'external-atk',mods:{atkFlat:100}});const hp=a.hp;
  advance(b,1);near(a.hp,hp+u.s.atk*.1*2);
  b.addBuff(a,{key:'isolate',flags:{isolated:true}});const stopped=a.hp;advance(b,2);near(a.hp,stopped);
});
test('permanent S1 naturally auto activates without a victim, refreshes particles and stops SP recovery',()=>{
  const {b,u,ally}=make(),a=ally();u.skill.rule='SP_FULL';
  advance(b,65.2);assert.equal(u.skill.active,true);assert.equal(u.skill.kind,'toggle');assert.equal(u.skill.timeLeft,Infinity);
  near(u.mem.cetsyrOrbit.cooldown,3);const sp=u.skill.spTotal;advance(b,90);assert.equal(u.skill.active,true);near(u.skill.spTotal,sp);
  a.hp=10;advance(b,1);assert.ok(a.hp>=10+u.s.atk*.35-1e-5);assert.equal(u.stats.dmg,0);
});
test('S2 fills six particles, expands gradually, applies True damage and Bind to ground/air without sight',()=>{
  for(const fly of [false,true]){
    const {b,u,activate,receipts}=make({skill:1}),e=enemy(b,{fly,stealth:true}),center=enemy(b,{x:5,y:5});
    activate();const o=u.mem.cetsyrOrbit;assert.equal(o.particles.length,6);near(o.radius,1.15);near(o.speed,.9);
    advance(b,b.dt);near(e.hp,100000-u.s.atk*2.75);near(center.hp,100000);
    assert.equal(e.s.flags.bind,true);near(e.findBuff('bind').timeLeft,3.5);
    assert.equal(receipts.filter(r=>r.target===e).length,1);assert.equal(o.particles.filter(p=>p.alive).length,5);
    advance(b,3);near(o.radius,2);assert.equal(b.projectiles.list.length,0);
  }
});
test('S2 collision rejects target-free units, can Bind damage-immune units and follows the live ATK multiplier',()=>{
  const {b,u,activate}=make({skill:1}),free=enemy(b,{free:true}),immune=enemy(b,{invulnerable:true});
  activate();advance(b,.1);near(free.hp,100000);assert.equal(!!free.s.flags.bind,false);
  near(immune.hp,100000);assert.equal(immune.s.flags.bind,true);
  const e=enemy(b,{x:5+Math.cos(Math.PI/3)*1.2,y:5-Math.sin(Math.PI/3)*1.2});
  b.addBuff(u,{key:'scale',mods:{atkFlat:100,atkScaleMul:1.5}});advance(b,.1);
  near(e.hp,100000-u.s.atk*u.s.atkScaleMul*2.75);
});
test('S2 output Bind applies to other issued HP damage and preserves native status resistance/immunity',()=>{
  const {b,u,activate}=make({skill:1}),e=enemy(b,{x:15}),immune=enemy(b,{x:16});
  b.on('beforeBuff',c=>{if(c.unit===immune && c.buff.flags?.bind)c.cancel=true;});
  b.applyStatus(e,'resist',{duration:100,value:.5});activate();
  b.dealDamage(u,e,{amount:1,type:'arts'});assert.equal(e.s.flags.bind,true);near(e.findBuff('bind').timeLeft,1.75);
  b.dealDamage(u,immune,{amount:1,type:'true'});assert.equal(!!immune.s.flags.bind,false);
  u.skill.end();b.removeBuff(e,'bind');b.dealDamage(u,e,{amount:1,type:'true'});assert.equal(!!e.s.flags.bind,false);
});
test('S2 finish replaces every particle, shrinks to radius one and keeps the original speed reset quirk',()=>{
  const {b,u,activate}=make({skill:1});activate();advance(b,3);
  u.skill.end();const o=u.mem.cetsyrOrbit;
  near(o.speed,1);near(o.finalRadius,1);assert.equal(o.particles.length,3);
  assert.ok(o.particles.every(p=>p.alive));advance(b,3.5);near(o.radius,1);
  activate();assert.equal(o.particles.length,6);near(o.speed,.9);advance(b,3.5);near(o.radius,2);
});
test('S2 Inspiration updates live owner ATK, ignores bards and loses effects immediately on exit/end',()=>{
  const {b,u,ally,activate}=make({skill:1}),a=ally();const base=a.s.atk;
  activate();near(a.s.atk,base+u.s.atk);near(u.s.atk,u.base.atk);
  b.addBuff(u,{key:'atk',mods:{atkFlat:100}});advance(b,1.034);near(a.s.atk,base+u.s.atk);
  b.addBuff(a,{key:'immune_to_encourage'});advance(b,.1);near(a.s.atk,base);
  b.removeBuff(a,'immune_to_encourage');advance(b,.1);near(a.s.atk,base+u.s.atk);
  a.x=15;advance(b,.1);near(a.s.atk,base);a.x=6;advance(b,.1);near(a.s.atk,base+u.s.atk);
  u.skill.end();near(a.s.atk,base);
});
test('S3 particle collisions retain all particles and marks expire without being refreshed on every overlap',()=>{
  const {b,u,ally,activate}=make({skill:2}),a=ally();activate();advance(b,.1);
  assert.ok(mark(u,a));assert.equal(u.mem.cetsyrOrbit.particles.filter(p=>p.alive).length,3);
  const remaining=mark(u,a).timeLeft;advance(b,.1);assert.ok(mark(u,a).timeLeft<remaining);
  advance(b,6);assert.equal(u.mem.cetsyrOrbit.particles.filter(p=>p.alive).length,3);
});
test('S3 redistributes weighted HP, includes self and bypasses heal/damage/shield/SP receipts on a two-second clock',()=>{
  const {b,u,ally,activate,receipts}=make({skill:2}),a=ally(6,7);
  b.addBuff(u,{key:'zero-atk',mods:{atkFlat:-u.base.atk}});
  const base=a.s.maxHp;u.hp=u.s.maxHp*.8;a.hp=base*.2;
  activate();const maxA=a.s.maxHp,expected=(u.s.maxHp*.8+maxA*.2)/(u.s.maxHp+maxA);
  near(u.hp/u.s.maxHp,expected);near(a.hp/a.s.maxHp,expected);
  b.addBuff(a,{key:'immune',flags:{healFree:true,noHeal:true,invulnerable:true},shield:999});
  let heals=0;b.on('heal',()=>heals++);u.hp=u.s.maxHp*.9;a.hp=a.s.maxHp*.1;
  advance(b,1.9);near(u.hp/u.s.maxHp,.9);near(a.hp/a.s.maxHp,.1);
  const total=u.hp+a.hp;advance(b,.134);
  near(u.hp+a.hp,total);near(u.hp/u.s.maxHp,total/(u.s.maxHp+a.s.maxHp));near(a.hp/a.s.maxHp,u.hp/u.s.maxHp);
  assert.equal(heals,0);assert.equal(receipts.length,0);near(a.findBuff('immune').shield,999);
  assert.equal(u.stats.heal,0);assert.equal(u.skill.spTotal,0);
});
test('S3 range includes its cardinal extension while excluding outside/isolated recipients and restores it on finish',()=>{
  const {b,u,ally,activate}=make({skill:2}),a=ally(6,7);const base=a.s.maxHp;
  advance(b,.1);near(a.s.maxHp,base);activate();near(a.s.maxHp,base+u.s.maxHp);
  b.addBuff(a,{key:'isolate',flags:{isolated:true}});u.hp=100;a.hp=1000;
  b.addBuff(u,{key:'zero-atk',mods:{atkFlat:-u.base.atk}});advance(b,2.1);near(a.hp,1000);
  u.skill.end();near(a.s.maxHp,base);advance(b,.1);assert.equal(a.findBuff(`cetsyr:heal:${u.id}`),null);
});
test('Sarkaz resistance follows the actual source, promotion and potential, applies globally and disappears on retreat',()=>{
  for(const elite of [1,2])for(const potential of [1,5]){
    const {b,u,ally}=make({elite,potential}),a=ally(5,12),e=enemy(b,{x:15});e.tags.add('sarkaz');
    const hp=a.hp;const ratio=elite===1?0:potential===5?.15:.1;
    near(b.dealDamage(e,a,{amount:100,type:'true'}),100*(1-ratio));near(a.hp,hp-100*(1-ratio));
    near(b.dealDamage(null,a,{amount:100,type:'true'}),100);b.retreat(u);
    near(b.dealDamage(e,a,{amount:100,type:'true'}),100);
  }
});
test('native Begin/Loop/End clips do not fabricate attacks and interrupted transition callbacks cannot restart a skill',()=>{
  const {b,u,activate}=make({skill:1});activate();assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Begin');
  advance(b,1.034);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Loop');
  u.skill.end();assert.equal(u.mem.regularFormVisual.clip,'Skill_2_End');advance(b,1.034);assert.equal(u.mem.regularFormVisual,null);
  activate();b.retreat(u);advance(b,2);assert.equal(u.mem.regularFormVisual,null);
  assert.equal(b.civilightParticles.length,0);
});
test('withdrawal clears aura/marks/pending collisions and a new deployment owns fresh particle clocks',()=>{
  const {b,u,ally,activate}=make({skill:1}),a=ally(),e=enemy(b);const base=a.s.atk;
  advance(b,.1);assert.ok(mark(u,a));activate();advance(b,.1);b.retreat(u);
  assert.equal(mark(u,a),null);near(a.s.atk,base);assert.equal(b.civilightParticles.length,0);
  const hp=e.hp;advance(b,10);near(e.hp,hp);
  advance(b,71);b.addDp('arkpedia',99);const next=b.deployOperator(ID,5,5,'LEFT');
  assert.notEqual(next.id,u.id);assert.equal(next.mem.cetsyrOrbit.particles.length,3);
  near(next.mem.cetsyrOrbit.speed,Math.PI/6);near(next.mem.cetsyrOrbit.radius,1.15);
});
test('Inspiration uses the strongest percentage per stat rather than final value, with fallback after skill finish',()=>{
  for(const skill of [1,2]){
    const {b,u,ally,activate}=make({skill}),a=ally(5,7),stat=skill===1?'atkFinalFlat':'hpFinalFlat';
    const base=skill===1?a.s.atk:a.s.maxHp,field=skill===1?'atk':'maxHp';activate();
    b.addBuff(a,{key:'weaker',tags:['inspire'],mods:{[stat]:10000},data:{inspirePriority:{[stat]:.5}}});
    near(a.s[field],base+u.s[field]);
    b.addBuff(a,{key:'stronger',tags:['inspire'],mods:{[stat]:10},data:{inspirePriority:{[stat]:1.1}}});
    near(a.s[field],base+10);b.removeBuff(a,'stronger');near(a.s[field],base+u.s[field]);
    u.skill.end();near(a.s[field],base+10000);
  }
});
test('S3 does not conserve fractional averages by mistake and never turns redistribution into a damage event',()=>{
  const {b,u,ally,activate,receipts}=make({skill:2}),a=ally();activate();
  b.addBuff(u,{key:'zero-atk',mods:{atkFlat:-u.base.atk}});u.hp=u.s.maxHp*.99;a.hp=1;
  const total=u.hp+a.hp,max=u.s.maxHp+a.s.maxHp,ratio=total/max;
  assert.ok(Math.abs(ratio-(.99+1/a.s.maxHp)/2)>.05);
  advance(b,2.034);near(u.hp,total*u.s.maxHp/max);near(a.hp,total*a.s.maxHp/max);
  assert.equal(receipts.length,0);assert.equal(a.alive,true);assert.equal(u.alive,true);
});
test('battle end removes only Civilight particle visuals and clears owned aura effects',()=>{
  const {b,u,ally,activate}=make({skill:1}),a=ally(),base=a.s.atk;
  activate();assert.equal(b.civilightParticles.length,6);
  const other={owner:{},x:1,y:2};b.civilightParticles.push(other);
  b.emit('battleEnd',{result:{}});assert.deepEqual(b.civilightParticles,[other]);
  near(a.s.atk,base);assert.equal(u.mem.cetsyrOrbit.particles.length,0);
});
