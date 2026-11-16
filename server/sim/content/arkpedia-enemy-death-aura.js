// SPDX-License-Identifier: GPL-3.0-or-later
import {OwnedStageAura} from './arkpedia-stage-auras.js';
import {sameSideEnemyAuraTarget} from './arkpedia-enemy-aura-targets.js';
import {selectedDeviceSpTargets} from './arkpedia-enemy-death-sp.js';
import {addDeviceSp} from './arkpedia-device-sp.js';
import {bodyInRadius} from '../body.js';
import {prepareBehaviorProgram,decodeBehaviorParameters} from '../../../shared/arkpedia/behavior-program.js';
/** Independent source-owned recipient attachments consume a killed event once.
 * The shared aura tracks membership; the receiver retains its own SP gauge. */
export function selectedAuraDeathSp(params){
 const program=validate(params),{key,radius,includeSelf,markerKeys,selector,blackboard}=params;
 const update=(b,e,a)=>{
  const live=!a.ended&&e.alive&&e.deployed&&!e.hidden&&!e.removed&&e.deploySeq===a.life;
  a.aura?.update(live?b.units.filter(u=>(includeSelf||u!==e)&&sameSideEnemyAuraTarget(e,u)&&bodyInRadius(u,e.x,e.y,radius)):[]);
  if(a.ended||!e.alive||!e.deployed||e.deploySeq!==a.life)a.aura?.clear();
 };
 return{spawn(b,e,a){a.life=e.deploySeq;a.ended=false;a.markers=[];a.aura=new OwnedStageAura(b,e,{key,stackable:true});
   for(const marker of markerKeys){const buff=b.addBuff(e,{key:marker,source:e,refresh:'independent',maxStacks:Infinity,admit:u=>!a.ended&&u.alive&&u.deployed&&u.deploySeq===a.life});if(buff)a.markers.push(buff);}
   update(b,e,a);
   for(const event of ['enemySpawn','deploy'])b.on(event,()=>update(b,e,a),{owner:e});
   // Consume recipient attachments before the common source-death dispatcher
   // detaches this aura. An owner is also an eligible same-side recipient.
   b.on('death',({unit,reason})=>{
    const buff=a.aura.owned.get(unit);if(reason!=='killed'||a.ended||e.deploySeq!==a.life||!buff||!unit.buffs.includes(buff))return;
    if(unit!==e&&(!e.alive||!e.deployed))return;
    a.aura.owned.delete(unit);b.removeBuff(unit,buff);
    for(const target of selectedDeviceSpTargets(b,e,selector))program.run('ON_BUFF_START',{battle:b,unit:e,source:e,target,blackboard,spService:{add:(u,n)=>addDeviceSp(b,u,n)}});
   },{owner:e,priority:100});
  },tick:update,status(_c,b,e,a){update(b,e,a);},death(_c,b,e,a){a.ended=true;a.aura?.clear();for(const marker of a.markers??[])b.removeBuff(e,marker);a.markers=[];}};
}
function validate({key,radius,includeSelf,markerKeys,selector,blackboard={},program,programComponent}){
 if(programComponent!==undefined)throw Error('Unhydrated behaviour program component');
 if(typeof key!=='string'||!key||key.length>256||!Number.isFinite(radius)||radius<=0||radius>128||typeof includeSelf!=='boolean'
  ||!Array.isArray(markerKeys)||markerKeys.length>16||new Set(markerKeys).size!==markerKeys.length||markerKeys.some(k=>typeof k!=='string'||!k||k.length>256||k===key)
  ||!selector||Object.keys(selector).sort().join()!=='maxTargets,side,tag'||typeof selector.tag!=='string'||!selector.tag||!['both','same','opposing'].includes(selector.side)||!Number.isSafeInteger(selector.maxTargets)||selector.maxTargets<1||selector.maxTargets>16)throw Error('Invalid selected death aura');
 const p=prepareBehaviorProgram(program);p.validateServices(['sp']);p.validateBlackboard(blackboard);return p;
}
selectedAuraDeathSp.validate=validate;selectedAuraDeathSp.decodeParameters=decodeBehaviorParameters;
