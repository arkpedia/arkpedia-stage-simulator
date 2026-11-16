// SPDX-License-Identifier: GPL-3.0-or-later
import {prepareBehaviorProgram,decodeBehaviorParameters} from '../../../shared/arkpedia/behavior-program.js';
import {addDeviceSp} from './arkpedia-device-sp.js';
import {aggroCmp} from '../targeting.js';
import {recordStageOutcome} from './arkpedia-stage-outcomes.js';
/** Death programs use an existing tagged device's SP implementation. In a
 * stage without the native target, the original selector has no recipients. */
export function selectedDeathSp(params){
 const program=validate(params),{parentKey,mods={},selector,blackboard,log}=params;
 return{
  spawn(b,e,a){
   if(!e.alive||!e.deployed)return;a.life=e.deploySeq;a.parent=b.addBuff(e,{key:parentKey,source:e,mods,refresh:'independent'});
   const live=()=>e.alive&&e.deployed&&e.deploySeq===a.life;
   if(!live()){if(a.parent)b.removeBuff(e,a.parent);return;}
   if(log)a.log=b.addBuff(e,{key:log.buffKey,source:e,refresh:'independent'});
   if(!live()){if(a.parent)b.removeBuff(e,a.parent);if(a.log)b.removeBuff(e,a.log);}
  },
  death(c,b,e,a){
   const attached=a.parent&&e.buffs.includes(a.parent),logged=a.log&&e.buffs.includes(a.log);
   if(a.parent)b.removeBuff(e,a.parent);if(a.log)b.removeBuff(e,a.log);a.parent=null;a.log=null;
   if(c.reason!=='killed'||e.deploySeq!==a.life)return;
   if(attached){
    for(const target of selectedDeviceSpTargets(b,e,selector))program.run('ON_BUFF_START',{battle:b,unit:e,source:e,target,blackboard,spService:{add:(unit,amount)=>addDeviceSp(b,unit,amount)}});
   }
   if(logged)recordStageOutcome(b,e,log.key);
  },
 };
}
function validate({parentKey,mods={},selector,blackboard={},log,program,programComponent}){
 if(programComponent!==undefined)throw Error('Unhydrated behaviour program component');
 if(typeof parentKey!=='string'||!parentKey||parentKey.length>256||!mods||typeof mods!=='object'||Array.isArray(mods)||Object.entries(mods).some(([k,n])=>k!=='taunt'||!Number.isFinite(n))
  ||!selector||Object.keys(selector).sort().join()!=='maxTargets,side,tag'||typeof selector.tag!=='string'||!selector.tag||selector.tag.length>256||!['both','same','opposing'].includes(selector.side)||!Number.isSafeInteger(selector.maxTargets)||selector.maxTargets<1||selector.maxTargets>16
  ||log!==undefined&&(!log||typeof log.key!=='string'||!log.key||typeof log.buffKey!=='string'||!log.buffKey||log.buffKey===parentKey))throw Error('Invalid selected death SP');
 const p=prepareBehaviorProgram(program);p.validateServices(['sp']);p.validateBlackboard(blackboard);return p;
}
selectedDeathSp.validate=validate;
selectedDeathSp.decodeParameters=decodeBehaviorParameters;

/** Shared native tagged-device acquisition, independent of the trigger event. */
export function selectedDeviceSpTargets(b,e,selector){
 return b.units.filter(u=>u.kind==='device'&&u.tags?.has(selector.tag)&&u.alive&&u.deployed&&!u.hidden&&!u.removed
  &&(selector.side==='both'||(selector.side==='same')===(u.side===e.side))&&!u.s.flags.untargetable&&!u.s.flags.isolated&&!u.s.flags.sleep
  &&!(u.side!==e.side&&(u.s.flags.targetFree||u.s.flags.stealth||u.s.flags.camou))).sort(aggroCmp).slice(0,selector.maxTargets);
}
