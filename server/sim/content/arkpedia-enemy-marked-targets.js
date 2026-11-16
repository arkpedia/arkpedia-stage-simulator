// SPDX-License-Identifier: GPL-3.0-or-later
/** One shared selector for marked ranged targets and ordinary blocker fallback. */
export function configureMarkedEnemyTargets(e,params){
 validateMarkedEnemyTargets(params);
 const {radius,globalRange=false,markerKey,groundOnly,excludedTag=null}=params,prior=e.profile.canTarget;
 e.profile.melee=false;e.profile.globalRange=globalRange;
 if(!globalRange)e.base.rangeRadius=radius;
 e.profile.canTarget=u=>(e.blockedBy?u===e.blockedBy:(!groundOnly||!u.isFlying)&&!!u.findBuff(markerKey)
  &&(!excludedTag||!u.tags.has(excludedTag)))&&(!prior||prior(u));
 e.markDirty();
}
export function validateMarkedEnemyTargets({radius,globalRange=false,markerKey,groundOnly,excludedTag=null}){
 if(typeof globalRange!=='boolean'||(!globalRange&&(!Number.isFinite(radius)||radius<=0))
  ||typeof markerKey!=='string'||!markerKey||typeof groundOnly!=='boolean'
  ||excludedTag!==null&&(typeof excludedTag!=='string'||!excludedTag))throw Error('Invalid marked enemy targeting');
}
