// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { deriveEnemySupport, prefabPath } from '../shared/arkpedia/enemy-support.js';
import { verifiedNative, verifiedChapter16FamilyGraph } from '../tools/arkpedia/enemy-support.mjs';
import { nativeDuckRun } from '../server/sim/content/duck-run.js';
import { installFeatureDispatch } from '../server/sim/content/enemies.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
const bytes=p=>readFileSync(new URL('../data/'+p,import.meta.url)),read=p=>JSON.parse(bytes(p));
const review=read('candidates/arkpedia-reviewed-duck-run.json');
const records=read('candidates/arkpedia-enemy-records.canonical.json').enemies;
const hash=b=>createHash('sha256').update(b).digest('hex');
function fixture(key='enemy_2001_duckmi',level=0) {
  const r=records[key].levels[level];
  const h=makeBattle({content:'generic',autoFinish:false,
    setup:b=>{installFeatureDispatch(b);installEnemyFeatures(b);},
    defs:{enemies:{[key]:r},chess:{dummy:chessRec({id:'dummy',stats:{atk:0,maxHp:1e6,blockCnt:1}})}},
    units:[{chessId:'dummy',row:10,col:7}]});
  h.b.start();const e=h.spawn(key,{pos:[10,7]});
  e.route={legs:[{t:'wait',time:100}],legIdx:0,pts:null,version:-1,waitLeft:null};
  return {h,b:h.b,e,a:e.mem.ab.list[0],u:h.unit('dummy'),r};
}
const hit=(b,s,e,amount=300,type='true')=>b.dealDamage(s,e,{amount,type,isAttack:true,canDodge:false});

test('Duck run closure and indexed native components bind exact original inputs',()=>{
  for(const p of Object.values(review.sources))assert.equal(hash(readFileSync(new URL('../'+p.path,import.meta.url))),p.sha256);
  const index=read('arkpedia-enemy-clock-source.json');
  verifiedNative(read('candidates/arkpedia-duck-run-native.json'),index.prefabs,hash(bytes('arkpedia-enemy-clock-source.json')),read('arkpedia-mvp.json').behaviors.source);
  const graph=read('candidates/arkpedia-duck-run-source.json');
  verifiedChapter16FamilyGraph(bytes('candidates/arkpedia-duck-run-source.json'),bytes('arkpedia-cn-native-source.json'),bytes('arkpedia-cn-enemy-native-source.json'),index);
  const event=JSON.parse(graph.templates.enemy_duckmi_t.originalJson).eventToActions._items;
  assert.equal(event.length,1);assert.equal(event[0].key,10);
  const action=JSON.parse(event[0].value.SerializedState)[0];
  assert.equal(action._modeIndex,1);assert.equal(action._restoreDefault,false);assert.equal(action._restartFSM,true);
  const nodes=Object.values(graph.prefabs)[0].map(r=>JSON.parse(r.originalJson));
  const speed=nodes.flatMap(n=>n._buffs??[]).find(b=>b.buffKey==='duckmi_speed_up');
  assert.equal(speed.lifeTimeType,2);assert.equal(speed.isSilenceable,0);
  assert.deepEqual(speed.attributes.attributeModifiers.map(m=>[m.attributeType,m.formulaItem,m.loadFromBlackboard]),[[6,1,1]]);
});
for(const key of Object.keys(review.enemies))for(const level of Object.keys(records[key].levels))
test(key+' level '+level+' attaches once, stays unblockable/nonattacking and runs permanently without stacking',()=>{
  const {h,b,e,a,u,r}=fixture(key,level),base=e.s.moveSpeed;
  assert.equal(e.mem.ab.list.length,1);assert.ok(e.s.flags.unblockable);assert.equal(a.running,false);
  h.run(.1);assert.equal(e.blockedBy,null);assert.equal(e.stats.attacks,0);
  hit(b,u,e);assert.equal(a.running,true);assert.equal(e.s.moveSpeed,base*(1+r.talents.bb['run.attack@move_speed']));
  const speed=e.s.moveSpeed;for(let i=0;i<3;i++)hit(b,u,e);
  assert.equal(e.s.moveSpeed,speed);h.run(30);assert.equal(e.s.moveSpeed,speed);assert.equal(e.stats.attacks,0);
  assert.equal(e.buffs.filter(x=>x.key==='duckmi_speed_up').length,1);assert.deepEqual(b.errors,[]);
});
test('accepted zero/shielded damage packets trigger the unconditional handler; invulnerable hits are rejected',()=>{
  const zero=fixture();hit(zero.b,zero.u,zero.e,0);assert.equal(zero.a.running,true);
  const {b,e,a,u}=fixture(),hp=e.hp;
  const inv=b.addBuff(e,{key:'fixture-invulnerable',persist:true,flags:{invulnerable:true}});
  hit(b,u,e);assert.equal(a.running,false);b.removeBuff(e,inv);
  b.addBuff(e,{key:'fixture-shield',persist:true,shield:1000});
  hit(b,u,e);assert.equal(e.hp,hp);assert.equal(a.running,true);
});
test('source-free damage and damage during control still trigger the nonsilenceable permanent mode',()=>{
  const {h,b,e,a}=fixture();
  b.addBuff(e,{key:'fixture-silence',persist:true,flags:{silence:true}});
  b.applyStatus(e,'stun',1);hit(b,null,e,1);assert.equal(a.running,true);
  h.run(1.1);assert.equal(e.s.moveSpeed,2);assert.deepEqual(b.errors,[]);
});
test('death and battle end retire only owned hooks and speed',()=>{
  for(const event of ['death','battleEnd']) {
    const {b,e,a,u}=fixture();b.addBuff(e,{key:'foreign-speed',persist:true,mods:{moveMul:2}});
    hit(b,u,e);
    if(event==='death')b.kill(e,null);else b.emit('battleEnd',{});
    assert.equal(a.active,false);assert.equal(e.findBuff('duckmi_speed_up'),null);
    assert.ok(e.findBuff('foreign-speed'));assert.deepEqual(b.errors,[]);
  }
});
test('both database identities require the exact reviewed shared prefab, native claim and parameter set',()=>{
  const native=read('candidates/arkpedia-duck-run-native.json'),index=read('arkpedia-enemy-clock-source.json');
  const evidence={...native,chapter16Families:{duckRun:{graphSha256:review.sources.graph.sha256}}};
  for(const key of Object.keys(review.enemies)) {
    const entry={[key]:records[key]};assert.equal(deriveEnemySupport(entry,index.prefabs,evidence)[key].policy,'stats-attacks-and-features');
    assert.equal(deriveEnemySupport(entry,index.prefabs,native)[key].policy,null);
    const drift=structuredClone(evidence);drift.prefabs[prefabPath('enemy_2001_duckmi')][0].originalJson+=' ';
    assert.equal(deriveEnemySupport(entry,index.prefabs,drift)[key].policy,null);
    for(const mutate of [r=>{r.talents.bb['run.attack@move_speed']++;},r=>{r.prefabKey='enemy_2001_duckmi_2';},r=>{r.abilities[1].text+=' changed';}]) {
      const wrong=structuredClone(entry);for(const r of Object.values(wrong[key].levels))mutate(r);
      assert.equal(deriveEnemySupport(wrong,index.prefabs,evidence)[key].policy,null);
      assert.throws(()=>nativeDuckRun(Object.values(wrong[key].levels)[0]),/Unreviewed/);
    }
  }
});
