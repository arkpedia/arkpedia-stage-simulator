// SPDX-License-Identifier: GPL-3.0-or-later
// Internal action ports. Delivery, deduplication, preprocessing time, source
// identity and attachments belong to the caller; no launch/stage support.
import {fearProjectileAfflictions} from './chapter16-fear-affliction.js';

// The selected cast has atkScale=1 and Arts damage. Its native ApplyDamage
// evaluates current ATK while the source reference locks, with a preprocessed
// ATK fallback if it no longer locks. Identity resolution is deliberately the
// caller's responsibility; alive=false alone does not choose the fallback.
export function fearProjectileDamageAction(b,{cachedAtk,resolveSource}){
 if(!Number.isFinite(cachedAtk)||cachedAtk<0||typeof resolveSource!=='function')
  throw Error('Fear projectile damage requires cached ATK and an explicit source resolver');
 return({target})=>{
  const life=target?.deploySeq;
  const valid=()=>!b.finished&&!b._endReq&&b.chapter16FearAfflictions?.active!==false
   &&target?.alive&&target.deployed&&target.deploySeq===life;
  if(!valid())return;
  const source=resolveSource();
  if(!valid())return;
  const amount=source?source.s.atk:cachedAtk;
  if(!Number.isFinite(amount)||amount<0)throw Error('Invalid resolved fear projectile ATK');
  return b.dealDamage(source??null,target,{amount,type:'arts',isAttack:true,canDodge:true,
   tags:['chapter16','fear-projectile-native-impact']});
 };
}

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
