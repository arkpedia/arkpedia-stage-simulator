// SPDX-License-Identifier: GPL-3.0-or-later
import {MAKOTO_ID as ID,selectedMakotoInputs,makotoS3PermissionInputs} from './arkpedia-makoto-source.js';
export const MAKOTO_S3_PERMISSION_CONTRACT=Object.freeze({
 scope:'Selected original S3 P1 one-trigger parent, derived SP-free/manual-only cast permission and actual skill-account readiness only.',
 mapping:'An explicit owning P1 predicate supplies source mode presence. Its original infinite general producer maps to one world-clock trigger after the positive firstTriggerInterval0.07000000029802322; the same raw triggerInterval, wait-first0 and finite triggerCnt1 remain checked. One independently admitted derived infinite child supplies the native SetSkillCastWithNoSp/SetCastSkillManualTriggerOnly commands through opt-in real SkillRuntime predicates. Manual readiness and activation can use zero stored SP without refilling, consuming or fabricating a charge; nonmanual activation is rejected while the permission is alive. Normal unit control, silence, exhaustion and cast-eligibility checks remain in their normal layers. Parent/child dispel, mode departure, account/source replacement and owner exit remove only owned permission. A refused/finished child is not fabricated again under its already-triggered parent.',
 limitations:'Positive custom first interval precedence over wait-first0, entry origin, fixed-tick rounding, native parent/child admission and callback ordering, and per-account command ownership remain explicit local mappings rather than compiled event/frame proof. The owner must supply transition-aware P1 presence and actual onStart/eligibility. Entry/form/health/SP-stop/passive/fatal/return composition, public art, modules and native effects/audio remain separate; no public admission.',frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u.removed&&!u._removing;
const due=(a,z)=>a>=z-1e-8;
export function verifyMakotoS3Permission(n=makotoS3PermissionInputs()){
 const {mode:m,producer:p,templates:ts}=n,b=p._buffs[0],create=ts.makoto_s3_1_create_allow_cast_skill.eventToActions.ON_BUFF_TRIGGER[0],child=create._buff,
  on=ts.makoto_s3_1_allow_cast_skill.eventToActions.ON_BUFF_START,off=ts.makoto_s3_1_allow_cast_skill.eventToActions.ON_BUFF_FINISH;
 if(!m._generalAbilities.some(p=>p.m_PathID==='-1855292784249942491')||p._buffs.length!==1||b.buffKey!=='makoto_s3_1_create_allow_cast_skill'
  ||b.lifeTimeType!==2||b.triggerLifeType!==1||b.triggerCnt!==1||b.triggerInterval!==0.07000000029802322||b.waitFirstTriggerInterval!==0
  ||b.firstTriggerInterval!==0.07000000029802322||b.isSilenceable!==0||b.isStunnable!==0||b.isDamageMissable!==0
  ||create._isDerivedBuff!==true||create._finishDerivedBuffIfParentFinish!==true||child.buffKey!=='makoto_s3_1_allow_cast_skill'
  ||child.lifeTimeType!=='INFINITY'||child.isDurableBuff!==false||child.isSilenceable!==false||child.isStunnable!==false)throw Error('Changed original Makoto S3 cast-permission producer');
 for(const [nodes,value]of[[on,true],[off,false]])if(nodes.length!==2||!nodes[0].$type.includes('+SetSkillCastWithNoSp,')||nodes[0]._noSp!==value
  ||!nodes[1].$type.includes('+SetCastSkillManualTriggerOnly,')||nodes[1]._value!==value)throw Error('Changed original Makoto S3 cast permission commands');
}
export class MakotoSkillThreePermission{
 constructor(b,u,{contract,inPersona}={}){
  if(contract!==MAKOTO_S3_PERMISSION_CONTRACT||typeof inPersona!=='function'||u.def.charId!==ID||u.deploySeq!==0)throw Error('Fresh selected Makoto S3, exact permission contract and explicit P1 predicate required');
  const record=selectedMakotoInputs(u);if(record.index!==2)throw Error('Fresh selected Makoto S3 required');verifyMakotoS3Permission();
  Object.assign(this,{b,u,record,inPersona,seq:null,account:null,spec:null,stopped:false,busy:false,inMode:false,handles:[],parent:null,child:null,phase:null});
 }
 valid(){return !this.stopped&&!this.b.finished&&this.seq!==null&&present(this.u)&&!this.u.hidden&&this.u.deploySeq===this.seq&&this.u.skill===this.account&&this.account?.spec===this.spec;}
 active(){if(!this.valid())return false;try{const yes=this.inPersona();return this.valid()&&yes===true;}catch(error){this.clear();throw error;}}
 owned(buff,kind){return !!buff&&buff.key===`makoto:s3-permission:${this.u.id}:${this.seq}:${kind}`&&buff.source===this.u&&buff.data?.makotoPermission===this&&this.u.buffs.includes(buff);}
 permitted(){const child=this.child;return this.owned(this.parent,'parent')&&this.owned(child,'child')&&this.active()&&this.owned(this.parent,'parent')&&this.owned(child,'child');}
 prepareSpec(base={}){if(this.spec||base.manualCastWithoutSp!=null||base.manualTriggerOnly!=null)throw Error('Fresh Makoto permission spec without foreign native cast commands required');
  this.spec={...base,manualCastWithoutSp:()=>this.permitted(),manualTriggerOnly:()=>this.permitted()};return this.spec;}
 admit(kind){const key=`makoto:s3-permission:${this.u.id}:${this.seq}:${kind}`,phase=this.phase;
  const permit=(_u,buff)=>this.valid()&&this.phase===phase&&!!phase&&buff.key===key&&buff.source===this.u&&buff.data?.makotoPermission===this
   &&buff.duration===Infinity&&Object.keys(buff.mods??{}).length===0&&Object.keys(buff.flags??{}).length===0
   &&(kind==='parent'||this.owned(this.parent,'parent'));
  let buff;buff=this.b.addBuff(this.u,{key,source:this.u,duration:Infinity,data:{makotoPermission:this},admit:permit,onRemove:()=>{
   if(kind==='parent'){if(this.phase===phase&&(!this.parent||this.parent===buff))this.clear();}else if(this.child===buff)this.child=null;
  }});
  if(!buff||!permit(this.u,buff)||!this.active()||!this.owned(buff,kind)){if(this.owned(buff,kind))this.b.removeBuff(this.u,buff);return null;}return buff;
 }
 tick(){if(this.busy)return;this.busy=true;try{
  if(!this.active()){this.clear();this.inMode=false;return;}
  if(!this.inMode){this.inMode=true;this.phase={nextAt:this.b.time+0.07000000029802322,triggered:false};this.parent=this.admit('parent');if(!this.parent){this.phase=null;return;}}
  if(!this.owned(this.parent,'parent')){this.clear();return;}
  const phase=this.phase;if(phase&&!phase.triggered&&due(this.b.time,phase.nextAt)){
   phase.triggered=true;this.child=this.admit('child');if(!this.active()||!this.owned(this.parent,'parent'))this.clear();
  }
 }finally{this.busy=false;}}
 clear(){const parent=this.parent,child=this.child;this.parent=this.child=null;this.phase=null;
  for(const [buff,kind]of[[child,'child'],[parent,'parent']])if(this.owned(buff,kind))this.b.removeBuff(this.u,buff);}
 install(){if(this.stopped||this.handles.length||this.u.deploySeq!==0||!this.spec||this.u.skill?.spec!==this.spec||this.u.mem.makotoPermission&&this.u.mem.makotoPermission!==this)throw Error('Makoto permission needs its exact fresh real skill account and cannot be reinstalled');
  this.account=this.u.skill;this.u.mem.makotoPermission=this;const{b,u}=this;this.handles=[b.on('deploy',({unit,move})=>{if(unit!==u||move)return;if(this.seq!==null){if(this.seq!==u.deploySeq)this.stop();return;}this.seq=u.deploySeq;},{owner:u}),
   b.on('tick',()=>{if(this.seq!==null&&!this.valid())this.stop();else this.tick();},{owner:u}),...['removed','death'].map(event=>b.on(event,({unit})=>{if(unit===u)this.stop();},{owner:u})),
   b.on('battleEnd',()=>this.stop(),{owner:u})];}
 stop(){if(this.stopped)return;this.stopped=true;this.clear();for(const h of this.handles)this.b.off(h);this.handles=[];}
}
