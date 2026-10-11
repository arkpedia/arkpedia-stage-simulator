// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-support-expansion-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
import { absoluteRangeKeys } from '../server/sim/targeting.js';

const near = (a, b) => assert.ok(Math.abs(a-b) < 1e-6, `${a} != ${b}`);
function advance(b, seconds) {
  for (let i=0; i<Math.round(seconds/b.dt); i++) b.step();
  assert.deepEqual(b.errors, []);
}
function make(id, { skill=0, rank=10, elite=2, level=70, potential=1, enemies=1,
  companions=[] }={}) {
  const source=structuredClone(data), op=source.operators[id];
  assert.ok(op, `${id} must have the reviewed source snapshot`);
  source.stage.geometry.waves[0].spawns=enemies
    ? [{enemy_id:'enemy_1007_slime',count:enemies,time:0,interval:0,route:1}] : [];
  source.stage.battle.dp_per_second=0;
  Object.assign(source.enemies.enemy_1007_slime.stats,
    {maxHp:100000,atk:100,def:0,magicResistance:0,moveSpeed:0});
  const build={...defaultBuild(op), skillId:op.skills[skill].id,skillRank:rank,elite,level,potential};
  const b=new StandardBattle(source,{operators:[build,...companions.map(id=>defaultBuild(source.operators[id]))]});
  b.autoFinish=false; b.setViewport('fullscreen-workspace');
  return {b,source,build};
}
function deploy(b,id,row=3,col=3) {
  b.addDp('arkpedia',99); const u=b.deployOperator(id,row,col,'RIGHT'); u.atkCd=1000;
  u.profile.canAttack=()=>false; return u;
}
function pin(b, positions=null) {
  b.step(); b.enemies.forEach((e,i)=>{
    b.addBuff(e,{key:'test:pin',persist:true,flags:{noMove:true,disarm:true}});
    [e.x,e.y]=positions?.[i]??[4,3];
  }); b.step();
}
function activate(u) {u.skill.gainSp(u.skill.spCost,'test'); assert.equal(u.skill.activate('test'),true);}
const bbAt=(source,id,skill,rank)=>Object.fromEntries(source.operators[id].skills[skill].levels[rank-1].blackboard.map(v=>[v.key,v.value]));

test('reviewed support source evidence pins original templates, model clips, and both exact skills',()=>{
  assert.equal(evidence.tableCommit,'57010cb5b2afea112cae57daa756b58676ba6850');
  assert.equal(evidence.templates.vrdant_s2.eventToActions.ON_OUTPUT_DAMAGE[0]._getMaxHpFromTarget,false);
  assert.equal(evidence.templates.vrdant_s2.eventToActions.ON_OUTPUT_DAMAGE[0]._damageType,'PURE');
  for(const id of['char_272_strong','char_4107_vrdant','char_4165_ctrail']) {
    assert.equal(Object.keys(evidence.operators[id].skills).length,2);
    for(const facing of['Front','Back']) {
      assert.match(evidence.operators[id].models[facing].sha256,/^[a-f0-9]{64}$/);
      assert.ok(evidence.operators[id].models[facing].hits.Attack[0]>0);
    }
  }
});

test('Jaye pays exactly three DP every three seconds, retreats on insufficient DP and receives no voluntary refund',()=>{
  const id='char_272_strong',{b}=make(id,{enemies:0}),u=deploy(b,id);
  b.getPlayer('arkpedia').dp=7;
  advance(b,2.9);near(b.dp,7);advance(b,.2);near(b.dp,4);advance(b,3);near(b.dp,1);
  advance(b,3);assert.equal(u.alive,false);near(b.dp,1);
  advance(b,25);const next=deploy(b,id);b.getPlayer('arkpedia').dp=50;
  b.retreatOperator(id);near(b.dp,50);assert.equal(next.alive,false);
  near(b.bench[id].readyAt-b.time,next.base.respawnTime);
});

test('Jaye S1 activates without a target at exact source SP, applies ATK at all ten ranks and remains active',()=>{
  const id='char_272_strong';
  for(let rank=1;rank<=10;rank++) {
    const{b,source}=make(id,{rank,enemies:0}),u=deploy(b,id),bb=bbAt(source,id,0,rank);
    advance(b,u.skill.spCost-.1);assert.equal(u.skill.active,false);
    advance(b,.2);assert.equal(u.skill.active,true);near(u.s.atk,u.base.atk*(1+bb.atk));
    assert.equal(u.skill.manual,false);assert.equal(u.skill.timeLeft,Infinity);
    advance(b,10);assert.equal(u.skill.active,true);
  }
});

test('Jaye talent uses original infection tags and scales ATK before DEF, with elite/potential unlocks',()=>{
  const id='char_272_strong';
  for(const[elite,level,potential,scale]of[[0,45,1,1],[1,60,1,1.25],[2,70,1,1.45],[2,70,5,1.5]]) {
    const{b}=make(id,{elite,level,potential,rank:4}),u=deploy(b,id);pin(b);
    const e=b.enemies[0];assert.ok(e.def.tags.includes('infection'));e.base.def=100;e.markDirty();
    const hp=e.hp;b.forceAttack(u,[e]);advance(b,.6);near(hp-e.hp,Math.max(u.s.atk*scale-100,u.s.atk*scale*.05));
    e.def={...e.def,tags:[]};const hp2=e.hp;b.forceAttack(u,[e]);advance(b,.6);
    near(hp2-e.hp,Math.max(u.s.atk-100,u.s.atk*.05));
  }
});

test('Jaye S1 silence lands on the source normal hit frame and expires by selected rank duration',()=>{
  const id='char_272_strong';
  for(const rank of[1,7,10]) {
    const{b,source}=make(id,{rank}),u=deploy(b,id);pin(b);activate(u);const e=b.enemies[0];
    b.forceAttack(u,[e]);advance(b,.4);assert.equal(e.findBuff('silence'),null);
    advance(b,.2);assert.ok(e.s.flags.silence);
    advance(b,bbAt(source,id,0,rank)['attack@silence']+.1);assert.equal(!!e.s.flags.silence,false);
  }
});

test('Jaye S2 keeps melee attack range and heals only the lowest-HP-ratio ally with a source speed-five projectile',()=>{
  const id='char_272_strong', {b,source}=make(id,{skill:1,companions:['char_123_fang','char_122_beagle']});
  const u=deploy(b,id),first=deploy(b,'char_123_fang',2,3),second=deploy(b,'char_122_beagle',3,4);
  pin(b);activate(u);b.refreshRange(u);assert.deepEqual(u.liveRangeGrid,u.def.rangeGrid);
  first.hp=first.s.maxHp*.2;second.hp=second.s.maxHp*.6;const before=first.hp,other=second.hp;
  const e=b.enemies[0];e.base.def=u.s.atk*1.45-100;e.markDirty();
  b.forceAttack(u,[e]);advance(b,.55);near(first.hp,before);near(second.hp,other);
  advance(b,.25);near(first.hp-before,100*bbAt(source,id,1,10).scale);near(second.hp,other);
  assert.equal(u.skill.timeLeft,Infinity);
});

test('Jaye S2 healing uses actual HP removed, including overkill and heal-immunity checks',()=>{
  for(const blocked of[false,true]) {
    const{b}=make('char_272_strong',{skill:1}),u=deploy(b,'char_272_strong');pin(b);activate(u);
    const e=b.enemies[0];e.hp=40;u.hp-=500;const before=u.hp;
    if(blocked)b.addBuff(u,{key:'test:noheal',flags:{healFree:true}});
    b.forceAttack(u,[e]);advance(b,.8);near(u.hp-before,blocked?0:20);
  }
});

test('Verdant S1 source max-HP and flat RES apply at every rank and remain through substitute switches',()=>{
  for(let rank=1;rank<=10;rank++) {
    const{b,source}=make('char_4107_vrdant',{rank,enemies:0}),u=deploy(b,'char_4107_vrdant');
    const bb=bbAt(source,'char_4107_vrdant',0,rank),hp=u.base.maxHp*(1+bb.max_hp);
    near(u.s.maxHp,hp);near(u.s.res,u.base.res+bb.magic_resistance);
    b.loseHp(u,hp*2);advance(b,2.1);assert.equal(u.trait.doll,true);
    near(u.s.maxHp,hp);near(u.s.res,u.base.res+bb.magic_resistance);
  }
});

test('Verdant runs the source two-stage switch, clears non-durable buffs and SP, blocks zero and cannot act during it',()=>{
  const{b}=make('char_4107_vrdant',{skill:1}),u=deploy(b,'char_4107_vrdant');pin(b);activate(u);
  b.addBuff(u,{key:'test:external',mods:{atkPct:1}});b.applyStatus(u,'stun',{duration:30});
  b.loseHp(u,u.s.maxHp*2);assert.equal(u.alive,true);assert.equal(u.trait.dollSwitching,true);
  assert.equal(u.skill.active,false);near(u.skill.spTotal,0);assert.equal(u.findBuff('test:external'),null);
  near(u.s.blockCnt,0);near(u.hp,u.s.maxHp);assert.equal(u.mem.regularFormVisual.clip,'SwitchOut');
  assert.equal(b.applyStatus(u,'freeze',{duration:5}),false);
  advance(b,1.1);assert.equal(u.trait.doll,true);assert.equal(u.mem.regularFormVisual.clip,'Doll_SwitchIn');
  assert.equal(u.s.flags.disarm,true);advance(b,1);assert.equal(u.trait.dollSwitching,false);
  assert.equal(u.mem.regularFormVisual.clip,'Doll_Idle');assert.equal(u.s.flags.noSp,true);
});

test('Verdant substitute uses its original surrounding range, physical attacks and HP regeneration only in doll form',()=>{
  const{b,source,build}=make('char_4107_vrdant',{skill:1,enemies:2}),u=deploy(b,'char_4107_vrdant');
  pin(b,[[3,2],[4,3]]);near(u.s.hpRegen,0);b.loseHp(u,u.s.maxHp*2);advance(b,2.1);u.atkCd=1000;
  const raw=recordFor(build,source);assert.deepEqual(u.liveRangeGrid,raw.trait.rangeGrid);
  const e=b.enemies[0];e.base.magicResistance=99;e.markDirty();const hp=e.hp,own=u.hp;
  b.forceAttack(u,[e]);advance(b,.5);near(hp-e.hp,u.s.atk);near(u.hp,own);
  u.hp-=500;b.addBuff(u,{key:'test:heal-free',flags:{healFree:true}});const wounded=u.hp;
  advance(b,1);near(u.hp-wounded,u.s.maxHp*.035);
});

test('Verdant substitute timer starts on its mode entry; original return clears doll state after both source clips',()=>{
  const{b}=make('char_4107_vrdant',{skill:1,enemies:0}),u=deploy(b,'char_4107_vrdant');
  b.loseHp(u,u.s.maxHp*2);advance(b,20.9);assert.equal(u.trait.doll,true);
  advance(b,.2);assert.equal(u.trait.doll,false);assert.equal(u.mem.regularFormVisual.clip,'Doll_SwitchOut');
  near(u.s.hpRegen,0);advance(b,1);assert.equal(u.mem.regularFormVisual.clip,'Start');
  advance(b,1);assert.equal(u.trait.dollSwitching,false);assert.equal(u.mem.regularFormVisual,null);
  near(u.s.blockCnt,2);assert.deepEqual(u.rangeGrid,u.def.rangeGrid);
});

test('Verdant S2 deals Arts, adds exact source ASPD and loses four percent MAX HP per enemy hit',()=>{
  for(const rank of[1,7,10]) {
    const{b,source}=make('char_4107_vrdant',{skill:1,rank}),u=deploy(b,'char_4107_vrdant');pin(b);activate(u);
    const bb=bbAt(source,'char_4107_vrdant',1,rank),e=b.enemies[0];e.base.def=9999;e.base.res=50;e.markDirty();
    near(u.s.aspd,u.base.aspd+bb.attack_speed);const hp=e.hp;u.hp=u.s.maxHp*.5;const own=u.hp;
    b.forceAttack(u,[e]);advance(b,.5);near(hp-e.hp,u.s.atk*.5);near(own-u.hp,u.s.maxHp*.04);
    u.hp=u.s.maxHp*.01;b.forceAttack(u,[e]);advance(b,.5);assert.equal(u.trait.dollSwitching,true);
    assert.equal(u.skill.active,false);assert.equal(u.alive,true);
  }
});

test('Verdant can die as a substitute and a scheduled form return never resurrects a removed deployment',()=>{
  const{b}=make('char_4107_vrdant',{enemies:0}),u=deploy(b,'char_4107_vrdant');
  b.loseHp(u,u.s.maxHp*2);advance(b,2.1);b.loseHp(u,u.s.maxHp*2);
  assert.equal(u.alive,false);advance(b,25);assert.equal(u.alive,false);assert.equal(u.form,null);
});

test('Contrail S1 deploys into source takeoff, applies physical-only dodge and lands after its finite selected duration',()=>{
  for(const rank of[1,7,10]) {
    const{b,source}=make('char_4165_ctrail',{rank,enemies:0}),u=deploy(b,'char_4165_ctrail');
    const bb=bbAt(source,'char_4165_ctrail',0,rank);assert.equal(u.skill.active,true);
    assert.equal(!!u.s.flags.liftoff,false);near(u.s.dodgePhys,bb.prob);near(u.s.dodgeArts,0);
    advance(b,.3);assert.equal(u.s.flags.liftoff,true);assert.equal(u.s.flags.blockFly,true);
    near(u.s.def,u.base.def);advance(b,.8);assert.equal(u.mem.regularFormVisual.clip,'Skill_Idle');
    advance(b,bb.duration-1.1);assert.equal(u.skill.active,false);assert.equal(u.s.flags.liftoff,true);
    advance(b,.9);assert.equal(!!u.s.flags.liftoff,false);near(u.s.def,u.base.def*1.1);
    advance(b,.1);assert.equal(u.mem.regularFormVisual,null);near(u.s.dodgePhys,0);
    assert.deepEqual(u.liveRangeGrid,u.def.skill.rangeGrid,'source default mode 7 retains S1 range');
  }
});

test('Contrail S2 original selector caps ground targets at two, allows three flying, slows only flyers and uses pre-DEF flight talent',()=>{
  for(const flyingCount of[0,1,3]) {
    const{b}=make('char_4165_ctrail',{skill:1,enemies:4}),u=deploy(b,'char_4165_ctrail');
    pin(b,[[4,3],[5,3],[4,2],[4,4]]);for(let i=0;i<flyingCount;i++)b.enemies[i].motion='FLY';
    activate(u);advance(b,1.1);u.atkCd=1000;const hp=b.enemies.map(e=>e.hp);
    const targets=acquireTargets(b,u,effectiveProfile(u));b.forceAttack(u,targets);advance(b,.9);
    const struck=b.enemies.filter((e,i)=>e.hp<hp[i]);assert.equal(struck.length,flyingCount===0?2:3);
    assert.ok(struck.filter(e=>!e.isFlying).length<=2);
    for(const e of struck) {
      near(hp[b.enemies.indexOf(e)]-e.hp,u.s.atk*1.1);
      assert.equal(!!e.s.flags.bind,false);assert.equal(!!e.findBuff('sluggish'),e.isFlying);
    }
  }
});

test('Contrail flight cannot be selected or damaged by ground enemies, but airborne enemies can still hit it',()=>{
  const{b}=make('char_4165_ctrail',{skill:1}),u=deploy(b,'char_4165_ctrail');pin(b);
  const e=b.enemies[0];activate(u);advance(b,.3);const hp=u.hp;
  near(b.dealDamage(e,u,{amount:100,type:'true'}),0);near(u.hp,hp);
  e.motion='FLY';near(b.dealDamage(e,u,{amount:100,type:'true'}),100);near(u.hp,hp-100);
});
