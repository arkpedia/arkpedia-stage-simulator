// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-blaze-igniting-prefabs.json' with {type:'json'};
import {bodyInRadius} from '../body.js';
import {canTargetEnemy} from '../targeting.js';
import {applyHpLoss,makeDamageInfo} from '../damage.js';

export const BLAZE_IGNITING_S3_CONTRACT=Object.freeze({
  scope:'Private selected-source S3 eventless ammunition barrage; public integration remains held',
  attack:'Selected ATK/BAT/range and ammunition, manual stop, one fixed-point delayed radius1.7 stop hit plus the still-valid original trace target per accepted attack; original continuous Skill_3_Loop instead of an invented OnAttack event',
  output:'Cached Arts and separate Elemental HP damage for enemies already in FIRE recovery; bonus precedes Arts, air and camouflage can receive the stop-area hit, no new FIRE injury is manufactured',
  lifecycle:'One-second 3%-Max-HP modifier-bypassing self hits, global pre-burst two-ammo recovery without the starting-ammo cap, fatal/downed interruption, original Begin/End guards and emitted shots survive mode end/removal',
  mapping:'Source stop delay maps to a fixed .3-second pending point hit. Birth captures ATK; transferred-source bonus ATK uses that same snapshot. Duration-free ammo mode uses final BAT cadence. Burn recovery runs before Meltdown/base burst. Fatal count recovery is bridged to at least the nominal load before local downing ends the skill.',
  limits:'Compiled transfer-source attribute lookup, count-recovery limit/reset routing, mode/skill callback ordering, downing/revival progress linkage, terminal tick phase, mount offsets, original particles/audio, modules and Unity frame parity remain unverified',
  observationSource:'https://prts.wiki/w/%E7%83%9B%E7%85%8C',
  frameParity:false,
});
const ID='char_1040_blaze2',DRAIN='blaze2_s_3[lose_hp]',air={canHitFly:true};
const live=t=>t?.alive&&t.deployed&&!t.hidden&&!t._removing;
const model=u=>evidence.models[ID][['UP','LEFT'].includes(u.dir)?'Back':'Front'];

export class BlazeIgnitingS3Barrage{
  constructor(core){this.core=core;this.b=core.b;this.u=core.u;this.record=core.record;this.transition=null;this.drain=null;}
  active(){return this.core.valid()&&!this.core.reborn&&this.u.skill.active;}
  canCast(){return this.core.valid()&&!this.core.reborn&&this.u.canAct&&!this.u.s.flags.disarm&&!this.transition;}
  start(){
    const {b,u,core}=this;core.phase=null;u.atkCd=0;
    this.transition={kind:'begin',ends:b.time+model(u).durations.Skill_3_Begin};core.visual('Skill_3_Begin');
    this.drain=b.addBuff(u,{key:DRAIN,source:u,interval:1,onTick:()=>{
      if(!this.active())return;
      const amount=u.s.maxHp*this.record.bb.lose_hp_scale;
      applyHpLoss(b,u,u,amount,makeDamageInfo({amount,type:'true',isAttack:true,isSkill:true,noSp:true,
        applyWay:'none',tags:['blaze2:s3-self']}));
    }});
    b.emit('blazeIgnitingS3Start',{owner:u,ammo:u.skill.ammoLeft});
  }
  end(reason){
    const {b,u,core}=this;core.phase=null;
    if(this.drain)b.removeBuff(u,this.drain);this.drain=null;
    if(core.valid()&&!core.reborn&&!['downed','owner-finish','death'].includes(reason)){
      this.transition={kind:'end',ends:b.time+model(u).durations.Skill_3_End};core.visual('Skill_3_End');
    }else this.transition=null;
    b.emit('blazeIgnitingS3End',{owner:u,reason});
  }
  recoverBurn({target,element}){
    const {b,u}=this;
    if(!this.active()||element!=='burn'||target?.side!=='enemy'||!live(target)||!canTargetEnemy(u,target,air))return;
    const before=u.skill.ammoLeft;
    // The original AmmoSkillCountModifier sets recoverSkipLimitCheck=true.
    // This is separate from ordinary external replenishment limits.
    u.skill.addAmmo(this.record.bb.ammo_recover);
    b.emit('blazeIgnitingS3AmmoRecover',{owner:u,target,before,after:u.skill.ammoLeft});
  }
  beforeDown(){
    const {b,u}=this;if(!u.skill.active)return;
    const before=u.skill.ammoLeft,nominal=this.record.bb['attack@trigger_time'];
    u.skill.addAmmo(Math.max(0,nominal-before));
    b.emit('blazeIgnitingS3DownedAmmoRestore',{owner:u,before,after:u.skill.ammoLeft,nominal});
    this.interrupt('downed');
  }
  interrupt(reason){if(this.u.skill.active)this.u.skill.end(reason);this.transition=null;}
  accepts(t){const p=this.core.phase;return p?.kind==='s3-attack'&&p.target===t;}
  release(t,info){
    const {core,b,u}=this,p=core.phase;
    if(!this.active()||!u.canAct||u.s.flags.disarm||p?.kind!=='s3-attack'||p.accepted
      ||p.target!==t||p.epoch!==u.attackControlEpoch)return false;
    // Native emit-to-input-pos covers an invalidated input life. It does not
    // restore inputs explicitly removed by the shared beforeAttack hook.
    if(live(t)&&t.deploySeq===p.seq&&!core.eligible(t))return false;
    p.accepted=true;
    const point=live(t)&&t.deploySeq===p.seq?{x:t.x,y:t.y}:{x:p.x,y:p.y},cachedAtk=u.s.atk;
    const projectile=b.addProjectile({from:point,to:point,source:u,flightTime:.30000001192092896,maxAge:.30000001192092896,
      visual:'bolt',data:{arkpediaTrackedVisual:true,blazeIgnitingOwner:core,blazeIgnitingKind:'s3',cachedAtk},
      onHit:()=>this.impact(point,cachedAtk,info,{target:t,seq:p.seq})});
    b.emit('blazeIgnitingProjectileBirth',{owner:u,target:t,projectile});return true;
  }
  impact(point,cachedAtk,info,trace){
    const {b,u}=this;if(b.finished)return;
    for(const t of [...b.enemies]){
      if(b.finished)break;
      const forced=t===trace.target&&t.deploySeq===trace.seq;
      if(!live(t)||!canTargetEnemy(u,t,air)||!forced&&!bodyInRadius(t,point.x,point.y,1.7000000476837158))continue;
      // Native additional_damage filters FIRE recovery before the primary hit.
      // PRTS observations corroborate bonus-before-Arts ordering.
      if(t.findBuff('burnBurst'))b.dealDamage(u,t,makeDamageInfo({amount:cachedAtk*this.record.bb['attack@atk_scale'],
        type:'elemental',element:'burn',isAttack:true,isSkill:true,attackId:info.attackId??0,applyWay:'none',
        canDodge:false,tags:['blaze2:s3-bonus']}));
      if(live(t))b.dealDamage(u,t,makeDamageInfo({amount:cachedAtk,type:'arts',isAttack:true,isSkill:true,
        attackId:info.attackId??0,applyWay:'ranged',tags:['blaze2:s3-shot']}));
    }
  }
  tick(){
    const {b,u,core}=this;if(!core.valid()||core.reborn)return true;
    if(this.transition){
      if(b.time+1e-9<this.transition.ends)return true;
      this.transition=null;core.phase=null;u.atkCd=0;
    }
    if(!this.active())return false;
    core.visual('Skill_3_Loop',1,true);
    if(!u.canAct||u.s.flags.disarm||u.atkCd>1e-9)return true;
    const t=core.targets()[0];if(!t)return true;
    // S3 has no OnAttack event and its original idle replacement loops
    // independently; do not limit a .3-second BAT to the 1.6-second clip.
    core.phase={kind:'s3-attack',target:t,seq:t.deploySeq,x:t.x,y:t.y,epoch:u.attackControlEpoch,accepted:false};
    const p=core.phase;b.forceAttack(u,[t]);
    if(core.phase===p)core.phase=null;
    if(this.active())u.atkCd=u.s.interval;
    return true;
  }
  ownerStop(){this.interrupt('owner-finish');if(this.drain)this.b.removeBuff(this.u,this.drain);this.drain=null;}
}
