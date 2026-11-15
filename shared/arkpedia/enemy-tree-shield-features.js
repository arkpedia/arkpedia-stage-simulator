// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-tree-shield-animations.json' with{type:'json'};
import {sameOutcomeValue as same} from './enemy-outcome-contracts.js';
import {ordinaryMeleeBodyNative} from './enemy-ordinary-body-contract.js';
const ids=['enemy_10069_ftlsj','enemy_10069_ftlsj_2'];
export const TREE_SHIELD_DESCRIPTION='Appears when your Operators are deployed in the 4 adjacent tiles around <Shield and Wall>';
export const isTreeShield=r=>ids.includes(r.prefabKey);
export function treeShieldNative(r,n){
 return isTreeShield(r)&&r.skills.length===0&&!r.sp&&same(r.talents,{bb:{},bbStr:{},groups:{}})
  &&same(r.abilities,[{text:TREE_SHIELD_DESCRIPTION,format:'NORMAL'}])
  &&ordinaryMeleeBodyNative(r,n,{clock:clocks.enemies[r.prefabKey],birthDelay:2,idleWhenBorn:1,interruptOnDetach:1,selectTargetSource:1,
   attackDuration:Math.fround(42/30),startDuration:1,attackEvents:[{time:Math.fround(17/30),name:'OnAttack',int:0,float:0,string:''}],startEvents:[]});
}
const feature={matchesRecord:isTreeShield,covers:treeShieldNative};
export const TREE_SHIELD_FEATURES={
 [`ability:${TREE_SHIELD_DESCRIPTION}`]:{...feature,explains:text=>text===TREE_SHIELD_DESCRIPTION,
  note:'The enemy owns its ordinary body, birth delay and melee. Source device adjacency and branch activation remain stage-controller responsibilities.'},
 'native:treeShieldBody':{...feature,ability:{kind:'passiveEnemyBody',params:r=>({birthDelay:2,birthDuration:2,birthClip:'Idle',birthLoop:true,
  attackAnim:{dur:clocks.enemies[r.prefabKey].durations.Attack,hit:clocks.enemies[r.prefabKey].events.Attack[0].time}})}},
 'native:treeShieldMelee':{...feature,ability:{kind:'animatedMeleeAttack',params:r=>({animation:{clip:'Attack',duration:clocks.enemies[r.prefabKey].durations.Attack,
  releases:clocks.enemies[r.prefabKey].events.Attack.map(e=>e.time)}})}},
};
