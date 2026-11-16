// SPDX-License-Identifier: GPL-3.0-or-later
import {sameOutcomeValue as same} from './enemy-outcome-contracts.js';

/** Common unscaled native talent binding; variants declare their wrapper type. */
export function nativeUnscaledTalentBinding(native,component,script='-2726233351382997147'){
 const wrapper=native.$siblings(component).find(v=>v.m_Script?.m_PathID===script);
 const fields={m_Script:{m_FileID:1,m_PathID:script},_overwriteTalentKey:'',_overwriteParentRangeId:0,_checkValidBySkillIndex:[],_attachInDummy:0,_defaultModeIndex:-1,_attackBlackboardModeIndex:-1,_extraAttackBlackboardModeIndices:[],_overrideDefaultRangeId:0,_applyTalentScale:0,_influenceSkillBlackboard:0,_fromRawDataToSkill:0,_applyTalentRange:0,_applyBlackboardBySkill:0,_applyStrBlackboardBySkill:0,_writeRangeIdToProjectileBlackboard:0,_affectWhenNotRootTalent:0,_scaleCertainKeyFlag:0,_scaleCertainKeyList:[],_scaleCertainMode:0,_scaleModeIndices:[]};
 return !!wrapper&&Object.entries(fields).every(([key,value])=>same(wrapper[key],value));
}
