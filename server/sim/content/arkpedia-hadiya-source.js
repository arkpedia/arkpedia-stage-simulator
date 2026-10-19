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

export function hadiyaNativeInputs() {
  const c = id => hadiyaSourceComponent('characters', HADIYA_ID, id);
  const s = (skill, id) => hadiyaSourceComponent('skills', `skchr_hadiya_${skill}`, id);
  return {
    root: c('3289407314962172129'),
    modes: [
      {mode: c('667418768306686177'), attack: c('7048047928707401953'), trigger: c('5863999800581179617'),
        selector: c('8026461108459948257'), range: c('-7025877565558732575'), replacement: c('7990795595262216417')},
      {mode: c('-5949462224016553759'), attack: c('9020135240677869793'), trigger: c('-1342828710411548447'),
        selector: c('5547554297164351713'), range: c('-3357727954904004383'), replacement: c('3462918522923796705')},
      {mode: c('5792691836790196449'), attack: c('5468999303584565473'), trigger: c('-1429241120789083935'),
        selector: c('7439359057097279713'), range: c('5116628783497300193'), hook: c('-6241494391475058463')},
    ],
    skills: [
      {root: s(1, '352136165415765773'), sequence: s(1, '1926727401098888973'),
        animation: s(1, '-3007968838773520627'), marker: s(1, '3736789960546961165'),
        mode: s(1, '-6349138092012878067'), extra: s(1, '3413914939534198541')},
      {root: s(2, '-2035843910263484491'), sequence: s(2, '590242317043191733'),
        animation: s(2, '-6338953523133657163'), marker: s(2, '895142671220363189'),
        mode: s(2, '1689415402916761525'), extra: s(2, '-3396841797430521931')},
    ],
    art: evidence.chararts[HADIYA_ID][0].data,
    templates: evidence.templates,
  };
}
