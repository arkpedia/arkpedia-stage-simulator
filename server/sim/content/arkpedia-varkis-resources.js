// SPDX-License-Identifier: GPL-3.0-or-later
// Held resource adapter. A future combat controller must bind the original mode transitions.
import { VARKIS_ID as ID, selectedVarkisBuild, varkisNativeInputs } from './arkpedia-varkis-source.js';
import { normalizeChess } from '../simdata.js';
export const VARKIS_RESOURCE_CONTRACT = Object.freeze({
  scope: 'Selected S2 overheal barrier and retained one-second inactive-mode decay; no public operator or attack controller',
  mapping: 'Explicit caller-owned mode transitions; final calculatedHeal excess enters the existing shared barrier/damage pipeline. The passive one-second clock starts at deployment and continues while the active mode suppresses decay.',
  limits: 'Compiled mode/event order, native ES intermediary accounting, relative priority against other shields and simultaneous heal modifiers remain unverified. Native particles/audio, modules and game-frame parity are unsupported.',
});
const present = u => u?.alive && u.deployed && !u._removing;
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
export function prepareVarkisResources(b,u,{contract}={}) {
  if (contract !== VARKIS_RESOURCE_CONTRACT || u.def.charId !== ID || u.deploySeq !== 0 || u.mem.varkisResources)
    throw Error('Fresh Varkáris and explicit held resource contract required');
  const r=selectedVarkisBuild({...u.def.raw.arkpedia,skillId:u.def.skill.id});
  if (!same(u.def.stats,normalizeChess({stats:r.stats}).stats) || !same(u.def.skill.bb,r.bb))
    throw Error('Changed Varkáris selected resource inputs');
  const n=varkisNativeInputs(), s=n.templates['varkis_s2[shield]'].eventToActions;
  const shield=n.s2Passive._buffs.find(x=>x.buffKey==='varkis_s2[shield]');
  if (shield.triggerInterval!==1 || shield.waitFirstTriggerInterval!==1
    || s.ON_APPLYING_MODIFIER[0]._checkCurModeIndex!==1
    || s.ON_APPLYING_MODIFIER[2]._sharedFlagIndex!=='HEAL_CAN_GENERAL_SHIELD'
    || s.ON_BUFF_TRIGGER.find(x=>x._minusParamKey)?._minusParamKey!=='dynamic_dec_per_sec'
    || n.templates['varkis_s2[shield_core]'].eventToActions.ON_TAKE_DAMAGE[0]._filterDamageType!==false)
    throw Error('Unreviewed Varkáris resource hierarchy');
  const c=new VarkisResources(b,u,r);u.mem.varkisResources=c;return c;
}
export class VarkisResources {
  constructor(b,u,r) { this.b=b;this.u=u;this.record=r;this.seq=null;this.mode=0;this.next=Infinity;this.handles=[];this.stopped=false;this.key=`varkis:s2:barrier:${u.id}`; }
  valid() { return !this.stopped&&!this.b.finished&&present(this.u)&&this.u.deploySeq===this.seq; }
  setSourceMode(mode) {
    if (![0,1].includes(mode) || mode===1&&this.record.index!==1) throw Error('Invalid selected Varkáris source mode');
    if (!this.valid()) return false;this.mode=mode;return true;
  }
  overflow({target,amount}) {
    if (this.record.index!==1||!this.valid()||this.mode!==1||this.u.hidden||target!==this.u) return;
    const u=this.u,extra=Math.max(0,amount-Math.max(0,u.s.maxHp-u.hp));
    if (!(extra>0)) return;
    const old=u.findBuff(this.key),value=Math.min(u.s.maxHp*this.record.bb.max_hp_ratio,(old?.shield??0)+extra);
    if (old) { old.shield=value;u.markDirty(); }
    else this.b.addBuff(u,{key:this.key,source:u,shield:value,visible:true});
  }
  tick() {
    if (!this.valid()) { if(this.seq!==null)this.stop();return; }
    while(this.b.time+1e-7>=this.next) {
      this.next+=1;
      if(this.mode===1)continue;
      const shield=this.u.findBuff(this.key);if(!shield)continue;
      shield.shield=Math.max(0,shield.shield-this.record.bb.dynamic_dec_per_sec);this.u.markDirty();
      if(shield.shield<=0)this.b.removeBuff(this.u,shield);
    }
  }
  install() {
    if(this.handles.length||this.stopped)throw Error('Varkáris resources cannot be reinstalled');
    this.handles.push(this.b.on('deploy',({unit,move})=>{
      if(unit!==this.u||move)return;this.seq=unit.deploySeq;this.next=this.b.time+1;
    },{owner:this.u}),this.b.on('calculatedHeal',ctx=>this.overflow(ctx),{owner:this.u}),
    this.b.on('tick',()=>this.tick(),{owner:this.u}),
    this.b.on('death',({unit})=>{if(unit===this.u)this.stop();},{owner:this.u}),
    this.b.on('removed',({unit})=>{if(unit===this.u)this.stop();},{owner:this.u}),
    this.b.on('battleEnd',()=>this.stop(),{owner:this.u}));
  }
  stop() {
    if(this.stopped)return;this.stopped=true;this.mode=0;
    for(const h of this.handles)this.b.off(h);this.handles=[];this.b.removeBuff(this.u,this.key);
  }
}
