// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-blaze-igniting-prefabs.json' with {type:'json'};
import {absoluteRangeKeys,canTargetEnemy} from '../targeting.js';
import {bodyInKeys,bodyInRadius} from '../body.js';

export const BLAZE_IGNITING_S1_CONTRACT=Object.freeze({
  scope:'Private selected-source automatic S1 ally-hosted damage field; public integration remains held',
  cast:'Selected natural SP, highest-Max-HP in-range operator including self, original Skill_1 release event, release-time ATK snapshot',
  field:'Selected radius, interval and lifetime; ally-following sourceless Arts output followed by FIRE injury; emitted ally-hosted fields outlive caster retreat',
  mapping:'Source text supplies the ATK ratio; post-settlement HP damage is the native real-damage receipt bridge. Skill_1 uses unscaled source game-second timings with a clip-end SP lock. Equal-Max-HP ties choose latest deployment; same-anchor fields replace rather than stack. The host buff owns twenty interval ticks including its terminal tick.',
  limits:'Compiled FixedValueDamage multiplier dispatch, timeMode1/maxAnimScale-1 conversion, overrideType3 priority, ability-detach/owner-removal linkage, first/last trigger phase, source callback ordering, original effects/audio, modules and Unity frame parity remain unverified',
  frameParity:false,
});
const ID='char_1040_blaze2',KEY='blaze2_s_1',air={canHitFly:true};
const live=t=>t?.alive&&t.deployed&&!t.hidden&&!t._removing;
const model=u=>evidence.models[ID][['UP','LEFT'].includes(u.dir)?'Back':'Front'];

export class BlazeIgnitingS1Fields{
  constructor(core){this.core=core;this.b=core.b;this.u=core.u;this.record=core.record;this.cast=null;this.fields=new Set();this.handles=[];this.ownerEnded=false;}
  candidates(){
    const u=this.u,keys=u.rangeKeySet??new Set(absoluteRangeKeys(u.rangeGrid,u.tileR,u.tileC,u.dir,u.s.rangeExtend));
    return this.b.allyUnits.filter(t=>live(t)&&t.kind==='op'&&!t.s.flags.untargetable&&!t.s.flags.healFree
      &&this.b.allySelectable(t,u)&&bodyInKeys(t,keys)).sort((a,z)=>z.s.maxHp-a.s.maxHp||z.deploySeq-a.deploySeq);
  }
  canCast(){return this.core.valid()&&!this.core.reborn&&this.u.canAct&&!this.u.s.flags.disarm
    &&!this.cast&&this.core.phase?.kind!=='entrance'&&this.candidates().length>0;}
  start(){
    const {b,u,core}=this,target=this.candidates()[0],clip=model(u);
    this.cast={target,targetSeq:target?.deploySeq,epoch:u.attackControlEpoch,released:false,
      releaseAt:b.time+clip.eventPayloads.Skill_1.find(e=>e.name==='OnAttack').time,
      readyAt:b.time+clip.durations.Skill_1};
    core.phase=null;core.visual('Skill_1');
    b.emit('blazeIgnitingS1Cast',{owner:u,target,cast:this.cast});
  }
  end(){this.cast=null;if(this.core.valid()&&!this.core.reborn)this.core.visual('Idle',1,true);}
  interrupt(reason){if(this.cast&&this.u.skill.active)this.u.skill.end(reason);this.cast=null;}
  tick(){
    const {b,u,core}=this,c=this.cast;
    if(c){
      if(!u.canAct||u.s.flags.disarm||core.reborn||c.epoch!==u.attackControlEpoch){this.interrupt('interrupted');return true;}
      if(!c.released&&b.time+1e-9>=c.releaseAt){c.released=true;this.release(c);}
      if(this.cast!==c||!core.valid())return true;
      if(b.time+1e-9>=c.readyAt)u.skill.end('clip-complete');
      return true;
    }
    if(this.canCast()&&u.skill.ready){u.skill.activate('blaze2:auto');return true;}
    return false;
  }
  release(c){
    const {b,u,record:r}=this,target=c.target;
    if(!this.core.valid()||!live(target)||target.deploySeq!==c.targetSeq||target.s.flags.untargetable||target.s.flags.healFree
      ||!b.allySelectable(target,u))return;
    this.ensureHooks();
    // The buff's source ATK snapshot occurs on ON_BUFF_START, after release.
    // Keep the full ATK and selected source ratio separately for review.
    const field={system:this,anchor:target,anchorSeq:target.deploySeq,cachedAtk:u.s.atk,ratio:r.bb.atk_scale,
      elementRatio:r.bb.element_multiplier,radius:r.bb.range_radius,interval:r.bb.interval,duration:r.bb.max_duration,
      bornAt:b.time,pulses:0,active:true,buff:null};
    // Generic replacement does not run onRemove. Retire the original host
    // instance explicitly so its independent producer loses stale state now.
    b.removeBuff(target,KEY);
    this.fields.add(field);
    field.buff=b.addBuff(target,{key:KEY,source:u,duration:field.duration,interval:field.interval,
      data:{blazeIgnitingS1:field},onTick:()=>this.pulse(field),onRemove:()=>this.detach(field),onExpire:()=>this.detach(field)});
    b.emit('blazeIgnitingS1Field',{owner:u,field});
  }
  validField(f){return f.active&&!this.b.finished&&live(f.anchor)&&f.anchorSeq===f.anchor.deploySeq&&f.anchor.findBuff(KEY)===f.buff;}
  pulse(field){
    const {b,u}=this;
    if(!this.validField(field)){this.finish(field);return;}
    field.pulses++;b.emit('blazeIgnitingS1Pulse',{owner:u,field});
    for(const t of [...b.enemies]){
      if(!this.validField(field))break;
      // Circle damage is an area receipt, not an ordinary enemy selector;
      // camouflage is not additionally rejected. Target-free/stealth/sleep
      // and flight eligibility still use the engine's shared predicates.
      if(!live(t)||!canTargetEnemy(u,t,air)||!bodyInRadius(t,field.anchor.x,field.anchor.y,field.radius))continue;
      const actual=b.dealDamage(u,t,{amount:field.cachedAtk*field.ratio,type:'arts',sourceless:true,
        canDodge:false,isAttack:true,isSkill:true,tags:['blaze2:s1-field']});
      if(actual>0&&live(t))b.dealDamage(u,t,{amount:actual*field.elementRatio,type:'element',element:'burn',sourceless:true,
        canDodge:false,isAttack:true,isSkill:true,tags:['blaze2:s1-injury']});
    }
  }
  detach(field){
    if(!field.active)return;field.active=false;this.fields.delete(field);
    this.b.emit('blazeIgnitingS1FieldEnd',{owner:this.u,field});
    if(this.ownerEnded&&!this.fields.size)this.clearHooks();
  }
  finish(field){
    if(!field.active)return;
    if(field.buff)this.b.removeBuff(field.anchor,field.buff);this.detach(field);
  }
  ensureHooks(){
    if(this.handles.length)return;
    const cleanup=()=>{for(const field of [...this.fields])if(!this.validField(field))this.finish(field);};
    this.handles=[this.b.on('tick',cleanup),this.b.on('removed',cleanup),this.b.on('death',cleanup),this.b.on('battleEnd',()=>{
      for(const field of [...this.fields])this.finish(field);this.clearHooks();
    })];
  }
  clearHooks(){for(const h of this.handles)this.b.off(h);this.handles=[];}
  ownerStop(){
    this.ownerEnded=true;this.interrupt('owner-finish');
    if(this.b.finished)for(const field of [...this.fields])this.finish(field);
    if(!this.fields.size)this.clearHooks();
  }
}
