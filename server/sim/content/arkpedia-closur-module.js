// SPDX-License-Identifier: GPL-3.0-or-later
// Exact internal 17-14 module. Public module selection remains disabled.
import {verifyClosurModuleSource} from './arkpedia-closur-module-source.js';
const registries=new WeakMap(),present=u=>u?.alive&&u.deployed&&!u.hidden&&!u._removing;
function registry(b){
 let r=registries.get(b);if(r)return r;
 r={owners:new Set(),factor(source,target){
  if(!source)return 1;
  const attacker=b.units.find(u=>u.id===source.id&&u.deploySeq===source.deploySeq);
  if(!present(attacker)||attacker.side!=='enemy'||attacker.blockedBy!==target||!target.blocking.includes(attacker))return 1;
  for(const state of r.owners){const row=state.marks.get(target);if(state.valid()&&row?.life===target.deploySeq&&target.buffs.includes(row.buff))return .85;}
  return 1;
 }};
 b._takenMultipliers??=new Map();b._takenMultipliers.set(r,r.factor);registries.set(b,r);return r;
}
export function prepareClosurModule(point){
 const build=point.record.owner.build;if(build.module!=='uniequip_002_closur')return null;verifyClosurModuleSource();
 const b=point.b,u=point.u,key=`closur_e_002[friend]:${u.id}`,marks=new Map(),handles=[];
 const state={point,u,seq:null,stopped:false,marks,registered:null,
  valid:()=>!state.stopped&&!b.finished&&u.alive&&u.deployed&&!u._removing&&state.seq===u.deploySeq&&point.valid(),
  eligible:t=>t!==u&&present(t)&&!t.isFlying&&t.side==='ally'&&t.kind!=='device'&&b.allySelectable(t,u)
    &&(t.kind==='token'&&t.ownerUnit===u||point.recipients.has(t)&&t.findBuff(point.friendKey)?.source===u),
  refresh(){
   if(!state.valid())return;point.mark();if(!state.valid())return;
   for(const[t,row]of [...marks])if(row.life!==t.deploySeq||!state.eligible(t)||!t.buffs.includes(row.buff)){marks.delete(t);b.removeBuff(t,row.buff);}
   for(const t of b.allyUnits){
    if(!state.valid())return;if(!state.eligible(t)||marks.has(t))continue;
    const row={life:t.deploySeq,buff:null};marks.set(t,row);
    row.buff=b.addBuff(t,{key,source:u,admit:()=>state.valid()&&t.deploySeq===row.life&&marks.get(t)===row&&state.eligible(t),
     data:{nativeDurable:false},onRemove:()=>{if(marks.get(t)===row)marks.delete(t);}});
    if(!row.buff||!state.valid()||t.deploySeq!==row.life||marks.get(t)!==row){if(marks.get(t)===row)marks.delete(t);b.removeBuff(t,row.buff);}
   }
  },
  install(){
   if(handles.length||state.stopped)throw Error('Closure module cannot be reinstalled');
   state.registered=registry(b);state.registered.owners.add(state);
   handles.push(b.on('deploy',({unit,move})=>{if(unit===u&&!move){if(state.seq!==null&&state.seq!==u.deploySeq){state.stop();return;}state.seq=u.deploySeq;}if(state.seq!==null)state.refresh();},{owner:state}),
    b.on('tick',()=>{if(state.seq!==null&&!state.valid())state.stop();else state.refresh();},{owner:state}),
    b.on('death',({unit})=>{if(unit===u)state.stop();},{owner:state}),b.on('battleEnd',()=>state.stop(),{owner:state}));
  },
  stop(){
   if(state.stopped)return;state.stopped=true;for(const[t,row]of marks)b.removeBuff(t,row.buff);marks.clear();handles.forEach(h=>b.off(h));
   const r=state.registered;if(r){r.owners.delete(state);if(!r.owners.size){if(b._takenMultipliers?.get(r)===r.factor)b._takenMultipliers.delete(r);if(registries.get(b)===r)registries.delete(b);}}
  },
 };
 return state;
}
