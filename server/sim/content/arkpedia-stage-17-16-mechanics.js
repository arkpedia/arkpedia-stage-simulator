// SPDX-License-Identifier: GPL-3.0-or-later
// Exact internal construction only. The public stage catalogue, ordinary
// constructor and native scheduler/FSM/presentation admission stay separate.
import source from'../../../data/candidates/arkpedia-stage-17-16-source.json' with{type:'json'};
import{jsonSourceDigest}from'../../../shared/arkpedia/source-digest.js';
import{stage17_16SchedulePlan,installStage17_16Schedule}from'./arkpedia-stage-17-16-schedule.js';
import{installStage17_16Cards}from'./arkpedia-stage-17-16-cards.js';
import{installStage17_16Dialogs}from'./arkpedia-stage-17-16-dialogs.js';
import{installViyPredefined,selectedViyPredefined}from'./arkpedia-viy-predefined.js';
// Pin the already implemented operator snapshots used by the four exact
// module record factories, rather than accepting a caller's edited catalogue.
const operatorPins={
 char_473_mberry:'119f4fa7c82d360bb8cb9ce883933e562936d00e27e3cc1c755430226988eaae',
 char_128_plosis:'0819f27c98c07abb8626228ae400cf1b23a479786a30231dbe57568bfcce8afa',
 char_4023_rfalcn:'a1af5a1ed1f97708e805ea7891d1f2a37658527479d1c6c995050255d537f2fa',
 char_488_buildr:'0a2b45fbbb21931f9e827c7e733e8566dbd1a2c4b7fb454d10f68d74d4e16017',
};
function verifySource(input=source){
 if(jsonSourceDigest(input)!=='1d2e674bbf2214013c02e0eae8e4734bce9aa56c21c3c970cdfec4ddce1a00dd')throw Error('Unreviewed 17-16 construction source');
}
export function stage17_16Preparation(stage,input=source){
 verifySource(input);
 const same=(a,b)=>a!==undefined&&jsonSourceDigest(a)===jsonSourceDigest(b);
 if(stage?.code!=='17-16'||stage.testOnly!==true||!same(stage.battle,input.stage.battle)
  ||!same(stage.geometry,input.geometry)||!same(stage.devices,input.devices)
  ||stage.pathing?.moveScale!==input.rawLevel.options.moveMultiplier||!Array.isArray(stage.tokens)||stage.tokens.length||stage.fixedSquad?.length)
  throw Error('Unreviewed 17-16 workspace stage selection');
 const p=selectedViyPredefined(),visible=Object.freeze([Object.freeze({build:Object.freeze({...p.build}),row:p.row,col:p.col,dir:p.dir,skillNumber:input.rawLevel.predefines.characterInsts[0].skillIndex+1})]);
 return Object.freeze({code:'17-16',kind:'stage-supplied',selectable:false,support:false,visible,hasReinforcements:true});
}
export function prepareStage17_16Mechanics(input){
 verifySource();
 const plan=stage17_16SchedulePlan(),operators={};
 for(const[id,pin]of Object.entries(operatorPins)){
  if(!input?.operators?.[id]||jsonSourceDigest(input.operators[id])!==pin)throw Error('Unreviewed 17-16 operator snapshot: '+id);
  operators[id]=structuredClone(input.operators[id]);
 }
 const data={operators,enemies:plan.records,tokens:{},sd:structuredClone(input.sd??{}),
  stage:{...structuredClone(source.stage),testOnly:true,geometry:structuredClone(source.geometry),devices:structuredClone(source.devices),tokens:[],pathing:{moveScale:plan.moveScale}}};
 return{data,layout:plan.layout,timeLimit:source.rawLevel.options.maxPlayTime===0?Infinity:source.rawLevel.options.maxPlayTime,
  install(b){
   // Register every exact hidden record before deploying the preset. The
   // initial body belongs to the field before the single battleStart event.
   const cards=installStage17_16Cards(b,data),viy=installViyPredefined(b),dialogs=installStage17_16Dialogs(b),schedule=installStage17_16Schedule(b,{cards,dialogs});
   Object.defineProperty(b,'internalStageMechanics',{value:Object.freeze({code:'17-16',testOnly:true,admitted:false,cards,viy,dialogs,schedule})});
  },
 };
}
