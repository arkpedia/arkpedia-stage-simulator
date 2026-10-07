import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function make(id, { rank=7, potential=1, elite=1, enemies=0 }={}) {
  const source=structuredClone(data);
  source.stage.geometry.waves[0].spawns=enemies ? [{enemy_id:'enemy_1007_slime',count:enemies,time:0,interval:0,route:1}] : [];
  Object.assign(source.enemies.enemy_1007_slime.stats,{maxHp:100000,atk:0,moveSpeed:0});
  const build={...defaultBuild(source.operators[id]),skillRank:rank,potential,elite,level:elite?55:40};
  const b=new StandardBattle(source,{operators:[build]});
  b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
  return {b,build,source};
}
function advance(b,seconds) {
  for(let i=0;i<Math.ceil(seconds/b.dt);i++)b.step();
  assert.deepEqual(b.errors,[]);
}

test('Plume earns exactly one DP per credited kill, with no reward for someone else or a dead victim',()=>{
  const {b}=make('char_192_falco',{enemies:3});
  const u=b.deployOperator('char_192_falco',2,7,'RIGHT');
  b.step();
  const [first,other,last]=b.enemies;
  b.getPlayer('arkpedia').dp=10;
  first.hp=1;b.forceAttack(u,[first]);
  near(b.dp,11);assert.equal(u.stats.kills,1);
  b.kill(first,u);near(b.dp,11);
  b.kill(other,null);near(b.dp,11);
  last.hp=1;b.forceAttack(u,[last]);near(b.dp,12);
  assert.equal(u.stats.kills,2);assert.deepEqual(b.errors,[]);
});

test('Plume refunds original potential-adjusted cost on retreat, including later deployments, but not death',()=>{
  const {b}=make('char_192_falco',{potential:6});
  const id='char_192_falco',original=b.cost(id);
  const u=b.deployOperator(id,2,7,'RIGHT');
  b.getPlayer('arkpedia').dp=0;b.retreatOperator(id);near(b.dp,original);
  assert.throws(()=>b.retreatOperator(id),/not deployed/);near(b.dp,original);
  advance(b,72);b.addDp('arkpedia',99);
  assert.equal(b.cost(id),Math.floor(original*1.5));
  b.deployOperator(id,2,7,'RIGHT');b.getPlayer('arkpedia').dp=0;
  b.retreatOperator(id);near(b.dp,original);
  advance(b,72);b.addDp('arkpedia',99);
  assert.equal(b.cost(id),original*2);
  const next=b.deployOperator(id,2,7,'RIGHT');b.getPlayer('arkpedia').dp=0;
  b.kill(next);near(b.dp,0);assert.notEqual(next.id,u.id);
});

test('Plume has one block and source ATK/ASPD skill bonuses at all seven ranks',()=>{
  const id='char_192_falco';
  for(let rank=1;rank<=7;rank++) {
    const {b,build,source}=make(id,{rank});
    const u=b.deployOperator(id,2,7,'RIGHT');
    const base=u.s.atk,aspd=u.s.aspd,skill=source.operators[id].skills[0].levels[rank-1];
    const bb=Object.fromEntries(skill.blackboard.map(({key,value})=>[key,value]));
    assert.equal(u.s.blockCnt,1);assert.equal(u.profile.canHitFly,false);
    u.skill.gainSp(u.skill.spCost,'test');assert.equal(b.activateOperator(id),true);
    near(u.s.atk-base,u.base.atk*bb.atk);near(u.s.aspd-aspd,bb.attack_speed);
    advance(b,skill.duration+.1);near(u.s.atk,base);near(u.s.aspd,aspd);
    assert.equal(u.skill.active,false);
    assert.ok(recordFor(build,source).arkpedia.modifiers.atkPct>0);
  }
  const e0=recordFor({...defaultBuild(data.operators[id]),elite:0,level:40,skillRank:4},data);
  assert.deepEqual(e0.arkpedia.modifiers,{});
});

test('Popukar hits two of three overlapping enemies per swing, both blocked and unblocked, before and during her skill',()=>{
  const id='char_281_popka',{b}=make(id,{enemies:3});
  const u=b.deployOperator(id,2,7,'RIGHT');u.atkCd=100;b.step();
  const victims=[];
  b.on('damaged',ctx=>{if(ctx.source===u)victims.push(ctx.target.id);});
  for(const blocked of [false,true]) for(const active of [false,true]) {
    for(const e of b.enemies) {e.x=8;e.y=2;e.blockedBy=null;}
    u.blocking=blocked?b.enemies.slice(0,2):[];
    for(const e of u.blocking)e.blockedBy=u;
    if(active && !u.skill.active){u.skill.gainSp(u.skill.spCost,'test');assert.equal(b.activateOperator(id),true);}
    const profile=effectiveProfile(u),targets=acquireTargets(b,u,profile);
    assert.equal(targets.length,2);victims.length=0;b.forceAttack(u,targets);
    assert.equal(victims.length,2);assert.equal(new Set(victims).size,2);
    if(active)advance(b,20.1);
  }
  near(u.hp,u.s.maxHp);near(u.s.maxHp,u.base.maxHp*1.06);
  const e0=recordFor({...defaultBuild(data.operators[id]),elite:0,level:40,skillRank:4},data);
  assert.deepEqual(e0.arkpedia.modifiers,{});
});

test('Popukar uses source HP/ATK talents and her ATK buff at every rank, without creating splash damage',()=>{
  const id='char_281_popka';
  for(let rank=1;rank<=7;rank++) {
    const {b,source}=make(id,{rank,potential:6});
    const u=b.deployOperator(id,2,7,'RIGHT'),base=u.s.atk;
    near(u.s.maxHp,u.base.maxHp*1.08);near(u.hp,u.s.maxHp);
    assert.equal(u.profile.splashRadius,0);assert.equal(u.profile.canHitFly,false);
    const level=source.operators[id].skills[0].levels[rank-1];
    u.skill.gainSp(u.skill.spCost,'test');assert.equal(b.activateOperator(id),true);
    near(u.s.atk-base,u.base.atk*level.blackboard.find(e=>e.key==='atk').value);
    advance(b,level.duration+.1);near(u.s.atk,base);
  }
});
