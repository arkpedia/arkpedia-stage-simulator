// SPDX-License-Identifier: GPL-3.0-or-later
// Original table selection only. This does not register a playable operator.
import evidence from '../../../data/arkpedia-native-operators/char_4217_makoto.json' with {type: 'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {normalizeChess, normSpType} from '../simdata.js';

export const MAKOTO_ID = 'char_4217_makoto';
export const MAKOTO_SKILLS = Object.freeze(['skchr_makoto_1', 'skchr_makoto_2', 'skchr_makoto_3']);
export const selectedMakotoBuild = build => selectedCNSourceBuild(evidence, MAKOTO_ID, build);

export function selectedMakotoInputs(unit) {
  const skill = unit.def.skill;
  if (!skill) throw Error('Incomplete original selected Makoto inputs');
  const build = unit.def.raw.arkpedia;
  const selected = selectedMakotoBuild({...build, skillId: skill.id});
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  if ((build.skillId != null && build.skillId !== skill.id) || unit.def.charId !== MAKOTO_ID
    || !same(unit.def.stats, normalizeChess({stats: selected.stats}).stats)
    || !same(unit.rangeGrid, selected.rangeGrid) || !same(unit.def.tags, selected.tags)
    || !same(unit.def.talents.map(t => t.bb), selected.talentBb)
    || !same(skill.bb, selected.bb) || !same(skill.rangeGrid ?? [], selected.skillRangeGrid)
    || skill.skillType !== selected.source.skillType || skill.durationType !== selected.source.durationType
    || skill.spType !== normSpType(selected.source.spData.spType)
    || skill.spCost !== selected.source.spData.spCost || skill.initSp !== selected.source.spData.initSp
    || skill.duration !== selected.source.duration || skill.maxCharges !== selected.source.spData.maxChargeTime)
    throw Error('Incomplete original selected Makoto inputs');
  return selected;
}

export function makotoSourceComponent(group, key, pathId) {
  const part = evidence[group]?.[key]?.flatMap(row => row.components).find(p => p.pathId === pathId);
  if (!part) throw Error('Missing original Makoto component');
  return part.data;
}
export function makotoDefaultInputs(){
 const read=id=>makotoSourceComponent('characters',MAKOTO_ID,id);
 return{root:read('-1218499832398557659'),mode:read('-3985492384108261851'),attack:read('-7239676370760577499'),
  trigger:read('3975289686999354917'),selector:read('5884809055292018213'),replacement:read('-6088048823850840539'),art:evidence.chararts[MAKOTO_ID][0].data};
}
export function makotoS1Inputs() {
  const read = id => makotoSourceComponent('characters', MAKOTO_ID, id);
  return {mode: read('2113126334119661093'), wrapper: read('-8120082265187824091'),
    trigger: read('2913041643974151717'), union: read('6199264337010609701'),
    healTrigger: read('-6308989604904907227'), attackTrigger: read('-2938589107860353499'),
    healSelector: read('86534097072016933'), attackSelector: read('8685380368023277093'),
    heal: read('-3514085099072598491'), attack: read('7294260590432538149'), hook: read('1623256020376145445'),
    projectile: evidence.projectiles.projectile_chr_makoto_s1};
}
export function makotoS2Inputs() {
  const read = id => makotoSourceComponent('characters', MAKOTO_ID, id);
  return {mode:read('-2876292474294186459'),attack:read('3635927784782679589'),
    trigger:read('-8248912276883583451'),selector:read('-1874532089215594971'),
    hook:read('-6711020895938949595'),aura:read('2200664464637021733'),validator:read('-9173143548894851547'),
    templates:Object.fromEntries(['makoto_s2_fear_possibility','makoto_s2_fear_impl','makoto_s2_fear_damage','makoto_s2_fear_aura_inst_kill'].map(k=>[k,evidence.templates[k]])),
    fear:evidence.buffDatabase.fear};
}
