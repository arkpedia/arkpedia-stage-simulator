// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-thorns-lodestar-prefabs.json' with {type:'json'};
import {bodyInKeys} from '../body.js';
import {canTargetEnemy} from '../targeting.js';
import {thornsPolygon,thornsPolygonContains} from './arkpedia-thorns-polygon.js';

export const THORNS_S3_CONTRACT=Object.freeze({
  scope:'Private S3 execution review; public lifecycle and original cast/region synchronization remain held',
  cast:'Natural manual SP; lowest block count then latest deployed operator anchors in passive range; original capped Skill_3_Loop event',
  field:'Independent convex polygon/strip/point, immediate first periodic receipt on region readiness, cached ATK, sourceless Arts damage and strongest ATK-priority reduction with weaker-field fallback',
  mapping:'Anchors freeze at the release event. Region readiness uses the preserved half-second polygon delay after release; duration starts at readiness. Damage/debuff ramp samples whole source intervals after readiness. These are explicit local clock mappings requiring original-game comparison.',
  limits:'Native polygon-creator/Token dispatch, one-second reached-delay semantics, anchor landing/mount positions, incrementer phase, endpoint caps, particles/audio, modules and Unity frame parity remain unverified',
  frameParity:false,
});
const ID='char_1039_thorn2',KEY='thorn2_s3_enemy_hit',EPS=1e-9;
const live=t=>t?.alive&&t.deployed&&!t.hidden&&!t._removing;
const model=u=>evidence.models[ID][['UP','LEFT'].includes(u.dir)?'Back':'Front'];
let fieldSeq=0;
const claims=new WeakMap(),battleFields=new WeakMap();
function fieldsFor(b){let fields=battleFields.get(b);if(!fields){fields=new Set();battleFields.set(b,fields);}return fields;}
function claim(field,t,value){
  const b=field.system.b;let recipients=claims.get(b);if(!recipients){recipients=new Map();claims.set(b,recipients);}
  let entry=recipients.get(t);if(!entry){if(!value)return;entry={fields:new Map(),buff:null,winner:null};recipients.set(t,entry);}
  if(value)entry.fields.set(field,{...value,seq:t.deploySeq});else entry.fields.delete(field);
  for(const [f,v]of entry.fields)if(!f.active||!live(t)||v.seq!==t.deploySeq)entry.fields.delete(f);
  const candidates=[...entry.fields].sort((a,z)=>Math.abs(z[1].atk)-Math.abs(a[1].atk)||a[0].id-z[0].id),winner=candidates[0];
  if(!winner){if(entry.buff)b.removeBuff(t,entry.buff);recipients.delete(t);return;}
  const [f,v]=winner,mods={atkMul:1+v.atk,defMul:1+v.def,resMul:1+v.magic_resistance};
  if(entry.winner!==f||t.findBuff(KEY)!==entry.buff||JSON.stringify(entry.buff?.mods)!==JSON.stringify(mods)){
    if(entry.buff)b.removeBuff(t,entry.buff);entry.winner=f;
    entry.buff=b.addBuff(t,{key:KEY,source:f.system.u,mods,data:{nativeBuffKey:KEY,thornsField:f}});
  }
}
export class ThornsS3Fields{
  constructor(core){this.core=core;this.b=core.b;this.u=core.u;this.record=core.record;this.cast=null;this.fields=[];this.handles=[];this.ownerEnded=false;}
  candidates(){
    const keys=this.core.rangeKeys();return this.b.allyUnits.filter(t=>live(t)&&t.kind==='op'&&!t.s.flags.untargetable
      &&!t.s.flags.healFree&&this.b.allySelectable(t,this.u)&&bodyInKeys(t,keys))
      .sort((a,z)=>a.s.blockCnt-z.s.blockCnt||z.deploySeq-a.deploySeq).slice(0,this.record.bb.max_target_token);
  }
  canCast(){return this.core.valid()&&this.u.canAct&&!this.u.s.flags.disarm&&!this.cast&&this.core.phase?.kind!=='entrance';}
  start(){
    const speed=Math.min(1,this.u.base.bat/this.u.s.interval),m=model(this.u);
    this.cast={epoch:this.u.attackControlEpoch,releaseAt:this.b.time+m.eventPayloads.Skill_3_Loop.find(e=>e.name==='OnAttack').time/speed,
      readyAt:this.b.time+m.durations.Skill_3_Loop/speed,duration:this.core.fieldDuration(),released:false};
    this.core.phase=null;this.core.visual('Skill_3_Loop',speed);this.ensureHooks();this.b.emit('thornsS3Cast',{owner:this.u,cast:this.cast});
  }
  end(){this.cast=null;if(this.core.valid())this.core.visual(this.core.idle(),1,true);}
  interrupt(reason){if(this.cast&&this.u.skill.active)this.u.skill.end(reason);this.cast=null;}
  tick(){
    const c=this.cast;if(!c)return false;
    if(!this.u.canAct||this.u.s.flags.disarm||c.epoch!==this.u.attackControlEpoch){this.interrupt('interrupted');return true;}
    if(!c.released&&this.b.time+EPS>=c.releaseAt){c.released=true;this.release(c);}
    if(this.cast!==c||!this.core.valid())return true;
    if(this.b.time+EPS>=c.readyAt)this.u.skill.end('clip-complete');return true;
  }
  release(c){
    const anchors=this.candidates(),selected=anchors.length?anchors:[this.u];
    const points=selected.map(t=>({x:Math.round(t.x),y:Math.round(t.y)}));
    const field={id:++fieldSeq,system:this,active:true,region:thornsPolygon(points),anchors:selected.slice(),
      cachedAtk:this.u.s.atk,releasedAt:this.b.time,readyAt:this.b.time+.5,expiresAt:this.b.time+.5+c.duration,
      nextAt:this.b.time+.5,recipients:new Map()};
    this.fields.push(field);fieldsFor(this.b).add(field);this.b.emit('thornsS3Release',{owner:this.u,field});
  }
  eligible(t,field){
    if(!live(t)||!canTargetEnemy(this.u,t,{canHitFly:true}))return false;
    if(thornsPolygonContains(field.region,t))return true;
    const blocker=t.blockedBy;
    // Source polygon ally-side selector ignores ally-target-free, includes tokens,
    // excludes devices/heal-free, and gives its blocked enemies region membership.
    return live(blocker)&&blocker.kind!=='device'&&!blocker.s.flags.untargetable&&!blocker.s.flags.healFree
      &&thornsPolygonContains(field.region,blocker);
  }
  values(field){
    const bb=this.record.bb,count=Math.min(bb.max_stack_cnt,Math.max(0,Math.floor((this.b.time-field.readyAt+EPS)/bb.interval)));
    return {count,scale:Math.min(bb.max_atk_scale,bb.atk_scale+count*bb.atk_scale_per_interval),
      atk:Math.max(bb.max_atk,bb.atk+count*bb.atk_per_interval),def:Math.max(bb.max_def,bb.def+count*bb.def_per_interval),
      magic_resistance:Math.max(bb.max_magic_resistance,bb.magic_resistance+count*bb.magic_resistance_per_interval)};
  }
  updateField(field){
    const b=this.b;if(!field.active)return;
    if(b.finished||b.time+EPS>=field.expiresAt){this.finish(field);return;}
    if(b.time+EPS<field.readyAt)return;
    const value=this.values(field);
    for(const [t,seq]of field.recipients)if(seq!==t.deploySeq||!this.eligible(t,field)){claim(field,t,null);field.recipients.delete(t);}
    for(const t of b.enemies){if(this.eligible(t,field)){field.recipients.set(t,t.deploySeq);claim(field,t,value);}}
    if(b.time+EPS<field.nextAt)return;field.nextAt+=this.record.bb.interval;
    for(const [t,seq]of field.recipients){
      if(b.finished||!field.active)break;
      if(t.deploySeq!==seq||!this.eligible(t,field))continue;
      // Refresh all ready field claims before damage, including a stronger
      // field whose owner hook runs later in this same battle phase.
      for(const other of fieldsFor(b)){
        if(other.active&&b.time+EPS>=other.readyAt&&b.time+EPS<other.expiresAt&&other.system.eligible(t,other)){
          other.recipients.set(t,t.deploySeq);claim(other,t,other.system.values(other));
        }else{claim(other,t,null);other.recipients.delete(t);}
      }
      b.dealDamage(this.u,t,{amount:field.cachedAtk*value.scale,type:'arts',sourceless:true,
        canDodge:false,isAttack:false,isSkill:true,tags:['dot','thorns:s3']});
    }
  }
  finish(field){if(!field.active)return;field.active=false;fieldsFor(this.b).delete(field);for(const t of field.recipients.keys())claim(field,t,null);field.recipients.clear();}
  ensureHooks(){
    if(this.handles.length)return;
    this.handles=[this.b.on('tick',()=>{
      for(const f of this.fields)this.updateField(f);this.fields=this.fields.filter(f=>f.active);
      if(this.ownerEnded&&!this.fields.length)this.clearHooks();
    }),this.b.on('death',()=>{
      // Damage callbacks may remove a recipient synchronously; membership cleanup
      // must not recursively dispatch another periodic receipt.
      for(const f of this.fields)for(const [t,seq]of f.recipients)if(!live(t)||t.deploySeq!==seq){claim(f,t,null);f.recipients.delete(t);}
    }),this.b.on('battleEnd',()=>{for(const f of this.fields)this.finish(f);this.fields=[];this.clearHooks();})];
  }
  clearHooks(){for(const h of this.handles)this.b.off(h);this.handles=[];}
  ownerStop(){this.ownerEnded=true;this.interrupt('owner-finish');if(this.b.finished){for(const f of this.fields)this.finish(f);this.fields=[];}
    if(!this.fields.length)this.clearHooks();}
}
