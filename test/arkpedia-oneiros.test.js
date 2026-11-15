// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnAny, ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import support from '../data/arkpedia-enemy-support.json' with { type: 'json' };
import evidence from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import index from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import animation from '../data/arkpedia-oneiros-source.json' with { type: 'json' };
import { BOMBD_RELEASE } from '../server/sim/content/enemies.js';
const id='enemy_1070_iced';
function fixture() {
  const h=spawnAny(id,{seconds:.1,units:[6,7,9].map(col=>({chessId:'test_enemy_harness_guard',row:9,col}))});
  const e=h.b.enemies.find(e=>e.defId===id);e.x=5;e.y=9;
  h.b.addBuff(e,{key:'test:stationary',persist:true,mods:{moveMul:0}});
  return {h,b:h.b,e,allies:h.b.allyUnits,cast:e.mem.ab.list.find(a=>a.fire)};
}

test('Oneiros original Attack event is the shared eight-frame release',()=>{
  assert.equal(animation.enemy,id);
  assert.equal(animation.source.sha256,'accf44273873070c1e33b3c1879388a9f934a857036a309ab3b44772fa9234c2');
  assert.deepEqual(animation.events.Attack.map(e=>e.name),['OnAttack']);
  assert.ok(Math.abs(animation.events.Attack[0].time-BOMBD_RELEASE)<1e-6);
});

test('Oneiros waits five seconds, then deals one 3x3 Arts blast and Cold without a movement bonus',()=>{
  assert.ok(support.enemies[id].policy);
  const {h,b,e,allies,cast}=fixture(),hits=[];
  b.on('damaged',c=>{if(c.source===e)hits.push(c);});
  b.applyStatus(e,'silence',{duration:30});
  h.run(4.7);assert.equal(cast.casts??0,0);assert.equal(hits.length,0);
  h.runUntil(()=>cast.casts>0,1);assert.equal(hits.length,0);
  h.run(1.5);
  assert.equal(hits.length,2);
  assert.ok(hits.every(c=>c.dmg.type==='arts'));
  assert.ok(allies[0].s.flags.cold);assert.ok(allies[1].s.flags.cold);assert.ok(!allies[2].s.flags.cold);
  const cold=allies[1].buffs.find(buff=>buff.status==='cold');assert.equal(cold.duration,10);
  assert.equal(e.profile.noAttack,true);assert.equal(e.findBuff('ab:bombRun')??null,null);
  h.run(12);assert.equal(cast.casts,1);assert.equal(hits.length,2);
  assert.deepEqual(b.errors,[]);
});

test('the blast applies the common Cold-to-Frozen combination, independently of Arts damage',()=>{
  const {h,b,e,allies}=fixture();
  b.applyStatus(allies[1],'cold',{duration:20});
  b.addBuff(allies[0],{key:'test:resist',persist:true,mods:{resFlat:100}});
  h.run(7);
  assert.ok(allies[1].s.flags.freeze);
  assert.ok(allies[0].s.flags.cold);
  assert.equal(e.mem.ab.list.find(a=>a.fire).casts,1);
  assert.deepEqual(b.errors,[]);
});

test('Oneiros admission refuses a changed status or blast shape',()=>{
  for(const what of ['status','area']) {
    const changed=structuredClone(evidence);
    const rows=what==='status'?changed.prefabs['dyn/battle/prefabs/enemies/enemy_1070_iced.prefab']:changed.projectiles.projectile_iced;
    for(const row of rows){
      const c=JSON.parse(row.originalJson);
      if(what==='status'&&c._activeBuffs?.length)c._activeBuffs[0].buffKey='different_status';
      if(what==='area'&&c.m_Size)c.m_Size.x=5;
      row.originalJson=JSON.stringify(c);
    }
    assert.equal(enemySupport(ENEMY_RECORDS.enemies[id],index.prefabs,changed).policy,null,what);
  }
});
