// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-siegebreaker-animations.json' with{type:'json'};
import {sameOutcomeValue as same} from './enemy-outcome-contracts.js';
import {ordinaryMeleeBodyNative} from './enemy-ordinary-body-contract.js';
import {inspirationNative} from './enemy-inspiration-features.js';
const ids=['enemy_1083_sotiab','enemy_1083_sotiab_2'];
export const isSiegebreaker=r=>ids.includes(r.prefabKey);
export function siegebreakerNative(r,n){
 if(!isSiegebreaker(r)||r.level!==0||r.applyWay!=='MELEE'||r.stats.dmgType!=='phys'||r.stats.motion!=='WALK'||r.notCountInTotal
  ||!inspirationNative(r,n)||!same(r.abilities,[{text:'Able to land directly onto the battlefield.',format:'NORMAL'},
   {text:r.prefabKey.endsWith('_2')?'When Inspired, gains massively increased ATK.':'When Inspired, gains greatly increased ATK.',format:'NORMAL'}]))return false;
 return ordinaryMeleeBodyNative(r,n,{clock:clocks.enemies[r.prefabKey],birthDelay:1.5,attackDuration:1,startDuration:1.5,
  attackEvents:[{time:Math.fround(13/30),name:'OnAttack',int:0,float:0,string:''}],startEvents:[{time:1,name:'OnStart',int:0,float:0,string:''}]});
}
const feature={matchesRecord:isSiegebreaker,covers:siegebreakerNative};
export const SIEGEBREAKER_FEATURES={
 'native:siegebreakerLanding':{...feature,ability:{kind:'passiveEnemyBody',params:r=>({birthDelay:1.5,birthDuration:clocks.enemies[r.prefabKey].durations.Start,
  birthClip:'Start',attackAnim:{dur:clocks.enemies[r.prefabKey].durations.Attack,hit:clocks.enemies[r.prefabKey].events.Attack[0].time}})}},
 'native:siegebreakerMelee':{...feature,ability:{kind:'animatedMeleeAttack',params:r=>({animation:{clip:'Attack',duration:clocks.enemies[r.prefabKey].durations.Attack,
  releases:clocks.enemies[r.prefabKey].events.Attack.map(e=>e.time)}})}},
};
