// SPDX-License-Identifier: GPL-3.0-or-later
import {recordStageOutcome} from './arkpedia-stage-outcomes.js';
/** SIMPLE native log inputs share the existing stage-result ledger. The
 * callback is available during combat; results retain the same contribution. */
export function recordNativeBattleInfo(b,unit,{key,addition}){
 validateNativeBattleInfo({key,addition});
 if(!unit||typeof unit!=='object'||Array.isArray(b.units)&&!b.units.includes(unit))throw Error('Invalid native battle info owner');
 if(addition)recordStageOutcome(b,unit,key,addition);
 b.emit('nativeBattleInfo',{unit,key,addition,total:nativeBattleInfo(b,key)});
}
export function nativeBattleInfo(b,key,unit=null){
 if(!unit)return b.stageOutcomes?.counters?.[key]??0;
 if(!b.units?.includes(unit))return 0;
 return(b.stageOutcomes?.events??[]).reduce((total,event)=>total+(event.key===key&&event.instance===unit.id?event.value:0),0);
}
export function validateNativeBattleInfo({key,addition}){
 if(typeof key!=='string'||!key||key.length>256||!Number.isSafeInteger(addition)||addition<0||addition>1024)throw Error('Invalid native battle info');
}
