// SPDX-License-Identifier: GPL-3.0-or-later
// Born output may outlive its owner, but cannot read a replacement deployment.
export function captureEnemySource(u){
 const view=Object.assign(Object.create(Object.getPrototypeOf(u)),{...u,
  base:{...u.base},mem:{},buffs:u.buffs.slice(),tags:new Set(u.tags),
  profile:{hitSleep:u.profile?.hitSleep},stats:u.stats,alive:false,deployed:false,removed:true});
 Object.defineProperty(view,'s',{value:structuredClone(u.s),enumerable:true});return view;
}
