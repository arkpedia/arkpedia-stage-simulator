// SPDX-License-Identifier: GPL-3.0-or-later
import e from '../../../data/arkpedia-native-operators/char_4207_branch.json' with { type: 'json' };
import { selectedCNSourceBuild } from './arkpedia-selected-cn-source.js';
export const BRANCH_ID = 'char_4207_branch';
export const BRANCH_SKILLS = Object.freeze(['skchr_branch_1', 'skchr_branch_2']);
export const selectedBranchBuild = build => selectedCNSourceBuild(e, BRANCH_ID, build);
export function branchNativeInputs() {
 const part = (group,key,id) => e[group][key].flatMap(r=>r.components).find(p=>p.pathId===id)?.data;
 return { ordinary:part('characters',BRANCH_ID,'-2471458536064813798'),
  modeAttack:part('characters',BRANCH_ID,'7215375809503622426'),
  modeSelector:part('characters',BRANCH_ID,'-8668370091982392038'),
  first:part('characters',BRANCH_ID,'-1686242165713930982'),
  markerEnd:part('characters',BRANCH_ID,'-3970810775685696230'),
  s1:part('skills',BRANCH_SKILLS[0],'5885449578972100848'),
  s2:part('skills',BRANCH_SKILLS[1],'7682073962776706516'),
  pulse:part('skills',BRANCH_SKILLS[1],'-6657771280588522028'),
  pulseSelector:part('skills',BRANCH_SKILLS[1],'-141073971959087660'),
  passive:part('characters',BRANCH_ID,'2176092032800322842'),
  talent:e.templates.branch_t_1.eventToActions.ON_SKILL_FINISH[0],
  resistance:e.buffDatabase['status_resistance[inf]'],tremble:e.buffDatabase.disarmed_combat,
  mixes:e.chararts[BRANCH_ID][0].data._mixSettings };
}
