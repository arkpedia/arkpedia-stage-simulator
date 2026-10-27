// SPDX-License-Identifier: GPL-3.0-or-later
// Internal action ports. Delivery, deduplication, preprocessing time, source
// identity and attachments belong to the caller; no launch/stage support.
import {fearProjectileAfflictions} from './chapter16-fear-affliction.js';

// Local lifetime mapping for the native ObjectPtr UID receipt. Engine removal
// corresponds to retirement; precise native recycle/animation frames stay held.
export function fearProjectileSourceReference(b,source){
 if(!source||!Number.isInteger(source.deploySeq)||!Number.isFinite(source.s.atk)||source.s.atk<0)
  throw Error('Fear projectile source reference requires a deployed source record');
 const life=source.deploySeq,cachedAtk=source.s.atk;let retired=false,ended=false,endHandle=null;const handles=[];
 const retireSource=()=>{retired=true;for(const handle of handles)b.off(handle);handles.length=0;};
 const release=()=>{ended=true;retireSource();if(endHandle)b.off(endHandle);endHandle=null;};
 const resolveSource=()=>{
  if(retired)return null;
  if(b.finished||b._endReq){release();return null;}
  if(source.removed||source.deploySeq!==life){retireSource();return null;}
  return source;
 };
 if(resolveSource()){
  handles.push(b.on('removed',({unit})=>{if(unit===source)retireSource();}),
   b.on('death',({unit})=>{if(unit===source&&source.removed)retireSource();}));
 }
 if(!ended)endHandle=b.on('battleEnd',release);
 return Object.freeze({cachedAtk,resolveSource,release,isBattleActive:()=>!ended&&!b.finished&&!b._endReq});
}

// The selected cast has atkScale=1 and Arts damage. Its native ApplyDamage
// evaluates current ATK while the source reference locks, with a preprocessed
// ATK fallback if it no longer locks. Identity resolution is deliberately the
// caller's responsibility; alive=false alone does not choose the fallback.
export function fearProjectileDamageAction(b,{cachedAtk,resolveSource,isBattleActive=()=>true}){
 if(!Number.isFinite(cachedAtk)||cachedAtk<0||typeof resolveSource!=='function'||typeof isBattleActive!=='function')
  throw Error('Fear projectile damage requires cached ATK and an explicit source resolver');
 return({target})=>{
  const life=target?.deploySeq;
  const valid=()=>isBattleActive()&&!b.finished&&!b._endReq&&b.chapter16FearAfflictions?.active!==false
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
