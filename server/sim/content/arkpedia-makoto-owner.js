// SPDX-License-Identifier: GPL-3.0-or-later
// Selected owner composition; public admission uses the separate runtime receipt.
import e from '../../../data/arkpedia-native-operators/char_4217_makoto.json' with {type:'json'};
import status from '../../../data/arkpedia-makoto-status-source.json' with {type:'json'};
import clocks from '../../../data/arkpedia-makoto-clocks.json' with {type:'json'};
import {MAKOTO_ID,selectedMakotoInputs}from'./arkpedia-makoto-source.js';
import {regularModelKey}from'../../../shared/arkpedia/facing.js';
import {MakotoOrdinaryAttacks,MAKOTO_ORDINARY_CONTRACT}from'./arkpedia-makoto-ordinary.js';
import {MakotoSkillOneCombat,MAKOTO_S1_COMBAT_CONTRACT}from'./arkpedia-makoto-s1-combat.js';
import {MakotoSkillTwoCombat,MAKOTO_S2_COMBAT_CONTRACT}from'./arkpedia-makoto-s2-combat.js';
import {MakotoSkillThreeAssault,MAKOTO_S3_ASSAULT_CONTRACT}from'./arkpedia-makoto-s3-assault.js';
import {MakotoSkillThreeHealing,MAKOTO_S3_HEALING_CONTRACT}from'./arkpedia-makoto-s3-healing.js';
import {MakotoSkillThreeEvasion,MAKOTO_S3_EVASION_CONTRACT}from'./arkpedia-makoto-s3-evasion.js';
import {MakotoSkillThreePermission,MAKOTO_S3_PERMISSION_CONTRACT}from'./arkpedia-makoto-s3-permission.js';
import {MakotoPersonaEntry,MAKOTO_ENTRY_CONTRACT}from'./arkpedia-makoto-entry.js';
import {MakotoPersonaReturn,MAKOTO_RETURN_CONTRACT}from'./arkpedia-makoto-return.js';
import {MakotoPersonaBody,MAKOTO_BODY_CONTRACT}from'./arkpedia-makoto-body.js';
import {MakotoAllOutCombat,MAKOTO_ALLOUT_CONTRACT}from'./arkpedia-makoto-allout.js';
import {resolveProfile}from'../professions.js';import{absoluteRangeKeys}from'../targeting.js';import{bodyInKeys}from'../body.js';
export const MAKOTO_OWNER_CONTRACT=Object.freeze({
 scope:'Selected S1/S2/S3 real-account, ordinary/Persona/P2 combat, manual/fatal entry, natural-expiry/all-out return and literal source death presentation.',
 mapping:'Original keyed clears preserve durable buffs and literal retained names. Accepted transition flags use the pinned version-limited status receipt; friendly target-free maps to existing isolated/noHeal while enemies retain selection. Rally/rebirth locally repairs the current owned HP to current maximum without deployment, ledger or SP/account reset; literal ratio-heal separately honors HEAL_FREE. The native before-zero instruction creates real UNDEADABLE before the pending shared HP set, rather than cancelling the damage or toggling every fatal form. Mode0 enters the selected Persona; mode3 enters P2 only with owned remaining time above the original threshold. Other modes have no fatal transformation. Source-zero on-enter-normal is an actual nonderived zero-duration buff which broadcasts only on admission and expires on its first ordinary buff tick; its independent group-damage timer is never substituted. Mode-bound Talents admit the twenty-second parent/stat/ASPD buffs after the actual mode switch; SwitchIn zero-block is a separate earlier producer. S1/S3 retain the original2.109999895095825 world escape, while S2 honors its disabled useEscapeTime and ends immediately. Fixed entry/return clocks remain separate. Forced S3 source CastStart uses an owner-authorized numbered receipt without SP/charges or manual activation; manual starts keep their one normal receipt. Death presentation resolves the incoming Die key through its current mode hook and then the original root catalogue. Missing Back clips remain hidden; withdrawals request no death pose. Present death clips keep their exact native length, while absent-art cleanup uses the existing renderer policy. Original A/B dispatch maps locally to alternation. Skill ranks/builds and separately owned born transport/heals persist through their documented boundaries.',
 limitations:'Rally HP/reset, zero-lifetime nonderived dispatch, source clear/phase/parallel/event ordering, escape world-clock dispatch, native abnormal behavior, alias/catalogue resolution order, renderer fade/absent-art cleanup and A/B alternation are explicit local mappings, not compiled/frame/RNG/pixel proof. Transition command refusal cancels unborn owner work; missing required base passives is held rather than inventing their blackboards. Native FX/audio/modules and original public artwork delivery/public registry admission remain separate.',frameParity:false,
});
const nativeName=b=>b.data?.nativeKey??b.key;
const live=u=>u?.alive&&u.deployed&&!u.hidden&&!u.removed&&!u._removing;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function makotoDeathPlans(n=e,c=clocks){
 if(c.receiptSha256!=='7489e0dea8732f27fdbe6bd90b7ab2584f9a30d6547f7de14d1b82581072c817')throw Error('Changed Makoto death source clocks');
 const rows=n.chararts[MAKOTO_ID][0].data._animations,root=rows.find(a=>a.animKey==='Die');
 if(root?.animName!=='Stun'||root.loop!==0||root.speed!==1||root.ignoreMissing!==1)throw Error('Changed original Makoto root death alias');
 const paths=[null,'1623256020376145445','-6711020895938949595','-7104469595420307931','-7234846479611671003','25925036447354405'];
 const expected=['Stun','Doll_Skill_1_Die','Doll_Skill_2_Die','Stun','Doll_Skill_3_P2_Die','Stun'];
 const replacement=[null,expected[1],expected[2],null,expected[4],null];
 return Object.freeze(paths.map((id,mode)=>{
  const node=id?n.characters[MAKOTO_ID].flatMap(r=>r.components).find(p=>p.pathId===id)?.data:null;
  if(id&&!Array.isArray(node?._replaceAnimPairs))throw Error('Missing original Makoto mode death hook');
  const pairs=node?._replaceAnimPairs.filter(p=>p.fromAnimKey==='Die')??[];
  if(pairs.length!==(replacement[mode]?1:0)||pairs.length&&pairs[0].toAnimKey!==replacement[mode])throw Error('Changed Makoto death replacement');
  const key=pairs[0]?.toAnimKey??'Die',alias=rows.find(a=>a.animKey===key);
  if(alias?.animName!==expected[mode]||alias.loop!==0||alias.speed!==1||alias.ignoreMissing!==1)throw Error('Changed original Makoto mode death alias');
  return Object.freeze(Object.fromEntries(['Front','Back'].map(face=>{
   const duration=c.models[face].exactDurations[alias.animName],rounded=n.models[MAKOTO_ID][face].durations[alias.animName];
   if(duration==null){if(rounded!=null)throw Error('Changed missing Makoto death clip');return[face,null];}
   if(duration!==1||rounded!==1)throw Error('Changed Makoto death clip duration');
   return[face,Object.freeze({clip:alias.animName,duration})];
  })));
 }));
}
function findNode(v,fn){if(!v||typeof v!=='object')return null;if(fn(v))return v;for(const a of Object.values(v)){const n=findNode(a,fn);if(n)return n;}return null;}
export function verifyMakotoOwner(n=e,s=status){
 const fail=()=>{throw Error('Changed original Makoto owner actions');};
 const tr=n.templates.makoto_tr.eventToActions.ON_BEFORE_TRY_SET_HP_ZERO;
 const consume=findNode(tr,a=>a.$type?.includes('+ConsumeTrySetHpZeroModifier,')),time=findNode(tr,a=>a.$type?.includes('+CheckBuffRemainingTime,')),undead=findNode(tr,a=>a.buffKey==='makoto_tr_undead');
 if(consume?._blockThisHpSet!==false||consume._dontConsumeWhenUndeadable!==false||time?._checkTime!==.009999999776482582||time._condType!=='GT'
   ||!same(undead?.attributes.abnormalFlags,['UNDEADABLE','SKILL_NOT_ACTIVATABLE'])||s.foundationSha256!=='7489e0dea8732f27fdbe6bd90b7ab2584f9a30d6547f7de14d1b82581072c817')fail();
 const modes=[];findNode(tr,a=>{if(a.$type?.includes('+CheckUnitCurrentMode,'))modes.push(a._checkCurModeIndex);return false;});if(!same(modes,[0,3]))fail();
 const flags=s.definitions;if(!same([flags.INVINCIBLE,flags.UNDEADABLE,flags.HEAL_FREE,flags.FORCE_DISARMED,flags.ALLY_TARGET_FREE],[5,6,7,18,15]))fail();
 const clear=n.templates.makoto_switchbegin.eventToActions.ON_BUFF_START.find(a=>a.$type.includes('+ClearAllBuffs,'));
 if(clear._alsoRemoveDurableBuff!==false||!clear._retainedBuffsWhenClear.includes('makoto_switchbegin'))fail();
 const heal=n.templates.HealViaMaxHpRatio.eventToActions.ON_BUFF_START[0];if(heal._ignoreHealFree!==false||heal._skipModifierEvent!==true)fail();
 for(const [key,rows] of Object.entries(n.skills)){
   const meta=rows.flatMap(r=>r.components).map(p=>p.data).find(d=>Object.hasOwn(d,'_canSilenced'));
   const cast=rows.flatMap(r=>r.components).map(p=>p.data).find(d=>Object.hasOwn(d,'_escapeTime'));
   if(!meta||meta._canSilenced!==0||meta._canCastDuringBorn!==1||meta._useEscapeTime!==(key==='skchr_makoto_2'?0:1)||cast?._escapeTime!==2.109999895095825||cast._preDelay!==0)fail();
 }
 const manualTime=findNode(n.templates.makoto_s3_trigger,a=>a.$type?.includes('+CheckBuffRemainingTime,'));if(manualTime?._checkTime!==.009999999776482582||manualTime._condType!=='GT')fail();
}
export class MakotoPersonaOwner{
 constructor(b,u,{contract}={}){
  if(contract!==MAKOTO_OWNER_CONTRACT||u.def.charId!==MAKOTO_ID||u.deploySeq!==0||u.mem.makotoOwner)throw Error('Fresh selected Makoto and exact complete-owner contract required');
  verifyMakotoOwner();const record=selectedMakotoInputs(u);this.deathPlans=makotoDeathPlans();
  Object.assign(this,{b,u,record,mode:0,seq:null,account:null,stopped:false,transition:null,cast:null,busy:false,base:new Map(),owned:new Set(),handles:[],turn:0,assaultTurn:0,serial:0,expiry:null});
  this.ordinary=new MakotoOrdinaryAttacks(b,u,{contract:MAKOTO_ORDINARY_CONTRACT,mayBegin:()=>this.combatMode(0),pickClip:()=>this.turn++%2?'Attack_B':'Attack_A'});
  this.body=new MakotoPersonaBody(b,u,{contract:MAKOTO_BODY_CONTRACT,mayEnter:i=>this.valid()&&this.transition?.kind==='entry'&&this.transition.ticket===i.ticket&&this.transition.to===i.mode,
   onExpired:info=>this.expired(info)});
  this.entry=new MakotoPersonaEntry(b,u,{contract:MAKOTO_ENTRY_CONTRACT,currentMode:()=>this.mode,applySource:(kind,plan,input)=>this.enterAction(kind,plan,input)});
  this.ret=new MakotoPersonaReturn(b,u,{contract:MAKOTO_RETURN_CONTRACT,currentMode:()=>this.mode,
   mayBegin:i=>this.valid()&&this.transition?.kind==='return'&&this.expiry===this.body.lastExpiry&&this.expiry?.mode===i.from,
   hasEnterNormal:()=>u.buffs.some(a=>nativeName(a)==='makoto_on_enter_normal'),applySource:(kind,plan,input)=>this.returnAction(kind,plan,input)});
  this.allout=new MakotoAllOutCombat(b,u,{contract:MAKOTO_ALLOUT_CONTRACT,mayBegin:ticket=>this.valid()&&this.transition?.kind==='return'&&this.ret.phase?.ticket===ticket&&this.hasBase('makoto_talent_2')});
  if(record.index===0)this.persona=new MakotoSkillOneCombat(b,u,{contract:MAKOTO_S1_COMBAT_CONTRACT,mayBegin:()=>this.combatMode(1)});
  if(record.index===1)this.persona=new MakotoSkillTwoCombat(b,u,{contract:MAKOTO_S2_COMBAT_CONTRACT,inPersona:()=>this.combatMode(2)});
  if(record.index===2){
   this.persona=new MakotoSkillThreeAssault(b,u,{contract:MAKOTO_S3_ASSAULT_CONTRACT,inPersona:()=>this.combatMode(3),pickClip:()=>this.assaultTurn++%2?'Doll_Skill_3_P1_Attack_B':'Doll_Skill_3_P1_Attack_A'});
   this.healing=new MakotoSkillThreeHealing(b,u,{contract:MAKOTO_S3_HEALING_CONTRACT,inPersona:()=>this.combatMode(4)});
   this.evasion=new MakotoSkillThreeEvasion(b,u,{contract:MAKOTO_S3_EVASION_CONTRACT,inPersona:()=>this.combatMode(4)});
   this.permission=new MakotoSkillThreePermission(b,u,{contract:MAKOTO_S3_PERMISSION_CONTRACT,inPersona:()=>this.combatMode(3)});
  }
  this.parts=[this.body,this.entry,this.ret,this.allout,this.ordinary,this.persona,...[this.healing,this.evasion,this.permission].filter(Boolean)];
 }
 valid(){return !this.stopped&&!this.b.finished&&this.seq!==null&&live(this.u)&&this.u.deploySeq===this.seq&&this.u.skill===this.account
  &&this.account?.spec===this.skillSpec&&this.u.mem.makotoOwner===this;}
 hasBase(name){const a=this.base.get(name);return !!a&&this.u.buffs.includes(a)&&a.source===this.u&&a.data?.makotoOwner===this&&nativeName(a)===name;}
 combatMode(mode){return this.valid()&&!this.transition&&this.mode===mode;}
 trait(mode=0){return{...(mode===0?this.ordinary.trait():mode===4||mode===5?{noAttack:true,heal:null}:this.persona.trait()),install:null};}
 spec(){const escape=this.record.index!==1,spec={kind:'instant',silenceable:false,completeOnAttack:false,holdSpWhileActive:escape,attack:escape?{isSkill:true}:null,pendingText:'Changing form',trigger:'NEVER',canActivate:()=>this.canCast(),
  onStart:()=>{if(escape)this.cast={activation:this.account.activations,endAt:this.b.time+2.109999895095825};if(!this.startEntry({manual:true}))this.account.end('source-refused');},
  onEnd:({activation})=>{if(this.cast?.activation===activation)this.cast=null;},formCountdown:()=>this.body.countdown(),
  acceptSourceCastStart:({ticket,reason})=>this.valid()&&reason==='makoto:forced-entry'&&this.transition?.kind==='entry'&&!this.transition.manual
   &&this.transition.ticket===ticket&&this.entry.phase?.plan.fireCastStart===true};
  return this.permission?this.permission.prepareSpec(spec):spec;
 }
 canCast(){return this.valid()&&this.hasBase('makoto_tr')&&this.hasBase('makoto_talent_1')&&!this.account.active&&!this.transition&&!this.body.castBlocked()&&(this.mode===0||this.mode===3&&this.body.countdown()?.remaining>.009999999776482582);}
 owns(a){return !!a&&this.owned.has(a)&&a.source===this.u&&a.data?.makotoOwner===this&&this.u.buffs.includes(a);}
 attach(name,{duration=Infinity,flags={},data={},guard=()=>true}={}){
  if(!this.valid()||!guard())return null;const key=`makoto:owner:${this.u.id}:${this.seq}:${name}`,expected={...flags};
  const admit=(_u,a)=>this.valid()&&guard()&&a.key===key&&a.source===this.u&&a.duration===duration&&a.timeLeft===duration
   &&same(a.flags,expected)&&!Object.keys(a.mods??{}).length&&a.data?.makotoOwner===this&&a.data?.nativeKey===name;
  const a=this.b.addBuff(this.u,{key,source:this.u,duration,timeLeft:duration,flags:{...flags},data:{...data,makotoOwner:this,nativeKey:name},admit});
  if(a)this.owned.add(a);if(!a||!admit(this.u,a)||!this.owns(a)){if(this.owns(a))this.b.removeBuff(this.u,a);this.owned.delete(a);return null;}return a;
 }
 remove(a){if(this.owns(a))this.b.removeBuff(this.u,a);this.owned.delete(a);}
 clearNative(actions){const a=actions.find(a=>a.$type.includes('+ClearAllBuffs,'));if(!a)throw Error('Missing source keyed clear');
  const keep=new Set(a._retainedBuffsWhenClear),life=this.seq,account=this.account;
  for(const buff of this.u.buffs.slice()){
   if(!this.valid()||life!==this.seq||account!==this.u.skill)return false;
   if(!buff.persist&&!keep.has(nativeName(buff)))this.b.removeBuff(this.u,buff);
  }return this.valid();
 }
 rally(){if(!this.valid())return false;this.u.hp=this.u.s.maxHp;return true;}
 ratioHeal(){if(!this.valid())return false;this.b.heal(this.u,this.u,this.u.s.maxHp,{ignoreHealFree:false,skipModifierEvent:true});return this.valid();}
 profile(mode){if(!this.valid())return false;this.mode=mode;this.u.kit.trait=this.trait(mode);this.u.profile=resolveProfile(this.u.def,this.u.kit.trait);
  this.u.rangeGrid=mode===0?this.record.rangeGrid:this.record.skillRangeGrid;this.b.refreshRange(this.u);
  const clip=['Idle','Doll_Skill_1_Idle','Doll_Skill_2_Loop','Doll_Skill_3_P1_Idle','Doll_Skill_3_P2_Loop','Skill_AllOutAttack_Loop'][mode];
  this.u.mem.regularFormVisual={clip,loop:true,replace:true,...(mode>=4?{forceFront:true}:{})};this.u.mem.regularVisualDirection=mode>=4?'DOWN':this.u.dir;return true;
 }
 beginActions(state,plan){
  const native=plan.beginBuffs[0],names=status.transitions.find(p=>same(p.flags,native.attributes.abnormalFlags))?.flagNames;
  if(!names)throw Error('Unreviewed source transition flags');
  const flags={invulnerable:true,disarm:true,noSp:true,undeadable:true,healFree:true,isolated:true,noHeal:true};
  const a=this.attach('makoto_switchbegin',{flags,guard:()=>this.transition===state});if(!a)return false;state.buff=a;state.skillBlocked=names.includes('SKILL_NOT_ACTIVATABLE');
  if(!this.clearNative(e.templates.makoto_switchbegin.eventToActions.ON_BUFF_START)||this.transition!==state||!this.rally())return false;
  this.account.setSpTotal(0);
  if(state.from===0&&this.record.talentBb[0].sluggish>0){
   const range=e.tables.ranges[this.record.talentBb[0].range_id],keys=new Set(absoluteRangeKeys(range.grids.map(g=>[g.row,g.col]),this.u.tileR,this.u.tileC,this.u.dir));
   for(const t of this.b.enemies.slice()){if(!this.valid()||this.transition!==state)return false;if(live(t)&&bodyInKeys(t,keys))this.b.applyStatus(t,'sluggish',{source:this.u,duration:this.record.talentBb[0].sluggish});}
  }return this.valid()&&this.transition===state;
 }
 startEntry({manual=false}={}){
  if(this.busy||!this.valid()||this.transition||!this.hasBase('makoto_tr')||!this.hasBase('makoto_talent_1'))return false;
  const to=this.mode===0?this.record.index+1:this.mode===3?4:null;if(to===null)return false;
  const snap=to===4?this.body.countdown():null;if(to===4&&(!snap||snap.remaining<=.009999999776482582))return false;
  const s={kind:'entry',from:this.mode,to,ticket:Object.freeze({}),manual,saved:null,buff:null};this.transition=s;this.busy=true;
  try{const accepted=this.entry.start({to,...(snap?{remaining:snap.remaining,duration:snap.duration}:{})});
   if(!accepted||!this.valid()||this.transition!==s){if(this.transition===s)this.cancelTransition();return false;}
   if(!manual&&this.entry.phase.plan.fireCastStart)this.account.notifySourceCastStart(s.ticket,'makoto:forced-entry');
   return this.valid()&&this.transition===s;
  }finally{this.busy=false;}
 }
 enterAction(kind,plan,input){const s=this.transition;if(!this.valid()||s?.kind!=='entry'||s.to!==plan.to||s.from!==input.from)return false;
  if(kind==='begin'){
   if(plan.to===4){s.saved=this.body.prepareP2(s.ticket,{beforeBlock:()=>this.beginActions(s,plan)});return !!s.saved&&this.valid()&&this.transition===s;}
   return this.beginActions(s,plan);
  }
  if(kind==='heal')return this.ratioHeal();
  if(kind==='switchIn'){
   if(plan.to!==4)this.body.produceZeroBlock(s.ticket);
   return this.valid()&&this.transition===s;
  }
  if(kind==='commit'){
   if(!this.clearNative(plan.commitActions)||!this.rally())return false;
   if(!this.profile(plan.to))return false;
   if(plan.to===4)this.body.enter({mode:4,...s.saved});else this.body.enter({mode:plan.to,ticket:s.ticket});
   if(!this.valid()||this.transition!==s)return false;this.transition=null;return true;
  }return false;
 }
 expired(info){if(!this.valid()||this.transition||this.body.lastExpiry!==info||this.mode!==info.mode)return;
  this.expiry=info;const s={kind:'return',from:this.mode,ticket:Object.freeze({}),buff:null};this.transition=s;
  if(!this.ret.start({allOut:this.hasBase('makoto_talent_2')})&&this.transition===s)this.cancelTransition();
 }
 returnAction(kind,plan,input){const s=this.transition;if(!this.valid()||s?.kind!=='return'||s.from!==input.from)return false;
  if(kind==='begin')return this.beginActions(s,plan);
  if(kind==='heal')return this.ratioHeal();
  if(kind==='broadcast'){
   const a=this.attach('makoto_on_enter_normal',{duration:plan.broadcastBuff.lifeTime,guard:()=>this.transition===s});
   if(a&&this.valid()&&this.transition===s&&this.hasBase('makoto_talent_2'))this.allout.begin(input.ticket);
   return this.valid()&&this.transition===s;
  }
  if(kind==='loop'||kind==='normal'){
   if(!this.clearNative(plan.normalActions)||!this.rally()||this.transition!==s)return false;
   if(kind==='normal'){this.body.clear();this.transition=null;this.expiry=null;}
   return this.profile(kind==='loop'?5:0);
  }return false;
 }
 cancelTransition(){this.entry.cancel();this.ret.cancel();const s=this.transition;this.transition=null;if(s)this.remove(s.buff);}
 fatalAttempt(ctx){if(ctx.unit!==this.u||!this.valid()||this.transition||!this.hasBase('makoto_tr')||![0,3].includes(this.mode))return;
  if(this.mode===3&&(!this.body.countdown()||this.body.countdown().remaining<=.009999999776482582))return;
  const undead=this.attach('makoto_tr_undead',{flags:{undeadable:true},guard:()=>!this.transition});
  if(undead&&!this.startEntry()){this.remove(undead);}
 }
 deathVisual(reason){const u=this.u;if(this.stopped||this.seq===null||u.deploySeq!==this.seq||u.mem.makotoOwner!==this||u.skill!==this.account||u.skill.spec!==this.skillSpec)return;
  const face=regularModelKey(u).endsWith('/back')?'Back':'Front',plan=this.deathPlans[this.mode]?.[face];
  // A missing original Back track stays absent. Withdrawal has no source Die
  // request; use the existing renderer's hidden cleanup instead of a fake pose.
  u.mem.regularDeathVisual=reason==='killed'&&plan?{clip:plan.clip,die:plan.clip,duration:plan.duration}:{hide:true};
 }
 install(){const{b,u}=this;if(this.stopped||this.handles.length||u.deploySeq!==0||u.skill?.spec!==this.skillSpec)throw Error('Fresh exact Makoto owner/account installation required');
  this.account=u.skill;u.mem.makotoOwner=this;
  this.handles=[b.on('deploy',({unit,move})=>{if(unit!==u||move)return;if(this.seq!==null){if(this.seq!==u.deploySeq)this.stop();return;}this.seq=u.deploySeq;
   for(const name of ['makoto_tr','makoto_talent_1','makoto_talent_2']){const a=this.attach(name);if(a)this.base.set(name,a);}
   if(!this.hasBase('makoto_tr')||!this.hasBase('makoto_talent_1'))this.stop();
  },{owner:u,priority:100}),b.on('hpZeroAttempt',c=>this.fatalAttempt(c),{owner:u,priority:100}),
  b.on('beforeStatus',ctx=>{if(ctx.target===u&&this.valid()&&this.transition&&this.owns(this.transition.buff)&&['stun','freeze','sleep'].includes(ctx.status))ctx.cancel=true;},{owner:u}),
  b.on('tick',()=>{if(this.seq!==null&&(!this.valid()||!this.hasBase('makoto_tr')||!this.hasBase('makoto_talent_1')))this.stop();
   else if(this.valid()&&this.cast&&this.b.time>=this.cast.endAt-1e-8)this.account.end('source-escape');},{owner:u,priority:100}),
  b.on('death',({unit,reason})=>{if(unit===u){this.deathVisual(reason);this.stop();}},{owner:u,priority:100}),
  b.on('removed',({unit})=>{if(unit===u){this.deathVisual('removed');this.stop();}},{owner:u,priority:100}),b.on('battleEnd',()=>this.stop(),{owner:u})];
  for(const p of this.parts)p.install();
 }
 stop(){if(this.stopped)return;this.stopped=true;this.cancelTransition();if(this.cast&&this.account===this.u.skill&&this.account.spec===this.skillSpec)this.account.end('makoto-owner-finish');this.cast=null;
  for(const p of this.parts)p.stop();for(const a of [...this.owned])this.remove(a);for(const h of this.handles)this.b.off(h);this.handles=[];}
}
export function prepareMakotoOwner(b,u,{contract}={}){
 const controller=new MakotoPersonaOwner(b,u,{contract});controller.skillSpec=controller.spec();
 return {controller,record:controller.record,kit:{install:null,talents:[],trait:controller.trait(),skill:controller.skillSpec}};
}
