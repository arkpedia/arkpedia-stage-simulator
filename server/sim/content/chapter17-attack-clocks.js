// SPDX-License-Identifier: GPL-3.0-or-later
// Selected native Combat cooldown bindings only. Animation/FSM timing and
// unrelated skill, channel and periodic clocks retain their own controllers.
import contract from '../../../data/candidates/arkpedia-ch17-attack-clock-contract.json' with {type:'json'};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const CHAPTER17_ATTACK_CLOCK_BINDINGS=Object.freeze(Object.fromEntries(Object.entries(contract.enemies).map(([id,p])=>[id,p.combatPathId])));
export function chapter17AttackClock(record,proof=contract.enemies[record?.key]){
 if(contract.schemaVersion!==1||contract.testOnly!==true||contract.frameParity!==false)throw Error('Missing Chapter 17 Combat clock contract');
 if(!Object.hasOwn(CHAPTER17_ATTACK_CLOCK_BINDINGS,record?.key))return null;
 const binding=CHAPTER17_ATTACK_CLOCK_BINDINGS[record.key];
 const selected=proof?.levels?.[record.level];
 if(!selected||record.prefabKey!==record.key||record.applyWay!==selected.applyWay||!same(record.talents?.groups,selected.groups)
  ||!same(record.talents?.bb,selected.bb)||!same(record.skills,selected.skills)||!same(record.abilities,selected.abilities))
  throw Error('Unreviewed Chapter 17 Combat clock record');
 const native=proof.native.map(JSON.parse),roots=native.filter(c=>c._combat),attacks=native.filter(c=>c._animKey==='Attack');
 if(roots.length!==1||roots[0]._combat.m_FileID!==0||roots[0]._combat.m_PathID!==binding||attacks.length!==1
  ||attacks[0]._affectedBySlowDown!==1||attacks[0]._timeMode!==0||attacks[0]._maxAnimScale!==1
  ||attacks[0]._cooldown!==0||attacks[0]._cooldownKey!=='duration'||attacks[0]._resetCdStrategy!==1||attacks[0]._waitForAttackEvent!==1
  ||attacks[0]._selectTargetTiming!==0||attacks[0]._selectTargetSource!==2||attacks[0]._interuptIfTargetDead!==0||attacks[0]._ignoreIfOwnerDead!==0
  ||attacks[0]._allowNoTarget!==0||attacks[0]._alwaysIncludeTarget!==1||attacks[0]._preDelay!==0||attacks[0]._escapeTime!==0
  ||!Number.isFinite(proof.attack?.duration)||!(proof.attack.duration>0)||!Number.isFinite(proof.attack.hit)||!(proof.attack.hit>0&&proof.attack.hit<proof.attack.duration)
  ||proof.attack.damageType!==(attacks[0]._damageType===1?'phys':attacks[0]._damageType===2?'arts':null))
  throw Error('Unreviewed Chapter 17 Combat clock binding');
 return{affectedBySlowDown:true};
}
export function chapter17AttackEvents(record){
 return chapter17AttackClock(record)?{...contract.enemies[record.key].attack}:null;
}
