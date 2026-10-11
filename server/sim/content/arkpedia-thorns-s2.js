// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-thorns-lodestar-prefabs.json' with {type:'json'};
import {bodyInKeys,bodyInRadius} from '../body.js';
import {canTargetEnemy,sortEnemyTargets} from '../targeting.js';
import {toLocal} from '../dir.js';
import {COLS} from '../constants.js';

export const THORNS_S2_CONTRACT=Object.freeze({
  scope:'Selected-source S2 growing/drifting field with public and isolated combat checks',
  cast:'Natural selected SP and charges, manual activation, capped original Skill_2 event; selected enemy root tile or farthest forward range tile',
  field:'Ground recipients; cached-ATK allied regeneration and sourceless Arts ticks, separate ordinary-healing event and HP-recovery attribute reductions; independent overlapping fields survive retreat',
  mapping:'PRTS observations complement native records: radius grows projectile_range*value per second and drifts projectile_move_speed away from deployment tile; both stop at remaining_time, independently of talent extension. Enemy selector ties use engine priority, fixed root-tile landing and arrival-based lifetime are local mappings.',
  limits:'Native multi-ability dispatch, incrementer clock and serialized extraMoveSpeed unit conversion, original particles/audio, mount offsets and Unity frame parity remain unverified',
  frameParity:false,
});
const ID='char_1039_thorn2';
const live=t=>t?.alive&&t.deployed&&!t.hidden&&!t._removing;
const model=u=>evidence.models[ID][['UP','LEFT'].includes(u.dir)?'Back':'Front'];
let fieldSeq=0;

export class ThornsS2Fields{
  constructor(core){
    this.core=core;this.b=core.b;this.u=core.u;this.record=core.record;
    this.cast=null;this.fields=[];this.handles=[];this.ownerEnded=false;this.pending=0;
  }
  selection(){
    const keys=this.core.rangeKeys(),{b,u}=this;
    const enemies=b.enemies.filter(t=>live(t)&&canTargetEnemy(u,t,{groundOnly:true})
      &&(!t.s.flags.camou||!!t.blockedBy)&&bodyInKeys(t,keys));
    sortEnemyTargets(b,u,enemies);
    if(enemies[0]){const t=enemies[0];return {target:t,seq:t.deploySeq,x:Math.round(t.x),y:Math.round(t.y)};}
    let tile=null,forward=0;
    for(const key of keys){
      const r=Math.floor(key/COLS),c=key%COLS,[side,front]=toLocal(r-u.tileR,c-u.tileC,u.dir);
      if(side===0&&front>forward&&b.grid.inRect(r,c)){tile={target:null,x:c,y:r};forward=front;}
    }
    return tile;
  }
  canCast(){return this.core.valid()&&this.u.canAct&&!this.u.s.flags.disarm&&!this.cast
    &&this.core.phase?.kind!=='entrance'&&!!this.selection();}
  start(){
    const {b,u,core}=this,speed=Math.min(1,u.base.bat/u.s.interval);
    this.cast={...this.selection(),epoch:u.attackControlEpoch,ownerX:u.tileC,ownerY:u.tileR,
      releaseAt:b.time+model(u).eventPayloads.Skill_2.find(e=>e.name==='OnAttack').time/speed,
      readyAt:b.time+model(u).durations.Skill_2/speed,duration:core.fieldDuration(),released:false};
    core.phase=null;core.visual('Skill_2',speed);this.ensureHooks();
    b.emit('thornsS2Cast',{owner:u,cast:this.cast});
  }
  end(){this.cast=null;if(this.core.valid())this.core.visual(this.core.idle(),1,true);}
  interrupt(reason){if(this.cast&&this.u.skill.active)this.u.skill.end(reason);this.cast=null;}
  tick(){
    const {b,u,core}=this,c=this.cast;if(!c)return false;
    if(!u.canAct||u.s.flags.disarm||c.epoch!==u.attackControlEpoch){this.interrupt('interrupted');return true;}
    if(!c.released&&b.time+1e-9>=c.releaseAt){c.released=true;this.throwField(c);}
    if(this.cast!==c||!core.valid())return true;
    if(b.time+1e-9>=c.readyAt)u.skill.end('clip-complete');
    return true;
  }
  throwField(c){
    const {b,u}=this;
    // Token subability selects at its event. A lost input target retains the
    // original input root tile (_emitToInputRootTileWhenTargetIsInvalid1).
    const valid=live(c.target)&&c.target.deploySeq===c.seq;
    const x=valid?Math.round(c.target.x):c.x,y=valid?Math.round(c.target.y):c.y,cachedAtk=u.s.atk;
    this.pending++;
    const projectile=b.addProjectile({from:u,to:{x,y},source:u,speed:10,maxAge:100,visual:'bolt',
      data:{arkpediaTrackedVisual:true,thornsS2:this},onHit:()=>{
        if(!b.finished)this.arrive({x,y,cachedAtk,duration:c.duration,ownerX:c.ownerX,ownerY:c.ownerY});
      }});
    b.emit('thornsS2Throw',{owner:u,projectile,x,y,cachedAtk,duration:c.duration});
  }
  arrive({x,y,cachedAtk,duration,ownerX,ownerY}){
    const length=Math.hypot(x-ownerX,y-ownerY);
    const field={id:++fieldSeq,active:true,x,y,startX:x,startY:y,dx:length?(x-ownerX)/length:0,
      dy:length?(y-ownerY)/length:0,cachedAtk,bornAt:this.b.time,expiresAt:this.b.time+duration,
      radius:this.record.bb.projectile_range,recipients:new Map()};
    this.fields.push(field);this.updateField(field);this.b.emit('thornsS2Field',{owner:this.u,field});
  }
  eligible(t,field){
    if(!live(t)||t.kind==='device'||t.isFlying||t.s.flags.healFree||!bodyInRadius(t,field.x,field.y,field.radius))return false;
    if(t.side==='ally')return !t.s.flags.untargetable&&!t.s.flags.healFree&&this.b.allySelectable(t,this.u);
    return canTargetEnemy(this.u,t,{groundOnly:true});
  }
  detach(field,t){const r=field.recipients.get(t);if(r)this.b.removeBuff(t,r.buff);field.recipients.delete(t);}
  updateField(field){
    const {b,u}=this,bb=this.record.bb;
    if(!field.active)return;
    if(b.finished||b.time+1e-9>=field.expiresAt){this.finishField(field);return;}
    const age=Math.min(Math.max(0,b.time-field.bornAt),bb.remaining_time);
    field.x=field.startX+field.dx*bb.projectile_move_speed*age;
    field.y=field.startY+field.dy*bb.projectile_move_speed*age;
    field.radius=bb.projectile_range*(1+bb.value*age);
    for(const [t,r]of field.recipients)if(r.seq!==t.deploySeq||!this.eligible(t,field))this.detach(field,t);
    for(const t of [...b.allyUnits,...b.enemies]){
      if(b.finished||!field.active)break;
      if(!this.eligible(t,field))continue;
      let r=field.recipients.get(t);
      if(!r||t.findBuff(r.buff.key)!==r.buff){
        if(r)this.detach(field,t);
        const ally=t.side==='ally',nativeBuffKey=ally?'thorn2_s_2[buff][ally]':'thorn2_s2_heal';
        const buff=b.addBuff(t,{key:`${nativeBuffKey}:${field.id}`,source:u,
          data:{nativeBuffKey,thornsField:field},mods:ally?{hpRegen:field.cachedAtk*bb.hp_recovery_per_sec_ratio_chr}:
            {hpRegenMul:1+bb.hp_recovery_per_sec}});
        r={seq:t.deploySeq,buff,nextAt:b.time+.8999999761581421};field.recipients.set(t,r);
      }
      // Native derived damage buff: first event .9s after entry, then every 1s.
      // A leave/re-entry or new deployment life creates a new independent clock.
      if(t.side==='enemy'&&b.time+1e-9>=r.nextAt){
        r.nextAt+=1;
        b.dealDamage(u,t,{amount:field.cachedAtk*bb.atk_scale,type:'arts',sourceless:true,
          canDodge:false,isAttack:false,isSkill:true,tags:['dot','thorns:s2']});
      }
    }
  }
  finishField(field){
    if(!field.active)return;field.active=false;
    for(const t of field.recipients.keys())this.detach(field,t);
  }
  ensureHooks(){
    if(this.handles.length)return;
    this.handles=[this.b.on('tick',()=>{
      this.pending=this.b.projectiles.list.filter(p=>p.data?.thornsS2===this&&!p.removed).length;
      for(const field of this.fields)this.updateField(field);this.fields=this.fields.filter(f=>f.active);
      if(this.ownerEnded&&!this.pending&&!this.fields.length)this.clearHooks();
    }),this.b.on('heal',ctx=>{
      // Native heal_scale modifies healing events; the HP-recovery attribute
      // has its own final scaler and must not receive that reduction twice.
      if(ctx.opts?.regen||ctx.target?.side!=='enemy')return;
      for(const field of this.fields){
        const r=field.recipients.get(ctx.target);
        if(field.active&&r?.seq===ctx.target.deploySeq&&ctx.target.findBuff(r.buff.key)===r.buff&&this.eligible(ctx.target,field))
          ctx.amount*=this.record.bb.heal_scale;
      }
    }),this.b.on('death',()=>{for(const field of this.fields)this.updateField(field);}),
    this.b.on('battleEnd',()=>{
      for(const field of this.fields)this.finishField(field);this.fields=[];
      this.b.projectiles.remove(p=>p.data?.thornsS2===this);this.pending=0;this.clearHooks();
    })];
  }
  clearHooks(){for(const h of this.handles)this.b.off(h);this.handles=[];}
  ownerStop(){
    this.ownerEnded=true;this.interrupt('owner-finish');
    if(this.b.finished){for(const field of this.fields)this.finishField(field);this.fields=[];
      this.b.projectiles.remove(p=>p.data?.thornsS2===this);this.clearHooks();}
    else if(!this.pending&&!this.fields.length)this.clearHooks();
  }
}
