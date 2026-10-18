// SPDX-License-Identifier: GPL-3.0-or-later
// Held S2 persona combat. Entry, SP, passive stats and all-out compose separately.
import evidence from '../../../data/arkpedia-native-operators/char_4217_makoto.json' with {type:'json'};
import clocks from '../../../data/arkpedia-makoto-clocks.json' with {type:'json'};
import {MAKOTO_ID as ID,selectedMakotoInputs,makotoS2Inputs} from './arkpedia-makoto-source.js';
import {absoluteRangeKeys,canTargetEnemy,sortEnemyTargets} from '../targeting.js';
import {bodyInKeys} from '../body.js';
import {sourceAbilityDelta} from './arkpedia-slow-down.js';

export const MAKOTO_S2_COMBAT_CONTRACT=Object.freeze({
  scope:'Selected original S2 delayed max-target ground Arts attacks, independent Fear producer and source-owned all-motion execution aura only.',
  mapping:'An explicit owning form predicate supplies persona presence; passive stats and skill accounts remain separate. The selected nonextended x-1 attack captures at most attack@max_target normal-priority ground input lives. Its empty animation key uses the original .800000011920929 pre-delay on an uncapped sampled base-BAT/current-interval clock with live slowdown, never a fabricated attack clip. One accepted multi-input receipt applies each non-missable Fear-chance producer before the separate normal-hit Arts action. The logical common Fear uses shared immunity/resistance/movement and survives owner exit. The all-motion aura owns independent recipient markers, polls every original .10000000149011612 world seconds, triggers immediately on entry and accepts Fear from any source. Strict current HP < live ATK times kill_atk_scale uses neither attack scale nor source outgoing damage multipliers. One claimed attempt applies the original fixed sourceless True kill_damage through the existing ordinary-stage damage pipeline, then finishes its aura marker; a surviving target may be reacquired on the next aura sample.',
  limitations:'Selector aliases, retained-input/legal-target checks, seeded Dice/child missability dispatch, pre-delay/cooldown and aura/attack ordering, float32 boundary tolerance, marker reattachment and source validity are explicit local mappings. Empty child Fear fields resolve through the retained common Fear database, not a new native buff interpreter. As in reviewed Logos execution, the engine shield/HP-floor/fatal pipeline is preserved; native instantKillLike cancellation-mask behavior remains unrecovered rather than replaced by direct kill(). No compiled/game-frame/pixel parity, entry/return/fatal/SP/all-out composition, public art, modules or native effects/audio is granted.',
  frameParity:false,
});
const present=t=>t?.alive&&t.deployed&&!t.removed&&!t._removing;
const retained=(t,life)=>present(t)&&!t.hidden&&t.side==='enemy'&&t.deploySeq===life;
const due=(a,z)=>a>=z-1e-7, same=(a,z)=>JSON.stringify(a)===JSON.stringify(z);
const type=v=>v?.$type?.split('+').at(-1).split(',')[0];
export function verifyMakotoS2Combat(n=makotoS2Inputs()) {
  const{mode:m,attack:a,trigger:t,selector:s,aura,validator:v,hook,templates:ts,fear}=n;
  if(m._attack.m_PathID!=='3635927784782679589'||m._attackTrigger.m_PathID!=='-8248912276883583451'
    ||!same(m._generalAbilities.map(p=>p.m_PathID),['2200664464637021733'])||m._animatorHooker.m_PathID!=='-6711020895938949595'
    ||a._selector.m_PathID!=='-1874532089215594971'||a._animKey!==''||a._endAnimKey!==''||a._waitForAttackEvent!==0
    ||a._preDelay!==0.800000011920929||a._timeMode!==0||a._maxAnimScale!==-1||a._affectedBySlowDown!==1
    ||a._selectTargetSource!==1||a._selectTargetTiming!==0||a._alwaysIncludeTarget!==1||a._allowNoTarget!==0
    ||a._interuptIfTargetDead!==0||a._faceToTarget!==1||a._faceToFront!==0||a._ignorePalsyInterrupt!==0
    ||a._damageType!==2||a._attackType!==1||a._atkScale!==0||a._atkScaleKey!=='atk_scale'||a._escapeTime!==0
    ||t._keepTarget!==0||t._minTargetNum!==1||t._overrideSearchTargetTick!==-1)throw Error('Changed original Makoto S2 attack clock');
  if(s._targetSide!==2||s._targetMotion!==1||s._targetCategory!==1||s._postFilter!==4||s._ignoreTargetFree!==0
    ||s._ignoreMotionMode!==0||s._forceIgnoreCamouflage!==0||s._limitTargetNum!==1||s._maxNum!==4
    ||s._maxTargetKey!=='max_target'||s._ignoreHitRange!==0||s._excludeOwner!==0)throw Error('Changed original Makoto S2 attack selection');
  if(!same(a._activeBuffs.map(b=>[b.buffKey,b.templateKey,b.isDamageMissable]),[
    ['makoto_s2_fear_possibility','makoto_s2_fear_possibility',0],['makoto_s2_fear_damage','makoto_s2_fear_damage',0]]))throw Error('Changed original Makoto S2 action order');
  const b=aura._buffs[0],o=v._targetOptions;
  if(aura._buffs.length!==1||b.buffKey!=='makoto_s2_fear_aura_inst_kill'||b.independentCharacterSource!==1
    ||b.triggerInterval!==0.10000000149011612||b.waitFirstTriggerInterval!==0||b.lifeTimeType!==2
    ||aura._removeBuffWhenTargetLeave!==1||aura._removeBuffWhenAbilityDetached!==1||aura._onlyAddBuffOnceForEachTarget!==0
    ||aura._ignoreOwnerFakeDeath!==0||aura._targetValidator.m_PathID!=='-9173143548894851547'
    ||o.targetSide!==2||o.targetMotion!==3||o.targetCategory!==1||o.ignoreTargetFree!==0||o.ignoreMotionMode!==0)throw Error('Changed original Makoto S2 execution aura');
  if(!same(hook._replaceAnimPairs.map(p=>[p.fromAnimKey,p.toAnimKey]),[['Idle','Doll_Skill_2_Loop'],['Die','Doll_Skill_2_Die'],['SwitchOut','Doll_Skill_2_SwitchOut'],['Stun','Doll_Skill_2_Stun']]))throw Error('Changed original Makoto S2 loop aliases');
  const probability=ts.makoto_s2_fear_possibility.eventToActions.ON_BUFF_START,damage=ts.makoto_s2_fear_damage.eventToActions.ON_BUFF_START,
    execution=ts.makoto_s2_fear_aura_inst_kill.eventToActions.ON_BUFF_TRIGGER;
  const all=(v,kind,out=[])=>{if(Array.isArray(v))for(const x of v)all(x,kind,out);else if(v&&typeof v==='object'){if(type(v)===kind)out.push(v);for(const x of Object.values(v))if(x&&typeof x==='object')all(x,kind,out);}return out;};
  const lethal=all(execution,'NoSourceDamageNew')[0];
  if(type(probability[0])!=='Dice'||probability[0]._probKey!=='prob'||probability[1]._buff.templateKey!=='makoto_s2_fear_impl'
    ||damage[1]._damageType!=='MAGICAL'||damage[1]._atkScaleVar!=='atk_scale'||damage[1]._applyWay!=='RANGED'||damage[1]._noSource!==false
    ||damage[1]._forceUseProjectileCachedAtk!==false||damage[1]._ignoreMissFlag!=='NONE'||damage[1]._skipModifierEvent!==false
    ||all(execution,'CheckContainsBuff')[0]._buffKeys.join()!=='fear'||all(execution,'CheckContainsBuff')[0]._checkBuffSource!==false
    ||all(execution,'AssignAttributeAsDynamicVarToBB')[0]._attributeType!=='ATK'||all(execution,'AssignAttributeAsDynamicVarToBB')[0]._scaleVar!=='kill_atk_scale'
    ||all(execution,'FilterByTargetHp')[0]._condType!=='LT'||lethal?._damageType!=='PURE'||lethal._damageKey!=='kill_damage'
    ||lethal._applyAtkScale!==false||lethal._damageWithoutModify!==false||lethal._ignoreForSp!==false||lethal._isEnvDamage!==false
    ||lethal._instantKillLikeDamage!==true||lethal._ignoreCancelReasonMask!=='MISS, BLOCKED, BLOCKED_WITH_DAMAGE_NUMBER, HIT_FAILED'
    ||type(execution.at(-1)._succeedNodes.at(-1))!=='FinishBuff'
    ||fear.attributes.abnormalFlags.join()!=='FEARED'||fear.isDamageMissable!==true||fear.statusResistable!=='YES'||fear.templateKey!=='fear_buff')throw Error('Changed original Makoto S2 Fear/execution actions');
}

export class MakotoSkillTwoCombat {
  constructor(b,u,{contract,inPersona}={}) {
    if(contract!==MAKOTO_S2_COMBAT_CONTRACT||typeof inPersona!=='function'||u.def.charId!==ID||u.deploySeq!==0)throw Error('Fresh selected Makoto S2, exact combat contract and explicit form predicate required');
    const record=selectedMakotoInputs(u);if(record.index!==1)throw Error('Fresh selected Makoto S2 required');
    verifyMakotoS2Combat();
    Object.assign(this,{b,u,record,inPersona,seq:null,stopped:false,busy:false,syncing:false,accepting:false,phase:null,
      handles:[],members:new Map(),executingTargets:new Set(),visuals:new WeakSet(),facing:u.dir,range:null,starting:false});
  }
  valid(){return !this.stopped&&!this.b.finished&&this.seq!==null&&present(this.u)&&this.u.deploySeq===this.seq;}
  active(){if(!this.valid())return false;try{const yes=this.inPersona();return this.valid()&&yes===true&&!this.u.hidden;}catch(error){this.phase=null;this.clearAura();throw error;}}
  keys(){const{tileR:r,tileC:c,dir}=this.u;if(!this.range||this.range.r!==r||this.range.c!==c||this.range.dir!==dir)
    this.range={r,c,dir,keys:new Set(absoluteRangeKeys(this.record.skillRangeGrid,r,c,dir))};return this.range.keys;}
  legal(t,air=false){return present(t)&&!t.hidden&&t.side==='enemy'&&!t.s.flags.invulnerable&&canTargetEnemy(this.u,t,{canHitFly:air,groundOnly:!air})
    &&(air||!t.s.flags.camou||!!t.blockedBy);}
  choices(){const keys=this.keys();return sortEnemyTargets(this.b,this.u,this.b.enemies.filter(t=>this.legal(t)&&bodyInKeys(t,keys)),'normal').slice(0,this.record.bb['attack@max_target']);}
  visual(){if(!this.valid())return;const old=this.u.mem.regularFormVisual;if(this.visuals.has(old)&&old.clip==='Doll_Skill_2_Loop')return;
    const face=this.facing==='UP'?'Back':'Front';if(clocks.models[face].exactDurations.Doll_Skill_2_Loop==null||!evidence.models[ID][face])throw Error('Missing original Makoto S2 loop');
    const v={clip:'Doll_Skill_2_Loop',loop:true,speed:1,replace:true};this.visuals.add(v);this.u.mem.regularFormVisual=v;this.u.mem.regularVisualDirection=this.facing;}
  face(t){const dx=t.x-this.u.x,dy=t.y-this.u.y;if(Math.hypot(dx,dy)>1e-8)this.facing=Math.abs(dy)>Math.abs(dx)?dy>0?'UP':'DOWN':dx<0?'LEFT':'RIGHT';this.u.mem.regularVisualDirection=this.facing;}
  begin(){if(this.starting||this.phase||!this.valid()||this.u.atkCd>1e-8)return false;this.starting=true;
    try{const epoch=this.u.attackControlEpoch;if(!this.active()||!this.valid()||!this.u.canAct||this.u.s.flags.disarm||this.phase||epoch!==this.u.attackControlEpoch)return false;
      const targets=this.choices();if(!targets.length||!this.valid()||this.phase||epoch!==this.u.attackControlEpoch)return false;
      const {u}=this,speed=u.base.bat/u.s.interval,releaseAge=0.800000011920929,period=Math.max(u.s.interval,releaseAge/speed);
      this.phase={inputs:targets.map(t=>({target:t,life:t.deploySeq})),epoch,speed,releaseAge,untilAge:period*speed,
        age:0,lastAt:this.b.time,released:false,accepted:false};u.atkCd=period;this.face(targets[0]);this.visual();return true;
    }finally{this.starting=false;}}
  admit(targets){const p=this.phase;if(!(this.accepting&&this.active()&&this.valid()&&this.phase===p&&p&&!p.accepted
    &&this.u.canAct&&!this.u.s.flags.disarm&&p.epoch===this.u.attackControlEpoch&&due(p.age,p.releaseAge)&&targets.length))return false;
    let previous=-1;return targets.every(t=>{const i=p.inputs.findIndex(input=>input.target===t),input=p.inputs[i];
      if(i<=previous||!input||!retained(t,input.life)||!this.legal(t))return false;previous=i;return true;});}
  release(targets,info){if(!this.admit(targets))return false;const p=this.phase;p.accepted=true;
    const inputs=targets.map(t=>p.inputs.find(input=>input.target===t));
    for(const input of inputs){if(!this.active()||!this.valid()||this.phase!==p||this.u.attackControlEpoch!==p.epoch||!this.u.canAct||this.u.s.flags.disarm)break;
      const t=input.target;if(!retained(t,input.life)||!this.legal(t))continue;
      // Both immediate producer buffs are non-missable. Their Dice precedes
      // the separate normal Arts damage action; no extra status accuracy roll.
      if(this.b.rng.chance(this.record.bb['attack@prob']))this.b.applyStatus(t,'fear',{source:this.u,duration:this.record.bb['attack@fear'],
        admit:()=>this.valid()&&this.phase===p&&retained(t,input.life),sourceStatusResistable:true});
      if(!this.active()||!this.valid()||this.phase!==p)break;
      if(!retained(t,input.life))continue;
      this.b.dealDamage(this.u,t,{amount:this.u.s.atk*this.u.s.atkScaleMul*this.record.bb['attack@atk_scale'],type:'arts',isAttack:true,
        isSkill:false,isProjectile:false,applyWay:'ranged',attackId:info.attackId,tags:['makoto:s2']});
    }
    return true;
  }
  memberValid(e){return this.valid()&&this.members.get(e.target)===e&&retained(e.target,e.life)&&e.target.buffs.includes(e.buff);}
  auraLegal(t){return this.legal(t,true)&&!t.s.flags.invulnerable&&bodyInKeys(t,this.keys());}
  drop(e){if(this.members.get(e.target)===e)this.members.delete(e.target);if(e.buff)this.b.removeBuff(e.target,e.buff);}
  clearAura(){for(const e of [...this.members.values()])this.drop(e);}
  execute(e){if(!e||e.executing||this.executingTargets.has(e.target)||!this.memberValid(e)||!this.active()||!this.memberValid(e)||!this.auraLegal(e.target))return;
    const t=e.target;
    if(!t.buffs.some(buff=>(buff.status??buff.key)==='fear')||!(t.hp<this.u.s.atk*this.record.bb['attack@kill_atk_scale']))return;
    e.executing=true;this.executingTargets.add(t);
    try{this.b.dealDamage(this.u,t,{amount:this.record.bb['attack@kill_damage'],type:'true',sourceless:true,canDodge:false,isAttack:true,
      isSkill:false,isProjectile:false,applyWay:'none',tags:['makoto:s2-execution']});}
    finally{try{this.drop(e);}finally{this.executingTargets.delete(t);}}
  }
  syncAura(){if(this.syncing)return;this.syncing=true;
    try{
      for(const e of [...this.members.values()])if(!this.memberValid(e)||!this.auraLegal(e.target))this.drop(e);
      for(const t of this.b.enemies.slice()){
        if(!this.active()){this.clearAura();return;}
        if(this.members.has(t)||!this.auraLegal(t))continue;
        const key=`makoto:s2-aura:${this.u.id}:${this.seq}`,e={target:t,life:t.deploySeq,buff:null,executing:false,nextAt:this.b.time+0.10000000149011612};
        this.members.set(t,e);
        e.buff=this.b.addBuff(t,{key,source:this.u,data:e,
          admit:(_t,buff)=>this.valid()&&this.members.get(t)===e&&retained(t,e.life)&&this.auraLegal(t)&&buff.key===key&&buff.source===this.u&&buff.data===e,
          onRemove:()=>{if(this.members.get(t)===e)this.members.delete(t);}});
        if(!e.buff||!this.active()||!this.memberValid(e)){this.drop(e);continue;}
        this.execute(e); // Original waitFirstTriggerInterval0.
      }
    }finally{this.syncing=false;}
  }
  tick(){if(this.busy||!this.valid())return;this.busy=true;
    try{
      if(!this.active()){this.phase=null;this.clearAura();return;}
      this.syncAura();
      for(const e of [...this.members.values()])if(due(this.b.time,e.nextAt)){
        // Preserve the source cadence across the local fixed tick without an
        // extra frame caused solely by its float32 representation of .1.
        e.nextAt+=0.10000000149011612;this.execute(e);
      }
      if(!this.active()||!this.valid())return;
      const {u,b}=this,p=this.phase;
      if(!u.canAct||u.s.flags.disarm||p&&p.epoch!==u.attackControlEpoch){this.phase=null;return;}
      if(p){p.age+=sourceAbilityDelta(u,Math.max(0,b.time-p.lastAt),true)*p.speed;p.lastAt=b.time;
        if(!p.released&&due(p.age,p.releaseAge)){p.released=true;this.accepting=true;
          try{b.forceAttack(u,p.inputs.filter(i=>retained(i.target,i.life)&&this.legal(i.target)).map(i=>i.target));}finally{this.accepting=false;}}
        if(!this.valid()||this.phase!==p||!due(p.age,p.untilAge))return;this.phase=null;
      }
      if(u.atkCd<=1e-8)this.begin();
    }finally{this.busy=false;}
  }
  trait(){return{noAttack:true,attackDrivenSkill:true,attack:'ranged',dmgType:'arts',heal:null,projectile:'none',canHitFly:false,groundOnly:true,
    maxTargets:1,maxTargetsByBlock:false,hitAllBlocked:false,allInRange:false,hits:1,hitsFn:null,chain:null,splashRadius:0,windup:0,attackVisual:'none',requiresAcceptedLaunch:true,
    acceptAreaAttack:(_b,_u,_p,ts)=>this.admit(ts),launchAreaAttack:(_b,_u,_p,ts,info)=>this.release(ts,info)};}
  install(){if(this.stopped||this.handles.length||this.u.mem.makotoS2Combat&&this.u.mem.makotoS2Combat!==this)throw Error('Makoto S2 combat cannot be reinstalled');
    this.u.mem.makotoS2Combat=this;const{b,u}=this;this.handles=[
      b.on('deploy',({unit,move})=>{if(unit!==u||move)return;if(this.seq!==null){if(this.seq!==u.deploySeq)this.stop();return;}this.seq=u.deploySeq;},{owner:u}),
      b.on('tick',()=>{if(this.seq!==null&&!this.valid())this.stop();else this.tick();},{owner:u}),
      ...['removed','death'].map(event=>b.on(event,({unit})=>{if(unit===u)this.stop();},{owner:u})),
      b.on('palsyTriggered',({unit})=>{if(unit===u)this.phase=null;},{owner:u}),b.on('battleEnd',()=>this.stop(),{owner:u})];
  }
  stop(){if(this.stopped)return;this.stopped=true;this.phase=null;this.accepting=false;for(const h of this.handles)this.b.off(h);this.handles=[];this.clearAura();
    if(this.seq===this.u.deploySeq&&this.visuals.has(this.u.mem.regularFormVisual)){delete this.u.mem.regularFormVisual;delete this.u.mem.regularVisualDirection;}}
}
