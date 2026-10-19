// SPDX-License-Identifier: GPL-3.0-or-later
// Original selected tables and graph bindings. No playable-kit registration.
import evidence from '../../../data/arkpedia-native-operators/char_4229_aphris.json' with {type: 'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {normalizeChess, normSpType} from '../simdata.js';

export const APHRISSA_ID = 'char_4229_aphris';
export const APHRISSA_RELAY_ID = 'token_10070_aphris_pc';
export const APHRISSA_SKILLS = Object.freeze(['skchr_aphris_1', 'skchr_aphris_2', 'skchr_aphris_3']);
export const selectedAphrissaBuild = build => selectedCNSourceBuild(evidence, APHRISSA_ID, build);

export function selectedAphrissaInputs(unit) {
  const skill = unit.def.skill;
  if (!skill) throw Error('Incomplete original selected Aphrissa inputs');
  const build = unit.def.raw.arkpedia;
  const selected = selectedAphrissaBuild({...build, skillId: skill.id});
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  if ((build.skillId != null && build.skillId !== skill.id) || unit.def.charId !== APHRISSA_ID
    || !same(unit.def.stats, normalizeChess({stats: selected.stats}).stats)
    || !same(unit.rangeGrid, selected.rangeGrid) || !same(unit.def.tags, selected.tags)
    || !same(unit.def.talents.map(t => t.bb), selected.talentBb)
    || !same(skill.bb, selected.bb) || !same(skill.rangeGrid ?? [], selected.skillRangeGrid)
    || skill.skillType !== selected.source.skillType || skill.durationType !== selected.source.durationType
    || skill.spType !== normSpType(selected.source.spData.spType)
    || skill.spCost !== selected.source.spData.spCost || skill.initSp !== selected.source.spData.initSp
    || skill.duration !== selected.source.duration || skill.maxCharges !== selected.source.spData.maxChargeTime)
    throw Error('Incomplete original selected Aphrissa inputs');
  return selected;
}

export function aphrissaSourceComponent(group, key, pathId) {
  const part = evidence[group]?.[key]?.flatMap(row => row.components).find(p => p.pathId === pathId);
  if (!part) throw Error('Missing original Aphrissa component');
  return part.data;
}

export function aphrissaNativeInputs() {
  const owner = id => aphrissaSourceComponent('characters', APHRISSA_ID, id);
  const skill = (index, id) => aphrissaSourceComponent('skills', APHRISSA_SKILLS[index], id);
  const token = id => aphrissaSourceComponent('tokens', APHRISSA_RELAY_ID, id);
  return {
    root: owner('-7422000034470305698'),
    ordinary: owner('-4640825836822405026'),
    ordinaryRange: owner('5624412606725939294'),
    ordinaryRelayValidator: owner('1611079732495114334'),
    ordinaryTarget: owner('1998237598669987934'),
    relayTalent: owner('3424089749748244574'),
    resistanceTalent: owner('3491600395291648094'),
    s1: skill(0, '3874522094489511037'),
    s2: skill(1, '-5368994881660036386'),
    s2Beam: skill(1, '-79185909474764066'),
    s2Range: skill(1, '-6697157982275806498'),
    s2TurnUnion: skill(1, '3193138193450949342'),
    s2RelayValidator: skill(1, '6535142130720922334'),
    s2OperatorValidator: skill(1, '-5741114064500794658'),
    s2ExtendValidator: skill(1, '2124487134426979038'),
    s3: skill(2, '-5625433486398897937'),
    s3Sequence: skill(2, '-1073599293142318865'),
    s3Charge: skill(2, '-4303161870961327889'),
    s3Active: skill(2, '-5427451279434235665'),
    s3Attack: owner('-2884652594386771874'),
    s3DownAttack: owner('2121442231411531870'),
    s3Counter: owner('-2016164900660387746'),
    s3DownCounter: owner('8203240663059390558'),
    relayRoot: token('-8739687973461992897'),
    relayPassive: token('821564727457438271'),
    relayTalentPassive: token('4654743988350966335'),
    templates: evidence.templates,
    artController: evidence.chararts[APHRISSA_ID][0].data,
    relayArtController: evidence.tokenArtworkControllers[APHRISSA_RELAY_ID][0].data,
  };
}
