// SPDX-License-Identifier: GPL-3.0-or-later
import contract from '../../../data/candidates/arkpedia-ch17-bag-feeding-contract.json' with {type:'json'};
import {verifyEnemyInstantKill} from '../enemy-instant-kill.js';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function verifyBagFeedingSource(id,p=contract){
 const fail=()=>{throw Error('Unreviewed Bag feeding clock or native consumption action');};
 if(p?.schemaVersion!==1||p.testOnly!==true||p.frameParity!==false||!Object.hasOwn(p.enemies??{},id)
  ||p.eventNames?.finish!=='ON_BUFF_FINISH'||p.eventNames?.trigger!=='ON_BUFF_TRIGGER'||p.consume?.length!==2||p.finishTrigger?.length!==1
  ||p.defaults?.feedingDuration!==10.5||p.defaults?.feedingInterval!==1)fail();
 const gate=p.consume[0],action=verifyEnemyInstantKill(p.consume[1]),finish=p.finishTrigger[0],r=p.enemies[id];
 if(Object.keys(gate).length!==2||gate.$type!=='Torappu.Battle.Action.Nodes+CheckEnemySkillAffecting'||gate._targetType!=='BUFF_SOURCE'
  ||action._targetType!=='BUFF_OWNER'||action._killSource!==false||action._noSource!==false||action._skipReborn!==false
  ||finish.$type!=='Torappu.Battle.Action.Nodes+TriggerBuffsByKeys'||finish._targetType!=='BUFF_OWNER'
  ||!same(finish._buffKeys,['enemy_mubag_kill_murad[flag]'])||['_excludeThisBuff','_excludeInTriggerAll','_forceTrigger','_triggerAllBuffs'].some(k=>finish[k]!==false))fail();
 const skill=JSON.parse(r.skillOriginalJson),combat=JSON.parse(r.combatOriginalJson),feed=r.feeding;
 if(skill._affectedBySlowDown!==0||skill._timeMode!==3||skill._cooldownKey!=='anim_duration'||r.phaseDuration!==11
  ||Object.hasOwn(combat,'_affectedBySlowDown')||Object.hasOwn(combat,'_animKey')||feed.buffKey!=='enemy_mubag_atk_up'
  ||feed.lifeTime!==10.5||feed.lifeTimeType!==1||feed.triggerInterval!==1||feed.waitFirstTriggerInterval!==1||feed.statusResistable!==2
  ||['isStunnable','isFreezable','isLevitatable','isGroundBoundable'].some(k=>feed[k]!==0)
  ||!same(feed.attributes,{abnormalAntis:[],abnormalComboImmunes:[],abnormalCombos:[],abnormalFlags:[],abnormalImmunes:[],attributeModifiers:[]}))fail();
 // This unnamed noncontrol parent uses the regular automatic-eligibility
 // mapping; the retained raw statusResistable enum is not reinterpreted here.
 return Object.freeze({killAction:action,feedingDuration:feed.lifeTime,feedingInterval:feed.triggerInterval,
  phaseDuration:r.phaseDuration,feedingSourceStatusResistable:false,skillAffectedBySlowDown:false});
}
