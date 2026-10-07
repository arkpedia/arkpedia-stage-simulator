import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild, catalogueFor, recordFor } from '../shared/arkpedia/loadout.js';
import { maxedSupport } from '../shared/arkpedia/squad.js';
import { assertRegularOperator } from '../shared/arkpedia/operators.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const twoStars=Object.values(data.operators).filter(op=>op.rarity===2);
function make(id,{level=30,potential=1,trust=0,enemies=0}={}) {
  const source=structuredClone(data);
  source.stage.geometry.waves[0].spawns=enemies?[{enemy_id:'enemy_1007_slime',count:enemies,time:0,interval:0,route:1}]:[];
  Object.assign(source.enemies.enemy_1007_slime.stats,{maxHp:100000,atk:0,moveSpeed:0});
  const build={...defaultBuild(source.operators[id]),level,potential,trust};
  const b=new StandardBattle(source,{operators:[build]});
  b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
  return {b,build,source};
}
function advance(b,seconds) {
  for(let i=0;i<Math.ceil(seconds/b.dt);i++)b.step();
  assert.deepEqual(b.errors,[]);
}

test('two-star builds and maxed supports use E0 level 30 and reject fabricated promotions or skills',()=>{
  assert.ok(twoStars.length);
  for(const op of twoStars) {
    const build=defaultBuild(op),cat=catalogueFor(data);
    assert.equal(build.elite,0);assert.equal(build.level,30);
    assert.equal(build.skillId,null);assert.equal(build.skillRank,null);
    const record=recordFor(build,data);assert.equal(record.skill,null);assert.equal(record.rarity,2);
    const support=maxedSupport({id:op.id},cat);
    assert.deepEqual(support,{...build,potential:6,trust:200});
    for(const patch of [{elite:1},{level:31},{skillId:'fake'},{skillRank:1}])
      assert.throws(()=>recordFor({...build,...patch},data),/promotion|level|no skills/);
    assert.throws(()=>assertRegularOperator({...op,skills:[{id:'fake'}]}),/Unsupported/);
  }
});

test('skill-less operators fight without gaining SP, showing a gauge, or allowing activation',()=>{
  for(const op of twoStars) {
    const {b}=make(op.id,{enemies:1});
    const u=b.deployOperator(op.id,op.position==='MELEE'?2:1,7,'UP');u.atkCd=100;
    b.step();const target=b.enemies[0];const before=target.hp;
    b.forceAttack(u,[target]);advance(b,2);
    assert.ok(target.hp<before,op.name);
    assert.equal(u.skill.noSkill,true);assert.equal(b.activateOperator(op.id),false);
    assert.equal(u.skill.gainSp(99,'test'),0);assert.equal(u.skill.spTotal,0);
    assert.equal(skillHud(u.skill),null);assert.equal(u.skill.activations,0);
  }
});

test('Yato unlocks her shorter redeployment at level 30 and combines it with potential, without generating skill DP',()=>{
  const id='char_502_nblade';
  for(const [level,potential,cooldown] of [[29,1,70],[30,1,40],[30,6,35]]) {
    const {b}=make(id,{level,potential});const cost=b.cost(id);
    const u=b.deployOperator(id,2,7,'RIGHT');assert.equal(u.s.blockCnt,2);
    b.getPlayer('arkpedia').dp=10;advance(b,3);near(b.dp,13);
    b.getPlayer('arkpedia').dp=0;b.retreatOperator(id);near(b.dp,Math.floor(cost/2));
    near(b.bench[id].readyAt-b.time,cooldown);
    advance(b,cooldown-1);b.addDp('arkpedia',99);
    assert.throws(()=>b.deployOperator(id,2,7,'RIGHT'),/redeploying/);
    advance(b,1.1);assert.equal(b.bench[id].unit.alive,false);
    const next=b.deployOperator(id,2,7,'RIGHT');assert.notEqual(next.id,u.id);
    assert.equal(next.skill.noSkill,true);assert.equal(b.cost(id),cost*2);
  }
});

test('Noir Corne gains HP/DEF only at level 30, including trust/potential stats, and attacks one enemy while blocking three',()=>{
  const id='char_500_noirc';
  for(const level of [29,30]) for(const potential of [1,6]) {
    const {b}=make(id,{level,potential,trust:200,enemies:3});
    const u=b.deployOperator(id,2,7,'RIGHT');u.atkCd=100;b.step();
    near(u.s.maxHp,u.base.maxHp*(level===30?1.12:1));near(u.hp,u.s.maxHp);
    near(u.s.def,u.base.def*(level===30?1.12:1));assert.equal(u.s.blockCnt,3);
    for(const e of b.enemies){e.x=7;e.y=2;e.blockedBy=u;}
    u.blocking=[...b.enemies];
    const targets=acquireTargets(b,u,effectiveProfile(u));assert.equal(targets.length,1);
    const before=b.enemies.map(e=>e.hp);b.forceAttack(u,targets);
    assert.equal(b.enemies.filter((e,i)=>e.hp<before[i]).length,1);
  }
});

test('Rangers prioritizes aerial targets and applies his level-30 bonus before DEF only against them',()=>{
  const id='char_503_rang';
  for(const level of [29,30]) for(const flying of [false,true]) {
    const {b}=make(id,{level,potential:6,enemies:2});
    const u=b.deployOperator(id,1,7,'UP');u.atkCd=100;b.step();
    const [ground,target]=b.enemies;
    for(const e of b.enemies){e.x=7;e.y=2;b.addBuff(e,{key:'test:pin',persist:true,flags:{noMove:true}});}
    target.motion=flying?'FLY':'WALK';target.base.def=50;b.step();
    assert.equal(target.isFlying,flying);assert.equal(u.profile.priority,'fly');
    if(flying)assert.equal(acquireTargets(b,u,effectiveProfile(u))[0],target);
    const before=target.hp,otherHp=ground.hp;
    b.forceAttack(u,[target]);advance(b,2);
    near(before-target.hp,u.s.atk*(level===30&&flying?1.5:1)-50);
    near(ground.hp,otherHp);near(u.s.aspd,112);
    assert.equal(recordFor(defaultBuild(data.operators[id]),data).arkpedia.critical,undefined);
  }
});

function checkDodge(id,eligibleType) {
  for(const level of [29,30]) for(const proc of [false,true]) {
    const {b,build,source}=make(id,{level,potential:6,trust:200});
    const u=b.deployOperator(id,1,7,'UP');
    near(u.s.dodgeArts,level===30&&eligibleType==='arts'?.5:0);
    near(u.s.dodgePhys,level===30&&eligibleType==='phys'?.5:0);
    assert.equal(recordFor(build,source).arkpedia.critical,undefined);
    for(const type of ['phys','arts','true']) {
      u.hp=u.s.maxHp;let rolls=0;
      b.rng=()=>{rolls++;return proc ? 0.499999 : 0.5;};
      const before=u.hp,dealt=b.dealDamage(null,u,{amount:500,type});
      assert.equal(dealt===0,level===30&&type===eligibleType&&proc);
      assert.equal(rolls,level===30&&type===eligibleType?1:0);
      near(before-u.hp,dealt);assert.deepEqual(b.errors,[]);
    }
  }
}

test('Durin unlocks 50% Arts-only dodge at level 30, without dodging physical/true damage or gaining a critical talent',()=>{
  checkDodge('char_501_durin','arts');
});
