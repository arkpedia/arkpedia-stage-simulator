// SPDX-License-Identifier: GPL-3.0-or-later
// Original skill-finish heal only. Native skill accounts compose separately.
import {YUKARI_ID as ID,selectedYukariInputs,yukariNativeInputs,yukariSourceComponent} from './arkpedia-yukari-source.js';
import {bodyInKeys} from '../body.js';
export const YUKARI_TALENT_CONTRACT=Object.freeze({
 scope:'Selected original Yukari skill-finish healing parent, independent immediate recipient grants and live-ATK heals only; no attack/skill controller or public admission.',
 mapping:'The accepted infinite nonsilenceable/nonstunnable talent parent listens at local higher priority100 to the selected SkillRuntime\'s source-numbered finish event, once per activation. Actual source death/withdrawal/replacement excludes new output; an arbitrary finish-reason string does not substitute for the native owner-death-reason check. E0 has no parent. The original HealWrapper combines self with up to the selected talent\'s max_target other friendly healable recipients on the current ordinary range, sorted by HP ratio then latest deployment/stable id. Self is independent of range and secondary targetability; isolation from others, heal prohibition and noHeal remain distinct. Full-HP legal targets may receive zero-restoration heal actions. Each selected target life independently admits its immediate nonderived heal buff; accepted batches survive parent dispel but later unborn grants require the same living source deployment. Current ATK and shared healing modifiers are read separately for each action. Claimed grants finish synchronously and preserve foreign replacement buffs. Source activation receipts and accepted heal ledger/team credit survive reentrant callbacks.',
 limitations:'Native Self/HP selector aliases, friendly target-free masks, tie order, effect/skill-finish callback order and priority enum mapping remain explicit local contracts, not compiled/native-frame parity. No invented on-arrow heal, generic skill ATK bonus or post-retirement source lookup is introduced. Ordinary and both skill controllers, original art/PMA delivery, native healing FX/audio/modules and public admission remain separate.',frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u.removed&&!u._removing;
export function verifyYukariTalent(n=yukariNativeInputs(),read=yukariSourceComponent){
 const p=n.talent._buffs[0],events=n.templates.yukari_t.eventToActions,actions=events.ON_SKILL_FINISH,h=actions[3],heal=n.templates['yukari_t[heal]'].eventToActions.ON_BUFF_START,
  selector=read('characters',ID,'-2169707945135561975'),self=read('characters',ID,'-3445508239539231991');
 if(n.talent._selector.m_PathID!=='0'||n.talent._attachPassiveBuffsOnDummy!==1||n.talent._buffs.length!==1||p.buffKey!=='yukari_t'||p.templateKey!=='yukari_t'||p.lifeTimeType!==2
  ||p.isSilenceable!==0||p.isStunnable!==0||p.attributes.abnormalFlags.length||p.attributes.attributeModifiers.length||p.blackboard.length
  ||n.templates.yukari_t.onEventPriority!=='HIGHER_PRIORITY'||Object.keys(events).join()!=='ON_SKILL_FINISH'||actions.length!==4
  ||actions[0]._source!=='BUFF_OWNER'||actions[0]._finishReason!=='WITHDRAW'||!actions[1].$type.includes('+IfNot,')||actions[2]._ownerType!=='BUFF_OWNER'
  ||h._abilityName!=='HealWrapper'||h._sourceType!=='BUFF_OWNER'||h._isDerivedBuff!==false||h._finishDerivedBuffIfParentFinish!==false
  ||h._buff.buffKey!=='yukari_t[heal]'||h._buff.templateKey!=='yukari_t[heal]'||h._buff.lifeTimeType!=='IMMEDIATELY'||h._buff.disableOverride!==true
  ||heal.length!==2||heal[0]._sourceType!=='BUFF_SOURCE'||heal[0]._targetType!=='BUFF_OWNER'||heal[0]._healScaleKey!=='heal_scale'||heal[0]._ignoreHealFree!==false
  ||heal[1]._effectKey!=='yukari_heal'||n.heal._selector.m_PathID!=='-4856562115062717687'||n.heal._ignoreHealFree!==0||n.heal._waitForAttackEvent!==0
  ||n.healSelector._rangeSelectorsList.map(p=>p.m_PathID).join()!=='-3445508239539231991,-2169707945135561975'||n.healSelector._limitTargetNum!==0||n.healSelector._distinctTargets!==0
  ||selector._targetSide!==1||selector._targetMotion!==3||selector._postFilter!==3||selector._ignoreTargetFree!==0||selector._ignoreHealFree!==0
  ||selector._excludeOwner!==1||selector._limitTargetNum!==1||selector._maxTargetKey!=='max_target'||selector._ignoreHitRange!==0
  ||self.m_Script.m_PathID!=='8735719249224227112')throw Error('Changed original Yukari skill-finish healing inputs');
 return{parent:p,heal:h._buff};
}
export class YukariFinishHealing{
 constructor(b,u,{contract}={}){
  if(contract!==YUKARI_TALENT_CONTRACT||u.def.charId!==ID||u.deploySeq!==0)throw Error('Fresh selected Yukari and exact talent contract required');
  Object.assign(this,{b,u,record:selectedYukariInputs(u),native:verifyYukariTalent(),seq:null,account:null,parent:null,started:false,stopped:false,handles:[],serial:0,seen:new Set(),grants:new Set()});
  this.bb=this.record.talentBb.find(bb=>Number.isFinite(bb.max_target)&&Number.isFinite(bb.heal_scale));
 }
 valid(){return !this.stopped&&!this.b.finished&&present(this.u)&&this.seq===this.u.deploySeq;}
 owns(p){return !!p&&!p.finished&&p.buff?.source===this.u&&p.buff.key===p.key&&p.buff.data?.yukariHeal===p&&p.unit.buffs.includes(p.buff);}
 remove(p){if(p?.buff?.source===this.u&&p.buff.key===p.key&&p.buff.data?.yukariHeal===p&&p.unit.buffs.includes(p.buff))this.b.removeBuff(p.unit,p.buff);}
 finish(p){if(p.finished)return;p.finished=true;this.grants.delete(p);if(this.parent===p)this.parent=null;this.remove(p);}
 grant(unit,duration,{permit,onFinish=()=>{}}){
  const p={unit,key:`${unit===this.u&&duration===Infinity?'yukari_t':'yukari_t[heal]'}:${this.u.id}:${this.seq}:${++this.serial}`,life:unit.deploySeq,buff:null,finished:false,admitted:false,claimed:false};let descriptor;
  const admit=(_u,buff)=>this.valid()&&!p.finished&&present(unit)&&unit.deploySeq===p.life&&permit()&&(!buff||buff.key===p.key&&buff.source===this.u&&buff.data?.yukariHeal===p
   &&Object.keys(buff.mods??{}).length===0&&Object.keys(buff.flags??{}).length===0&&buff.status==null&&(buff===descriptor||buff.stacks===1&&buff.duration===duration&&buff.timeLeft===duration))
   &&(!unit.findBuff(p.key)||unit.findBuff(p.key).data?.yukariHeal===p);
  const finish=()=>{if(p.finished)return;p.finished=true;this.grants.delete(p);if(this.parent===p)this.parent=null;if(p.admitted)onFinish();};
  descriptor={key:p.key,duration,source:this.u,refresh:'keep',data:{yukariHeal:p},admit,onExpire:finish,onRemove:finish};p.buff=this.b.addBuff(unit,descriptor);
  if(!admit()||!this.owns(p)){p.finished=true;this.remove(p);return null;}p.admitted=true;this.grants.add(p);return p;
 }
 start(){if(!this.valid()||this.started)return;this.started=true;this.account=this.u.skill;if(!this.bb)return;this.parent=this.grant(this.u,Infinity,{permit:()=>!this.parent});}
 secondary(t){return present(t)&&t!==this.u&&!t.hidden&&t.side==='ally'&&t.kind!=='device'&&!t.s.flags.untargetable&&!t.s.flags.healFree
  &&!t.s.flags.noHeal&&!t.profile?.noHeal&&this.b.allySelectable(t,this.u);}
 choices(){const{b,u}=this;if(b.rangeChanged(u))b._refreshRange(u);
  const others=b.allyUnits.filter(t=>this.secondary(t)&&bodyInKeys(t,u.rangeKeySet)).sort((a,z)=>a.hp/a.s.maxHp-z.hp/z.s.maxHp||z.deploySeq-a.deploySeq||String(a.id).localeCompare(String(z.id))).slice(0,this.bb.max_target);
  return[u,...others].map(unit=>({unit,life:unit.deploySeq}));
 }
 onFinish({unit,skill,activation}){
  if(unit!==this.u||!this.valid()||!this.owns(this.parent)||skill!==this.account||skill!==this.u.skill||!Number.isInteger(activation)||activation<1
   ||activation>skill.activations||skill.active&&activation===skill.activations||this.seen.has(activation))return false;
  this.seen.add(activation);const targets=this.choices();
  for(const{unit:t,life}of targets){if(!this.valid())break;if(!present(t)||t.deploySeq!==life||t!==this.u&&!this.secondary(t))continue;
   const p=this.grant(t,0,{permit:()=>t.deploySeq===life&&(t===this.u||this.secondary(t))});if(!p)continue;
   try{if(!this.owns(p)||!this.valid()||t.deploySeq!==life)continue;p.claimed=true;
    this.b.heal(this.u,t,this.u.s.atk*this.bb.heal_scale,{self:t===this.u,tags:['yukari:talent'],yukariActivation:activation});
   }finally{this.finish(p);}
  }return true;
 }
 install(){if(this.stopped||this.handles.length)throw Error('Yukari talent cannot be reinstalled');const{b,u}=this;this.handles=[
  b.on('deploy',({unit,move})=>{if(unit!==u||move)return;if(this.seq===null){this.seq=u.deploySeq;this.start();}else if(this.seq!==u.deploySeq)this.stop();},{owner:u,priority:100}),
  b.on('skillEnd',c=>this.onFinish(c),{owner:u,priority:100}),b.on('tick',()=>{if(this.seq!==null&&!this.valid())this.stop();},{owner:u}),
  b.on('removed',({unit})=>{if(unit===u)this.stop();},{owner:u}),b.on('death',({unit})=>{if(unit===u)this.stop();},{owner:u}),b.on('battleEnd',()=>this.stop(),{owner:u})];
 }
 stop(){if(this.stopped)return;this.stopped=true;for(const p of [...this.grants])if(!p.claimed)this.finish(p);this.parent=null;this.account=null;this.seen.clear();for(const h of this.handles)this.b.off(h);this.handles=[];}
}
