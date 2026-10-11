// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-thorns-lodestar-prefabs.json' with {type:'json'};
import {absoluteRangeKeys} from '../targeting.js';
import {bodyInKeys} from '../body.js';

export const THORNS_S1_CONTRACT=Object.freeze({
  scope:'Selected-source S1 automatic field with public and isolated combat checks',
  cast:'Natural selected SP; original capped Skill event/clip, ability-start duration extension, release-time cached ATK',
  field:'Speed-ten homing throw; stationary x-4 arrival field, continuous HP regeneration and flat DEF, recipient leave/expiry cleanup; emitted fields survive retreat',
  mapping:'Native postFilter39/professionMask767 is mapped to lowest HP ratio then latest deployment; clip completion ends the cast SP lock. Native disableOverride derived buffs stay independently parent-owned and stack. Root-rounded arrival tiles and duration starting at arrival are local mappings.',
  limits:'Original particles/audio, compiled selector/override priority, native flight-to-field duration clock and Unity frame parity remain unverified',
  frameParity:false,
});
const ID='char_1039_thorn2',KEY='thorns2_s_1[buff]';
const live=t=>t?.alive&&t.deployed&&!t.hidden&&!t._removing;
const model=u=>evidence.models[ID][['UP','LEFT'].includes(u.dir)?'Back':'Front'];
const grid=evidence.tables.ranges['x-4'].grids.map(v=>[v.row,v.col]);
let fieldSeq=0;
// Native disableOverride1: each projectile owns its derived instance. Identical
// display/template keys must not collapse separate parent fields into one buff.
function claim(field,t,enabled){
  const b=field.system.b,old=field.buffs.get(t),key=`${KEY}:${field.id}`;
  if(!enabled||!field.active||!live(t)){
    if(old)b.removeBuff(t,old);field.buffs.delete(t);return;
  }
  if(!old||t.findBuff(key)!==old)field.buffs.set(t,b.addBuff(t,{key,source:field.system.u,
    data:{nativeBuffKey:KEY,thornsField:field},mods:{hpRegen:field.cachedAtk*field.ratio,defFlat:field.def}}));
}

export class ThornsS1Fields{
  constructor(controller){
    this.core=controller;this.b=controller.b;this.u=controller.u;this.record=controller.record;
    this.cast=null;this.fields=[];this.handles=[];this.ownerEnded=false;this.pending=0;
  }
  candidates(){
    const keys=this.core.rangeKeys();
    // Native selector ignores ally-target-free: an isolated unit can be the
    // selected landing anchor, although the field's hit checker excludes it.
    return this.b.allyUnits.filter(t=>live(t)&&t.kind!=='device'&&!t.s.flags.untargetable
      &&!t.s.flags.healFree&&bodyInKeys(t,keys)).sort((a,z)=>a.hpRatio-z.hpRatio||z.deploySeq-a.deploySeq);
  }
  canCast(){return this.core.valid()&&this.u.canAct&&!this.u.s.flags.disarm&&!this.cast
    &&this.core.phase?.kind!=='entrance'&&this.candidates().length>0;}
  start(){
    const {b,u,core}=this,target=this.candidates()[0],speed=Math.min(1,u.base.bat/u.s.interval);
    this.cast={target,targetSeq:target?.deploySeq,epoch:u.attackControlEpoch,
      releaseAt:b.time+model(u).eventPayloads.Skill.find(e=>e.name==='OnAttack').time/speed,
      readyAt:b.time+model(u).durations.Skill/speed,duration:core.fieldDuration(),released:false};
    core.phase=null;core.visual('Skill',speed);this.ensureHooks();
    b.emit('thornsS1Cast',{owner:u,target,duration:this.cast.duration});
  }
  end(){this.cast=null;if(this.core.valid())this.core.visual(this.core.idle(),1,true);}
  interrupt(reason){if(this.cast&&this.u.skill.active)this.u.skill.end(reason);this.cast=null;}
  tick(){
    const {b,u,core}=this,c=this.cast;
    if(c){
      if(!u.canAct||u.s.flags.disarm||c.epoch!==u.attackControlEpoch){this.interrupt('interrupted');return true;}
      if(!c.released&&(!c.target?.alive||c.target.deploySeq!==c.targetSeq)){
        this.interrupt('target-life');u.skill.gainSp(u.skill.spCost,'thorns:failed-target');return true;
      }
      if(!c.released&&b.time+1e-9>=c.releaseAt){c.released=true;this.throwField(c);}
      if(this.cast!==c||!core.valid())return true;
      if(b.time+1e-9>=c.readyAt){u.skill.end('clip-complete');return true;}
      return true;
    }
    if(this.canCast()&&u.skill.ready){u.skill.activate('thorns:auto');return true;}
    return false;
  }
  throwField(c){
    if(!live(c.target)||c.target.deploySeq!==c.targetSeq||c.target.s.flags.untargetable||c.target.s.flags.healFree)return;
    const {b,u}=this,cachedAtk=u.s.atk,seq=c.targetSeq;this.pending++;
    const p=b.addProjectile({from:u,target:c.target,source:u,speed:10,maxAge:100,visual:'bolt',
      data:{arkpediaTrackedVisual:true,thornsS1:this},onHit:({target,x,y})=>{
        if(!b.finished&&live(target)&&target.deploySeq===seq)this.arrive({x,y,cachedAtk,duration:c.duration});
      }});
    b.emit('thornsS1Throw',{owner:u,target:c.target,projectile:p,cachedAtk,duration:c.duration});
  }
  arrive({x,y,cachedAtk,duration}){
    const field={id:++fieldSeq,system:this,active:true,x,y,row:Math.round(y),col:Math.round(x),cachedAtk,
      ratio:this.record.bb.hp_recovery_per_sec_ratio,def:this.record.bb.def,expiresAt:this.b.time+duration,recipients:new Map(),buffs:new Map()};
    field.keys=new Set(absoluteRangeKeys(grid,field.row,field.col,'RIGHT'));
    this.fields.push(field);this.updateField(field);this.b.emit('thornsS1Field',{owner:this.u,field});
  }
  updateField(field){
    if(this.b.finished||this.b.time+1e-9>=field.expiresAt){this.finishField(field);return;}
    const desired=new Map(this.b.allyUnits.filter(t=>live(t)&&t.kind!=='device'&&!t.s.flags.untargetable
      &&!t.s.flags.healFree&&this.b.allySelectable(t,this.u)&&bodyInKeys(t,field.keys)).map(t=>[t,t.deploySeq]));
    for(const [t,seq]of field.recipients)if(desired.get(t)!==seq)claim(field,t,false);
    for(const t of desired.keys())claim(field,t,true);field.recipients=desired;
  }
  finishField(field){
    if(!field.active)return;field.active=false;
    for(const t of field.recipients.keys())claim(field,t,false);field.recipients.clear();
  }
  ensureHooks(){
    if(this.handles.length)return;
    this.handles=[this.b.on('tick',()=>{
      // Flights can fizzle without an onHit callback; count actual live projectiles.
      this.pending=this.b.projectiles.list.filter(p=>p.data?.thornsS1===this&&!p.removed).length;
      for(const field of this.fields)this.updateField(field);this.fields=this.fields.filter(f=>f.active);
      if(this.ownerEnded&&!this.pending&&!this.fields.length)this.clearHooks();
    }),this.b.on('death',()=>{for(const field of this.fields)this.updateField(field);}),
    this.b.on('battleEnd',()=>{
      for(const field of this.fields)this.finishField(field);this.fields=[];
      this.b.projectiles.remove(p=>p.data?.thornsS1===this);this.pending=0;this.clearHooks();
    })];
  }
  clearHooks(){for(const h of this.handles)this.b.off(h);this.handles=[];}
  ownerStop(){
    this.ownerEnded=true;this.interrupt('owner-finish');
    if(this.b.finished){for(const field of this.fields)this.finishField(field);this.fields=[];this.b.projectiles.remove(p=>p.data?.thornsS1===this);this.clearHooks();}
    else if(!this.pending&&!this.fields.length)this.clearHooks();
  }
}
