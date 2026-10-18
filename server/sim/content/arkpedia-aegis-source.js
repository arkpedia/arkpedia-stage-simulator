// SPDX-License-Identifier: GPL-3.0-or-later
// Original table selection only. This does not register a playable operator.
import evidence from '../../../data/arkpedia-native-operators/char_4218_aigis.json' with {type: 'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {normalizeChess, normSpType} from '../simdata.js';

export const AEGIS_ID = 'char_4218_aigis';
export const AEGIS_SKILLS = Object.freeze(['skchr_aigis_1', 'skchr_aigis_2']);
export const selectedAegisBuild = build => selectedCNSourceBuild(evidence, AEGIS_ID, build);

export function selectedAegisInputs(unit) {
  const skill = unit.def.skill;
  if (!skill) throw Error('Incomplete original selected Aegis inputs');
  const build = unit.def.raw.arkpedia;
  const selected = selectedAegisBuild({...build, skillId: skill.id});
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  if ((build.skillId != null && build.skillId !== skill.id) || unit.def.charId !== AEGIS_ID
    || !same(unit.def.stats, normalizeChess({stats: selected.stats}).stats)
    || !same(unit.rangeGrid, selected.rangeGrid) || !same(unit.def.tags, selected.tags)
    || !same(unit.def.talents.map(t => t.bb), selected.talentBb)
    || !same(skill.bb, selected.bb) || !same(skill.rangeGrid ?? [], selected.skillRangeGrid)
    || skill.skillType !== selected.source.skillType || skill.durationType !== selected.source.durationType
    || skill.spType !== normSpType(selected.source.spData.spType)
    || skill.spCost !== selected.source.spData.spCost || skill.initSp !== selected.source.spData.initSp
    || skill.duration !== selected.source.duration || skill.maxCharges !== selected.source.spData.maxChargeTime)
    throw Error('Incomplete original selected Aegis inputs');
  return selected;
}

export function aegisSourceComponent(group, key, pathId) {
  const part = evidence[group]?.[key]?.flatMap(row => row.components).find(p => p.pathId === pathId);
  if (!part) throw Error('Missing original Aegis component');
  return part.data;
}
export function aegisNativeInputs(){
 const owner=id=>aegisSourceComponent('characters',AEGIS_ID,id),root=owner('644028478319572997');
 return{root,modes:root._modes.map(ref=>{const mode=owner(ref.m_PathID);return{pathId:ref.m_PathID,mode,attack:owner(mode._attack.m_PathID),trigger:owner(mode._attackTrigger.m_PathID),
  hook:mode._animatorHooker.m_PathID==='0'?null:owner(mode._animatorHooker.m_PathID)};}),
  s1:aegisSourceComponent('skills',AEGIS_SKILLS[0],'8630322705540194064'),
  s2:aegisSourceComponent('skills',AEGIS_SKILLS[1],'-603818715698787806'),
  s2Missiles:aegisSourceComponent('skills',AEGIS_SKILLS[1],'3458929326777535010'),
  s2Kick:aegisSourceComponent('skills',AEGIS_SKILLS[1],'-6574393273308116446'),
  s2End:aegisSourceComponent('skills',AEGIS_SKILLS[1],'3101406417099328034'),
  ordinarySelector:owner('-665036946679908347'),talent:owner('-8078009171055331323'),takeoff:owner('8532344131868833797'),
  templates:evidence.templates,projectiles:evidence.projectiles,artController:evidence.chararts[AEGIS_ID][0].data};
}
