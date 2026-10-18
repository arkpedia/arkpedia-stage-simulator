// SPDX-License-Identifier: GPL-3.0-or-later
// Original table selection only. This does not register a playable operator.
import evidence from '../../../data/arkpedia-native-operators/char_4213_skybx.json' with {type: 'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {normalizeChess, normSpType} from '../simdata.js';

export const SKYBOX_ID = 'char_4213_skybx';
export const SKYBOX_SKILLS = Object.freeze(['skchr_skybx_1', 'skchr_skybx_2']);
export const selectedSkyboxBuild = build => selectedCNSourceBuild(evidence, SKYBOX_ID, build);

export function selectedSkyboxInputs(unit) {
  const skill = unit.def.skill;
  if (!skill) throw Error('Incomplete original selected Skybox inputs');
  const build = unit.def.raw.arkpedia;
  const selected = selectedSkyboxBuild({...build, skillId: skill.id});
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  if ((build.skillId != null && build.skillId !== skill.id) || unit.def.charId !== SKYBOX_ID
    || !same(unit.def.stats, normalizeChess({stats: selected.stats}).stats)
    || !same(unit.rangeGrid, selected.rangeGrid) || !same(unit.def.tags, selected.tags)
    || !same(unit.def.talents.map(t => t.bb), selected.talentBb)
    || !same(skill.bb, selected.bb) || !same(skill.rangeGrid ?? [], selected.skillRangeGrid)
    || skill.skillType !== selected.source.skillType || skill.durationType !== selected.source.durationType
    || skill.spType !== normSpType(selected.source.spData.spType)
    || skill.spCost !== selected.source.spData.spCost || skill.initSp !== selected.source.spData.initSp
    || skill.duration !== selected.source.duration || skill.maxCharges !== selected.source.spData.maxChargeTime)
    throw Error('Incomplete original selected Skybox inputs');
  return selected;
}

export function skyboxSourceComponent(group, key, pathId) {
  const part = evidence[group]?.[key]?.flatMap(row => row.components).find(p => p.pathId === pathId);
  if (!part) throw Error('Missing original Skybox component');
  return part.data;
}
export function skyboxNativeInputs() {
  const owner=pathId=>skyboxSourceComponent('characters',SKYBOX_ID,pathId),root=owner('3799167938044558607');
  return {root,modes:root._modes.map(ref=>{
    const mode=owner(ref.m_PathID);
    return {pathId:ref.m_PathID,mode,attack:owner(mode._attack.m_PathID),trigger:owner(mode._attackTrigger.m_PathID)};
  }),s1:skyboxSourceComponent('skills',SKYBOX_SKILLS[0],'-2486689608233139802'),
    s1Attack:skyboxSourceComponent('skills',SKYBOX_SKILLS[0],'-5325103701835529818'),
    s2:skyboxSourceComponent('skills',SKYBOX_SKILLS[1],'1354464068243986088'),
    artController:evidence.chararts[SKYBOX_ID][0].data,templates:evidence.templates,projectiles:evidence.projectiles};
}
