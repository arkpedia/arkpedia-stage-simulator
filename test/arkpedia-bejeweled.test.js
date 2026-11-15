// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnAny,ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { bejeweledNative } from '../shared/arkpedia/enemy-bejeweled-features.js';
import { enemySupport,nativeComponents } from '../shared/arkpedia/enemy-support.js';
import evidence from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import index from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};
const ids=['enemy_10019_sgmum','enemy_10019_sgmum_2'];
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function fixture(id=ids[0]){const f=spawnAny(id,{seconds:.05,stats:{moveSpeed:0},autoFinish:false});
  const e=f.b.enemies[0],op=f.b.allyUnits[0];op.profile.noAttack=true;
  return{...f,e,op,a:e.mem.ab.list.find(a=>a.counts),hit:(type='phys',amount=100,extra={})=>f.b.dealDamage(op,e,{type,amount,isAttack:false,...extra})};
}
test('both records start with their source taunt addition and independent zero adaptation counters',()=>{
  for(const id of ids){const f=fixture(id);assert.equal(f.e.s.taunt,f.e.base.tauntLevel+1);assert.equal(f.e.s.def,50);assert.equal(f.e.s.res,5);
    assert.deepEqual(f.a.counts,{phys:0,arts:0});assert.deepEqual(f.b.errors,[]);}
});
test('accepted Physical and Arts instances build independent defenses for subsequent packets',()=>{
  const f=fixture();assert.equal(f.hit('phys',100),50);close(f.e.s.def,50+2000/30);assert.equal(f.e.s.res,5);
  assert.equal(f.hit('phys',100),5);assert.equal(f.a.counts.phys,2);
  close(f.hit('arts',100),95);close(f.e.s.res,5+80/30);close(f.e.s.def,50+4000/30);
  assert.deepEqual(f.a.counts,{phys:2,arts:1});assert.deepEqual(f.b.errors,[]);
});
test('each damage instance counts once, including multi-hit and damage over time, and both channels cap at thirty',()=>{
  for(const id of ids){const f=fixture(id);for(let i=0;i<40;i++){f.hit('phys',1,{tags:['dot']});f.hit('arts',1,{isAttack:true});}
    assert.deepEqual(f.a.counts,{phys:30,arts:30});assert.equal(f.e.s.def,2050);assert.equal(f.e.s.res,85);
    assert.equal(f.e.alive,true);assert.deepEqual(f.b.errors,[]);}
});
test('shielded and zero-damage accepted instances count; misses, invulnerability, True damage and HP loss do not',()=>{
  const f=fixture();f.b.addBuff(f.e,{key:'shield',shield:1e6});const hp=f.e.hp;f.hit('phys',100);
  assert.equal(f.e.hp,hp);assert.equal(f.a.counts.phys,1);f.hit('arts',0);assert.equal(f.a.counts.arts,1);
  f.b.rng=Object.assign(()=>0,f.b.rng);f.b.addBuff(f.e,{key:'dodge',mods:{dodgePhys:1}});f.hit('phys',100);assert.equal(f.a.counts.phys,1);
  f.b.addBuff(f.e,{key:'inv',flags:{invulnerable:true}});f.hit('arts',100);assert.equal(f.a.counts.arts,1);
  f.b.removeBuff(f.e,'inv');f.hit('true',100);f.b.loseHp(f.e,100);assert.deepEqual(f.a.counts,{phys:1,arts:1});assert.deepEqual(f.b.errors,[]);
});
test('Silence and control do not suppress the passive, and separate enemies own separate counters',()=>{
  const f=fixture();f.b.addBuff(f.e,{key:'control',flags:{silence:true,stun:true}});f.hit('phys',100);assert.equal(f.a.counts.phys,1);
  const other=f.b.spawnEnemy(ids[0],{pos:[9,8]});assert.deepEqual(other.mem.ab.list.find(a=>a.counts).counts,{phys:0,arts:0});
  f.b.removeBuff(f.e,'control');f.run(.2);close(f.e.s.def,50+2000/30);assert.deepEqual(f.b.errors,[]);
});
test('native admission refuses changed damage masks, counter stat, caps and gameplay hidden inside visual branches',()=>{
  for(const id of ids)assert.ok(enemySupport(ENEMY_RECORDS.enemies[id],index.prefabs,evidence).policy,id);
  for(const kind of['mask','stat','extra']){const ev=structuredClone(evidence),nodes=ev.templates['enemy_sgmum[hit_ap]'].eventToActions.ON_TAKE_DAMAGE[0]._succeedNodes;
    if(kind==='mask')ev.templates['enemy_sgmum[hit_ap]'].eventToActions.ON_TAKE_DAMAGE[0]._conditionNode._damageMask='MAGICAL';
    if(kind==='stat')nodes[3]._attributeType='ATK';
    if(kind==='extra')nodes[4]._succeedNodes.push({$type:'Torappu.Battle.Action.Nodes+InstantKill, Assembly-CSharp'});
    assert.equal(bejeweledNative(ENEMY_RECORDS.enemies[ids[0]].levels[0],nativeComponents(ev,ids[0])),false,kind);
  }
  const r=structuredClone(ENEMY_RECORDS.enemies[ids[0]].levels[0]);r.talents.bb['hit_ap.max_stack_cnt']=40;
  assert.equal(bejeweledNative(r,nativeComponents(evidence,ids[0])),false);
});
