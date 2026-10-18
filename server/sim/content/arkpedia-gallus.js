// SPDX-License-Identifier: GPL-3.0-or-later
// Selected original passive-only operator; public admission is separate.
import e from '../../../data/arkpedia-native-operators/char_4227_gallus.json' with {type:'json'};
import clocks from '../../../data/arkpedia-gallus-clocks.json' with {type:'json'};
import {GALLUS_ID as ID,selectedGallusBuild,gallusNativeInputs} from './arkpedia-gallus-source.js';
import {normalizeChess} from '../simdata.js';
import {sortEnemyTargets,canTargetEnemy} from '../targeting.js';
import {sourceAbilityDelta} from './arkpedia-slow-down.js';
export const GALLUS_CONTRACT=Object.freeze({
 scope:'Selected original GALLUS² ordinary Arts attacks and deployment-window RES reduction; no public admission',
 mapping:'Original one-second Start precedes single-target ground/air shots. Input-time BAT/interval playback caps at native 1.3 and advances with live slow_down; control epochs cancel windup without erasing positive cooldown. During the accepted twenty-second deployment mark, normal target priority is stably prefixed by absence of this source-life RES reduction; marked targets remain a fallback. Expiry/dispel returns ordinary priority without restarting an existing windup or cooldown. Original speed-ten finite homing shots resolve Arts damage with live same-life ATK or birth fallback after departure, then check the current source mark before admitting a ten-second independently sourced final RES scalar. Current hits do not benefit from their newly attached reduction. Existing source-owned reductions refresh their remaining duration; independent sources multiply. Recipient effects and legally born finite shots survive source departure; new marks cannot be created after its deployment window. Battle end drains all work.',
 limits:'Native selector secondaryFilter/filterBuffSource aliases, fallback priority, direct damage versus receiver-buff ordering, source/live/birth transport, accepted resource admission through callback departure, extend semantics, interruption/clock conversion and life identities are explicit local mappings. Modules, native particles/audio/shaders, physical devices and original game-frame/pixel parity are unverified. No public roster/data approval.',frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u._removing,air={canHitFly:true},same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),MARK='gallus:deployment';
export function prepareGallus(b,u,{contract}={}){
 if(contract!==GALLUS_CONTRACT||u.def.charId!==ID||u.deploySeq!==0||u.mem.gallus)throw Error('Fresh selected GALLUS² and exact contract required');
 const r=selectedGallusBuild(u.def.raw.arkpedia),n=gallusNativeInputs(),buff=n.templates.gallus_t_1.eventToActions.ON_BUFF_START[0]._succeedNodes[0]._buff;
 if(!same(u.def.stats,normalizeChess({stats:r.stats}).stats)||!same(u.rangeGrid,r.rangeGrid)||!same(u.def.tags,r.tags)||!same(u.def.talents.map(t=>t.bb),r.talentBb)||u.def.skill)throw Error('Incomplete selected passive GALLUS inputs');
 for(const a of[n.ordinary,n.preferred])if(a._timeMode!==0||a._waitForAttackEvent!==1||a._affectedBySlowDown!==1||a._maxAnimScale!==1.2999999523162842||a._damageType!==2||a._projectileKey!=='projectile_chr_gallus')throw Error('Changed original GALLUS attack');
 if(n.root._occupiedRemainingCharacterCnt!==0||n.preferredSelector._filterBuffSource!==1||n.preferredSelector._withoutThisBuff!==1||n.mark._buffs[0].isSilenceable!==0||!buff.independentCharacterSource||buff.overrideType!=='EXTEND'||buff.attributes.attributeModifiers[0].formulaItem!=='FINAL_SCALER')throw Error('Changed original GALLUS passive graph');
 const graph=e.projectiles.projectile_chr_gallus.flatMap(r=>r.components.map(c=>c.data)),projectile=graph.find(d=>'_lifeTime'in d),move=graph.find(d=>'_speed'in d),end=n.templates['gallus_t_1[mark]'].eventToActions.ON_BUFF_FINISH[0];
 if(projectile._lifeTime!==10||projectile._maxHitNum!==1||projectile._stopWhenSourceInvalid!==0||projectile._alwaysHitTraceTargetInTheEnd!==1||move._speed!==10||move._moveType!==1||move._delayToStart!==0
  ||end._modeIndex!==1||end._restartFSM!==false||n.mark._additiveActiveBuffs[0].templateKey!=='gallus_t_1'||n.templates.gallus_t_1.eventToActions.ON_BUFF_START[0]._conditionNode._targetType!=='BUFF_SOURCE')throw Error('Changed original GALLUS transport/window graph');
 const c=new Gallus(b,u,r);u.deploymentSlotCost=0;u.mem.gallus=c;return{record:r,controller:c,kit:{talents:[],skill:null,trait:{noAttack:true,attackDrivenSkill:true,attack:'ranged',dmgType:'arts',projectile:'none',canHitFly:true,maxTargets:1,hits:1,hitsFn:null,chain:null,splashRadius:0,allInRange:false,hitAllBlocked:false,windup:0,requiresAcceptedLaunch:true,acceptAreaAttack:(_b,_u,_p,ts)=>c.admit(ts),launchAreaAttack:(_b,_u,_p,ts,info)=>c.release(ts,info)}}};
}
export class Gallus{
 constructor(b,u,r){Object.assign(this,{b,u,record:r,bb:r.talentBb[0],seq:null,stopped:false,phase:null,handles:[],facing:u.dir,visualSeq:0,accepting:false,flights:new Set(),marks:new Map(),watchers:[]});}
 valid(){return !this.stopped&&!this.b.finished&&present(this.u)&&this.u.deploySeq===this.seq;}
 inWindow(){return this.valid()&&!!this.mark&&this.u.findBuff(MARK)===this.mark;}
 key(){return`gallus:res:${this.u.id}:${this.seq}`;}
 model(){const f=this.facing==='UP'?'Back':'Front';return{...e.models[ID][f],...clocks.models[f]};}
 visual(clip,speed=1,loop=false){if(this.model().exactDurations[clip]==null)throw Error('Missing original GALLUS clip');this.u.mem.regularVisualDirection=this.facing;this.u.mem.regularFormVisual={clip,speed,loop,...(!loop?{playId:`gallus:${this.seq}:${++this.visualSeq}`}:{})};this.u.mem.regularDeathVisual=this.facing==='UP'?{hide:true,duration:1}:{die:'Die',clip:'Die',duration:1};}
 idle(){this.facing=this.u.dir;this.visual('Idle',1,true);}
 choices(){if(this.b.rangeChanged(this.u))this.b._refreshRange(this.u);const ts=this.b.enemiesInKeys(this.u.rangeKeys,this.u,air);sortEnemyTargets(this.b,this.u,ts);if(this.inWindow())ts.sort((a,z)=>Number(!!a.findBuff(this.key()))-Number(!!z.findBuff(this.key())));return ts;}
 begin(t){const x=t.x-this.u.x,y=t.y-this.u.y;if(Math.hypot(x,y)>1e-8)this.facing=Math.abs(y)>Math.abs(x)?y>0?'UP':'DOWN':x<0?'LEFT':'RIGHT';
  const m=this.model(),speed=Math.min(1.2999999523162842,this.u.base.bat/this.u.s.interval),delay=m.eventPayloads.Attack[0].time,period=Math.max(this.u.s.interval,delay/speed);
  this.phase={kind:'attack',target:t,life:t.deploySeq,epoch:this.u.attackControlEpoch,age:0,lastAt:this.b.time,speed,releaseAge:delay,untilAge:period*speed,released:false,accepted:false};this.u.atkCd=period;this.visual('Attack',speed*this.u.s.slowDownRate);
 }
 admit(ts){const p=this.phase;return this.accepting&&this.valid()&&!this.u.hidden&&this.u.canAct&&!this.u.s.flags.disarm&&p?.kind==='attack'&&!p.accepted&&p.epoch===this.u.attackControlEpoch&&p.age+1e-7>=p.releaseAge&&ts.length===1&&ts[0]===p.target&&ts[0].deploySeq===p.life&&canTargetEnemy(this.u,ts[0],air);}
 apply(t){if(!this.inWindow()||!present(t))return;const life=t.deploySeq,key=this.key();let buff;buff=this.b.addBuff(t,{key,source:this.u,duration:this.bb.buff_duration,refresh:'extend',visible:true,mods:{resMul:1+this.bb.magic_resistance},onRemove:()=>{if(this.marks.get(t)?.buff===buff)this.marks.delete(t);this.unwatchIfIdle();}});
  if(!buff)return;if(this.b.finished||!present(t)||t.deploySeq!==life||t.findBuff(key)!==buff){if(t.findBuff(key)===buff)this.b.removeBuff(t,buff);return;}this.marks.set(t,{buff,life});this.watch();
 }
 release(ts,info){if(!this.admit(ts))return false;this.phase.accepted=true;const t=ts[0],life=t.deploySeq,u=this.u,b=this.b,sourceLife=this.seq,birthAtk=u.s.atk*u.s.atkScaleMul;
  const p=b.addProjectile({from:u,target:t,source:u,speed:10,maxAge:10,visual:'bolt',data:{arkpediaTrackedVisual:true,gallusOwner:u.id},onHit:({target})=>{
   this.flights.delete(p);if(!b.finished&&target?.deploySeq===life&&canTargetEnemy(u,target,air)){const atk=present(u)&&u.deploySeq===sourceLife?u.s.atk*u.s.atkScaleMul:birthAtk;
    b.dealDamage(u,target,{amount:atk,type:'arts',isAttack:true,isSkill:info.isSkill,attackId:info.attackId,applyWay:'ranged',tags:['gallus:ordinary']});if(present(target)&&target.deploySeq===life)this.apply(target);}
   this.unwatchIfIdle();
  }});this.flights.add(p);this.watch();return true;
 }
 watch(){if(this.watchers.length)return;this.watchers=[this.b.on('tick',()=>{for(const p of this.flights)if(!this.b.projectiles.list.includes(p)&&!this.b.projectiles.arriving.includes(p))this.flights.delete(p);
   for(const[t,e]of this.marks)if(!present(t)||t.deploySeq!==e.life||t.findBuff(e.buff.key)!==e.buff){if(t.findBuff(e.buff.key)===e.buff)this.b.removeBuff(t,e.buff);this.marks.delete(t);}this.unwatchIfIdle();}),this.b.on('battleEnd',()=>this.stop(true))];}
 unwatchIfIdle(){if(this.flights.size||this.marks.size)return;for(const h of this.watchers)this.b.off(h);this.watchers=[];}
 tick(){if(!this.valid())return;const{b,u}=this;let p=this.phase;
  if(p?.kind==='born'){if(b.time+1e-7<p.until)return;this.phase=p=null;this.idle();}
  if(u.hidden||!u.canAct||u.s.flags.disarm||p?.epoch!=null&&p.epoch!==u.attackControlEpoch){this.phase=null;this.idle();return;}
  if(p?.kind==='attack'){p.age+=sourceAbilityDelta(u,Math.max(0,b.time-p.lastAt),true)*p.speed;p.lastAt=b.time;u.mem.regularFormVisual.speed=p.speed*u.s.slowDownRate;
   if(!p.released&&p.age+1e-7>=p.releaseAge){p.released=true;if(p.target.deploySeq===p.life&&canTargetEnemy(u,p.target,air)){this.accepting=true;try{b.forceAttack(u,[p.target]);}finally{this.accepting=false;}}}
   if(!this.valid()||this.phase!==p||p.age+1e-7<p.untilAge)return;this.phase=p=null;
  }
  if(u.atkCd>1e-9)return;const t=this.choices()[0];if(t)this.begin(t);else this.idle();
 }
 install(){if(this.handles.length||this.stopped)throw Error('GALLUS cannot be reinstalled');const{b,u}=this;this.handles=[b.on('deploy',({unit,move})=>{if(unit!==u||move)return;this.seq=u.deploySeq;this.facing=u.dir;this.mark=b.addBuff(u,{key:MARK,source:u,duration:this.bb.duration});if(!this.valid())return;this.phase={kind:'born',until:b.time+this.model().exactDurations.Start};u.mem.regularBornUntil=this.phase.until;this.visual('Start');},{owner:u}),b.on('tick',()=>{if(this.seq!==null&&!this.valid())this.stop();else this.tick();},{owner:u}),b.on('removed',({unit})=>{if(unit===u)this.stop();},{owner:u}),b.on('death',({unit})=>{if(unit===u)this.stop();},{owner:u}),b.on('battleEnd',()=>this.stop(true),{owner:u})];}
 stop(end=false){if(end){this.b.projectiles.remove(p=>this.flights.has(p));this.flights.clear();for(const[t,e]of this.marks)this.b.removeBuff(t,e.buff);this.marks.clear();this.unwatchIfIdle();}if(this.stopped)return;this.stopped=true;this.phase=null;this.accepting=false;for(const h of this.handles)this.b.off(h);this.handles=[];if(this.mark)this.b.removeBuff(this.u,this.mark);delete this.u.mem.regularFormVisual;delete this.u.mem.regularVisualDirection;this.unwatchIfIdle();}
}
