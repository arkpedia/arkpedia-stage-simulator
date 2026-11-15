// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadContentContext,planStage} from '../tools/arkpedia/content-inventory.mjs';
import {loadStageRuleReceipt} from '../tools/arkpedia/stage-rule-storage.mjs';
import {readOriginalLevel} from '../tools/arkpedia/original-level.mjs';
import {compileStageEnemyAlias} from '../tools/arkpedia/stage-enemy-aliases.mjs';
import {enemyModelKey} from '../shared/arkpedia/facing.js';
const c=await loadContentContext();
for(const id of ['cr-mo-1','isw-no_level_obt_roguelike_ro5_level_rogue5_sv-6','unknown_stage_guide_01']){
  test(`${id}: original zero-capacity aliases retain independent data and share their existing native bodies`,async()=>{
    const{receipt}=await loadStageRuleReceipt(c.root,id),{level}=await readOriginalLevel(c.root,receipt);
    const refs=level.enemyDbRefs.filter(r=>r.useDb===false&&(['enemy_1105_tyokai','enemy_1105_tyokai_2','enemy_1002_nsabr'].includes(r.overwrittenData?.prefabKey?.m_value)));
    assert.ok(refs.length);
    for(const ref of refs){
      const before=structuredClone(ref),base=ref.overwrittenData.prefabKey.m_value;
      assert.equal(ref.overwrittenData.attributes.spRecoveryPerSec.m_value,1);
      const {record}=compileStageEnemyAlias(ref,c.records,c.support);
      assert.equal(record.key,ref.id);assert.equal(record.assetPrefabKey,base);assert.equal(record.skills.length,0);
      assert.ok(!record.sp||record.sp.maxSp===0&&record.sp.initSp===0);
      assert.equal(enemyModelKey(record.key,record),enemyModelKey(base,c.records.enemies[base].levels[0]));
      assert.deepEqual(ref,before);
      for(const change of[
        r=>r.overwrittenData.attributes.spRecoveryPerSec.m_value=2,
        r=>r.overwrittenData.spData={spType:'INCREASE_WITH_TIME',maxSp:1,initSp:0,increment:1},
        r=>r.overwrittenData.spData={spType:'INCREASE_WITH_TIME',maxSp:0,initSp:1,increment:1},
        r=>r.overwrittenData.skills=[{prefabKey:'unexpected'}],
      ]){const changed=structuredClone(ref);change(changed);assert.throws(()=>compileStageEnemyAlias(changed,c.records,c.support));}
    }
    const plan=await planStage(c,id,{waves:true});
    assert.equal(plan.blockers.some(b=>b.kind==='enemy-alias'&&refs.some(r=>r.id===b.id)),false);
    // Other unsupported mode/environment/device/enemy requirements still gate
    // admission. A relaxed inactive field is never a complete-stage override.
  });
}
