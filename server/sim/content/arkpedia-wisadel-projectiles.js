// SPDX-License-Identifier: GPL-3.0-or-later
// Private ordinary/S1 subsystem. The controller owns accepted attack commands;
// these outputs own their flight/delay clocks, not another attack or SP event.
import evidence from '../../../data/arkpedia-wisadel-prefabs.json' with { type:'json' };
import { canTargetEnemy } from '../targeting.js';

export const WISADEL_AFTERIMAGE = 'wisdel_t_1[bomb]';
const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const ground = { groundOnly:true,canHitFly:false }, allMotion = { canHitFly:true };
// Shared across owners: the native explosion action explicitly does not require
// a live centre target. Preserve its mark until a lethal shock's action resolves.
const shockDepth = new WeakMap();
const specs = Object.fromEntries(['default','s1','s1_shock','s1_shock2','s1_bomb'].map(key => {
  const rows=evidence.projectiles[`projectile_chr_wisdel_${key}`].flatMap(r=>r.components.map(c=>c.data));
  const mover=rows.find(c=>c._delayAfterReached!=null), root=rows.find(c=>c._lifeTime!=null);
  return [key,{ radius:rows.find(c=>c.m_Radius!=null).m_Radius,
    delay:mover._delayAfterReached,speed:mover._speed,life:root._lifeTime }];
}));
const trait=Object.fromEntries(evidence.tables.character.trait.candidates[0].blackboard.map(v=>[v.key,v.value]));

export class WisadelProjectiles {
  constructor(b,u,record) {
    this.b=b; this.u=u; this.record=record; this.outputs=new Set(); this.marks=new Map();
    this.detonating=new Set(); this.handles=[]; this.ownerFinished=false; this.cancelled=false;
  }
  talentActive() { return !this.ownerFinished && live(this.u) && Object.keys(this.record.talent).length>0; }
  talent(key,fallback=0) { return this.talentActive() ? this.record.talent[`attack@${key}`]??fallback : fallback; }
  valid(command) { return !this.cancelled && !this.b.finished && !command.cancelled; }
  victims(x,y,radius,profile) {
    return this.b.foesInRadius(x,y,radius,true).filter(t=>canTargetEnemy(this.u,t,profile))
      .map(target=>({ target,seq:target.deploySeq }));
  }
  sameLife(v,profile) { return v.target.deploySeq===v.seq && canTargetEnemy(this.u,v.target,profile); }
  install() {
    if(this.handles.length || this.cancelled)return;
    // No owner-scoped tick: already-born projectiles survive owner withdrawal.
    this.handles=[this.b.on('tick',()=>this.tick()),this.b.on('battleEnd',()=>this.finish()),
      this.b.on('death',({unit})=>{
        const mark=this.marks.get(unit);if(mark&&!shockDepth.get(unit))this.b.removeBuff(unit,mark);
      })];
  }
  launch(target,info,isSkill) {
    const command={ target,targetSeq:target.deploySeq,ownerSeq:this.u.deploySeq,
      attackId:info.attackId,isSkill,x:this.u.x,y:this.u.y,lastX:target.x,lastY:target.y,
      bornAt:this.b.time,cancelled:false,timers:[] };
    const keys=isSkill?['s1','s1_shock','s1_shock2','s1_bomb']:['default'];
    command.parts=keys.map(key=>({key,spec:specs[key],x:this.u.x,y:this.u.y,lastX:target.x,lastY:target.y,
      updatedAt:this.b.time,arrived:false,done:false,stunVictims:null}));
    this.outputs.add(command);
    this.b.emit('wisadelProjectileBirth',{ owner:this.u,command });
    return command;
  }
  tick() {
    for(const command of [...this.outputs]) {
      if(!this.valid(command))continue;
      const reached=[];
      for(const part of command.parts) {
        if(part.arrived)continue;
        const {target}=command,{spec}=part;
        if(live(target)&&target.deploySeq===command.targetSeq) { part.lastX=target.x;part.lastY=target.y; }
        const dx=part.lastX-part.x,dy=part.lastY-part.y,d=Math.hypot(dx,dy);
        const travel=spec.speed*Math.max(0,this.b.time-part.updatedAt);part.updatedAt=this.b.time;
        if(d<=travel+1e-9 || this.b.time-command.bornAt>=spec.life-1e-9) {
          part.x=part.lastX;part.y=part.lastY;reached.push(part);
          if(part.key==='s1_bomb')part.stunVictims=this.victims(part.x,part.y,part.spec.radius,ground);
        } else if(d>0) { part.x+=dx*travel/d;part.y+=dy*travel/d; }
      }
      // Sample all arrivals before their callbacks mutate another victim life.
      for(const part of reached)this.arrive(command,part);
    }
  }
  complete(command,part) {
    part.done=true;
    if(command.parts.every(p=>p.done)){ this.outputs.delete(command);this.releaseHooks(); }
  }
  arrive(command,part) {
    if(!this.valid(command)||part.arrived)return;
    part.arrived=true;
    const main=part.key==='default'||part.key==='s1';
    if(main){ command.x=part.x;command.y=part.y;command.arrived=true; }
    if(part.key==='s1_bomb'){
      for(const v of part.stunVictims) {
        if(!this.valid(command))break;
        if(this.sameLife(v,ground))this.b.applyStatus(v.target,'stun',{
          duration:this.record.bb.stun_duration,source:this.u });
      }
      this.complete(command,part);return;
    }
    // Schedule before receipt hooks. Control/death of the shooter cannot erase
    // an accepted native output; battle finish can erase every remaining part.
    command.timers.push(this.b.after(part.spec.delay,()=>{
      if(this.valid(command))this.hit(command,'aftershock',part);
      this.complete(command,part);
    }));
    if(main)this.hit(command,'main',part);
  }
  attach(target,seq) {
    if(!this.talentActive() || target.deploySeq!==seq || !live(target))return;
    // Shared native key, no independent-character stack. First accepted source
    // claims parent cleanup; another owner's shock may still consume that mark.
    const buff=this.b.addBuff(target,{key:WISADEL_AFTERIMAGE,source:this.u,refresh:'keep',
      data:{ wisadelLife:seq },onRemove:({buff})=>{
        if(this.marks.get(target)===buff)this.marks.delete(target);
      }});
    if(buff?.source===this.u && buff.data.wisadelLife===seq)this.marks.set(target,buff);
    // beforeBuff may withdraw the parent or replace the victim life.
    if(buff?.source===this.u && (!this.talentActive() || target.deploySeq!==seq || !live(target)))
      this.b.removeBuff(target,buff);
  }
  hit(command,kind,part) {
    if(!this.valid(command))return;
    this.b.emit('wisadelProjectileImpact',{ owner:this.u,command,kind,part });
    for(const v of this.victims(part.x,part.y,part.spec.radius,ground)) {
      if(!this.valid(command))break;
      if(!this.sameLife(v,ground))continue;
      const primary=v.target===command.target && v.seq===command.targetSeq;
      if(kind==='main'&&primary)this.attach(v.target,v.seq);
      if(!this.valid(command)||!this.sameLife(v,ground))continue;
      const mark=v.target.findBuff(WISADEL_AFTERIMAGE);
      const scale=kind==='main'?1:command.isSkill?this.record.bb.append_atk_scale:trait['attack@append_atk_scale'];
      const shock=kind==='aftershock';
      if(shock)shockDepth.set(v.target,(shockDepth.get(v.target)??0)+1);
      try {
        this.b.dealDamage(this.u,v.target,{amount:this.u.s.atk*this.u.s.atkScaleMul*scale*
          (primary?this.talent('main_atk_scale',1):1),type:'phys',isAttack:true,
          isSkill:command.isSkill,isSplash:true,applyWay:'ranged',attackId:command.attackId,
          tags:shock?['aftershock']:[] });
        if(v.target.deploySeq!==v.seq && mark?.data.wisadelLife===v.seq)this.b.removeBuff(v.target,mark);
        if(shock&&this.valid(command)&&v.target.deploySeq===v.seq&&
          (!v.target.alive||this.sameLife(v,ground)))this.explode(command,v);
      } finally {
        if(shock){
          const depth=shockDepth.get(v.target)-1;
          if(depth)shockDepth.set(v.target,depth);else shockDepth.delete(v.target);
          if(!v.target.alive&&!depth){
            const deadMark=v.target.findBuff(WISADEL_AFTERIMAGE);
            if(deadMark?.data.wisadelLife===v.seq)this.b.removeBuff(v.target,deadMark);
          }
        }
      }
    }
  }
  explode(command,v) {
    // Native Dice precedes CheckContainsBuff: each valid shock victim rolls,
    // including unmarked victims. E0 has no talent and consumes no such roll.
    if(!this.talentActive() || this.b.rng()>=this.talent('prob'))return;
    const mark=v.target.findBuff(WISADEL_AFTERIMAGE);
    if(!mark || mark.data.wisadelLife!==v.seq || this.detonating.has(mark))return;
    this.detonating.add(mark);
    const x=v.target.x,y=v.target.y,scale=this.talent('bomb_atk_scale'),stun=this.talent('stun'),radius=this.talent('range_radius');
    this.b.emit('wisadelAfterimageExplosion',{ owner:this.u,target:v.target,mark,command,x,y });
    for(const victim of this.victims(x,y,radius,allMotion)) {
      if(!this.valid(command))break;
      if(!this.sameLife(victim,allMotion))continue;
      this.b.dealDamage(this.u,victim.target,{amount:this.u.s.atk*this.u.s.atkScaleMul*scale,
        type:'phys',isAttack:false,isSkill:command.isSkill,isSplash:true,applyWay:'none',
        attackId:command.attackId,tags:['afterimage'] });
      if(this.valid(command)&&this.sameLife(victim,allMotion))this.b.applyStatus(victim.target,'stun',{
        duration:stun,source:this.u });
    }
    // Preserve a replacement created by a receipt/removal callback. The native
    // successful branch consumes the afterimage, not every other mark nearby.
    this.b.removeBuff(v.target,mark); this.detonating.delete(mark);
  }
  clearMarks() {
    for(const [target,mark]of [...this.marks])this.b.removeBuff(target,mark);
    this.marks.clear();
  }
  finishOwner() { this.ownerFinished=true; this.clearMarks(); this.releaseHooks(); }
  releaseHooks() {
    if(!this.ownerFinished || this.outputs.size)return;
    for(const h of this.handles)this.b.off(h); this.handles=[];
  }
  finish() {
    this.cancelled=true; this.ownerFinished=true;
    for(const command of this.outputs) { command.cancelled=true; for(const timer of command.timers)timer.cancel(); }
    this.outputs.clear(); this.clearMarks(); this.releaseHooks();
  }
}
