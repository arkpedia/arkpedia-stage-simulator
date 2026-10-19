// SPDX-License-Identifier: GPL-3.0-or-later
// Held S2 marker/check/output grants. Account, delayed selector and art compose separately.
import {YUKARI_ID as ID,selectedYukariInputs,yukariNativeInputs,yukariSourceComponent} from './arkpedia-yukari-source.js';
export const YUKARI_S2_EFFECTS_CONTRACT=Object.freeze({
 scope:'Selected original Yukari S2 immediate checker, persistent next-skill marker and timed nonstacking Arts-output grant only; no cast/selector or public admission.',
 mapping:'The caller supplies selected friendly operator lives. An independently admitted immediate check computes damage_scale=abs(1+selected damage_up), keeps a stronger existing verified marker, and removes/replaces an equal or weaker owned marker before creating the native UNIQUE infinite marker. Foreign or reentrantly substituted state is never adopted/deleted. Each marker captures the receiver life and an admission-time activation watermark; only a later source-numbered skillStart consumes it, once. A future current SkillRuntime on the same receiver life is allowed because the native trigger has no skill-ID/account filter. The accepted start claims before callbacks, attempts an independent duration-key output buff, then finishes only its marker even if output is refused. Already claimed output survives parent dispel, account change and source retirement, but never receiver replacement. The named artsEnhance channel selects the strongest live positive damage_scale bonus, keeps independent source lifetimes for fallback, and multiplies existing unrelated typed output modifiers. Physical/True/elemental damage, injury, healing, printed ATK and skill SP are unchanged. Source exit stops new checks but does not remove nonderived receiver markers/output; receiver exit and battle end clear only owned resources.',
 limitations:'Native UNIQUE/default override/priority, action-failure ordering, source inheritance, watermark and strongest-source fallback remain explicit local mappings. Unknown foreign same-key markers fail closed rather than being interpreted as native blackboards. Native event/compiled callback order, selector priorities, ball delay, full S2 account, public artwork/gameplay, native FX/audio/modules and frame/pixel parity are separate. No invented instant ATK buff or marker consumption on the currently running skill.',frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u.removed&&!u._removing;
const same=(a,z)=>JSON.stringify(a)===JSON.stringify(z);
let ownerSerial=0;
export function verifyYukariS2Effects(n=yukariNativeInputs(),read=yukariSourceComponent){
 const check=read('skills','skchr_yukari_2','991671031988104758'),passive=check._activeBuffs[0],actions=n.templates['yukari_s_2[check]'].eventToActions.ON_BUFF_START,
  calc=actions[0],branch=actions[1],contains=branch._conditionsNode[0],success=branch._succeedNodes,failure=branch._failNodes,
  marker=success[3],trigger=n.templates.yukari_s_2.eventToActions.ON_SKILL_START,output=trigger[0],d=output._buff,scale=n.templates['damage_scale[out_mag]'].eventToActions.ON_OUTPUT_DAMAGE;
 if(check._metadata.namedAsAlias!=='Skill_2'||check._waitForAttackEvent!==0||check._timeMode!==2||check._affectedBySlowDown!==0||check._selectTargetTiming!==2||check._activeBuffs.length!==1
  ||passive.buffKey!=='yukari_s_2[check]'||passive.templateKey!=='yukari_s_2[check]'||passive.lifeTimeType!==0||!same(passive.blackboard,[{key:'damage_base',value:1,valueStr:''}])
  ||actions.length!==2||calc._inputKey!=='damage_up'||calc._outputKey!=='damage_scale'||calc._addParamKey!=='damage_base'||calc._finalAbs!==true||calc._multiplyParamKey!==null||calc._dividedParamKey!==null
  ||branch._conditionsNode.length!==1||contains._targetType!=='BUFF_OWNER'||!same(contains._buffKeys,['yukari_s_2'])||contains._checkBuffSource!==false
  ||success.length!==4||failure.length!==1||success[0]._buffKey!=='yukari_s_2'||success[0]._valueKey!=='damage_scale'||success[0]._blackboardKey!=='value'||success[0]._filterBuffSource!==false
  ||success[1]._blackboardKey!=='damage_scale'||success[1]._anotherKeyToCompare!=='value'||success[1]._condType!=='GE'
  ||success[2]._buffKey!=='yukari_s_2'||success[2]._targetType!=='BUFF_OWNER'||success[2]._checkBuffSource!==false||!same(marker,failure[0]))throw Error('Changed original Yukari S2 checker');
 for(const a of[marker,output]){const p=a._buff;if(a._buffOwner!=='BUFF_OWNER'||a._useSpecialBuffSource!==false||a._isDerivedBuff!==false||a._finishDerivedBuffIfParentFinish!==false
   ||p.isDurableBuff!==true||p.isDamageMissable!==false||p.isSilenceable!==false||p.isStunnable!==false||p.attributes.abnormalFlags.length||p.attributes.attributeModifiers.length||p.maxStackCnt!==1||p.independentCharacterSource!==false)
   throw Error('Changed original Yukari S2 grant ownership');}
 if(marker._buff.buffKey!=='yukari_s_2'||marker._buff.templateKey!=='yukari_s_2'||marker._buff.lifeTimeType!=='INFINITY'||marker._buff.overrideType!=='UNIQUE'
  ||trigger.length!==2||!trigger[1].$type.includes('+FinishBuff,')||d.buffKey!=='yukari_s_2[damage_scale]'||d.templateKey!=='damage_scale[out_mag]'||d.lifeTimeType!=='LIMITED'||d.durationKey!=='duration'
  ||d.overrideKey!=='damage_enhance_magical'||d.overrideType!=='DEFAULT'||!same(d.priorityBBKeys,['damage_scale'])||d.statusResistable!=='AUTOMATIC'
  ||scale.length!==1||scale[0]._filterDamageType!==true||scale[0]._damageMask!=='MAGICAL'||scale[0]._filterApplyWay!==false||scale[0]._filterModifierKey!==false||scale[0]._isStackable!==false||scale[0]._isOneMinus!==false)
  throw Error('Changed original Yukari S2 next-skill/Arts output');
}
export class YukariSkillTwoEffects{
 constructor(b,u,{contract}={}){
  if(contract!==YUKARI_S2_EFFECTS_CONTRACT||u.def.charId!==ID||u.deploySeq!==0||selectedYukariInputs(u).index!==1)throw Error('Fresh selected Yukari S2 and exact effects contract required');
  verifyYukariS2Effects();const record=selectedYukariInputs(u);Object.assign(this,{b,u,record,power:Math.abs(1+record.bb.damage_up),duration:record.bb.duration,seq:null,owner:++ownerSerial,serial:0,retired:false,ended:false,grants:new Set(),watchers:[]});
 }
 bind(){if(this.seq!==null||this.retired||this.ended||!present(this.u))throw Error('S2 effects bind one living deployment');this.seq=this.u.deploySeq;}
 sourceLive(){return !this.ended&&!this.retired&&!this.b.finished&&present(this.u)&&this.u.deploySeq===this.seq;}
 receiver(t,life=t?.deploySeq){return !this.ended&&!this.b.finished&&present(t)&&t.deploySeq===life&&t.side==='ally'&&t.kind==='op'&&this.b.allyUnits.includes(t);}
 owns(p){return !!p&&!p.finished&&p.buff?.key===p.key&&p.buff.source===this.u&&p.buff.data?.yukariS2===p&&p.unit.buffs.includes(p.buff);}
 remove(p){if(p?.buff?.key===p.key&&p.buff.source===this.u&&p.buff.data?.yukariS2===p&&p.unit.buffs.includes(p.buff))this.b.removeBuff(p.unit,p.buff);}
 finish(p){if(!p||p.finished)return;p.finished=true;this.grants.delete(p);this.remove(p);this.unwatch();}
 admitGrant(unit,{kind,duration,key,permit,account=unit.skill,after=account?.activations}={}){
  const p={manager:this,unit,kind,key:key??`yukari_s_2[${kind}]:${this.owner}:${++this.serial}`,life:unit.deploySeq,account,after,power:this.power,duration,effectDuration:this.duration,buff:null,finished:false,admitted:false,claimed:false};
  const mods=kind==='output'?{artsDealtMul:p.power}:null,status=kind==='output'?'artsEnhance':null,data={yukariS2:p,...(kind==='output'?{value:p.power-1}:{})},durable=kind!=='check';let descriptor;
  const admit=(_t,buff)=>this.receiver(unit,p.life)&&!p.finished&&permit()&&(!buff||buff.key===p.key&&buff.source===this.u&&buff.data?.yukariS2===p&&buff.status===status
   &&p.power===this.power&&p.effectDuration===this.duration&&same(buff.mods??{},mods??{})&&Object.keys(buff.flags??{}).length===0&&buff.persist===durable&&buff.sourceStatusResistable==null&&(kind!=='output'||buff.data.value===p.power-1)
   &&(buff===descriptor||buff.stacks===1&&buff.duration===duration&&buff.timeLeft===duration))&&(!unit.findBuff(p.key)||unit.findBuff(p.key).data?.yukariS2===p);
  const finish=()=>{if(p.finished)return;p.finished=true;this.grants.delete(p);this.unwatch();};
  descriptor={key:p.key,source:this.u,duration,mods,status,data,persist:durable,refresh:'keep',sourceStatusResistable:null,admit,onRemove:finish,onExpire:finish};p.buff=this.b.addBuff(unit,descriptor);
  if(!admit()||!this.owns(p)){p.finished=true;this.remove(p);return null;}if(kind==='marker'){p.account=unit.skill;p.after=p.account?.activations??0;}p.admitted=true;this.grants.add(p);if(kind!=='check')this.watch();return p;
 }
 marker(t){const buff=t.findBuff('yukari_s_2'),p=buff?.data?.yukariS2;return p?.manager instanceof YukariSkillTwoEffects&&p.manager.b===this.b&&p.kind==='marker'&&p.manager.owns(p)?p:null;}
 grant(t,{permit=()=>true}={}){
  if(!this.sourceLive()||!this.receiver(t)||typeof permit!=='function')return null;const life=t.deploySeq;
  const check=this.admitGrant(t,{kind:'check',duration:0,permit:()=>this.sourceLive()&&t.deploySeq===life&&permit()});if(!check)return null;
  try{if(!this.sourceLive()||!this.owns(check))return null;const old=this.marker(t),existing=t.findBuff('yukari_s_2');
   if(existing&&!old||old&&old.power>this.power)return null;if(old)old.manager.finish(old);
   if(!this.sourceLive()||!this.owns(check)||!this.receiver(t,life)||t.findBuff('yukari_s_2'))return null;
   return this.admitGrant(t,{kind:'marker',key:'yukari_s_2',duration:Infinity,permit:()=>this.sourceLive()&&this.owns(check)&&permit()});
  }finally{this.finish(check);}
 }
 consume({unit,skill,activation}){
  if(!this.receiver(unit)||!skill||skill!==unit.skill||!Number.isInteger(activation)||activation<1||activation>skill.activations)return false;
  const p=this.marker(unit);if(!p||p.manager!==this||p.claimed||p.account===skill&&activation<=p.after)return false;p.claimed=true;
  try{return !!this.admitGrant(unit,{kind:'output',duration:p.effectDuration,account:skill,after:activation,permit:()=>this.receiver(unit,p.life)});}
  finally{this.finish(p);}
 }
 watch(){if(this.watchers.length||![...this.grants].some(p=>p.kind!=='check'))return;const{b}=this;this.watchers=[
  b.on('skillStart',c=>this.consume(c)),b.on('tick',()=>{for(const p of [...this.grants])if(p.kind!=='check'&&(!this.receiver(p.unit,p.life)||!this.owns(p)))this.finish(p);this.unwatch();}),
  b.on('removed',({unit})=>{for(const p of [...this.grants])if(p.unit===unit)this.finish(p);}),b.on('death',({unit})=>{for(const p of [...this.grants])if(p.unit===unit)this.finish(p);}),b.on('battleEnd',()=>this.drain())];
 }
 unwatch(){if([...this.grants].some(p=>p.kind!=='check'))return;for(const h of this.watchers)this.b.off(h);this.watchers=[];}
 retire(){this.retired=true;}
 drain(){if(this.ended)return;this.ended=true;this.retire();for(const p of [...this.grants])this.finish(p);this.unwatch();}
}
