// SPDX-License-Identifier: GPL-3.0-or-later
import {MAKOTO_ID as ID,selectedMakotoInputs,makotoS3EvasionInputs} from './arkpedia-makoto-source.js';
import {absoluteRangeKeys} from '../targeting.js';import {bodyInKeys} from '../body.js';
export const MAKOTO_S3_EVASION_CONTRACT=Object.freeze({
 scope:'Selected original S3 P2 friendly all-motion aura and parent-derived independent Physical/Arts Evade actions only.',
 mapping:'An explicit owning P2 predicate supplies presence; the selected nonextended x-1 range admits legal friendly character lives including self. Each source owns its own infinite aura parent and independently admitted derived infinite child, with selected attack@prob. Native independentCharacterSource remains true on both. Each owned child contributes its independent Physical/Arts probability to the existing shared dodge aggregation: one minus the product of failure probabilities, including unrelated dodge sources. A missable packet resolves one ordinary combined dodge roll through all apply ways and emits the normal dodge/missed receipt without damage. No additive probability, True/elemental immunity, ATK/DEF/RES change or healing is synthesized. Range exit, source mode departure/removal, receiver replacement and parent finish remove only the owned derived child. Refused/dispelled children are not fabricated again while that parent survives; finishing a parent allows a later aura sample to reattach.',
 limitations:'Numeric target options, profession-mask639 mapped to actual operators, source-validity/selector ordering, tick sampling, separate admission, parent/child finish order and combined-probability dodge dispatch remain explicit local mappings. Native compiled buff iteration/order and exact seeded game RNG parity are not recovered. Block/health/SP/passive form composition, free recast, entry/return/fatal/all-out, public art, modules and native effects/audio remain separate.',frameParity:false,
});
const present=t=>t?.alive&&t.deployed&&!t.removed&&!t._removing;
const retained=(t,life)=>present(t)&&!t.hidden&&t.side==='ally'&&t.deploySeq===life;
export function verifyMakotoS3Evasion(n=makotoS3EvasionInputs()){
 const {mode:m,aura:a,validator:v,templates:ts}=n,p=a._buffs[0],o=v._targetOptions,create=ts.makoto_s3_2_aura.eventToActions.ON_BUFF_START[0],child=create._buff,
  finish=ts.makoto_s3_2_aura.eventToActions.ON_BUFF_FINISH,evade=ts.evade.eventToActions.ON_TAKE_DAMAGE;
 if(!m._generalAbilities.some(p=>p.m_PathID==='-6508989524430762459')||a._buffs.length!==1||p.buffKey!=='makoto_s3_2_aura'||p.templateKey!=='makoto_s3_2_aura'
  ||p.lifeTimeType!==2||p.independentCharacterSource!==1||p.isDamageMissable!==0||p.isSilenceable!==0||p.isStunnable!==0
  ||a._selfOption!==0||a._removeBuffWhenTargetLeave!==1||a._removeBuffWhenAbilityDetached!==1||a._onlyAddBuffOnceForEachTarget!==0||a._ignoreOwnerFakeDeath!==0
  ||a._targetValidator.m_PathID!=='-2311411998879199707'||o.targetSide!==1||o.targetMotion!==3||o.targetCategory!==1||o.enableAdvancedOptions!==1
  ||o.ignoreTargetFree!==0||o.ignoreAllyTargetFree!==0||o.ignoreHealFree!==0||o.ignoreMotionMode!==0||o.checkUnitType!==0||o.purposeMask!==0||o.professionMask!==639)throw Error('Changed original Makoto P2 evasion aura');
 if(!create.$type.includes('+CreateBuff,')||create._buffOwner!=='BUFF_OWNER'||create._isDerivedBuff!==true||create._finishDerivedBuffIfParentFinish!==true
  ||child.buffKey!=='makoto_s3_2_evade'||child.templateKey!=='evade'||child.lifeTimeType!=='INFINITY'||child.independentCharacterSource!==true||child.maxStackCnt!==1
  ||child.isDamageMissable!==false||child.isSilenceable!==false||child.isStunnable!==false||child.isDurableBuff!==false
  ||finish.length!==1||!finish[0].$type.includes('+FinishDerivedBuff,')||evade.length!==1||!evade[0].$type.includes('+Evade,')
  ||evade[0]._damageMask!=='PHYSICAL_AND_MAGICAL'||evade[0]._applyWayFilter!=='ALL')throw Error('Changed original Makoto P2 derived evasion');
}
export class MakotoSkillThreeEvasion{
 constructor(b,u,{contract,inPersona}={}){
  if(contract!==MAKOTO_S3_EVASION_CONTRACT||typeof inPersona!=='function'||u.def.charId!==ID||u.deploySeq!==0)throw Error('Fresh selected Makoto S3, exact evasion contract and explicit P2 predicate required');
  const record=selectedMakotoInputs(u);if(record.index!==2)throw Error('Fresh selected Makoto S3 required');verifyMakotoS3Evasion();
  Object.assign(this,{b,u,record,inPersona,seq:null,stopped:false,busy:false,attaching:false,handles:[],members:new Map(),range:null});
 }
 valid(){return !this.stopped&&!this.b.finished&&this.seq!==null&&present(this.u)&&this.u.deploySeq===this.seq;}
 active(){if(!this.valid())return false;try{const yes=this.inPersona();return this.valid()&&yes===true&&!this.u.hidden;}catch(error){this.clear();throw error;}}
 keys(){const{tileR:r,tileC:c,dir}=this.u;if(!this.range||this.range.r!==r||this.range.c!==c||this.range.dir!==dir)
  this.range={r,c,dir,keys:new Set(absoluteRangeKeys(this.record.skillRangeGrid,r,c,dir))};return this.range.keys;}
 legal(t){return present(t)&&!t.hidden&&t.side==='ally'&&t.kind==='op'&&!t.s.flags.untargetable
  &&this.b.allySelectable(t,this.u)&&bodyInKeys(t,this.keys());}
 owns(p,buff=p.parent){return !!buff&&buff.source===this.u&&buff.data?.makotoEvasion===p&&p.target.buffs.includes(buff);}
 remove(p){if(p.finished)return;p.finished=true;if(this.members.get(p.target)===p)this.members.delete(p.target);
  for(const buff of [p.child,p.parent])if(this.owns(p,buff))this.b.removeBuff(p.target,buff);}
 attach(t){if(this.attaching||!this.valid()||this.members.has(t)||!this.legal(t))return null;this.attaching=true;try{
  const p={target:t,life:t.deploySeq,parent:null,child:null,finished:false},base=`makoto:s3-evade:${this.u.id}:${this.seq}`,power=this.record.bb['attack@prob'];this.members.set(t,p);
  if(!this.active()){this.remove(p);return null;}
  const permit=(_t,buff,key,evasion)=>this.valid()&&!p.finished&&this.members.get(t)===p&&retained(t,p.life)&&this.legal(t)
   &&buff.key===key&&buff.source===this.u&&buff.data?.makotoEvasion===p&&buff.duration===Infinity
   &&Object.keys(buff.flags??{}).length===0
   &&(evasion?Object.keys(buff.mods??{}).length===2&&buff.mods.dodgePhys===power&&buff.mods.dodgeArts===power:Object.keys(buff.mods??{}).length===0);
  p.parent=this.b.addBuff(t,{key:base,source:this.u,duration:Infinity,data:{makotoEvasion:p},admit:(_t,buff)=>permit(_t,buff,base,false),onRemove:()=>this.remove(p)});
  if(!this.active()||!this.owns(p)||!retained(t,p.life)||!this.legal(t)){this.remove(p);return null;}
  const key=base+':child';p.child=this.b.addBuff(t,{key,source:this.u,duration:Infinity,data:{makotoEvasion:p},mods:{dodgePhys:power,dodgeArts:power},
   admit:(_t,buff)=>this.owns(p)&&permit(_t,buff,key,true)});
  if(!this.active()||!this.owns(p)||!retained(t,p.life)||!this.legal(t)){this.remove(p);return null;}
  if(p.child&&!this.owns(p,p.child))p.child=null;return p;
 }finally{this.attaching=false;}
 }
 tick(){if(this.busy)return;this.busy=true;try{
  if(!this.active()){this.clear();return;}
  for(const p of [...this.members.values()])if(!this.owns(p)||!retained(p.target,p.life)||!this.legal(p.target))this.remove(p);
  for(const t of this.b.allyUnits.slice()){if(!this.active()){this.clear();return;}if(!this.members.has(t)&&this.legal(t))this.attach(t);}
 }finally{this.busy=false;}}
 clear(){for(const p of [...this.members.values()])this.remove(p);}
 install(){if(this.stopped||this.handles.length||this.u.mem.makotoS3Evasion&&this.u.mem.makotoS3Evasion!==this)throw Error('Makoto S3 evasion cannot be reinstalled');
  this.u.mem.makotoS3Evasion=this;const{b,u}=this;this.handles=[b.on('deploy',({unit,move})=>{if(unit!==u||move)return;if(this.seq!==null){if(this.seq!==u.deploySeq)this.stop();return;}this.seq=u.deploySeq;},{owner:u}),
   b.on('tick',()=>{if(this.seq!==null&&!this.valid())this.stop();else this.tick();},{owner:u}),...['removed','death'].map(event=>b.on(event,({unit})=>{if(unit===u)this.stop();else if(this.members.has(unit))this.remove(this.members.get(unit));},{owner:u})),
   b.on('battleEnd',()=>this.stop(),{owner:u})];}
 stop(){if(this.stopped)return;this.stopped=true;this.clear();for(const h of this.handles)this.b.off(h);this.handles=[];}
}
