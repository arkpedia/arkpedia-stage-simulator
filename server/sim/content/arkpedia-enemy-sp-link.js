// SPDX-License-Identifier: GPL-3.0-or-later
import {addDeviceSp,selectedDeviceSpTargets} from './arkpedia-device-sp.js';
import {prepareBehaviorProgram,decodeBehaviorParameters} from '../../../shared/arkpedia/behavior-program.js';
/** A native passive that selects tagged devices once, when it starts, and
 * leaves one derived periodic buff on each. The derived buffs belong to their
 * receivers and finish with the parent; a device that appears later is never
 * acquired, and a receiver that leaves takes its own link with it. */
export function selectedSpLink(params){
 const program=validate(params),{parentKey,linkKey,interval,selector,blackboard}=params;
 const clear=(b,a)=>{const links=a.links??[];a.links=[];for(const {unit,buff} of links)b.removeBuff(unit,buff);};
 return{
  spawn(b,e,a){
   const life=e.deploySeq;a.links=[];a.ended=false;
   const finish=()=>{a.ended=true;clear(b,a);};
   a.parent=b.addBuff(e,{key:parentKey,source:e,refresh:'independent',maxStacks:Infinity,onRemove:finish,onExpire:finish});
   if(!a.parent||a.ended||!e.alive||!e.deployed||e.deploySeq!==life||!e.buffs.includes(a.parent)){if(a.parent)b.removeBuff(e,a.parent);a.parent=null;return;}
   for(const unit of selectedDeviceSpTargets(b,e,selector)){
    if(a.ended)break;
    const receiverLife=unit.deploySeq;let entry=null;
    const buff=b.addBuff(unit,{key:linkKey,source:e,refresh:'independent',maxStacks:Infinity,interval,
     admit:u=>u.alive&&u.deployed&&u.deploySeq===receiverLife,
     onTick:()=>{
      if(a.ended||!unit.alive||!unit.deployed||unit.deploySeq!==receiverLife)return;
      program.run('ON_BUFF_TRIGGER',{battle:b,unit,target:unit,source:e,blackboard,buffKey:linkKey,spService:{add:(u,n)=>addDeviceSp(b,u,n)}});
     },
     onRemove:()=>{if(entry)a.links=a.links.filter(v=>v!==entry);},onExpire:()=>{if(entry)a.links=a.links.filter(v=>v!==entry);}});
    if(!buff)continue;
    if(a.ended||!unit.buffs.includes(buff)){b.removeBuff(unit,buff);continue;}
    entry={unit,buff};a.links.push(entry);
   }
  },
  death(_c,b,e,a){const parent=a.parent;a.parent=null;if(parent&&e.buffs.includes(parent))b.removeBuff(e,parent);a.ended=true;clear(b,a);},
 };
}
function validate({parentKey,linkKey,interval,selector,blackboard={},program,programComponent}){
 if(programComponent!==undefined)throw Error('Unhydrated behaviour program component');
 if([parentKey,linkKey].some(k=>typeof k!=='string'||!k||k.length>256)||parentKey===linkKey||!Number.isFinite(interval)||interval<=0
  ||!selector||Object.keys(selector).sort().join()!=='maxTargets,side,tag'||typeof selector.tag!=='string'||!selector.tag||!['both','same','opposing'].includes(selector.side)
  ||!Number.isSafeInteger(selector.maxTargets)||selector.maxTargets<1||selector.maxTargets>16)throw Error('Invalid selected SP link');
 const p=prepareBehaviorProgram(program);p.validateServices(['sp']);p.validateBlackboard(blackboard);return p;
}
selectedSpLink.validate=validate;selectedSpLink.decodeParameters=decodeBehaviorParameters;
