// SPDX-License-Identifier: GPL-3.0-or-later
/** Same-side selectors respect ally isolation, hidden and sleeping bodies.
 * Opponent-only target-free and camouflage do not exclude their own allies. */
export function sameSideEnemyAuraTarget(source,target,{includeDevices=false}={}){
 return target.side===source.side&&target.alive&&target.deployed&&!target.hidden&&!target.removed
  &&(target.kind!=='device'||includeDevices&&!target.obstacle)&&!target.s.flags.untargetable&&!target.s.flags.isolated&&!target.s.flags.sleep;
}
