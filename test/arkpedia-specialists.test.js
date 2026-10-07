// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
import { PUSH_TILES, PULL_STOP_RADIUS, PULL_CRAWL } from '../server/sim/constants.js';

const near = (a,b) => assert.ok(Math.abs(a-b)<1e-6, `${a} != ${b}`);
function advance(b,seconds) {
  for(let i=0;i<Math.round(seconds/b.dt);i++)b.step();
  assert.deepEqual(b.errors,[]);
}
function make(id,{skill=0,rank=10,elite=2,level=70,potential=1,enemies=0,companions=[]}={}) {
  const source=structuredClone(data);
  source.stage.geometry.waves[0].spawns=enemies
    ?[{enemy_id:'enemy_1007_slime',count:enemies,time:0,interval:0,route:1}]:[];
  Object.assign(source.enemies.enemy_1007_slime.stats,{maxHp:100000,atk:100,def:0,magicResistance:0,moveSpeed:0});
  const op=source.operators[id];
  const build={...defaultBuild(op),skillId:op.skills[skill].id,skillRank:rank,elite,level,potential};
  const b=new StandardBattle(source,{operators:[build,...companions.map(id=>defaultBuild(source.operators[id]))]});
  b.autoFinish=false;b.setViewport('fullscreen-workspace');
  return{b,source,build};
}
function deploy(b,id,row=3,col=3,dir='RIGHT') {
  b.addDp('arkpedia',99);const u=b.deployOperator(id,row,col,dir);u.atkCd=1000;return u;
}
function activate(b,u) {u.skill.gainSp(u.skill.spCost,'test');assert.equal(u.skill.activate('test'),true);}
function pin(b,positions) {
  b.step();b.enemies.forEach((e,i)=>{
    b.addBuff(e,{key:'test:pin',persist:true,flags:{noMove:true,disarm:true}});
    [e.x,e.y]=positions?.[i]??[6,3];e.base.massLevel=0;e.markDirty();
  });b.step();
}
const bbAt=(source,id,skill,rank)=>Object.fromEntries(source.operators[id].skills[skill].levels[rank-1].blackboard.map(v=>[v.key,v.value]));

test('Gravel S1 deploys full source DEF, decays each source interval, expires and resets on redeployment at every rank',()=>{
  const id='char_237_gravel';
  for(let rank=1;rank<=10;rank++) {
    const{b,source}=make(id,{rank});const u=deploy(b,id);const bb=bbAt(source,id,0,rank);
    const base=u.base.def*1.06;
    near(u.s.def,base+u.base.def*bb.def);assert.equal(u.skill.kind,'passive');assert.equal(u.skill.ready,false);
    advance(b,2);near(u.s.def,base+u.base.def*bb.def*(1-2/bb.duration));
    advance(b,bb.duration-2+.1);near(u.s.def,base);
    b.retreatOperator(id);advance(b,18+.1);
    const next=deploy(b,id);near(next.s.def,next.base.def*(1.06+bb.def));
    assert.equal(next.buffs.filter(v=>v.key==='gravel:defense').length,1);
  }
});

test('Gravel S2 absorbs HP damage after mitigation, loses only remaining shield on source decay, and expires at ten seconds',()=>{
  const id='char_237_gravel';
  for(const rank of [1,7,10]) {
    const{b,source}=make(id,{skill:1,rank,enemies:1});const u=deploy(b,id);pin(b);
    const e=b.enemies[0],total=u.s.maxHp*bbAt(source,id,1,rank).hp_ratio,initial=u.hp;
    const shield=u.findBuff('gravel:barrier');near(shield.shield,total);
    near(b.dealDamage(e,u,{amount:50,type:'true'}),0);near(u.hp,initial);near(shield.shield,total-50);
    advance(b,5);near(shield.shield,total*.5-50);
    advance(b,5.1);assert.equal(u.findBuff('gravel:barrier'),null);near(u.hp,initial);
    b.dealDamage(e,u,{amount:50,type:'true'});near(u.hp,initial-50);
  }
});

test('Gravel S1 decay remains in the direct percentage bucket with her aura and other DEF bonuses, before final scalers',()=>{
  const id='char_237_gravel', {b}=make(id), u=deploy(b,id);
  b.addBuff(u,{key:'test:defense',mods:{defFlat:20,defPct:.5,defMul:.8}});
  near(u.s.def,(u.base.def+20)*(1+.06+.5+4)*.8);
  advance(b,3);near(u.s.def,(u.base.def+20)*(1+.06+.5+4*.75)*.8);
  advance(b,9.1);near(u.s.def,(u.base.def+20)*(1+.06+.5)*.8);
});

test('Gravel S2 removes its shield buff as soon as damage or source decay empties it, before the ten-second cap',()=>{
  const id='char_237_gravel';
  for(const decay of[false,true]) {
    const{b}=make(id,{skill:1,enemies:1}),u=deploy(b,id);pin(b);
    const total=u.findBuff('gravel:barrier').shield,hp=u.hp;
    b.dealDamage(b.enemies[0],u,{amount:decay?total*.6:total+50,type:'true'});
    if(decay){advance(b,4.1);near(u.hp,hp);}
    else near(u.hp,hp-50);
    assert.equal(u.findBuff('gravel:barrier'),null);
  }
});

test('Gravel talent lowers only own cost and buffs deployed low-cost allies globally, including late/redeployed allies, with death cleanup',()=>{
  const id='char_237_gravel';
  for(const[elite,level,potential,bonus]of[[1,60,1,0],[2,70,1,.06],[2,70,5,.08]]) {
    const{b,source,build}=make(id,{skill:1,elite,level,potential,rank:7,companions:['char_123_fang','char_122_beagle','char_502_nblade']});
    const fang=deploy(b,'char_123_fang',2,7),expensive=deploy(b,'char_122_beagle',3,7);
    const a=fang.s.def,z=expensive.s.def;assert.ok(fang.base.cost<=10);assert.ok(expensive.base.cost>10);
    const u=deploy(b,id);near(fang.s.def,a+fang.base.def*bonus);near(expensive.s.def,z);
    assert.equal(recordFor(build,source).arkpedia.modifiers.defPct,undefined);
    const cheap=deploy(b,'char_502_nblade',2,6);near(cheap.s.def,cheap.base.def*(1+bonus));
    b.retreatOperator('char_123_fang');advance(b,70);assert.ok(b.cost('char_123_fang')>10);
    const next=deploy(b,'char_123_fang',2,7);near(next.s.def,a+next.base.def*bonus);
    b.kill(u,null);near(next.s.def,a);near(expensive.s.def,z);near(cheap.s.def,cheap.base.def);
  }
});

test('Gravel splits full-ATK mitigated output into two half-damage events, preserving armored/minimum damage and granting target SP only once',()=>{
  for(const defense of[100,1000]) {
    const id='char_237_gravel';const{b}=make(id,{enemies:1});const u=deploy(b,id);pin(b);
    const e=b.enemies[0];e.base.def=defense;e.markDirty();const hp=e.hp,hits=[];
    b.on('damaged',ctx=>{if(ctx.source===u&&ctx.target===e)hits.push(ctx);});
    b.forceAttack(u,[e]);const total=Math.max(u.s.atk-defense,u.s.atk*.05);
    near(hp-e.hp,total);assert.equal(hits.length,2);
    near(hits[0].amount,total*.5);near(hits[1].amount,total*.5);
    assert.equal(hits[0].dmg.noSp,false);assert.equal(hits[1].dmg.noSp,true);
  }
});

test('Ethan attacks every selectable ground enemy in range, never blocks, and retains 50% Physical/Arts dodge and lower taunt',()=>{
  const id='char_355_ethan';const{b}=make(id,{enemies:4});const u=deploy(b,id);pin(b,[[3,3],[4,3],[3,2],[4,4]]);
  const flying=b.enemies[3];flying.motion='FLY';
  const targets=acquireTargets(b,u,effectiveProfile(u));assert.equal(targets.length,3);
  assert.equal(targets.includes(flying),false);assert.equal(u.s.blockCnt,0);
  near(u.s.dodgePhys,.5);near(u.s.dodgeArts,.5);near(u.s.taunt,-1);
  b.rng.chance=()=>false;const hp=b.enemies.map(e=>e.hp);b.forceAttack(u,targets);
  assert.equal(b.enemies.filter((e,i)=>e.hp<hp[i]).length,3);
  assert.equal(u.blocking.length,0);
});

test('Ethan Bind rolls separately per hit, uses source promotion duration and only S2 probability scales, then expires',()=>{
  const id='char_355_ethan';
  for(const[elite,level,duration]of[[0,45,0],[1,60,2],[2,70,3]]) {
    const{b}=make(id,{skill:elite?1:0,elite,level,rank:4,enemies:2});const u=deploy(b,id);pin(b,[[3,3],[4,3]]);
    let rolls=0;b.rng.chance=p=>{near(p,.25);return ++rolls===1;};
    b.forceAttack(u,b.enemies);assert.equal(Boolean(b.enemies[0].s.flags.bind),!!duration);
    assert.equal(Boolean(b.enemies[1].s.flags.bind),false);assert.equal(rolls,duration?2:0);
    if(duration){advance(b,duration+.1);assert.equal(Boolean(b.enemies[0].s.flags.bind),false);}
  }
  for(const rank of[1,7,10]) {
    const{b,source}=make(id,{skill:1,rank,enemies:2});const u=deploy(b,id);pin(b,[[3,3],[4,3]]);
    const bb=bbAt(source,id,1,rank);let rolls=0;b.rng.chance=p=>{near(p,.25*bb.talent_scale);rolls++;return true;};
    activate(b,u);near(u.s.atk,u.base.atk*(1+bb.atk));b.forceAttack(u,b.enemies);assert.equal(rolls,2);
    assert.ok(b.enemies.every(e=>e.findBuff('bind').duration===3));
    advance(b,source.operators[id].skills[1].levels[rank-1].duration+.1);near(u.s.atk,u.base.atk);
  }
});

test('Ethan S1 DoT begins after one second, applies fixed sourceless Arts rather than ATK, refreshes one instance, and survives retreat',()=>{
  const id='char_355_ethan';
  for(const rank of[1,7,10]) {
    const{b,source}=make(id,{rank,enemies:1});const u=deploy(b,id);pin(b,[[3,3]]);
    const e=b.enemies[0],bb=bbAt(source,id,0,rank);e.base.res=50;e.markDirty();b.rng.chance=()=>false;
    b.addBuff(u,{key:'test:damage',mods:{atkPct:2,dmgDealtMul:4}});
    b.forceAttack(u,[e]);const hp=e.hp;advance(b,.5);near(e.hp,hp);
    b.forceAttack(u,[e]);const refreshed=e.hp;assert.equal(e.buffs.filter(v=>v.key==='ethan:poison').length,1);
    advance(b,.5);near(refreshed-e.hp,bb['attack@poison_damage']*.5);
    let hits=0;b.on('hit',ctx=>{if(ctx.dmg.tags.includes('ethan:poison')){assert.equal(ctx.source,null);hits++;}});
    b.retreatOperator(id);const after=e.hp;advance(b,bb['attack@duration']);
    assert.ok(e.hp<after);assert.ok(hits>0);assert.equal(e.findBuff('ethan:poison'),null);
  }
});

test('Shaw and Rope can deploy on high ground while other melee operators still cannot',()=>{
  for(const id of['char_277_sqrrel','char_236_rope']) {
    const{b}=make(id,{enemies:1,companions:['char_208_melan']});b.addDp('arkpedia',99);
    assert.equal(b.placementError(id,1,7),null);
    assert.match(b.placementError('char_208_melan',1,7),/melee tile/i);
    const u=deploy(b,id,1,7);assert.equal(u.ground,false);pin(b,[[7,1]]);
    assert.equal(u.blocking.length,0);assert.equal(b.enemies[0].blockedBy,null);
  }
});

test('Shaw RES talent uses source flat values and normal/S1 targets are capped by current block count',()=>{
  const id='char_277_sqrrel';
  for(const[elite,level,res]of[[0,45,0],[1,60,7],[2,70,15]]) {
    const{b}=make(id,{elite,level,rank:4,enemies:3});const u=deploy(b,id);pin(b,[[3.6,3],[3.7,3],[3.8,3]]);
    near(u.s.res,u.base.res+res);assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,2);
    b.addBuff(u,{key:'test:block',mods:{blockCnt:-1}});
    assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,1);
  }
});

test('Shaw S1 source force moves light enemies by the correct projectile push distance, heavy/immune enemies resist, and damage scales at every rank',()=>{
  const id='char_277_sqrrel';
  for(let rank=1;rank<=10;rank++) {
    const{b,source}=make(id,{rank,enemies:3});const u=deploy(b,id);pin(b,[[3.6,3],[3.7,3],[3.8,3]]);
    const[light,heavy,immune]=b.enemies,bb=bbAt(source,id,0,rank);
    heavy.base.massLevel=bb.force+3;heavy.markDirty();b.addBuff(immune,{key:'test:immune',flags:{noDisplace:true}});
    activate(b,u);const hp=b.enemies.map(e=>e.hp);b.forceAttack(u,b.enemies);
    near(light.x,3.6);near(light.hp,hp[0]);advance(b,.2);
    near(light.x,3.6+PUSH_TILES[bb.force]);near(heavy.x,3.7);near(immune.x,3.8);
    for(let i=0;i<3;i++)near(hp[i]-b.enemies[i].hp,u.s.atk*bb.atk_scale);
    assert.equal(u.skill.active,false);
  }
});

test('Shaw directional push applies the off-angle/near-source force penalty and stops at walls',()=>{
  const id='char_277_sqrrel';const{b}=make(id,{enemies:3});const u=deploy(b,id,3,5);pin(b,[[4.4,3],[5.1,3],[7.2,3]]);
  activate(b,u);const[side,nearby,wall]=b.enemies;b.forceAttack(u,b.enemies);advance(b,.3);
  near(side.x,4.4-1.7);near(side.y,3);near(nearby.x,5.1+1.7);
  assert.ok(wall.x<7.5);assert.ok(wall.x>=7.2);
});

test('Shaw S2 launches immediately onto all ground enemies on its two frontal source tiles and deals damage/push on source-speed impact',()=>{
  const id='char_277_sqrrel';const{b}=make(id,{skill:1,enemies:4});const u=deploy(b,id);
  pin(b,[[3.6,3],[4.2,3],[5.3,3],[6.2,3]]);const hp=b.enemies.map(e=>e.hp);
  activate(b,u);assert.equal(u.skill.active,false);
  for(let i=0;i<4;i++)near(b.enemies[i].hp,hp[i]);advance(b,.3);
  for(let i=0;i<3;i++)near(hp[i]-b.enemies[i].hp,u.s.atk*3);
  near(b.enemies[3].hp,hp[3]);assert.equal(u.stats.attacks,0);
});

test('Rope physical dodge follows source promotion/potential and does not apply to Arts',()=>{
  const id='char_236_rope';
  for(const[elite,level,potential,chance]of[[0,45,1,0],[1,60,1,.15],[1,60,5,.19],[2,70,1,.3],[2,70,5,.34]]) {
    const{b}=make(id,{elite,level,potential,rank:4});const u=deploy(b,id);
    near(u.s.dodgePhys,chance);near(u.s.dodgeArts,0);
  }
});

test('Rope S1 damages on hook impact and source force pulls to front or only partway for heavier enemies',()=>{
  const id='char_236_rope';
  for(const rank of[1,7,10]) for(const extra of[0,1,2,3]) {
    const{b,source}=make(id,{rank,enemies:1});const u=deploy(b,id);pin(b);
    const e=b.enemies[0],bb=bbAt(source,id,0,rank);e.base.massLevel=bb.force+extra;e.markDirty();
    const hp=e.hp;activate(b,u);b.forceAttack(u,[e]);near(e.hp,hp);near(e.x,6);
    advance(b,.4);near(hp-e.hp,u.s.atk*bb.atk_scale);
    const expected=extra===0?3+PULL_STOP_RADIUS:extra===1?6-(6-3.5)*.35:extra===2?6-PULL_CRAWL:6;
    near(e.x,expected);assert.equal(u.skill.active,false);
  }
});

test('Rope S2 selects only two enemies in extended range, starts their hooks on activation, and spends a targetless cast without leaving a pending skill',()=>{
  const id='char_236_rope';const{b}=make(id,{skill:1,enemies:3});const u=deploy(b,id);pin(b,[[6.4,3],[6.6,3],[6.8,3]]);
  const hp=b.enemies.map(e=>e.hp);activate(b,u);assert.equal(u.stats.attacks,1);assert.equal(u.skill.active,false);
  advance(b,.5);assert.equal(b.enemies.filter((e,i)=>e.hp<hp[i]).length,2);
  assert.ok(b.enemies.filter((e,i)=>e.hp<hp[i]).every(e=>Math.abs(e.x-(3+PULL_STOP_RADIUS))<1e-6));
  const empty=make(id,{skill:1}),v=deploy(empty.b,id);activate(empty.b,v);
  assert.equal(v.skill.pending,false);assert.equal(v.skill.active,false);near(v.skill.sp,0);
});

test('Rope skills lock normal attacks and SP until hook flight, one-second link and one-second post-delay end; a fizzled hook ends after post-delay',()=>{
  const id='char_236_rope';
  for(const skill of[0,1]) {
    const{b}=make(id,{skill,enemies:1});const u=deploy(b,id);pin(b,[[6,3]]);u.atkCd=0;
    activate(b,u);if(skill===0)b.forceAttack(u,[b.enemies[0]]);
    assert.equal(u.stats.attacks,1);assert.equal(u.s.flags.disarm,true);
    advance(b,.4);assert.equal(u.stats.attacks,1);near(u.skill.sp,0);
    advance(b,1.8);assert.equal(u.stats.attacks,1);assert.equal(u.s.flags.disarm,true);near(u.skill.sp,0);
    advance(b,.2);assert.equal(Boolean(u.s.flags.disarm),false);assert.ok(u.stats.attacks>1);
    b.retreatOperator(id);assert.equal(u.findBuff('rope:cast'),null);
  }
  const{b}=make(id,{skill:1,enemies:1});const u=deploy(b,id);pin(b);u.atkCd=0;
  activate(b,u);b.kill(b.enemies[0]);advance(b,.1);assert.equal(u.s.flags.disarm,true);
  advance(b,1.1);assert.equal(Boolean(u.s.flags.disarm),false);assert.equal(u.mem.ropeCast,null);
});
