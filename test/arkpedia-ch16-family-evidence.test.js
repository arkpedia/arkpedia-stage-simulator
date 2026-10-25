// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { verifiedChapter16FamilyGraph, verifiedNative } from '../tools/arkpedia/enemy-support.mjs';
import { parseSkel } from '../tools/assets/skel.mjs';
const bytes = path => readFileSync(new URL('../data/' + path, import.meta.url));
const inventory = bytes('arkpedia-cn-native-source.json'), enemies = bytes('arkpedia-cn-enemy-native-source.json');
const index = JSON.parse(bytes('arkpedia-enemy-clock-source.json'));
const verify = graph => verifiedChapter16FamilyGraph(JSON.stringify(graph), inventory, enemies, index);
for (const [chapter,family] of [['ch17','flyer'],['ch17','bag'],['ch16','fear-projectile']]) {
  const graph = JSON.parse(bytes(`candidates/arkpedia-${chapter}-${family}-source.json`));
  test(`${family} retained source closure does not admit its unfinished controller`, () => {
    assert.doesNotThrow(() => verify(graph));
    if(chapter==='ch16') {
      const raw=bytes('arkpedia-enemy-clock-source.json'),pin=JSON.parse(bytes('arkpedia-mvp.json')).behaviors.source;
      assert.doesNotThrow(()=>verifiedNative(JSON.parse(bytes(`candidates/arkpedia-${chapter}-${family}-native.json`)),
        index.prefabs,createHash('sha256').update(raw).digest('hex'),pin));
    }
    const support = JSON.parse(bytes('candidates/arkpedia-ch16-enemy-support.json'));
    for (const key of Object.keys(graph.prefabs).map(p => p.split('/').at(-1).replace('.prefab', '')))
      assert.equal(support.enemies[key].policy, null);
  });
}
for (const family of ['crossbow', 'commander', 'artillery', 'story-guardian']) {
  const graph = JSON.parse(bytes(`candidates/arkpedia-ch16-${family}-source.json`));
  test(`${family} complete graph matches the pinned inventory, timing components and action closure`, () => {
    assert.doesNotThrow(() => verify(graph));
  });
  test(`${family} refuses inventory drift and a self-rehashed changed indexed component`, () => {
    const drift = structuredClone(graph); drift.source.enemyInventory.sha256 = 'changed';
    assert.throws(() => verify(drift), /inventories disagree/);
    const changed = structuredClone(graph), [path, rows] = Object.entries(changed.prefabs)[0];
    const clock = index.prefabs[path].clockComponents[0], row = rows.find(r => r.pathId === clock.pathId);
    row.originalJson += ' '; row.sha256 = createHash('sha256').update(row.originalJson).digest('hex');
    assert.throws(() => verify(changed), /differs from indexed component/);
  });
}
test('artillery action closure requires the separate lingering projectile', () => {
  const original = JSON.parse(bytes('candidates/arkpedia-ch16-artillery-source.json'));
  const graph = structuredClone(original);
  delete graph.projectiles[Object.keys(graph.projectiles).find(p => p.endsWith('_range.prefab'))];
  assert.throws(() => verify(graph), /projectile closure incomplete/);
  const template = structuredClone(original);
  delete template.templates['uacann_ma[range_damage]'];
  assert.throws(() => verify(template), /template closure incomplete/);
});

test('Guardian source preserves delayed HP loss and the miner fog marker independently of ordinary attacks',()=>{
  const g=JSON.parse(bytes('candidates/arkpedia-ch16-story-guardian-source.json'));
  const parts=Object.values(g.prefabs)[0].map(r=>JSON.parse(r.originalJson));
  const delay=parts.find(n=>n._buffs?.[0]?.buffKey==='dyegrd_t[delay_dot]');
  assert.equal(delay._buffs[0].durationKey,'delay_duration');assert.equal(delay._buffs[0].lifeTimeType,1);
  const aura=parts.find(n=>n._buffs?.[0]?.buffKey==='gyegrd_a[exist]');
  assert.equal(aura._removeBuffWhenAbilityDetached,1);
  const validator=parts.find(n=>n._buffs?.[0]==='enemy_mcreep_self_mark');
  assert.equal(validator._excludeKey,0);assert.equal(validator._targetOptions.targetSide,7);
  const events=k=>JSON.parse(g.templates[k].originalJson).eventToActions._items;
  const delayed=events('dyegrd_t[delay_dot]');assert.equal(delayed[0].key,25);
  const child=JSON.parse(delayed[0].value.SerializedState)[0]._buff;
  assert.equal(child.buffKey,'dyegrd_t[delay_dot_core]');assert.equal(child.triggerInterval,1);
  assert.equal(child.waitFirstTriggerInterval,true);assert.deepEqual(child.attributes.abnormalFlags,['UNMOVABLE_PRIVATE']);
  const damage=JSON.parse(events('dyegrd_t[delay_dot_core]')[0].value.SerializedState)[0];
  assert.ok(damage.$type.endsWith('+DamageViaMaxHpRatio'));assert.equal(damage._damageType,'PURE');
  assert.equal(damage._isUndeadable,false);assert.equal(damage._skipModifierEvent,false);
});

test('fear projectile source requires its separate explosion and full-HP removal of derived miner fear/disarm',()=>{
  const g=JSON.parse(bytes('candidates/arkpedia-ch16-fear-projectile-source.json'));
  assert.equal(Object.keys(g.projectiles).length,1);
  const events=JSON.parse(g.templates['feawpj_a[mcreep_fear]'].originalJson).eventToActions._items;
  const start=JSON.parse(events.find(e=>e.key===0).value.SerializedState)[0];
  assert.deepEqual(start._conditionNode._buffKeys,['enemy_mcreep_self_mark']);
  assert.equal(start._succeedNodes[0]._buff.blackboard[0].value,999999);
  assert.deepEqual(start._succeedNodes[1]._buff.attributes.abnormalFlags,['DISARMED']);
  for(const child of start._succeedNodes)assert.equal(child._finishDerivedBuffIfParentFinish,true);
  const tick=JSON.parse(events.find(e=>e.key===2).value.SerializedState);
  assert.equal(tick[0]._condType,'EQUALS');assert.equal(tick[0]._value,1);
  assert.ok(tick[1].$type.endsWith('+FinishBuff'));
  const missing=structuredClone(g);missing.projectiles={};
  assert.throws(()=>verify(missing),/projectile closure incomplete/);
});

test('fear projectile original clock source cannot be replaced by a fabricated OnAttack marker',()=>{
  const source=JSON.parse(bytes('candidates/arkpedia-ch16-fear-projectile-animation-source.json'));
  const row=source.enemies.enemy_10128_fearpj,raw=Buffer.from(row.base64,'base64');
  assert.equal(raw.length,row.bytes);assert.equal(createHash('sha256').update(raw).digest('hex'),row.sha256);
  assert.equal(source.source.graph.sha256,createHash('sha256').update(bytes('candidates/arkpedia-ch16-fear-projectile-source.json')).digest('hex'));
  const skel=parseSkel(raw,undefined,{includeEventPayloads:true,includeExactDurations:true});
  assert.equal(skel.exactDurations.Attack,.5333333611488342);assert.deepEqual(skel.eventPayloads,{});
  assert.equal(JSON.parse(bytes('candidates/arkpedia-ch16-enemy-support.json')).enemies.enemy_10128_fearpj.policy,null);
});
