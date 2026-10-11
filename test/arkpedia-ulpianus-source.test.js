// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import evidence from '../data/arkpedia-ulpianus-prefabs.json' with { type:'json' };
import data from '../data/arkpedia-mvp.json' with { type:'json' };
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
const ID='char_4145_ulpia';
test('full native source and all ranks are retained for the enabled three-skill Ulpianus adapter',()=>{
  assert.deepEqual(REGULAR_OPERATORS[ID].skillIds,['skchr_ulpia_1','skchr_ulpia_2','skchr_ulpia_3']);
  assert.ok(data.operators[ID]);
  assert.deepEqual(evidence.enabledOperators,[ID]);assert.equal(evidence.frameParity,false);
  assert.equal(evidence.moduleSupport,false);assert.equal(evidence.nativeParticleSupport,false);
  assert.equal(evidence.source.bundles.length,6);assert.equal(Object.keys(evidence.templates).length,10);
  assert.equal(Object.keys(evidence.tables.skills).length,3);
  for(const skill of Object.values(evidence.tables.skills))assert.equal(skill.levels.length,10);
  for(const face of ['Front','Back'])assert.equal(evidence.models[ID][face].sha256,
    evidence.officialSkeletonBindings[ID][face].sha256);
  assert.equal(evidence.tables.tokens.token_10039_ulpia_block.profession,'TOKEN');
  for(const record of evidence.source.bundles)assert.match(record.sha256,/^[a-f0-9]{64}$/);
});
test('source move carries named HP-ratio/progress fields and has a zero-slot model-free origin footprint',()=>{
  const rows=evidence.characters[ID].flatMap(x=>x.components);
  const text=JSON.stringify([evidence.characters,evidence.skills,evidence.projectiles]);
  for(const key of ['ulpia_skill_progress','ulpia_located_col','ulpia_located_row','_respawnBlackboardKeys'])
    assert.ok(text.includes(key));
  const hp=JSON.stringify(evidence.templates.ulpia_s3_hp_ratio_sync);
  assert.ok(hp.includes('MOVE_LIKE_RESPAWN_SELF'));assert.ok(hp.includes('AssignHpRatioToBB'));
  assert.ok(hp.includes('"_skipModifierEvent":true'));
  const aura=rows.find(x=>x.pathId==='4518813146696839646').data;
  assert.equal(aura._removeBuffWhenAbilityDetached,1);assert.equal(aura._removeBuffIncludeReborning,0);
  const token=evidence.tokens.token_10039_ulpia_block.flatMap(x=>x.components);
  assert.ok(token.some(x=>x.data._occupiedRemainingCharacterCnt===0));
  assert.ok(evidence.tokens.token_10039_ulpia_block.some(x=>x.object==='EmptyAnimator'));
});
test('durable source evidence has no non-finite serialized values or rounded native pointer numbers',()=>{
  function walk(v,k='') {
    if(k==='m_PathID')assert.equal(typeof v,'string');
    if(typeof v==='number')assert.ok(Number.isFinite(v));
    else if(Array.isArray(v))v.forEach(x=>walk(x));
    else if(v&&typeof v==='object')for(const[key,x]of Object.entries(v))walk(x,key);
  }
  walk(evidence);
});
