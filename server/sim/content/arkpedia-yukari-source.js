// SPDX-License-Identifier: GPL-3.0-or-later
// Original table selection only. This does not register a playable operator.
import evidence from '../../../data/arkpedia-native-operators/char_4219_yukari.json' with {type: 'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {normalizeChess, normSpType} from '../simdata.js';

export const YUKARI_ID = 'char_4219_yukari';
export const YUKARI_SKILLS = Object.freeze(['skchr_yukari_1', 'skchr_yukari_2']);
export const selectedYukariBuild = build => selectedCNSourceBuild(evidence, YUKARI_ID, build);

export function selectedYukariInputs(unit) {
  const skill = unit.def.skill;
  if (!skill) throw Error('Incomplete original selected Yukari inputs');
  const build = unit.def.raw.arkpedia;
  const selected = selectedYukariBuild({...build, skillId: skill.id});
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  if ((build.skillId != null && build.skillId !== skill.id) || unit.def.charId !== YUKARI_ID
    || !same(unit.def.stats, normalizeChess({stats: selected.stats}).stats)
    || !same(unit.rangeGrid, selected.rangeGrid) || !same(unit.def.tags, selected.tags)
    || !same(unit.def.talents.map(t => t.bb), selected.talentBb)
    || !same(skill.bb, selected.bb) || !same(skill.rangeGrid ?? [], selected.skillRangeGrid)
    || skill.skillType !== selected.source.skillType || skill.durationType !== selected.source.durationType
    || skill.spType !== normSpType(selected.source.spData.spType)
    || skill.spCost !== selected.source.spData.spCost || skill.initSp !== selected.source.spData.initSp
    || skill.duration !== selected.source.duration || skill.maxCharges !== selected.source.spData.maxChargeTime)
    throw Error('Incomplete original selected Yukari inputs');
  return selected;
}

export function yukariSourceComponent(group, key, pathId) {
  const part = evidence[group]?.[key]?.flatMap(row => row.components).find(p => p.pathId === pathId);
  if (!part) throw Error('Missing original Yukari component');
  return part.data;
}
export function yukariNativeInputs(){
 const owner=id=>yukariSourceComponent('characters',YUKARI_ID,id),skill=(index,id)=>yukariSourceComponent('skills',YUKARI_SKILLS[index],id);
 return{root:owner('-4578916712774622455'),ordinary:owner('2501127350376276745'),ordinarySelector:owner('-5733160562708700407'),
  talent:owner('6606001467802657545'),heal:owner('-7827353325321772279'),healSelector:owner('-4856562115062717687'),
  s1:skill(0,'-840541679911766411'),s1Attack:skill(0,'-8534795369964767627'),s2:skill(1,'-322774957127160266'),s2Grant:skill(1,'956012865735044662'),
  templates:evidence.templates,projectiles:evidence.projectiles,artController:evidence.chararts[YUKARI_ID][0].data};
}
