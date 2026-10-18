// SPDX-License-Identifier: GPL-3.0-or-later
// Original table selection only. This does not register a playable operator.
import evidence from '../../../data/arkpedia-native-operators/char_4222_taraxa.json' with {type: 'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {normalizeChess, normSpType} from '../simdata.js';

export const TARAXA_ID = 'char_4222_taraxa';
export const TARAXA_SKILLS = Object.freeze(['skchr_taraxa_1', 'skchr_taraxa_2']);
export const selectedTaraxaBuild = build => selectedCNSourceBuild(evidence, TARAXA_ID, build);

export function selectedTaraxaInputs(unit) {
  const skill = unit.def.skill;
  if (!skill) throw Error('Incomplete original selected Taraxacum inputs');
  const build = unit.def.raw.arkpedia;
  const selected = selectedTaraxaBuild({...build, skillId: skill.id});
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  if ((build.skillId != null && build.skillId !== skill.id) || unit.def.charId !== TARAXA_ID
    || !same(unit.def.stats, normalizeChess({stats: selected.stats}).stats)
    || !same(unit.rangeGrid, selected.rangeGrid) || !same(unit.def.tags, selected.tags)
    || !same(unit.def.talents.map(t => t.bb), selected.talentBb)
    || !same(skill.bb, selected.bb) || !same(skill.rangeGrid ?? [], selected.skillRangeGrid)
    || skill.skillType !== selected.source.skillType || skill.durationType !== selected.source.durationType
    || skill.spType !== normSpType(selected.source.spData.spType)
    || skill.spCost !== selected.source.spData.spCost || skill.initSp !== selected.source.spData.initSp
    || skill.duration !== selected.source.duration || skill.maxCharges !== selected.source.spData.maxChargeTime)
    throw Error('Incomplete original selected Taraxacum inputs');
  return selected;
}

export function taraxaSourceComponent(group, key, pathId) {
  const part = evidence[group]?.[key]?.flatMap(row => row.components).find(p => p.pathId === pathId);
  if (!part) throw Error('Missing original Taraxacum component');
  return part.data;
}
export function taraxaNativeInputs() {
  const owner = pathId => taraxaSourceComponent('characters', TARAXA_ID, pathId);
  const root = owner('222644719906584764');
  return {root, modes: root._modes.map(ref => {
    const mode = owner(ref.m_PathID);
    return {pathId: ref.m_PathID, mode, attack: owner(mode._attack.m_PathID), trigger: owner(mode._attackTrigger.m_PathID),
      abilities: mode._generalAbilities.map(ref => owner(ref.m_PathID))};
  }), talent: owner('-3473435998802609988'),
    s1: taraxaSourceComponent('skills', TARAXA_SKILLS[0], '3250041386757968404'),
    s2: taraxaSourceComponent('skills', TARAXA_SKILLS[1], '7320933178505528353'),
    templates: evidence.templates, projectiles: evidence.projectiles};
}
