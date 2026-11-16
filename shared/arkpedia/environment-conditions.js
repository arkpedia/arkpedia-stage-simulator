// SPDX-License-Identifier: GPL-3.0-or-later
/** Pure stage-provider boundary shared by enemy modifiers and data programs. */
export function environmentConditionMask(battle,unit){
 const field=battle.environmentConditions;if(!field)return 0;
 if(field.maskAt===undefined&&typeof field.test==='function')return 0;
 if(typeof field.maskAt!=='function')throw Error('Invalid stage environment condition provider');
 const mask=field.maskAt(unit)??0;
 if(!Number.isInteger(mask)||mask<0||mask>0xffffffff)throw Error('Invalid stage environment condition mask');
 return mask;
}
export const singleEnvironmentCondition=mask=>Number.isInteger(mask)&&mask>0&&mask<=0x40000000&&(mask&(mask-1))===0;
/** Distinct native environment controllers do not share condition bits. */
export function environmentCondition(battle,unit,condition){
 if(condition!=='act31SidePollute')throw Error('Unknown stage environment condition');
 const field=battle.environmentConditions;if(!field)return false;
 if(field.test===undefined&&typeof field.maskAt==='function')return false;
 if(typeof field.test!=='function')throw Error('Invalid named stage environment provider');
 const value=field.test(condition,unit);
 if(typeof value!=='boolean')throw Error('Invalid named stage environment condition');
 return value;
}
