// SPDX-License-Identifier: GPL-3.0-or-later
// Presentation observes existing damage receipts; it never applies combat work.
import {APHRISSA_ID as ID,aphrissaNativeInputs} from './arkpedia-aphrissa-source.js';
import {APHRISSA_HIT_CONTRACT,APHRISSA_HIT_STYLES,validateAphrissaHit} from '../../../shared/arkpedia/aphrissa-hit-presentation.js';
const present=u=>u?.alive&&u.deployed&&!u.removed&&!u._removing;
export function prepareAphrissaHitPresentation(b,u,{contract}={}){
  if(contract!==APHRISSA_HIT_CONTRACT||u.def.charId!==ID||u.deploySeq!==0||u.mem.aphrissaHitPresentation)throw Error('Explicit held Aphrissa hit presentation required');
  const n=aphrissaNativeInputs();
  for(const [mode,attack,fx]of [['normal',n.ordinary,n.ordinaryHitFx],['s1',n.s1Attack,n.s1HitFx],
    ['s1',n.s1DownAttack,n.s1DownHitFx],['s2',n.s2Beam,n.s2HitFx],['s3',n.s3Attack,n.s3HitFx],['s3',n.s3DownAttack,n.s3DownHitFx]]){
    const expected={_directionType:0,_effects:[APHRISSA_HIT_STYLES[mode].root],_oneshot:1,_endEvent:3,_onlyOnce:0,
      _useFourDirectionalFace:0,_useOwnerToTargetDirection:0,_playIfNotInputTarget:0,_playOnlyIfInputTarget:0};
    if(fx.m_Enabled!==1||fx.m_GameObject.m_PathID!==attack.m_GameObject.m_PathID
      ||JSON.stringify(fx._hitEffects)!==JSON.stringify([expected])||fx._castEffects.length||fx._attachEffects.length
      ||fx._inputTargetEffects.length||fx._castTargetEffects.length||fx._convertCastEndToAttachFinish!==0
      ||fx._recalculatePlaybackSpeed!==0||fx._preDelayFactor!==0)throw Error('Changed original Aphrissa hit dispatch inputs');
  }
  const controller=new HitPresentation(b,u);u.mem.aphrissaHitPresentation=controller;return controller;
}
class HitPresentation{
  constructor(b,u){Object.assign(this,{b,u,seq:null,stopped:false,records:new Map(),seen:new WeakSet(),handles:[]});}
  valid(){return !this.stopped&&!this.b.finished&&present(this.u)&&!this.u.mem.aphrissaOwner?.stopped
    &&this.seq===this.u.deploySeq&&this.u.mem.aphrissaHitPresentation===this;}
  receive({source,target,dmg}){
    if(!this.valid()||this.u.hidden||source!==this.u||!present(target)||target.hidden||target.side!=='enemy'||!dmg
      ||this.seen.has(dmg)||dmg.type!=='arts'||!dmg.isAttack||!Number.isSafeInteger(dmg.attackId)||dmg.attackId<1)return;
    const owner=this.u.mem.aphrissaOwner;
    for(const [mode,controller]of [['normal',owner.ordinary],['s1',owner.s1Attacks],['s2',owner.beam],['s3',owner.attacks]]){
      const phase=controller?.phase,delivery=mode==='s2'?phase?.batch:phase,input=delivery?.delivering;
      if(!controller?.valid()||!delivery?.accepted||delivery.deliveringDamage!==dmg||input?.unit!==target
        ||input.life!==target.deploySeq||dmg.attackId!==delivery.attackId)continue;
      this.seen.add(dmg);
      const t={id:`${this.u.id}:${this.seq}:hit:${mode}:${dmg.attackId}:${target.id}:${input.life}`,mode,
        ownerId:this.u.id,ownerLife:this.seq,targetId:target.id,targetLife:input.life,attackId:dmg.attackId,
        root:APHRISSA_HIT_STYLES[mode].root,startedAt:this.b.time,x:target.x,y:target.y,row:target.tileR,col:target.tileC};
      validateAphrissaHit(t);this.records.set(t.id,t);return;
    }
  }
  tick(){if(!this.valid()){this.stop();return;}for(const [id,t]of this.records)
    if(this.b.time-t.startedAt>=APHRISSA_HIT_STYLES[t.mode].retention-1e-7)this.records.delete(id);}
  snapshot(){this.tick();return this.stopped||this.u.hidden?[]:[...this.records.values()].map(t=>structuredClone(t));}
  install(){
    if(this.stopped||this.handles.length||this.seq!==null)throw Error('Aphrissa hit presentation cannot be reinstalled');
    this.handles=[this.b.on('deploy',({unit,move})=>{if(unit===this.u&&!move){if(this.seq!==null)this.stop();else this.seq=unit.deploySeq;}},{owner:this.u}),
      this.b.on('damaged',h=>this.receive(h),{owner:this.u}),this.b.on('tick',()=>{if(this.seq!==null)this.tick();},{owner:this.u}),
      this.b.on('death',({unit})=>{if(unit===this.u)this.stop();},{owner:this.u}),this.b.on('battleEnd',()=>this.stop(),{owner:this.u})];
  }
  stop(){if(this.stopped)return;this.stopped=true;this.records.clear();this.seen=new WeakSet();for(const h of this.handles)this.b.off(h);this.handles=[];}
}
