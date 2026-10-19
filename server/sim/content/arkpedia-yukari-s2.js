// SPDX-License-Identifier: GPL-3.0-or-later
// Held source S2 cast, delayed native helper, persistent grants and ordinary bow.
import selection from '../../../data/arkpedia-yukari-selection.json' with{type:'json'};
import {YUKARI_ID as ID,selectedYukariInputs,yukariNativeInputs,yukariSourceComponent} from './arkpedia-yukari-source.js';
import {YukariOrdinaryAttacks,YUKARI_ORDINARY_CONTRACT} from './arkpedia-yukari-ordinary.js';
import {YukariFinishHealing,YUKARI_TALENT_CONTRACT} from './arkpedia-yukari-talent.js';
import {YukariSkillTwoEffects,YUKARI_S2_EFFECTS_CONTRACT} from './arkpedia-yukari-s2-effects.js';
import {sourceAbilityDelta} from './arkpedia-slow-down.js';import{bodyInKeys}from'../body.js';
export const YUKARI_S2_CONTRACT=Object.freeze({
 scope:'Selected manual/time-SP S2, original facing-specific marker and clip, independently owned half-second helper, priority grants, finish healing and ordinary bow; no public admission.',
 mapping:'The primary ability selects self, so manual casting needs no enemy or unmarked recipient. One charge may replace Born or ordinary windup, preserving positive ordinary cooldown and holding SP through original Skill_2. Its timeMode1 animation is independent of ASPD and affected once by live slowdown. The original Front2.4000000953674316/Back2.299999952316284 marker independently admits the infinite nonsilenceable/nonstunnable ball buff. One world-time0.5 interval claims its helper before callbacks; its unused lifeTime0.800000011920929 does not replace INFINITY or the trigger interval. The already born nonderived helper survives account end/control/hiding, but original source withdrawal/death/replacement or explicit controller removal prevents new output. Current source attack range, operator-only profession masks, friendly target-free/isolation and no-existing-marker filter select up to selected max_target distinct receiver lives once. Named source groups prefer Makoto, then Casters, other operators and Yukari copies. Same-bundle Cello selectors/source descriptions corroborate postFilter17 highest current ATK; local ties use earliest deployment/stable ID. Immediate checker/grants retain their separate resource contract and no backfill is invented. Normal clip finish heals once through the selected talent and reopens ordinary Begin. The friendly buff ability emits no fabricated attack/damage receipt.',
 limitations:'Native event4/half-second helper dispatch, Self/validator/profession aliases, highest-ATK ties, accepted-batch/admission/control/account order and extra-ability concurrency remain explicit local mappings. Named hierarchy and highest-ATK corroboration do not certify compiled enum/method/frame behavior. Rejected/dispelled ball is not retried. Native persona/ball/buff/trail/audio effects, modules, public artwork/battle approval and compiled/frame/pixel parity are not claimed.',frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u.removed&&!u._removing;
const due=(a,z)=>a>=z-1e-6;
const professions=new Set(['PIONEER','WARRIOR','TANK','SNIPER','MEDIC','CASTER','SUPPORT','SPECIAL']);
export function verifyYukariS2(n=yukariNativeInputs(),read=yukariSourceComponent){
 const s=n.s2,a=n.s2Grant,self=read('skills','skchr_yukari_2','-6250387879752487370'),ball=read('skills','skchr_yukari_2','-948490678897791434'),p=ball._buffs[0],
  helper=read('skills','skchr_yukari_2','991671031988104758'),selector=read('skills','skchr_yukari_2','-3827349351850627530'),trigger=n.templates['yukari_s_2[ball]'].eventToActions.ON_BUFF_TRIGGER;
 if(s._allowSpRecoveryWhenAffecting!==0||s._canSilenced!==0||s._canUseInAbnormalState!==0||s._canCastDuringBorn!==1||s._canSwitchDuringBorn!==1||s._checkHasTargetBeforeDoCast!==0||s._useTriggerInManualMode!==0
  ||s._allowNoTarget!==0||s._recoverSpIfNoTarget!==0||s._resetAbilityCooldownWhenCastEnd!==0||s._earlySkillFinishAtAttackFinished!==0||s._stopAffectOnInterrupt!==0||s._extraAbilities.map(p=>p.m_PathID).join()!=='991671031988104758'
  ||a._selector.m_PathID!=='-6250387879752487370'||self.m_Script.m_PathID!=='8735719249224227112'||a._animKey!=='Skill_2'||a._endAnimKey!=='Idle'||a._waitForAttackEvent!==1||a._timeMode!==1||a._maxAnimScale!==1||a._affectedBySlowDown!==1||a._ignorePalsyInterrupt!==0
  ||a._selectTargetSource!==1||a._selectTargetTiming!==0||a._allowNoTarget!==0||a._activeBuffs.length||ball._runActionOnEvent!==4||ball._buffs.length!==1||p.buffKey!=='yukari_s_2[ball]'||p.templateKey!=='yukari_s_2[ball]'
  ||p.lifeTimeType!==2||p.lifeTime!==.800000011920929||p.triggerCnt!==1||p.triggerInterval!==.5||p.waitFirstTriggerInterval!==1||p.isSilenceable!==0||p.isStunnable!==0||p.attributes.attributeModifiers.length||p.attributes.abnormalFlags.length
  ||trigger.length!==3||trigger[0]._ownerType!=='BUFF_OWNER'||trigger[1]._ownerType!=='BUFF_OWNER'||trigger[1]._targetType!=='BUFF_OWNER'||trigger[1]._abilityName!=='Skill_2'||trigger[1]._checkCanUseAblityFlag!==false||trigger[1]._castDirectly!==true||trigger[1]._notInterruptAbilityIfCasting!==false||!trigger[2].$type.includes('+FinishBuff,')
  ||helper._metadata.namedAsAlias!=='Skill_2'||helper._selector.m_PathID!=='-3827349351850627530'||helper._selectTargetTiming!==2||helper._affectedBySlowDown!==0
  ||selector._rangeSelectorsList.map(p=>p.m_PathID).join()!=='-4877054061279433162,-7771582958315885002,-4898207796721603018,-7696040682394866122'
  ||selector._distinctTargets!==1||selector._limitTargetNum!==1||selector._maxNumBlackboardKey!=='max_target'||selector._buffKey!=='yukari_s_2'||selector._withoutThisBuff!==1||selector._filterBuffSource!==0||selector._secondaryFilter!==3)
  throw Error('Changed original Yukari S2 cast/helper inputs');
 const groups=selector._rangeSelectorsList.map(p=>read('skills','skchr_yukari_2',p.m_PathID));
 for(const[g,i]of groups.map((g,i)=>[g,i]))if(g._postFilter!==17||g._targetSide!==1||g._targetMotion!==3||g._ignoreTargetFree!==0||g._ignoreHitRange!==0||g._limitTargetNum!==0||g._needProfessionMask!==([0,1,1,0][i])||g._professionMask!==([0,32,607,0][i]))throw Error('Changed original Yukari S2 priority selectors');
 const validators=[['-4107949892224864714'],[],['-2234261523052614090','-6974829150597927370'],['6608412264661528118']];
 for(const[g,i]of groups.map((g,i)=>[g,i]))if((g._validatorFilterSettings??[]).map(v=>v.validator.m_PathID).join()!==validators[i].join()||(g._validatorFilterSettings??[]).some(v=>v.isMatched!==0||v.ignoreTargetSide!==0)||g._excludeOwner!==0||g._ignoreAllyTargetFree!==0||g._ignoreHealFree!==0)throw Error('Changed original Yukari S2 identity filter ownership');
 for(const[id,target,reverse]of[['-4107949892224864714','char_4217_makoto',1],['-2234261523052614090','char_4217_makoto',0],['-6974829150597927370',ID,0],['6608412264661528118',ID,1]]){
  const v=read('skills','skchr_yukari_2',id);if(v._targetId!==target||v._reverse!==reverse||v._loadFromBlackboard!==0)throw Error('Changed original Yukari S2 identity selectors');
 }
 if(selection.operator!==ID||selection.compiledEnumParity!==false||selection.groups.map(g=>g.hierarchy.at(-1)).join()!=='Makoto,Caster,Other,Yukari'||selection.corroboration.some(g=>g.postFilter!==17))throw Error('Missing original Yukari S2 selection corroboration');
}
export class YukariSkillTwo extends YukariOrdinaryAttacks{
 constructor(b,u,talent,{contract}={}){
  if(contract!==YUKARI_S2_CONTRACT||selectedYukariInputs(u).index!==1)throw Error('Original selected Yukari S2 and exact controller contract required');
  super(b,u,{contract:YUKARI_ORDINARY_CONTRACT,mayBegin:()=>!u.skill.active});verifyYukariS2();Object.assign(this,{talent,effects:new YukariSkillTwoEffects(b,u,{contract:YUKARI_S2_EFFECTS_CONTRACT}),balls:new Set(),ballSerial:0,finishing:false,stopping:false,accountHandles:[]});
 }
 canCast(){return this.valid()&&!this.finishing&&!this.stopping&&this.u.canAct&&!this.u.hidden&&!this.u.skill.active;}
 liveSkill(p){return this.valid()&&this.phase===p&&this.u.skill.active&&this.u.skill.activations===p.activation&&this.u.canAct&&!this.u.hidden&&this.u.actionControlEpoch===p.epoch;}
 friendly(t){return present(t)&&t.side==='ally'&&t.kind==='op'&&professions.has(t.def.profession)&&!t.hidden&&!t.s.flags.untargetable&&this.b.allySelectable(t,this.u);}
 recipients(){if(this.b.rangeChanged(this.u))this.b._refreshRange(this.u);const group=t=>t.def.charId==='char_4217_makoto'?0:t.def.charId===ID?3:t.def.profession==='CASTER'?1:2;
  return this.b.allyUnits.filter(t=>this.friendly(t)&&bodyInKeys(t,this.u.rangeKeySet)&&!t.findBuff('yukari_s_2')).sort((a,z)=>group(a)-group(z)||z.s.atk-a.s.atk||a.deploySeq-z.deploySeq||String(a.id).localeCompare(String(z.id))).slice(0,this.record.bb.max_target);
 }
 startSkill(){if(!this.valid()||!this.u.skill.active)return;this.phase=null;this.ending=null;this.chain=false;this.bornUntil=this.b.time;this.u.mem.regularBornUntil=this.b.time;this.facing=this.u.dir;
  const p={kind:'s2',activation:this.u.skill.activations,epoch:this.u.actionControlEpoch,age:0,lastAt:this.b.time,released:false};this.phase=p;p.visual=this.visual('Skill_2',this.u.s.slowDownRate);
 }
 ownsBall(p){return !p.finished&&p.buff?.key===p.key&&p.buff.source===this.u&&p.buff.data?.yukariBall===p&&this.u.buffs.includes(p.buff);}
 finishBall(p){if(!p||p.finished)return;p.finished=true;this.balls.delete(p);if(p.buff?.key===p.key&&p.buff.source===this.u&&p.buff.data?.yukariBall===p&&this.u.buffs.includes(p.buff))this.b.removeBuff(this.u,p.buff);}
 birthBall(){const p={key:`yukari_s_2[ball]:${this.u.id}:${this.seq}:${++this.ballSerial}`,life:this.seq,buff:null,finished:false,claimed:false};let descriptor;
  const admit=(_u,buff)=>this.valid()&&this.u.deploySeq===p.life&&!p.finished&&(!buff||buff.key===p.key&&buff.source===this.u&&buff.data?.yukariBall===p&&Object.keys(buff.mods??{}).length===0&&Object.keys(buff.flags??{}).length===0&&buff.status==null&&buff.interval===.5&&buff.sourceStatusResistable==null
   &&(buff===descriptor||buff.duration===Infinity&&buff.timeLeft===Infinity&&buff.stacks===1))&&(!this.u.findBuff(p.key)||this.u.findBuff(p.key).data?.yukariBall===p);
  const finish=()=>{p.finished=true;this.balls.delete(p);};descriptor={key:p.key,source:this.u,duration:Infinity,interval:.5,data:{yukariBall:p},refresh:'keep',admit,onRemove:finish,onExpire:finish,onTick:()=>this.triggerBall(p)};
  p.buff=this.b.addBuff(this.u,descriptor);if(!admit()||!this.ownsBall(p)){this.finishBall(p);return null;}this.balls.add(p);return p;
 }
 triggerBall(p){if(p.claimed||!this.ownsBall(p))return;if(!this.valid()||this.u.deploySeq!==p.life){this.finishBall(p);return;}p.claimed=true;
  const targets=this.recipients().map(unit=>({unit,life:unit.deploySeq}));try{for(const{unit:t,life}of targets){if(!this.valid())break;if(t.deploySeq===life&&this.friendly(t))this.effects.grant(t,{permit:()=>this.valid()&&t.deploySeq===life&&this.friendly(t)});}}finally{this.finishBall(p);}
 }
 finishAccount(reason='INTERRUPTED'){if(this.finishing)return;this.finishing=true;try{this.phase=null;this.ending=null;this.chain=false;if(this.u.skill.active)this.u.skill.end(reason);if(this.valid()&&!this.stopping&&!this.u.skill.active)this.idle();}finally{this.finishing=false;}}
 skillEnded(){if(!this.finishing&&!this.stopping)this.finishAccount('INTERRUPTED');}
 tick(){if(!this.valid())return;const p=this.phase;if(p?.kind!=='s2'){super.tick();return;}if(!this.liveSkill(p)){this.finishAccount('INTERRUPTED');return;}
  p.age+=sourceAbilityDelta(this.u,Math.max(0,this.b.time-p.lastAt),true);p.lastAt=this.b.time;if(this.u.mem.regularFormVisual===p.visual)p.visual.speed=this.u.s.slowDownRate;
  const m=this.model();if(!p.released&&due(p.age,m.eventPayloads.Skill_2[0].time)){p.released=true;this.birthBall();}
  if(this.liveSkill(p)&&due(p.age,m.exactDurations.Skill_2))this.finishAccount('NORMAL_EXIT');
 }
 spec(){return{kind:'instant',silenceable:false,completeOnAttack:false,pendingText:'Skill active',trigger:{rule:'NEVER'},flags:{noSp:true},holdSpWhileActive:true,attack:{isSkill:true},canActivate:()=>this.canCast(),onStart:()=>this.startSkill(),onEnd:()=>this.skillEnded()};}
 install(){this.talent.install();this.accountHandles=[this.b.on('deploy',({unit,move})=>{if(unit===this.u&&!move&&this.effects.seq===null)this.effects.bind();},{owner:this.u}),
  this.b.on('palsyTriggered',({unit})=>{if(unit===this.u&&this.phase?.kind==='s2')this.finishAccount('INTERRUPTED');},{owner:this.u})];super.install();}
 stop(){if(this.stopped||this.stopping)return;this.stopping=true;try{if(this.seq===this.u.deploySeq)this.finishAccount('INTERRUPTED');super.stop();for(const p of [...this.balls])this.finishBall(p);this.effects.retire();if(this.b.finished)this.effects.drain();this.talent.stop();for(const h of this.accountHandles)this.b.off(h);this.accountHandles=[];}finally{this.stopping=false;}}
}
export function prepareYukariS2(b,u,{contract}={}){
 if(contract!==YUKARI_S2_CONTRACT||u.def.charId!==ID||u.deploySeq!==0||u.mem.yukari)throw Error('Fresh selected Yukari S2 and exact controller contract required');
 const talent=new YukariFinishHealing(b,u,{contract:YUKARI_TALENT_CONTRACT}),controller=new YukariSkillTwo(b,u,talent,{contract});u.mem.yukari=controller;
 return{record:controller.record,talent,effects:controller.effects,controller,kit:{install:null,talents:[],trait:controller.trait(),skill:controller.spec()}};
}
