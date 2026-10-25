// SPDX-License-Identifier: GPL-3.0-or-later
// Complete original source constraints, independent of runtime registration.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {verifiedNative,verifiedChapter16FamilyGraph} from '../tools/arkpedia/enemy-support.mjs';
import {parseSkel} from '../tools/assets/skel.mjs';
const bytes=p=>readFileSync(new URL('../data/'+p,import.meta.url)),read=p=>JSON.parse(bytes(p));
const sha=b=>createHash('sha256').update(b).digest('hex');
const g=read('candidates/arkpedia-ch17-bag-source.json');
const actions=(key,event)=>JSON.parse(JSON.parse(g.templates[key].originalJson).eventToActions._items.find(e=>e.key===event).value.SerializedState);
test('Bag full native/indexed/clock receipts reproduce independently of runtime registration',()=>{
 const idx=read('arkpedia-enemy-clock-source.json');
 verifiedChapter16FamilyGraph(JSON.stringify(g),bytes('arkpedia-cn-native-source.json'),bytes('arkpedia-cn-enemy-native-source.json'),idx);
 verifiedNative(read('candidates/arkpedia-ch17-bag-native.json'),idx.prefabs,sha(bytes('arkpedia-enemy-clock-source.json')),read('arkpedia-mvp.json').behaviors.source);
 const clock=read('candidates/arkpedia-ch17-bag-animation-source.json');
 assert.equal(clock.source.graph.sha256,sha(bytes('candidates/arkpedia-ch17-bag-source.json')));
 for(const[key,row]of Object.entries(clock.enemies)){
  const raw=Buffer.from(row.base64,'base64');assert.equal(sha(raw),row.sha256);assert.ok(parseSkel(raw).animations.length>0);
  assert.equal(read('arkpedia-regular-enemies.json').enemies[key],undefined);
 }
});
test('feeding lifetime, skill duration and aura lifetime are separate native contracts',()=>{
 const parts=Object.values(g.prefabs)[0].map(r=>JSON.parse(r.originalJson));
 const feeding=parts.find(n=>n._buffs?.[0]?.buffKey==='enemy_mubag_atk_up')._buffs[0];
 assert.equal(feeding.lifeTime,10.5);assert.equal(feeding.lifeTimeType,1);assert.equal(feeding.triggerInterval,1);assert.equal(feeding.waitFirstTriggerInterval,1);
 const skill=parts.find(n=>n._cooldownKey==='anim_duration');assert.equal(skill._timeMode,3);assert.equal(skill._affectedBySlowDown,0);
 const aura=parts.find(n=>n._buffs?.[0]?.buffKey==='enemy_mubag_kill_murad');
 assert.equal(aura._buffs[0].lifeTimeType,2);assert.equal(aura._removeBuffWhenTargetLeave,1);assert.equal(aura._removeBuffWhenAbilityDetached,1);
 for(const key of ['enemy_10209_mubag','enemy_10209_mubag_2']){
  const r=read('candidates/arkpedia-enemy-records.canonical.json').enemies[key].levels[0];
  assert.equal(r.skills[0].bb.anim_duration,11);assert.equal(r.skills[0].bb.max_stack_cnt,40);assert.equal(r.talents.bb['ReachedAura.duration'],10);
 }
});
test('derived feeding flag routes back to its own source parent rather than killing every nearby source',()=>{
 const create=actions('enemy_mubag_kill_murad',0)[0];
 assert.equal(create._buffOwner,'BUFF_SOURCE');assert.equal(create._useSpecialBuffSource,true);assert.equal(create._specialBuffSource,'BUFF_OWNER');
 assert.equal(create._isDerivedBuff,true);assert.equal(create._finishDerivedBuffIfParentFinish,true);
 const flag=actions('enemy_mubag_kill_murad[flag]',2)[0];assert.equal(flag._targetType,'BUFF_SOURCE');assert.deepEqual(flag._buffKeys,['enemy_mubag_kill_murad']);assert.equal(flag._triggerAllBuffs,false);
 const finish=actions('enemy_mubag_atk_up',1)[0];assert.deepEqual(finish._buffKeys,['enemy_mubag_kill_murad[flag]']);assert.equal(finish._targetType,'BUFF_OWNER');
 const kill=actions('enemy_mubag_kill_murad',2);assert.ok(kill[0].$type.endsWith('+CheckEnemySkillAffecting'));assert.equal(kill[0]._targetType,'BUFF_SOURCE');assert.ok(kill[1].$type.endsWith('+InstantKill'));assert.equal(kill[1]._targetType,'BUFF_OWNER');
 const tick=actions('enemy_mubag_atk_up',2)[0];assert.deepEqual(tick._conditionNode._buffKeys,['enemy_mubag_kill_murad[flag]']);assert.equal(tick._failNodes[0]._resetCooldown,false);
 assert.equal(tick._succeedNodes[0]._buff.lifeTimeType,'INFINITY');assert.equal(tick._succeedNodes[0]._isDerivedBuff,false);
});
