// SPDX-License-Identifier: GPL-3.0-or-later
// Internal action-order port. Delivery, deduplication, damage/ATK evaluation and
// attachments belong to the explicitly supplied caller; no launch/stage support.
import {fearProjectileAfflictions} from './chapter16-fear-affliction.js';

export function applyFearProjectileImpact(b,{source,target,applyAttachments,runActions}){
 if(!source||typeof applyAttachments!=='function'||typeof runActions!=='function')
  throw Error('Fear projectile impact requires explicit source, attachment and action callers');
 const life=target?.deploySeq;
 const manager=fearProjectileAfflictions(b);
 const valid=()=>manager.active&&target?.alive&&target.deployed&&target.deploySeq===life;
 if(!valid())return false;
 // Native ActionController.OnHitTarget: _AttachBuffs -> attachments -> actions.
 // A non-miner can reject the affliction parent and still receive the actions.
 const parent=manager.apply(source,target);
 if(!valid())return false;
 applyAttachments({source,target,parent});
 if(!valid())return false;
 runActions({source,target,parent});
 return true;
}
