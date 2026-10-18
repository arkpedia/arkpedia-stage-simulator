// SPDX-License-Identifier: GPL-3.0-or-later
// Selected source controller; public roster, art and browser admission remain separate.
import {COLS} from '../constants.js';
import e from '../../../data/arkpedia-native-operators/char_4224_turdus.json' with {type:'json'};
import clocks from '../../../data/arkpedia-turdus-clocks.json' with {type:'json'};
import {TURDUS_ID as ID,selectedTurdusInputs,turdusNativeInputs} from './arkpedia-turdus-source.js';
import {TurdusChains,TURDUS_CHAIN_CONTRACT,turdusHealable,sortTurdusAllies} from './arkpedia-turdus-chain.js';
import {TurdusResources,TURDUS_RESOURCE_CONTRACT} from './arkpedia-turdus-resources.js';
export const TURDUS_CONTRACT=Object.freeze({
 scope:'Selected original Ukusik ordinary chain healing, timed ASPD/extra-bounce S1 and one-shot self-cost/chain-resource S2; no public admission',
 mapping:'Ordinary attacks retain one input-time injured ally and release one accepted heal receipt at original Attack/Skill_1_Loop .6 markers. Source max animation scale one caps sampled BAT/interval playback. All three heal abilities have affectedBySlowDown zero: later slow_down is not multiplied into their already sampled elapsed clock. Positive cooldown survives controls and mode detachment; born transport remains independent. S1 starts its account at activation, plays its unscaled original Begin, then independently admits ASPD and mode buffs for the remaining account. Accepted mode one supplies one extra chain target and literal Loop/Idle tracks; the original End mix returns to Idle. S2 pays its nonlethal current-HP cost at activation, chooses its current lowest-ratio legal ally at the .6 marker (full HP allowed), releases its independent chain/resource payload and holds SP through the original 1.5-second cast. No-target source ability attempts do not fabricate a receiver. Original Start is a full one-second birth window, replaceable by source-permitted skills.',
 limits:'The chain/resource contracts retain their own boundaries. Selector aliases (ordinary filter 3, S2 filter 78), capture and empty-receipt bookkeeping, S1 account versus buff/Begin timing, S2 self-cost event 2, FSM/mode interruption, callback order and playback sampling are explicit local mappings. Original compiled methods, modules, native effects/audio/shaders, physical devices and game-frame/pixel parity remain unverified; public original-art/data/browser/full-regression acceptance is separate.',frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u._removing,due=(a,b)=>a+1e-7>=b;
export function verifyTurdusController(){const n=turdusNativeInputs();
 for(const [a,clip,key,timing]of[[n.ordinary,'Attack','projectile_chr_turdus',0],[n.s1Attack,'Skill_1_Loop','projectile_chr_turdus',0],[n.s2Heal,'Skill_2','projectile_chr_turdus_s2',1]])
  if(a._waitForAttackEvent!==1||a._animKey!==clip||a._projectileKey!==key||a._selectTargetTiming!==timing||a._maxAnimScale!==1||a._affectedBySlowDown!==0||a._timeMode!==0||a._useCachedAtkOnly!==0||a._ignoreHealFree!==0)throw Error('Changed original Ukusik healing clocks');
 if(n.s1._playSkillBeginAnim!==1||n.s1._beginAnim!=='Skill_1_Begin'||n.s1._attackBlackboardModeIndex!==1||n.s2._playSkillBeginAnim!==0||n.s2Heal._allowNoTarget!==1||n.s1._canCastDuringBorn!==1||n.s2._canCastDuringBorn!==1
  ||n.s1._allowSpRecoveryWhenAffecting!==0||n.s2._allowSpRecoveryWhenAffecting!==0||n.s1Buffs._buffs[0].attributes.attributeModifiers[0].attributeType!==7||n.s1Buffs._buffs[1].templateKey!=='switch_mode_restart_fsm'||n.s1Buffs._buffs[1].blackboard[0].value!==1)
  throw Error('Changed original Ukusik source skill/mode binding');
 for(const selector of[n.ordinarySelector,n.s1Selector,n.s2Selector])if(selector._limitTargetNum!==1||selector._maxNum!==1||selector._excludeOwner!==0||selector._ignoreHealFree!==0)throw Error('Changed original Ukusik one-recipient acquisition');
 return n;
}
export class TurdusController{
 constructor(b,u,record,resources,chain){Object.assign(this,{b,u,record,resources,chain,native:turdusNativeInputs(),seq:null,stopped:false,phase:null,accepting:false,facing:u.dir,visualSeq:0,handles:[],aspd:null,modeBuff:null,lastMode:0,finishing:false});}
 valid(){return !this.stopped&&!this.b.finished&&present(this.u)&&this.u.deploySeq===this.seq;}
 get mode(){return this.modeBuff&&this.u.findBuff(this.modeBuff.key)===this.modeBuff?1:0;}
 model(){const face=this.facing==='UP'?'Back':'Front';return{...e.models[ID][face],...clocks.models[face]};}
 visual(clip,speed=1,loop=false){if(this.model().exactDurations[clip]==null)throw Error('Missing original Ukusik clip: '+clip);this.u.mem.regularVisualDirection=this.facing;this.u.mem.regularFormVisual={clip,speed,loop,...(!loop?{playId:`turdus:${this.seq}:${++this.visualSeq}`}:{})};this.u.mem.regularDeathVisual=this.facing==='UP'?{hide:true,duration:1}:{clip:'Die',die:'Die',duration:1};}
 idle(withMix=false){const from=this.u.mem.regularFormVisual?.clip;this.facing=this.u.dir;const to=this.mode?'Skill_1_Idle':'Idle';
  const mix=withMix&&this.native.mixes.find(m=>m.sourceAnimName===from&&m.targetAnimName===to);
  if(mix){this.phase={kind:'end',until:this.b.time+this.model().exactDurations[mix.mixAnimName]};this.visual(mix.mixAnimName);}else this.visual(to,1,true);
 }
 face(t){const x=t.x-this.u.x,y=t.y-this.u.y;if(Math.hypot(x,y)>1e-8)this.facing=Math.abs(y)>Math.abs(x)?y>0?'UP':'DOWN':x<0?'LEFT':'RIGHT';}
 targets(allowFull=false){if(this.b.rangeChanged(this.u))this.b._refreshRange(this.u);const keys=new Set(this.u.rangeKeys);return sortTurdusAllies(this.b.allyUnits.filter(t=>turdusHealable(this.b,this.u,t)&&keys.has(t.tileR*COLS+t.tileC)&&(allowFull||t.hp<t.s.maxHp-1e-6))).slice(0,1);}
 canCast(){return this.valid()&&!this.u.hidden&&this.u.canAct&&!this.u.s.flags.disarm&&!this.u.skill.active&&!['begin','end','s2'].includes(this.phase?.kind);}
 start(){this.phase=null;this.facing=this.u.dir;
  if(this.record.index===0){this.phase={kind:'begin',until:this.b.time+this.model().exactDurations.Skill_1_Begin};this.visual('Skill_1_Begin');}
  else{this.resources.selfCost();if(!this.valid())return;const speed=Math.min(1,this.u.base.bat/this.u.s.interval);this.phase={kind:'s2',age:0,lastAt:this.b.time,speed,epoch:this.u.attackControlEpoch,released:false,accepted:false,releaseAge:this.model().eventPayloads.Skill_2[0].time,untilAge:this.model().exactDurations.Skill_2};this.visual('Skill_2',speed);}
 }
 grantS1(){if(!this.valid()||!this.u.skill.active)return;const{b,u}=this,duration=u.skill.timeLeft;
  this.aspd=b.addBuff(u,{key:`turdus:s1:aspd:${u.id}`,source:u,duration,mods:{aspd:this.record.bb.attack_speed}});
  if(!this.valid()){this.clearS1();return;}
  this.modeBuff=b.addBuff(u,{key:`turdus:s1:mode:${u.id}`,source:u,duration});if(!this.valid())this.clearS1();this.lastMode=this.mode;
 }
 clearS1(){for(const buff of[this.aspd,this.modeBuff])if(buff&&this.u.findBuff(buff.key)===buff)this.b.removeBuff(this.u,buff);this.aspd=null;this.modeBuff=null;this.lastMode=0;}
 end(){const was=this.record.index===0;this.clearS1();if(this.finishing||!this.valid())return;this.phase=null;this.idle(was);}
 finishS2(reason){this.finishing=true;try{if(this.u.skill.active)this.u.skill.end(reason);}finally{this.finishing=false;}this.phase=null;if(this.valid())this.idle();}
 begin(t){this.face(t);const mode=this.mode,clip=mode?'Skill_1_Loop':'Attack',speed=Math.min(1,this.u.base.bat/this.u.s.interval),releaseAge=this.model().eventPayloads[clip][0].time,period=Math.max(this.u.s.interval,releaseAge/speed);
  this.phase={kind:'attack',mode,target:t,life:t.deploySeq,epoch:this.u.attackControlEpoch,age:0,lastAt:this.b.time,speed,releaseAge,untilAge:period*speed,released:false,accepted:false};this.u.atkCd=period;this.visual(clip,speed);
 }
 admit(ts){const p=this.phase;if(!this.accepting||!this.valid()||this.u.hidden||!this.u.canAct||this.u.s.flags.disarm||!p||p.accepted||p.epoch!==this.u.attackControlEpoch||!due(p.age,p.releaseAge))return false;
  if(p.kind==='attack'&&p.mode!==this.mode)return false;return p.target?ts.length===1&&ts[0]===p.target&&ts[0].deploySeq===p.life&&turdusHealable(this.b,this.u,ts[0]):p.kind==='s2'&&ts.length===0;
 }
 release(ts,info){if(!this.admit(ts))return false;const p=this.phase,s2=p.kind==='s2';p.accepted=true;if(!ts.length)return s2;
  return this.chain.launch(ts[0],{s2,extra:!s2&&p.mode===1?this.record.bb['attack@chain.extra_value']:0,attackId:info.attackId});
 }
 tick(){if(!this.valid())return;const{b,u}=this;let p=this.phase;
  if(p?.kind==='begin'){if(!u.skill.active){this.phase=null;this.idle();return;}if(!due(b.time,p.until))return;this.grantS1();if(!this.valid())return;this.phase=p=null;this.idle();}
  if(this.lastMode!==this.mode){this.lastMode=this.mode;if(p?.kind==='attack'){this.phase=p=null;this.idle(true);p=this.phase;}}
  if(u.hidden||!u.canAct||u.s.flags.disarm||p?.epoch!=null&&p.epoch!==u.attackControlEpoch){this.phase=null;if(p?.kind==='s2')this.finishS2('interrupted');else this.idle();return;}
  if(p?.kind==='born'||p?.kind==='end'){if(!due(b.time,p.until))return;this.phase=p=null;this.idle();}
  if(p?.kind==='s2'||p?.kind==='attack'){
   if(p.kind==='s2'&&!u.skill.active){this.phase=null;this.idle();return;}p.age+=Math.max(0,b.time-p.lastAt)*p.speed;p.lastAt=b.time;
   if(!p.released&&due(p.age,p.releaseAge)){p.released=true;if(p.kind==='s2'){p.target=this.targets(true)[0];p.life=p.target?.deploySeq;}
    this.accepting=true;try{b.forceAttack(u,p.target?[p.target]:[],{allowEmpty:p.kind==='s2'});}finally{this.accepting=false;}}
   if(!this.valid()||this.phase!==p||!due(p.age,p.untilAge))return;
   if(p.kind==='s2'){this.finishS2('completed');return;}this.phase=p=null;
  }
  if(u.atkCd>1e-9)return;const t=this.targets()[0];if(t)this.begin(t);else this.idle();
 }
 spec(){return this.record.index===0?{kind:'duration',duration:this.record.source.duration,silenceable:false,trigger:{rule:'NEVER'},flags:{noSp:true},attack:{},canActivate:()=>this.canCast(),onStart:()=>this.start(),onEnd:()=>this.end()}
  :{kind:'instant',silenceable:false,trigger:{rule:'NEVER'},flags:{noSp:true},attack:{},completeOnAttack:false,pendingText:'Skill casting',canActivate:()=>this.canCast(),onStart:()=>this.start(),onEnd:()=>this.end()};}
 install(){if(this.handles.length||this.stopped)throw Error('Ukusik cannot be reinstalled');const{b,u}=this;this.handles=[b.on('deploy',({unit,move})=>{if(unit!==u||move)return;this.seq=u.deploySeq;this.chain.installMarkers();this.resources.install();if(!this.valid())return;this.facing=u.dir;this.phase={kind:'born',until:b.time+this.model().exactDurations.Start};u.mem.regularBornUntil=this.phase.until;this.visual('Start');},{owner:u}),
  b.on('tick',()=>{if(this.seq!==null&&!this.valid())this.stop();else this.tick();},{owner:u}),b.on('removed',({unit})=>{if(unit===u)this.stop();},{owner:u}),b.on('death',({unit})=>{if(unit===u)this.stop();},{owner:u}),b.on('battleEnd',()=>this.stop(),{owner:u})];}
 stop(){if(this.stopped)return;this.stopped=true;this.phase=null;this.accepting=false;this.clearS1();this.chain.removeMarkers();this.resources.stop();if(this.b.finished){this.chain.drain();this.resources.drain();}for(const h of this.handles)this.b.off(h);this.handles=[];delete this.u.mem.regularFormVisual;delete this.u.mem.regularVisualDirection;}
}
export function prepareTurdus(b,u,{contract}={}){
 if(contract!==TURDUS_CONTRACT||u.def.charId!==ID||u.deploySeq!==0||u.mem.turdus)throw Error('Fresh original selected Ukusik and exact contract required');verifyTurdusController();const record=selectedTurdusInputs(u),resources=new TurdusResources(b,u,{contract:TURDUS_RESOURCE_CONTRACT}),chain=new TurdusChains(b,u,record,{contract:TURDUS_CHAIN_CONTRACT,onRecipient:(t,ctx)=>resources.attach(t,ctx)}),controller=new TurdusController(b,u,record,resources,chain);u.mem.turdus=controller;
 return{record,resources,chain,controller,kit:{install:null,talents:[],skill:controller.spec(),trait:{noAttack:true,attackDrivenSkill:true,attack:'ranged',dmgType:'heal',heal:{mode:'single'},projectile:'none',maxTargets:1,maxTargetsByBlock:false,hitAllBlocked:false,allInRange:false,hits:1,hitsFn:null,chain:null,splashRadius:0,windup:0,requiresAcceptedLaunch:true,
  acceptAreaAttack:(_b,_u,_p,ts)=>controller.admit(ts),launchAreaAttack:(_b,_u,_p,ts,info)=>controller.release(ts,info)}}};
}
