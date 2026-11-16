// SPDX-License-Identifier: GPL-3.0-or-later
/** Pure stage-provider boundary shared by enemy modifiers and data programs. */
export function environmentConditionMask(battle,unit){
 const field=battle.environmentConditions;if(!field)return 0;
 if(typeof field.maskAt!=='function')throw Error('Invalid stage environment condition provider');
 const mask=field.maskAt(unit)??0;
 if(!Number.isInteger(mask)||mask<0||mask>0xffffffff)throw Error('Invalid stage environment condition mask');
 return mask;
}
export const singleEnvironmentCondition=mask=>Number.isInteger(mask)&&mask>0&&mask<=0x40000000&&(mask&(mask-1))===0;
