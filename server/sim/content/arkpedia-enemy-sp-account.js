// SPDX-License-Identifier: GPL-3.0-or-later
import {SkillRuntime} from '../skills.js';
/** A noncasting enemy SP account. Stage/linked-object controllers can inspect
 * readiness without disguising waking, activation or transformation as a cast.
 * Explicit damage grants are independent of the packet's ordinary hurt-SP
 * credit; the unit's noSp flag still blocks them through SkillRuntime. */
export function reactiveEnemySpAccount({cost,initial=0,rate=0,perHit=1,cancelDamage=false}) {
 if(![cost,initial,rate,perHit].every(Number.isFinite)||cost<=0||initial<0||initial>cost||rate<0||perHit<0
  ||typeof cancelDamage!=='boolean')throw Error('Invalid reactive enemy SP account');
 return {
  spawn(b,e,a){
   if(e.kind!=='enemy'||e.skill&&!e.skill.noSkill)throw Error('Reactive SP requires an enemy without another skill account');
   e.base.spRecovery=rate;e.markDirty();
   a.skill=e.skill=new SkillRuntime(b,e,{skillType:'AUTO'},{id:'reactiveEnemySp',kind:'instant',spCost:cost,initSp:initial,
    spType:'time',trigger:'NEVER'});
   a.skill.reset();
   b.on('targetDamageModifier',c=>{
    if(c.target!==e||!e.alive||!e.deployed||e.hidden||e.skill!==a.skill||c.targetLife!==e.deploySeq)return;
    a.skill.gainSp(perHit,'incomingDamage');
    if(cancelDamage)c.cancel=true;
   },{owner:e});
  },
  // Ordinary routed enemies do not tick SkillRuntime in the common engine.
  // Placed devices/tokens already do; the spawn contract refuses those kinds.
  tick(_b,e,a,dt){if(e.alive&&e.deployed&&e.skill===a.skill)a.skill.tick(dt);},
 };
}
