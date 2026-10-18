// SPDX-License-Identifier: GPL-3.0-or-later
import {JU_ID, selectedJuInputs, juNativeInputs} from './arkpedia-ju-source.js';
import {JuOrdinaryAttacks, JU_ORDINARY_CONTRACT} from './arkpedia-ju-ordinary.js';
import {JuWounds, JU_WOUND_CONTRACT} from './arkpedia-ju-wounds.js';
import {JuExtraDamage, JU_EXTRA_CONTRACT} from './arkpedia-ju-extra.js';

export const JU_S2_CONTRACT = Object.freeze({
  scope: 'Selected original Ju S2 manual account, Begin, accepted ATK/mode buff, two retained attack inputs, short native projectile and delayed range-aura damage; no public admission.',
  mapping: 'The timed account includes original Begin. Its end grants the original switch buff for remaining account time; only an accepted matching buff selects the S2 attack mode and enables its aura. Positive cooldown survives mode changes, which cancel unfired phases. Input-time selection retains up to the selected max_target_s2 and each original recipient life. The original mover-less projectile resolves at its finite lifetime without inventing speed-driven travel. Only the recorded Skill_2_Idle to Idle mix uses Skill_2_End.',
  limitations: 'Native account/Begin/FSM ordering, selector aliases, aura polling, fixed-lifetime hit dispatch and source-invalid live-attribute fallback are explicit local mappings. Original art delivery, modules, native effects/audio and compiled-client/frame parity are not admitted.',
  frameParity: false,
});
const alive = u => u?.alive && u.deployed && !u.removed;
const retained = t => alive(t) && !t.hidden && t.side === 'enemy';
const due = (a,z) => a >= z - 1e-8;
export function verifyJuS2(n = juNativeInputs()) {
  const c=n.s2,a=n.s2Attack,s=n.s2Selector,p=n.s2Projectile,b=n.s2Buffs._buffs[0];
  const mix=n.artController._mixSettings;
  if(mix.length!==1||mix[0].sourceAnimName!=='Skill_2_Idle'||mix[0].targetAnimName!=='Idle'
    ||mix[0].mixAnimName!=='Skill_2_End'||mix[0].acceptAllSource!==0
    ||c._playSkillBeginAnim!==1||c._beginAnim!=='Skill_2_Begin'||c._attackBlackboardModeIndex!==1
    ||c._allowSpRecoveryWhenAffecting!==0||c._canSilenced!==0||c._stopAffectOnInterrupt!==0
    ||c._uninterruptibleOnAbilityPredelay!==1||c._canCastDuringBorn!==1
    ||a._animKey!=='Skill_2_Loop'||a._endAnimKey!=='Skill_2_Idle'||a._selectTargetTiming!==0
    ||a._waitForAttackEvent!==1||a._maxAnimScale!==1||a._affectedBySlowDown!==0||a._timeMode!==0
    ||a._projectileKey!=='projectile_chr_ju_s2'||a._useCachedAtkOnly!==0||a._atkScale!==1
    ||s._maxTargetKey!=='max_target_s2'||s._postFilter!==27||s._buffKey!=='cripple'||s._buffKeyExcluded!==1
    ||p._managedBySource!==0||p._stopWhenSourceInvalid!==0||p._alwaysHitTraceTargetInTheEnd!==1
    ||p._lifeTime!==.16699999570846558||b.buffKey!=='ju_s_2[switch]'||b.templateKey!=='switch_mode_restart_fsm'
    ||b.blackboard[0]?.key!=='mode'||b.blackboard[0]?.value!==1
    ||b.attributes.attributeModifiers[0]?.attributeType!==1||b.attributes.attributeModifiers[0]?.formulaItem!==1)
    throw Error('Changed original Ju S2 controller inputs');
}

export class JuSkillTwo extends JuOrdinaryAttacks {
  constructor(b,u,wounds,{contract}={}) {
    if(contract!==JU_S2_CONTRACT||selectedJuInputs(u).index!==1)throw Error('Original selected Ju S2 and exact contract required');
    super(b,u,{contract:JU_ORDINARY_CONTRACT,mayBegin:()=>true});verifyJuS2();
    this.wounds=wounds;this.modeBuff=null;this.lastMode=false;
    this.extra=new JuExtraDamage(b,u,{contract:JU_EXTRA_CONTRACT,affecting:()=>this.mode&&u.skill.active});
  }
  get mode(){return this.modeBuff?.data?.juMode===this&&this.u.findBuff('ju_s_2[switch]')===this.modeBuff;}
  choices(){return super.choices({limit:this.mode?this.record.bb['attack@max_target_s2']:1});}
  canCast(){return this.valid()&&!this.u.hidden&&this.u.canAct&&!this.u.s.flags.disarm&&!this.u.skill.active
    &&!['begin','end'].includes(this.phase?.kind);}
  startSkill(){
    if(!this.valid()||!this.u.skill.active)return;
    this.phase={kind:'begin',until:this.b.time+this.model().exactDurations.Skill_2_Begin};
    this.bornUntil=Math.min(this.bornUntil,this.b.time);this.facing=this.u.dir;this.visual('Skill_2_Begin');
  }
  grantMode(){
    if(!this.valid()||!this.u.skill.active)return;
    const buff=this.b.addBuff(this.u,{key:'ju_s_2[switch]',source:this.u,refresh:'keep',
      mods:{atkMul:1+this.record.bb.atk},data:{juMode:this}});
    if(buff?.data?.juMode===this)this.modeBuff=buff;
    if(!this.valid()||!this.u.skill.active)this.clearMode();
    this.lastMode=!!this.mode;
  }
  clearMode(){
    if(this.modeBuff?.data?.juMode===this&&this.u.buffs.includes(this.modeBuff))this.b.removeBuff(this.u,this.modeBuff);
    this.modeBuff=null;this.lastMode=false;this.extra.clearAuras();
  }
  endSkill(){
    const from=this.u.mem.regularFormVisual?.clip;this.clearMode();this.phase=null;
    if(!this.valid())return;
    if(from==='Skill_2_Idle'){
      this.phase={kind:'end',until:this.b.time+this.model().exactDurations.Skill_2_End};this.visual('Skill_2_End');
    }else this.idle();
  }
  idle(){this.facing=this.u.dir;this.visual(this.mode?'Skill_2_Idle':'Idle',1,true);}
  begin(target){
    if(!this.mode){super.begin(target);return;}
    const targets=this.choices();if(!targets.length)return;
    this.face(targets[0]);const speed=Math.min(1,this.u.base.bat/this.u.s.interval);
    const releaseAge=this.model().eventPayloads.Skill_2_Loop[0].time;
    const period=Math.max(this.u.s.interval,releaseAge/speed);
    this.phase={kind:'s2',targets,lives:targets.map(t=>t.deploySeq),epoch:this.u.attackControlEpoch,
      speed,releaseAge,age:0,lastAt:this.b.time,untilAge:period*speed,released:false,accepted:false};
    this.u.atkCd=period;this.visual('Skill_2_Loop',speed);
  }
  admit(ts){
    const p=this.phase;if(p?.kind!=='s2')return super.admit(ts);
    return this.accepting&&this.valid()&&this.mode&&this.u.canAct&&!this.u.s.flags.disarm&&!p.accepted
      &&p.epoch===this.u.attackControlEpoch&&due(p.age,p.releaseAge)&&ts.length>0&&new Set(ts).size===ts.length
      &&ts.every(t=>{const i=p.targets.indexOf(t);return i>=0&&t.deploySeq===p.lives[i]&&retained(t);});
  }
  release(ts,info){
    const p=this.phase;if(p?.kind!=='s2')return super.release(ts,info);
    if(!this.admit(ts))return false;p.accepted=true;
    const atk=this.u.s.atk*this.u.s.atkScaleMul,sourceLife=this.seq;
    // No native mover exists. This finite endpoint is intentionally invisible;
    // original particles are not approximated with a fabricated moving arrow.
    for(const target of ts){
      const life=target.deploySeq;let projectile;
      projectile=this.b.addProjectile({from:target,target,source:this.u,attached:true,
        flightTime:.16699999570846558,maxAge:.16699999570846558,visual:'none',data:{juS2:true},
        onHit:()=>{
          this.flights.delete(projectile);
          if(!this.ended&&!this.b.finished&&retained(target)&&target.deploySeq===life){
            const live=alive(this.u)&&this.u.deploySeq===sourceLife?this.u.s.atk*this.u.s.atkScaleMul:atk;
            this.b.dealDamage(this.u,target,{amount:live,type:'phys',isAttack:true,isProjectile:true,isSkill:true,
              attackId:info.attackId,applyWay:'ranged',tags:['ju:s2:attack']});
          }
          this.unwatch();
        }});
      this.flights.set(projectile,{target,life});
    }
    if(this.b.finished)this.drain();else this.watch();return true;
  }
  tick(){
    if(!this.valid())return;
    let p=this.phase;
    if(p?.kind==='begin'){
      if(!this.u.skill.active){this.phase=null;this.idle();return;}
      if(!due(this.b.time,p.until))return;
      this.grantMode();if(!this.valid()||this.phase!==p)return;this.phase=p=null;this.idle();
    }
    if(p?.kind==='end'){
      if(!due(this.b.time,p.until))return;this.phase=p=null;this.idle();
    }
    if(this.lastMode!==!!this.mode){this.lastMode=!!this.mode;this.phase=p=null;this.idle();}
    if(p?.kind!=='s2'){super.tick();return;}
    const u=this.u;
    if(!this.mode||!u.canAct||u.s.flags.disarm||p.epoch!==u.attackControlEpoch){this.phase=null;this.idle();return;}
    p.age+=Math.max(0,this.b.time-p.lastAt)*p.speed;p.lastAt=this.b.time;
    if(!p.released&&due(p.age,p.releaseAge)){
      p.released=true;const targets=p.targets.filter((t,i)=>t.deploySeq===p.lives[i]&&retained(t));
      this.accepting=true;try{this.b.forceAttack(u,targets);}finally{this.accepting=false;}
    }
    if(!this.valid()||this.phase!==p||!due(p.age,p.untilAge))return;
    this.phase=null;if(u.atkCd>1e-8)return;
    const target=this.choices()[0];if(target)this.begin(target);else this.idle();
  }
  spec(){return{kind:'duration',duration:this.record.source.duration,silenceable:false,trigger:{rule:'NEVER'},
    flags:{noSp:true},attack:{},canActivate:()=>this.canCast(),onStart:()=>this.startSkill(),onEnd:()=>this.endSkill()};}
  install(){this.wounds.install();this.extra.install();super.install();}
  stop(){super.stop();this.clearMode();this.extra.stop();this.wounds.stop();}
}
export function prepareJuS2(b,u,{contract}={}){
  if(contract!==JU_S2_CONTRACT||u.def.charId!==JU_ID||u.deploySeq!==0||u.mem.ju)
    throw Error('Fresh selected Ju S2 and exact controller contract required');
  const wounds=new JuWounds(b,u,{contract:JU_WOUND_CONTRACT});
  const controller=new JuSkillTwo(b,u,wounds,{contract});u.mem.ju=controller;
  return{record:controller.record,wounds,extra:controller.extra,controller,kit:{install:null,talents:[],
    trait:controller.trait(),skill:controller.spec()}};
}
