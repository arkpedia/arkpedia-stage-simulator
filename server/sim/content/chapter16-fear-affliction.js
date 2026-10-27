// SPDX-License-Identifier: GPL-3.0-or-later
// Internal source action receiver only; launch/controller and stage admission stay held.
import contract from '../../../data/candidates/arkpedia-ch16-fear-affliction-contract.json' with {type:'json'};
import {captureEnemySource} from './enemy-source-view.js';
const present=u=>u?.alive&&u.deployed;
const d=contract.defaults;
export function fearProjectileAfflictions(b){
 if(b.chapter16FearAfflictions)return b.chapter16FearAfflictions;
 let ended=false,seq=0;const receipts=new Map(),admissions=new WeakMap();
 const finish=p=>{
  if(!p?.active)return;p.active=false;
  if(receipts.get(p.target)===p)receipts.delete(p.target);
  b.removeBuff(p.target,p.parent);
  for(const child of p.children)b.removeBuff(p.target,child);
  p.children.length=0;
 };
 const valid=p=>!ended&&!b.finished&&!b._endReq&&p.active&&receipts.get(p.target)===p&&present(p.target)&&p.target.deploySeq===p.life
  &&(!p.parent||p.target.buffs.includes(p.parent));
 const manager=b.chapter16FearAfflictions={
  apply(source,target){
   if(ended||b.finished||b._endReq||!source||!present(target))return null;
   const token=++seq,life=target.deploySeq,sourceView=captureEnemySource(source);admissions.set(target,token);
   const previous=receipts.get(target);if(previous)finish(previous);
   // Removal callbacks may install a newer parent or replace the recipient body.
   if(admissions.get(target)!==token||ended||b.finished||b._endReq||!present(target)||target.deploySeq!==life)return null;
   const p={target,life,source:sourceView,active:true,parent:null,children:[],next:b.time+d.interval,token};
   receipts.set(target,p);
   p.parent=b.addBuff(target,{key:d.parentKey,source:p.source,persist:true,admit:()=>valid(p),onRemove:()=>finish(p)});
   if(!p.parent||!valid(p)||!target.findBuff(d.minerMark)){finish(p);return null;}
   const fearKey=`ch16:fearpj:fear:${p.token}`,disarmKey=`ch16:fearpj:disarm:${p.token}`;
   b.applyStatus(target,'fear',{key:fearKey,duration:d.fearDuration,source:p.source,refresh:'independent',ignoreSelect:true,
    admit:()=>valid(p),buffData:{fearProjectileParent:p.token}});
   const fear=target.findBuff(fearKey);
   if(fear){if(valid(p))p.children.push(fear);else b.removeBuff(target,fear);}
   if(!valid(p)){finish(p);return null;}
   const disarm=b.addBuff(target,{key:disarmKey,source:p.source,persist:true,flags:{disarm:true},admit:()=>valid(p),
    data:{nativeBuffKey:d.disarmKey,fearProjectileParent:p.token}});
   if(disarm){if(valid(p))p.children.push(disarm);else b.removeBuff(target,disarm);}
   if(!valid(p)){finish(p);return null;}
   return p;
  },
  finish,
 };
 b.on('tick',()=>{
  for(const p of [...receipts.values()]){
   if(!valid(p)){finish(p);continue;}
   while(valid(p)&&p.next<=b.time+1e-9){p.next+=d.interval;if(p.target.hp/p.target.s.maxHp===1)finish(p);}
  }
 });
 const retired=({unit})=>{const p=receipts.get(unit);if(p)finish(p);};
 b.on('death',retired);b.on('removed',retired);
 b.on('battleEnd',()=>{ended=true;for(const p of [...receipts.values()])finish(p);});
 return manager;
}
