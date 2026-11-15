// SPDX-License-Identifier: GPL-3.0-or-later
/** Native type-1, nonempty-key pairs: any pair whose blocker AND blockee
 * markers are present admits a new block. Existing relationships have their
 * own source-owned release policy, rather than being rechecked here. */
export function blockerBuffPairsMatch(blocker,enemy){
  const pairs=enemy.profile?.blockerBuffPairs;
  return !pairs?.length||pairs.some(pair=>blocker.findBuff(pair.blockerBuffKey)&&enemy.findBuff(pair.blockeeBuffKey));
}
