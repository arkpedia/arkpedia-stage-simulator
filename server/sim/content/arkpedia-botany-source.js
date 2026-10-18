// SPDX-License-Identifier: GPL-3.0-or-later
// Original table selection only. This does not register a playable operator.
import evidence from '../../../data/arkpedia-native-operators/char_4223_botany.json' with {type: 'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {normalizeChess, normSpType} from '../simdata.js';

export const BOTANY_ID = 'char_4223_botany';
export const BOTANY_SKILLS = Object.freeze(['skchr_botany_1', 'skchr_botany_2']);
export const selectedBotanyBuild = build => selectedCNSourceBuild(evidence, BOTANY_ID, build);

export function selectedBotanyInputs(unit) {
  const skill = unit.def.skill;
  if (!skill) throw Error('Incomplete original selected Botany inputs');
  const build = unit.def.raw.arkpedia;
  const selected = selectedBotanyBuild({...build, skillId: skill.id});
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  if ((build.skillId != null && build.skillId !== skill.id) || unit.def.charId !== BOTANY_ID
    || !same(unit.def.stats, normalizeChess({stats: selected.stats}).stats)
    || !same(unit.rangeGrid, selected.rangeGrid) || !same(unit.def.tags, selected.tags)
    || !same(unit.def.talents.map(t => t.bb), selected.talentBb)
    || !same(skill.bb, selected.bb) || !same(skill.rangeGrid ?? [], selected.skillRangeGrid)
    || skill.skillType !== selected.source.skillType || skill.durationType !== selected.source.durationType
    || skill.spType !== normSpType(selected.source.spData.spType)
    || skill.spCost !== selected.source.spData.spCost || skill.initSp !== selected.source.spData.initSp
    || skill.duration !== selected.source.duration || skill.maxCharges !== selected.source.spData.maxChargeTime)
    throw Error('Incomplete original selected Botany inputs');
  return selected;
}

export function botanySourceComponent(group, key, pathId) {
  const part = evidence[group]?.[key]?.flatMap(row => row.components).find(p => p.pathId === pathId);
  if (!part) throw Error('Missing original Botany component');
  return part.data;
}
export function botanyNativeInputs() {
  const owner = pathId => botanySourceComponent('characters', BOTANY_ID, pathId);
  const root = owner('-1375545782524767420');
  return {root, modes: root._modes.map(ref => {
    const mode = owner(ref.m_PathID);
    return {pathId: ref.m_PathID, mode, attack: owner(mode._attack.m_PathID), trigger: owner(mode._attackTrigger.m_PathID),
      abilities: mode._generalAbilities.map(ref => owner(ref.m_PathID))};
  }), talent: owner('-4561706410878168252'),
    s1: botanySourceComponent('skills', BOTANY_SKILLS[0], '-7153721279235102625'),
    s1Attack: botanySourceComponent('skills', BOTANY_SKILLS[0], '7417283066513778783'),
    s2: botanySourceComponent('skills', BOTANY_SKILLS[1], '7015122995996678919'),
    artController:evidence.chararts[BOTANY_ID][0].data,
    templates: evidence.templates, projectiles: evidence.projectiles};
}
