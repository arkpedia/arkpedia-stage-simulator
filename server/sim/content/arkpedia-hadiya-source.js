// SPDX-License-Identifier: GPL-3.0-or-later
// Selected source data only. Neither a playable kit nor public admission.
import evidence from '../../../data/arkpedia-native-operators/char_394_hadiya.json' with {type: 'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {normalizeChess, normSpType} from '../simdata.js';

export const HADIYA_ID = 'char_394_hadiya';
export const HADIYA_SKILLS = Object.freeze(['skchr_hadiya_1', 'skchr_hadiya_2']);
export const selectedHadiyaBuild = build => selectedCNSourceBuild(evidence, HADIYA_ID, build);

export function selectedHadiyaInputs(unit) {
  const skill = unit.def.skill;
  if (!skill) throw Error('Incomplete original selected Hadiya inputs');
  const build = unit.def.raw.arkpedia;
  const selected = selectedHadiyaBuild({...build, skillId: skill.id});
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  if ((build.skillId != null && build.skillId !== skill.id) || unit.def.charId !== HADIYA_ID
    || !same(unit.def.stats, normalizeChess({stats: selected.stats}).stats)
    || !same(unit.rangeGrid, selected.rangeGrid) || !same(unit.def.tags, selected.tags)
    || !same(unit.def.talents.map(t => t.bb), selected.talentBb)
    || !same(skill.bb, selected.bb) || !same(skill.rangeGrid ?? [], selected.skillRangeGrid)
    || skill.skillType !== selected.source.skillType || skill.durationType !== selected.source.durationType
    || skill.spType !== normSpType(selected.source.spData.spType)
    || skill.spCost !== selected.source.spData.spCost || skill.initSp !== selected.source.spData.initSp
    || skill.duration !== selected.source.duration || skill.maxCharges !== selected.source.spData.maxChargeTime)
    throw Error('Incomplete original selected Hadiya inputs');
  return selected;
}

export function hadiyaSourceComponent(group, key, pathId) {
  const part = evidence[group]?.[key]?.flatMap(row => row.components).find(p => p.pathId === pathId);
  if (!part) throw Error('Missing original Hadiya component');
  return part.data;
}

export function hadiyaTalentInputs() {
  return {
    binding: hadiyaSourceComponent('characters', HADIYA_ID, '5692212858493683937'),
    producer: hadiyaSourceComponent('characters', HADIYA_ID, '1206869766499748065'),
    template: evidence.templates.hadiya_t_1,
    stun: evidence.buffDatabase.stun,
    ranges: evidence.tables.ranges,
  };
}
