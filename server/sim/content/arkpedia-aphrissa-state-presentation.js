// SPDX-License-Identifier: GPL-3.0-or-later
import {APHRISSA_ID as ID,aphrissaNativeInputs} from './arkpedia-aphrissa-source.js';
import {APHRISSA_STATE_CONTRACT,APHRISSA_STATE_STYLES,APHRISSA_STATE_DRAIN,validateAphrissaState} from '../../../shared/arkpedia/aphrissa-state-presentation.js';
const CHARGE='aphris_sk3[charge-vfx]',WING='aphris_sk3[wing-vfx]',STATS='aphris_sk3[on_finish]';
const present=u=>u?.alive&&u.deployed&&!u.removed&&!u._removing;
export function prepareAphrissaStatePresentation(b,u,{contract}={}){
  if(contract!==APHRISSA_STATE_CONTRACT||u.def.charId!==ID||u.deploySeq!==0||u.mem.aphrissaStatePresentation)throw Error('Explicit held Aphrissa state presentation required');
  const n=aphrissaNativeInputs(),charge=n.s3ChargeBuffs._buffs[2],wing=n.s3WingBuff._buffs[0],finish=n.s3Active._buffs[2],
    end=n.templates[CHARGE].eventToActions.ON_BUFF_FINISH,clearCharge=n.templates[WING].eventToActions.ON_BUFF_START,
    clearWing=n.templates.aphris_sk3_finishvfx.eventToActions.ON_BUFF_FINISH;
  for(const [buff,key,kind]of [[n.s1BuffAbility._buffs[0],'aphris_sk1','s1'],[charge,CHARGE,'charge'],[wing,WING,'wing'],[n.s3Active._buffs[0],STATS,'active']])
    if(buff.buffKey!==key||buff.overrideEffectKey!==APHRISSA_STATE_STYLES[kind].root||buff.enableInitDirectionFromSource!==0
      ||buff.disableOverride!==0||buff.maxStackCnt!==1)throw Error('Changed original Aphrissa state buff binding');
  if(charge.lifeTimeType!==1||charge.durationKey!=='charge_time'||wing.lifeTimeType!==2||finish.buffKey!=='aphris_sk3_finishvfx'
    ||n.s3WingBuff._runActionOnEvent!==6||n.s3WingBuff._onlyRunOnce!==0||n.s3WingBuff._extraCondition!==0
    ||end.length!==1||end[0]._effectKey!==APHRISSA_STATE_STYLES.chargeEnd.root||end[0]._targetType!=='BUFF_OWNER'
    ||end[0]._sourceType!=='BUFF_OWNER'||end[0]._createEffectHoldBySource||end[0]._useSourceFaceVactor||end[0]._useConstDirection
    ||end[0]._useSourceToTargetDirection||clearCharge.length!==1||clearCharge[0]._buffKey!==CHARGE
    ||clearWing.length!==1||clearWing[0]._buffKey!==WING)throw Error('Changed original Aphrissa state actions');
  const controller=new StatePresentation(b,u);u.mem.aphrissaStatePresentation=controller;return controller;
}
class StatePresentation{
  constructor(b,u){Object.assign(this,{b,u,owner:u.mem.aphrissaOwner,seq:null,stopped:false,records:new Map(),identities:new WeakMap(),ended:new WeakSet(),serial:0,handles:[]});}
  valid(){return !this.stopped&&!this.b.finished&&present(this.u)&&this.seq===this.u.deploySeq
    &&this.u.mem.aphrissaStatePresentation===this&&this.u.mem.aphrissaOwner===this.owner&&this.owner?.valid();}
  key(record){if(!this.identities.has(record))this.identities.set(record,++this.serial);return this.identities.get(record);}
  track(kind,record,startedAt=record.startedAt){const t={id:`${this.u.id}:${this.seq}:state:${kind}:${this.key(record)}`,kind,
    ownerId:this.u.id,ownerLife:this.seq,activation:record.activation,startedAt,root:APHRISSA_STATE_STYLES[kind].root};
    validateAphrissaState(t);return t;}
  onParentRemoved(owner,record){
    if(!this.valid()||owner!==this.owner||this.ended.has(record)||record.buff?.source!==this.u)return;
    const s1=owner.record.index===0,kind=s1&&owner.atkParent===record&&record.key==='aphris_sk1'?'s1'
      :owner.record.index===2&&owner.parents?.get(record.key)===record?{[CHARGE]:'charge',[STATS]:'active',[WING]:'wing'}[record.key]:null;
    if(!kind||record.buff.data?.[s1?'aphrissaS1Parent':'aphrissaS3Parent']!==record)return;
    this.ended.add(record);const t=this.track(kind,record);
    if(APHRISSA_STATE_DRAIN[kind]===null)this.records.delete(t.id);
    else{t.finishedAt=this.b.time;validateAphrissaState(t);this.records.set(t.id,t);}
    if(kind==='charge'){const end=this.track('chargeEnd',record,this.b.time);this.records.set(end.id,end);}
  }
  onChargeRemoved(owner,record){this.onParentRemoved(owner,record);}
  snapshot(){
    if(!this.valid()){this.stop();return [];}
    const owner=this.u.mem.aphrissaOwner,active=[];
    if(owner.record.index===0&&owner.owns(owner.atkParent)&&!this.ended.has(owner.atkParent))active.push(['s1',owner.atkParent]);
    if(owner.record.index===2)for(const [kind,key]of [['charge',CHARGE],['active',STATS],['wing',WING]]){
      const record=owner.parents.get(key);if(owner.owns(record)&&!this.ended.has(record))active.push([kind,record]);
    }
    const current=new Set();for(const [kind,record]of active){const t=this.track(kind,record);current.add(t.id);this.records.set(t.id,t);}
    for(const [id,t]of this.records){
      if(t.kind==='chargeEnd'&&t.finishedAt===undefined&&this.b.time>=t.startedAt+APHRISSA_STATE_STYLES.chargeEnd.retention-1e-7)
        t.finishedAt=t.startedAt+APHRISSA_STATE_STYLES.chargeEnd.retention;
      if(t.finishedAt!==undefined){if(this.b.time>=t.finishedAt+APHRISSA_STATE_DRAIN[t.kind])this.records.delete(id);}
      else if(t.kind!=='chargeEnd'&&!current.has(id))this.records.delete(id);
    }
    return this.u.hidden?[]:[...this.records.values()].map(t=>structuredClone(t));
  }
  install(){if(this.stopped||this.handles.length||this.seq!==null)throw Error('Aphrissa state presentation cannot be reinstalled');
    this.handles=[this.b.on('deploy',({unit,move})=>{if(unit===this.u&&!move){if(this.seq!==null)this.stop();else this.seq=unit.deploySeq;}},{owner:this.u}),
      this.b.on('tick',()=>{if(this.seq!==null)this.snapshot();},{owner:this.u}),
      this.b.on('death',({unit})=>{if(unit===this.u)this.stop();},{owner:this.u}),this.b.on('battleEnd',()=>this.stop(),{owner:this.u})];
  }
  stop(){if(this.stopped)return;this.stopped=true;this.records.clear();this.identities=new WeakMap();this.ended=new WeakSet();
    for(const h of this.handles)this.b.off(h);this.handles=[];}
}
