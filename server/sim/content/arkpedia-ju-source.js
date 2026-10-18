// SPDX-License-Identifier: GPL-3.0-or-later
// Original table selection only. This does not register a playable operator.
import evidence from '../../../data/arkpedia-native-operators/char_4221_ju.json' with {type: 'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {normalizeChess, normSpType} from '../simdata.js';

export const JU_ID = 'char_4221_ju';
export const JU_SKILLS = Object.freeze(['skchr_ju_1', 'skchr_ju_2']);
export const selectedJuBuild = build => selectedCNSourceBuild(evidence, JU_ID, build);

export function selectedJuInputs(unit) {
  const skill = unit.def.skill;
  if (!skill) throw Error('Incomplete original selected Ju inputs');
  const build = unit.def.raw.arkpedia;
  const selected = selectedJuBuild({...build, skillId: skill.id});
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  if ((build.skillId != null && build.skillId !== skill.id) || unit.def.charId !== JU_ID
    || !same(unit.def.stats, normalizeChess({stats: selected.stats}).stats)
    || !same(unit.rangeGrid, selected.rangeGrid) || !same(unit.def.tags, selected.tags)
    || !same(unit.def.talents.map(t => t.bb), selected.talentBb)
    || !same(skill.bb, selected.bb) || !same(skill.rangeGrid ?? [], selected.skillRangeGrid)
    || skill.skillType !== selected.source.skillType || skill.durationType !== selected.source.durationType
    || skill.spType !== normSpType(selected.source.spData.spType)
    || skill.spCost !== selected.source.spData.spCost || skill.initSp !== selected.source.spData.initSp
    || skill.duration !== selected.source.duration || skill.maxCharges !== selected.source.spData.maxChargeTime)
    throw Error('Incomplete original selected Ju inputs');
  return selected;
}

export function juSourceComponent(group, key, pathId) {
  const component = evidence[group]?.[key]?.flatMap(row => row.components)
    .find(part => part.pathId === pathId);
  if (!component) throw Error('Missing original Ju component');
  return component.data;
}

export function juNativeInputs() {
  const owner = pathId => juSourceComponent('characters', JU_ID, pathId);
  const skill = (index, pathId) => juSourceComponent('skills', JU_SKILLS[index], pathId);
  const projectile = (key, pathId) => juSourceComponent('projectiles', key, pathId);
  return {
    root: owner('2270243336663970079'),
    ordinary: owner('3157216610612982047'),
    ordinarySelector: owner('3300171949473116447'),
    s2Attack: owner('2127071424874590495'),
    s2Selector: owner('-6893981573928799969'),
    talent: owner('5914913970001391903'),
    s1: skill(0, '1320541379567901434'),
    s1Attack: skill(0, '1533296779637185274'),
    s1Selector: skill(0, '2473391087346932474'),
    s2: skill(1, '-2598262169233215323'),
    s2Buffs: skill(1, '-4296442019744665435'),
    s2Aura: skill(1, '-5233858499592671067'),
    ordinaryProjectile: projectile('projectile_chr_ju', '-2169976116972856660'),
    ordinaryMovement: projectile('projectile_chr_ju', '7221377419024095916'),
    s1Projectile: projectile('projectile_chr_ju_s1', '23612793641943109'),
    s1Movement: projectile('projectile_chr_ju_s1', '261003329231700037'),
    s2Projectile: projectile('projectile_chr_ju_s2', '6731274324302738297'),
    templates: evidence.templates,
    animator: evidence.chararts[JU_ID][0].data,
    artController: juSourceComponent('artworkHierarchy', JU_ID, '-2922912604820152915'),
  };
}
