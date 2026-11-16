// SPDX-License-Identifier: GPL-3.0-or-later
/** Exact portable form of the shared native physical/Arts mode-switch pattern. */
export function ownerEnvironmentModeEvents(condition){
 const mode=index=>({op:'mode',who:'owner',index}),switchTo=index=>({op:'switchMode',who:'target',index});
 const when=(terms,yes)=>({op:'when',condition:{op:'all',terms},yes,no:[]});
 return{
  ON_BEFORE_ATTACK:[{op:'when',condition,
   yes:[when([{op:'silenced',who:'owner',unset:true},mode(1)],[switchTo(0)])],no:[when([mode(0)],[switchTo(1)])]}],
  ON_BUFF_DISABLE:[when([mode(0)],[switchTo(1)])],
 };
}
