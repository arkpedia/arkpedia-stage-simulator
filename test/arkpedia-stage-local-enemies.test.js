// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileStageLocalEnemy} from '../shared/arkpedia/enemy-records.js';
import {normalizeEnemy} from '../server/sim/simdata.js';
const read=p=>JSON.parse(readFileSync(new URL('../data/'+p,import.meta.url)));
const source=code=>read(`candidates/arkpedia-stage-${code}-source.json`);
const locals=code=>source(code).rawLevel.enemyDbRefs.filter(ref=>ref.useDb===false);
const canonical=read('candidates/arkpedia-enemy-records.canonical.json').enemies;

test('16-9 local miner compiles its literal zero-fear contract without inheriting catalogue talents',()=>{
  const ref=locals('16-9')[0],before=structuredClone(ref);
  const r=compileStageLocalEnemy(ref,{damageType:'PHYSIC'});
  assert.equal(r.key,'enemy_3010_mcreep_a');assert.equal(r.prefabKey,'enemy_3010_mcreep');
  assert.equal(r.stats.maxHp,12000);assert.equal(r.stats.atk,500);assert.equal(r.stats.def,150);
  assert.equal(r.stats.moveSpeed,.7);assert.equal(r.stats.bat,3);assert.equal(r.stats.dmgType,'phys');
  assert.deepEqual(r.talents.bb,{'FearLoseBlood.value':0});
  assert.deepEqual(r.talents.groups,{FearLoseBlood:['value']});assert.deepEqual(r.skills,[]);
  assert.equal(r.notCountInTotal,true);assert.equal(r.stats.lpr,0);assert.ok(r.stats.otherImmunities.includes('feared'));
  assert.equal(r.abilities[0].text,ref.overwrittenData.description.m_value);
  assert.notDeepEqual(r.talents,canonical.enemy_3010_mcreep.levels[0].talents);
  assert.deepEqual(ref,before,'compilation must not mutate source data');
});

test('17-18 local infantry, Brute, rockbreaker and caster retain independent skills, HP and count/life rules',()=>{
  const refs=locals('17-18');assert.equal(refs.length,4);
  const byId=Object.fromEntries(refs.map(ref=>[ref.id,compileStageLocalEnemy(ref,{damageType:ref.id.includes('mumag')?'MAGIC':'PHYSIC'})]));
  const infantry=byId.enemy_10201_muinf_2_a,rockbreaker=byId.enemy_10204_mudia_2_a,caster=byId.enemy_10203_mumag_2_a;
  const brute=byId.enemy_10207_mubrut_2_a;assert.equal(brute.stats.maxHp,12000);assert.equal(brute.stats.atk,2100);
  assert.equal(infantry.stats.maxHp,5000);assert.equal(infantry.stats.atk,300);assert.equal(infantry.stats.moveSpeed,1.2);
  assert.deepEqual(infantry.talents.bb,{'MuradPollut.hp_ratio':.2});
  assert.equal(rockbreaker.stats.maxHp,6000);assert.equal(rockbreaker.stats.def,1300);
  assert.deepEqual(rockbreaker.skills,[],'null local skills must not inherit catalogue SummonSelf');
  assert.deepEqual(rockbreaker.talents.groups,{});
  assert.ok(canonical.enemy_10204_mudia_2.levels[0].skills.some(s=>s.prefabKey==='SummonSelf'));
  assert.equal(caster.stats.maxHp,6250);assert.equal(caster.stats.atk,130);assert.equal(caster.stats.rangeRadius,2.3);
  assert.equal(caster.skills[0].prefabKey,'ChargeRift');assert.equal(caster.skills[0].cooldown,10);
  assert.deepEqual(caster.skills[0].bb,{def:2,sp:1,duration:15,hit_duration:15});
  for(const r of Object.values(byId)) {
    assert.equal(r.notCountInTotal,true);assert.equal(r.stats.lpr,1,'uncounted local units can still consume life');
    assert.equal(r.sp.increment,1);assert.equal(r.sp.maxSp,0);
    const n=normalizeEnemy(r.key,r);assert.equal(n.maxHp,r.stats.maxHp);assert.equal(n.lpr,1);
  }
});

test('local compiler rejects database-backed refs, missing source attributes and unreviewed damage semantics',()=>{
  const local=locals('16-9')[0];
  for(const change of [r=>r.useDb=true,r=>r.useDb=undefined,r=>r.level=1,
    r=>delete r.overwrittenData,r=>r.overwrittenData.prefabKey.m_defined=false,
    r=>r.overwrittenData.attributes.maxHp.m_defined=false,r=>r.overwrittenData.attributes.atk.m_value=NaN]) {
    const r=structuredClone(local);change(r);assert.throws(()=>compileStageLocalEnemy(r,{damageType:'PHYSIC'}));
  }
  for(const damageType of [undefined,'phys','unknown'])assert.throws(()=>compileStageLocalEnemy(local,{damageType}),/reviewed native damage type/);
});

test('compiling local definitions grants no catalogue or stage support',()=>{
  const support=read('candidates/arkpedia-ch16-enemy-support.json'),index=read('arkpedia-stages.json');
  for(const code of ['16-9','17-18']) {
    for(const ref of locals(code)) {
      compileStageLocalEnemy(ref,{damageType:'PHYSIC'});
      assert.equal(canonical[ref.id],undefined);assert.equal(support.enemies[ref.id],undefined);
    }
    assert.equal(index.stages.some(s=>s.code===code),false);
  }
});
