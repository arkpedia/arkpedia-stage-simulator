// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyReviewedHiddenGroups} from '../tools/arkpedia/reviewed-hidden-groups.mjs';
const source=JSON.parse(readFileSync(new URL('../data/candidates/arkpedia-stage-16-8-source.json',import.meta.url)));
const expected={includedHiddenGroups:['group0'],excludedHiddenGroups:['group1']};
test('16-8 source normal ALL group adds five slugs; optional Six-Star replacement stays excluded',()=>{
  const geometry=structuredClone(source.geometry);assert.equal(applyReviewedHiddenGroups(geometry,source,expected),5);
  const spawns=geometry.waves.flatMap(w=>w.spawns);assert.equal(spawns.reduce((n,s)=>n+s.count,0),35);
  assert.equal(spawns.filter(s=>s.enemy_id==='enemy_10126_rkbomb').reduce((n,s)=>n+s.count,0),12);
  assert.equal(source.stage.enemies.total,35);assert.equal(source.geometry.waves.flatMap(w=>w.spawns).reduce((n,s)=>n+s.count,0),30);
});
test('no review, wrong partition, absent normal rune and ambiguous default disable fail before mutation',()=>{
  for(const change of [
    (s,e)=>{e.includedHiddenGroups=[];e.excludedHiddenGroups=['group0','group1'];},
    (s,e)=>{e.includedHiddenGroups=['group1'];e.excludedHiddenGroups=['group0'];},
    (s,e)=>{e.excludedHiddenGroups=[];},
    s=>{s.rawLevel.runes=s.rawLevel.runes.filter(r=>r.key!=='level_hidden_group_enable');},
    s=>{s.rawLevel.runes.push({key:'level_hidden_group_disable',difficultyMask:'ALL',blackboard:[{key:'key',valueStr:'group0'}]});},
    s=>{s.conditional[0].condition.random_pack='unreviewed';},
    s=>{s.conditional[0].wave=999;},
  ]){
    const s=structuredClone(source),e=structuredClone(expected),g=structuredClone(s.geometry),before=structuredClone(g);
    change(s,e);assert.throws(()=>applyReviewedHiddenGroups(g,s,e));assert.deepEqual(g,before);
  }
});
