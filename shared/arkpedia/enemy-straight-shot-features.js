// SPDX-License-Identifier: GPL-3.0-or-later
// Straight Shot families share the native skill name CrossAttack, so one
// feature dispatches by record to its own pinned contract and parameters.
import {isRapidCrossbowman,rapidCrossbowmanNative,straightShotParams,STRAIGHT_SHOT_DESCRIPTION} from './enemy-rapid-crossbowman-features.js';
import {isCrossbowmanAmbusher,crossbowmanAmbusherNative,ambusherShotParams,AMBUSHER_SHOT_DESCRIPTION,AMBUSHER_STEALTH} from './enemy-crossbowman-ambusher-features.js';
export const isStraightShooter=r=>isRapidCrossbowman(r)||isCrossbowmanAmbusher(r);
export const straightShooterNative=(r,n)=>isRapidCrossbowman(r)?rapidCrossbowmanNative(r,n):crossbowmanAmbusherNative(r,n);
export const STRAIGHT_SHOT_FEATURES={
 // One wrapper owns the skill; the record's ability text describes it.
 'skill:CrossAttack':{matchesRecord:isStraightShooter,covers:straightShooterNative,nativeClaim:()=>({wrappers:1}),
  explains:text=>text===STRAIGHT_SHOT_DESCRIPTION||text===AMBUSHER_SHOT_DESCRIPTION,
  note:'Straight Shot: unblocked, same row or column, straight bolts that hit the first body in their path',
  ability:r=>({kind:'straightShot',params:isRapidCrossbowman(r)?straightShotParams:ambusherShotParams})},
};
/** The Ambushers' Invisible common ability: native stealth, also lifted while they shoot. */
export const AMBUSHER_STEALTH_ABILITY={kind:'nativeStealth',params:()=>({...AMBUSHER_STEALTH})};
export {isCrossbowmanAmbusher,crossbowmanAmbusherNative};
