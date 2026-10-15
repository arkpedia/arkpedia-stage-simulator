// SPDX-License-Identifier: GPL-3.0-or-later
// Selected original Timeslot controller. Public admission is a separate review.
import evidence from '../../../data/arkpedia-native-operators/char_4236_tmslot.json' with {type:'json'};
import clocks from '../../../data/arkpedia-tmslot-clocks.json' with {type:'json'};
import overdrive from '../../../data/arkpedia-tmslot-overdrive-source.json' with {type:'json'};
import {TMSLOT_ID as ID,selectedTimeslotBuild,timeslotNativeInputs} from './arkpedia-tmslot-source.js';
import {normalizeChess,normSpType} from '../simdata.js';
import {acquireTargets,effectiveProfile} from '../ai.js';
import {canTargetEnemy,sortEnemyTargets} from '../targeting.js';
import {bodyInKeys} from '../body.js';
export const TMSLOT_CONTRACT=Object.freeze({
 scope:'Selected Timeslot owner attacks, ordinary ramping drone, timed common S1 and two persistent S2 drones with source-marked range-forced overload',
 mapping:'One owner input captured at attack start; capped original owner marker and independent ordinary cooldown. Owner/ordinary-drone flights use speed fifteen, captured drone ramp coefficient and live ATK while the original source deployment is present, falling back to birth ATK after source invalidity. Each persistent S2 slot owns a target life, independent ramp and uncapped live attack-rate clock; its first pulse is at .6 original ability seconds, then one selected BAT apart. Initial S2 slots launch at the accepted owner strike. Empty slots may reacquire in overload at the current owner interval while the owner can act; existing locks continue through control and beyond range. Accepted drone HP-damage output alone rolls the source Slow talent. One owner attack receipt; persistent pulses have separate damage IDs without ordinary attack receipts. The forty-second selected duration is the full two-bar window; natural overload begins at its half. Mark checks run on world time every .1s; a live marked recipient outside overlapping attack range skips remaining first-phase time, retaining at most the twenty-second overload half. Only original declared overload mix edges are played.',
 limits:'Compiled duration-to-bar accounting, mark/alias priority, emission-time ramp progression, live/cached damage fallback, independent overload reacquisition, projectile/ability/target-FSM ordering, mount geometry and input-time owner clock capture are explicit local interpretations. Modules, native particles/shaders/audio and original game-frame/pixel parity are unverified. This controller does not register Timeslot publicly.',
 frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u._removing;
const live=u=>present(u)&&!u.hidden;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const air=Object.freeze({canHitFly:true});
const due=(b,t)=>b.time+1e-7>=t;
const slot=()=>({target:null,life:null,rampTarget:null,rampLife:null,scale:0,age:0,next:.6000000238418579,mark:null,pulses:0});
export class TimeslotController{
 constructor(b,u,record){this.b=b;this.u=u;this.record=record;this.seq=null;this.stopped=false;this.handles=[];
  this.mode=0;this.phase=null;this.startedAt=null;this.overloadedAt=null;this.facing=u.dir;this.lastClip=null;this.visualSeq=0;this.accepting=false;
  this.slots=[slot(),slot()];this.markKey=`tmslot:mark:${u.id}`;this.marks=new Map();this.flights=new Set();this.acquireAge=0;this.markAge=0;
  this.talent=record.talentBb[0]??null;this.talentKey=`tmslot:talent:${u.id}`;this.skillKey=`tmslot:skill:${u.id}`;this.modeKey=`tmslot:mode:${u.id}`;this.talentBuff=null;this.modeBuff=null;this.statBuff=null;this.lastAt=null;
 }
 valid(){return !this.stopped&&!this.b.finished&&live(this.u)&&this.seq===this.u.deploySeq;}
 model(){const face=this.facing==='UP'?'Back':'Front';return {...evidence.models[ID][face],...clocks.models[face]};}
 rate(){return this.u.base.bat/this.u.s.interval;}
 visual(clip,speed=1,loop=false){if(this.model().exactDurations[clip]==null)throw Error('Missing original Timeslot animation');this.lastClip=clip;
  this.u.mem.regularVisualDirection=this.facing;this.u.mem.regularFormVisual={clip,speed,loop,...(!loop?{playId:`tmslot:${this.seq}:${++this.visualSeq}`}:{})};}
 hasOverload(){return this.mode===3&&this.statBuff!=null&&this.u.findBuff(this.skillKey)===this.statBuff;}
 idle(){this.visual(this.hasOverload()?'Skill_2_Overload_Loop':'Idle',1,true);}
 face(t){const x=t.x-this.u.x,y=t.y-this.u.y;if(Math.hypot(x,y)>1e-8)this.facing=Math.abs(y)>Math.abs(x)?y>0?'UP':'DOWN':x<0?'LEFT':'RIGHT';}
 refresh(){if(this.b.rangeChanged(this.u))this.b._refreshRange(this.u);}
 choices(){this.refresh();const rows=this.b.enemiesInKeys(this.u.rangeKeys,this.u,air);sortEnemyTargets(this.b,this.u,rows);return rows;}
 ramp(s,t){const bb=this.record.traitBb;if(s.rampTarget!==t||s.rampLife!==t.deploySeq){s.rampTarget=t;s.rampLife=t.deploySeq;s.scale=bb.init_atk_scale;}
  else s.scale=Math.min(bb.max_atk_scale,s.scale+bb.delta_atk_scale);return s.scale;}
 resetSlots(){for(const t of [...this.marks.keys()])this.clearMark(t);this.slots=[slot(),slot()];this.acquireAge=0;this.markAge=0;}
 clearMark(t){const m=this.marks.get(t);if(m){this.marks.delete(t);this.b.removeBuff(t,m.buff);}}
 mark(t){const old=this.marks.get(t);if(old?.life===t.deploySeq&&t.findBuff(this.markKey)===old.buff)return old.buff;
  this.clearMark(t);const buff=this.b.addBuff(t,{key:this.markKey,source:this.u});
  if(!this.valid()||this.mode<2||!present(t)){if(buff)this.b.removeBuff(t,buff);return null;}
  if(buff)this.marks.set(t,{life:t.deploySeq,buff});return buff;
 }
 releaseSlots(){if(!this.valid()||this.mode<2)return;
  for(const s of this.slots){if(s.target)continue;const t=this.choices()[0];if(!t)continue;
   s.target=t;s.life=t.deploySeq;s.age=0;s.next=.6000000238418579;s.mark=this.mark(t);
   if(!this.valid())return;
  }
 }
 flight(t,info,alias,scale=1){if(!this.valid()||!live(t))return;const u=this.u,b=this.b,birthAtk=u.s.atk*u.s.atkScaleMul,sourceLife=u.deploySeq;
  const p=b.addProjectile({from:u,target:t,source:u,speed:15,maxAge:10,visual:alias==='Funnel'?'drone':'bolt',
   data:{arkpediaTrackedVisual:true,tmslotOwner:u.id,tmslotAlias:alias},onHit:({target})=>{
    this.flights.delete(p);if(b.finished||!target||!canTargetEnemy(u,target,air))return;
    const atk=live(u)&&u.deploySeq===sourceLife?u.s.atk*u.s.atkScaleMul:birthAtk;
    b.dealDamage(u,target,{amount:atk*scale,type:'arts',isAttack:true,isSkill:info.isSkill,attackId:info.attackId,applyWay:'ranged',tags:['tmslot:'+alias]});
   }});this.flights.add(p);
 }
 admit(t){const p=this.phase;return this.accepting&&this.valid()&&!this.hasOverload()&&this.u.canAct&&!this.u.s.flags.disarm&&p?.kind==='attack'&&!p.accepted
  &&p.mode===this.mode&&p.epoch===this.u.attackControlEpoch&&p.target===t&&p.life===t.deploySeq&&canTargetEnemy(this.u,t,air)&&due(this.b,p.releaseAt);}
 release(t,info){if(!this.admit(t))return false;this.phase.accepted=true;
  this.flight(t,info,'Owner');if(!this.valid())return true;
  if(this.mode<2)this.flight(t,info,'Funnel',this.ramp(this.slots[0],t));else this.releaseSlots();return true;
 }
 canCast(){return this.valid()&&this.u.canAct&&!this.u.skill.active&&!['transition','end'].includes(this.phase?.kind);}
 start(){if(!this.valid())return;const{b,u,record:r}=this;this.mode=r.index===0?1:2;this.startedAt=b.time;this.overloadedAt=null;
  if(this.phase?.kind!=='born')this.phase=null;
  if(r.index===0){const buff=b.addBuff(u,{key:this.skillKey,source:u,mods:{atkPct:r.bb.atk}});
   if(!this.valid()){if(buff)b.removeBuff(u,buff);return;}this.statBuff=buff;
  }else{this.resetSlots();const buff=b.addBuff(u,{key:this.modeKey,source:u,onRemove:({buff})=>{if(this.modeBuff===buff)this.detachMode();}});
   if(!this.valid()||this.mode!==2){if(buff)b.removeBuff(u,buff);return;}this.modeBuff=buff;if(!buff)this.detachMode();
  }
  if(this.valid()&&this.phase?.kind!=='born')this.idle();
 }
 enterOverload(forced=false){if(!this.valid()||this.mode!==2||!this.u.skill.active)return false;
  const{b,u,record:r}=this,last=this.lastClip;this.mode=3;this.overloadedAt=b.time;this.phase=null;
  if(forced)u.skill.timeLeft=Math.min(u.skill.timeLeft,r.source.duration/2);
  const buff=b.addBuff(u,{key:this.skillKey,source:u,mods:{atkPct:r.bb.atk,aspd:r.bb.attack_speed}});
  if(!this.valid()||this.mode!==3){if(buff)b.removeBuff(u,buff);return false;}this.statBuff=buff;
  if(!this.hasOverload()){this.idle();return true;}
  if(['Skill_2','Idle'].includes(last)){const clip='Skill_2_Overload_Begin';this.phase={kind:'transition',until:b.time+this.model().exactDurations[clip]};this.visual(clip);}
  else this.idle();return true;
 }
 detachMode(){this.mode=0;this.phase=null;this.modeBuff=null;this.resetSlots();this.b.removeBuff(this.u,this.skillKey);this.statBuff=null;}
 end(){const last=this.lastClip,wasOverloaded=this.hasOverload();this.b.removeBuff(this.u,this.modeKey);this.detachMode();
  if(!this.valid())return;this.facing=this.u.dir;
  if(wasOverloaded&&last==='Skill_2_Overload_Loop'){const clip='Skill_2_Overload_End';this.phase={kind:'end',until:this.b.time+this.model().exactDurations[clip]};this.visual(clip);}
  else this.idle();
 }
 slow(c){if(!this.valid()||!this.talentBuff||this.u.findBuff(this.talentKey)!==this.talentBuff||c.source!==this.u||!live(c.target)
   ||!c.dmg.tags?.some(t=>['tmslot:Funnel','tmslot:S2Funnel_1','tmslot:S2Funnel_2'].includes(t)))return;
  if(this.b.rng()<this.talent.prob&&this.valid()&&live(c.target)&&this.u.findBuff(this.talentKey)===this.talentBuff)
   this.b.applyStatus(c.target,'sluggish',{duration:this.talent.sluggish,source:this.u});
 }
 pulse(s,index){const t=s.target;if(!this.valid()||this.mode<2||!present(t)||t.deploySeq!==s.life||!canTargetEnemy(this.u,t,air))return;
  const scale=this.ramp(s,t);s.pulses++;
  this.b._ev(['atk',this.u.id,t.id,'drone']);this.b.dealDamage(this.u,t,{amount:this.u.s.atk*this.u.s.atkScaleMul*scale,type:'arts',
   isAttack:true,isSkill:true,applyWay:'none',attackId:++this.b._attackSeq,tags:[`tmslot:S2Funnel_${index+1}`]});
 }
 drones(dt){if(!this.valid()||this.mode<2)return;const rate=this.rate();
  for(const[index,s]of this.slots.entries()){
   if(s.target&&(!present(s.target)||s.target.deploySeq!==s.life)){
    const old=s.target;s.target=null;s.life=null;s.scale=0;s.rampTarget=null;s.rampLife=null;
    if(!this.slots.some(other=>other!==s&&other.target===old))this.clearMark(old);
   }
   if(!s.target)continue;s.age+=dt*rate;
   // Suppressed recipients consume their clocks without replaying missed hits.
   while(s.age+1e-7>=s.next){s.next+=this.record.stats.baseAttackTime;this.pulse(s,index);if(!this.valid()||this.mode<2)return;}
  }
  if(this.mode===3){this.acquireAge+=dt*rate;if(this.acquireAge+1e-7>=this.record.stats.baseAttackTime){this.acquireAge=Math.max(0,this.acquireAge-this.record.stats.baseAttackTime);
   if(this.u.canAct&&!this.u.s.flags.disarm)this.releaseSlots();}}

 }
 skillTick(dt){if(!this.valid()||this.mode!==2)return;
  if(due(this.b,this.startedAt+this.record.source.duration/2)){this.enterOverload();return;}
  this.markAge+=dt;if(this.markAge+1e-7>=.10000000149011612){this.markAge=Math.max(0,this.markAge-.10000000149011612);this.refresh();const keys=new Set(this.u.rangeKeys);
   for(const[t,m]of this.marks)if(present(t)&&t.deploySeq===m.life&&t.findBuff(this.markKey)===m.buff&&!bodyInKeys(t,keys)){this.enterOverload(true);break;}}
 }
 tick(){if(!this.valid())return;const{b,u}=this,dt=Math.max(0,b.time-(this.lastAt??b.time));this.lastAt=b.time;
  for(const p of this.flights)if(!b.projectiles.list.includes(p)&&!b.projectiles.arriving.includes(p))this.flights.delete(p);
  this.drones(dt);if(!this.valid())return;
  let p=this.phase;if(p&&['born','transition','end'].includes(p.kind)){if(!due(b,p.until))return;this.phase=p=null;this.idle();}
  if(!u.canAct||u.s.flags.disarm||this.hasOverload()){if(p?.kind==='attack')this.phase=null;this.idle();return;}
  if(p?.kind==='attack'){
   if(p.epoch!==u.attackControlEpoch||p.mode!==this.mode){this.phase=p=null;this.idle();}
   else{
    if(!p.released&&due(b,p.releaseAt)){p.released=true;if(p.life===p.target.deploySeq&&canTargetEnemy(u,p.target,air)){
     this.accepting=true;try{b.forceAttack(u,[p.target]);}finally{this.accepting=false;}}
    }
    if(!this.valid()||this.phase!==p||!due(b,p.until))return;this.phase=p=null;
   }
  }
  if(u.atkCd>1e-9)return;this.refresh();const t=acquireTargets(b,u,{...effectiveProfile(u),canHitFly:true,maxTargets:1,allInRange:false}).slice(0,1)[0];
  if(!t){this.idle();return;}this.face(t);const clip=this.mode>=2?'Skill_2':'Attack',m=this.model(),speed=Math.min(1,this.rate());
  const releaseAt=b.time+m.eventPayloads[clip][0].time/speed,period=Math.max(u.s.interval,releaseAt-b.time);
  this.phase={kind:'attack',startedAt:b.time,mode:this.mode,target:t,life:t.deploySeq,epoch:u.attackControlEpoch,releaseAt,until:b.time+period,released:false,accepted:false};u.atkCd=period;this.visual(clip,speed);
 }
 install(){if(this.handles.length||this.stopped)throw Error('Timeslot cannot be reinstalled');const{b,u}=this;
  this.handles.push(b.on('deploy',({unit,move})=>{if(unit!==u||move)return;this.seq=u.deploySeq;this.lastAt=b.time;this.facing=u.dir;
   if(this.talent)this.talentBuff=b.addBuff(u,{key:this.talentKey,source:u,mods:{atkPct:this.talent.atk}});
   if(!this.valid())return;const until=b.time+this.model().exactDurations.Start;u.mem.regularBornUntil=until;this.phase={kind:'born',until};this.visual('Start');},{owner:u}),
   b.on('damaged',c=>this.slow(c),{owner:u}),b.on('tick',()=>{if(this.seq!==null&&!this.valid())this.stop();else this.tick();},{owner:u}),
   b.on('death',({unit})=>{if(unit===u)this.stop();},{owner:u}),b.on('removed',({unit})=>{if(unit===u)this.stop();},{owner:u}),b.on('battleEnd',()=>this.stop(true),{owner:u}));
 }
 stop(battleEnd=false){if(this.stopped)return;this.stopped=true;this.phase=null;this.accepting=false;this.mode=0;this.resetSlots();
  for(const h of this.handles)this.b.off(h);this.handles=[];for(const key of[this.modeKey,this.skillKey,this.talentKey])this.b.removeBuff(this.u,key);this.modeBuff=this.statBuff=this.talentBuff=null;
  if(battleEnd)this.b.projectiles.remove(p=>this.flights.has(p));this.flights.clear();delete this.u.mem.regularFormVisual;delete this.u.mem.regularVisualDirection;
 }
 spec(){return{kind:'duration',duration:this.record.source.duration,silenceable:false,trigger:{rule:'NEVER'},manualCancel:this.record.index===1,
  ...(this.record.index===1?{overloadState:()=>this.mode===3}:{}),attack:{},canActivate:()=>this.canCast(),onStart:()=>this.start(),onTick:({dt})=>this.skillTick(dt),onEnd:()=>this.end()};}
}
export function prepareTimeslot(b,u,{contract}={}){
 if(contract!==TMSLOT_CONTRACT||u.def.charId!==ID||u.deploySeq!==0||u.mem.tmslot)throw Error('Fresh selected Timeslot and explicit contract required');
 const r=selectedTimeslotBuild({...u.def.raw.arkpedia,skillId:u.def.skill?.id}),s=u.def.skill;
 if(u.def.raw.arkpedia.skillId!=null&&u.def.raw.arkpedia.skillId!==s.id||!same(u.def.stats,normalizeChess({stats:r.stats}).stats)
  ||!same(u.rangeGrid,r.rangeGrid)||!same(u.def.tags,r.tags)||!same(u.def.talents.map(t=>t.bb),r.talentBb)||!same(u.def.traitBb,r.traitBb)
  ||!same(s.bb,r.bb)||s.skillType!==r.source.skillType||s.durationType!==r.source.durationType||s.spType!==normSpType(r.source.spData.spType)
  ||s.spCost!==r.source.spData.spCost||s.initSp!==r.source.spData.initSp||s.duration!==r.source.duration
  ||s.maxCharges!==r.source.spData.maxChargeTime||!same(s.rangeGrid??[],r.skillRangeGrid))throw Error('Incomplete Timeslot selected inputs');
 const n=timeslotNativeInputs();if(n.ordinary._maxAnimScale!==1||n.s2Attack._maxAnimScale!==1||n.s2._isOverloadSkill!==1
  ||n.funnel._metadata.namedAsAlias!=='Funnel'||n.s2Funnels.some((a,i)=>a._metadata.namedAsAlias!==`S2Funnel_${i+1}`||a._waitForProjectileInvalid!==1)
  ||n.s1._playSkillBeginAnim!==0||n.s2._playSkillBeginAnim!==0||overdrive.term.termId!=='ba.overdrive'
  ||overdrive.term.description!=='技能持续拥有两段计量槽，技能进行到一半时触发额外效果'||overdrive.source.gitBlob!=='ab3b249f3116650c630859104c97f18289fb1a54')throw Error('Changed Timeslot native inputs');
 const controller=new TimeslotController(b,u,r);u.mem.tmslot=controller;
 return{record:r,controller,kit:{install:null,talents:[],skill:controller.spec(),trait:{noAttack:true,attackDrivenSkill:true,attack:'ranged',dmgType:'arts',projectile:'none',
  canHitFly:true,maxTargets:1,hits:1,hitsFn:null,chain:null,splashRadius:0,allInRange:false,hitAllBlocked:false,windup:0,requiresAcceptedLaunch:true,
  acceptAreaAttack:(_b,_u,_p,targets)=>targets.length===1&&controller.admit(targets[0]),
  launchAreaAttack:(_b,_u,_p,targets,info)=>controller.release(targets[0],info)}}};
}
