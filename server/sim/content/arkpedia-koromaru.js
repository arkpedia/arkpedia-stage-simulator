// SPDX-License-Identifier: GPL-3.0-or-later
// Selected combat only. Public admission and compiled startup immunity are held.
import e from '../../../data/arkpedia-native-operators/char_4220_kormr.json' with {type:'json'};
import clocks from '../../../data/arkpedia-koromaru-clocks.json' with {type:'json'};
import {KOROMARU_ID as ID,selectedKoromaruBuild,koromaruNativeInputs} from './arkpedia-koromaru-source.js';
import {normalizeChess} from '../simdata.js';
import {absoluteRangeKeys,canTargetEnemy,sortEnemyTargets} from '../targeting.js';
import {sourceAbilityDelta} from './arkpedia-slow-down.js';

export const KOROMARU_CONTRACT=Object.freeze({
 scope:'Selected Koromaru two-marker ordinary Physical attacks and six-marker deployment Arts sequence; no public admission',
 mapping:'One nearest eligible ground target life is captured at deployment in original x-1 tiles. Start_1 is selected with a target, otherwise Start_2 finishes without a late passive search. The fixed original Start, Skill_Loop and Skill_End clips precede ordinary attacks; passive elapsed time ignores ASPD and slow_down. Five original loop markers apply live-ATK, non-missable Arts damage; marker six attaches a nonderived one-second recipient child which triggers once after half a second. The child checks the same source and recipient life, then applies the separate final Arts coefficient and resistable enemy fear. Ordinary attacks retain one target, one attack receipt and two separately timed Physical damage instances; interval playback is uncapped and live slow_down scales only that eligible clock. Control epochs cancel ordinary windup while preserving cooldown. Existing recipient fear survives source departure; unfinished source work does not.',
 limits:'Nearest-distance tie order, input capture at deployment, Start_1 versus Start_2 choice, mode/FSM transition, one receipt per multi-marker ability, callback order, independently owned fear and retained-child selectability are explicit local mappings. Compiled numeric startup abnormal flags/immunities, complete protection/interruption semantics, the native missable fear-buff dispatch and public gameplay are held. This selected adapter does not grant guessed startup immunity. Native hit-effect/audio assets, modules, physical devices and original game-frame/pixel parity are unverified.',
 frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u._removing;
const ground={canHitFly:false};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const due=(a,z)=>a+1e-7>=z;
function verify(){const n=koromaruNativeInputs(),a=n.ordinary,t=n.talentAttack;
 if(n.root._occupiedRemainingCharacterCnt!==0||a._timeMode!==0||a._animKey!=='Attack'||a._damageType!==1||a._affectedBySlowDown!==1||a._maxAnimScale!==-1||a._additionalTimes!==1||a._splitDamage!==0||a._atkScale!==1
  ||t._timeMode!==2||t._damageType!==2||t._affectedBySlowDown!==0||t._additionalTimes!==5||t._animKey!==''||t._allowNoTarget!==1
  ||[a,t].some(x=>x._waitForAttackEvent!==1||x._waitAttackEventForAllAttacks!==1||x._refreshInputTargetOnCheckSpell!==0))throw Error('Changed original Koromaru attack inputs');
 const branch=n.templates['kormr_t[attack]'].eventToActions.ON_BUFF_START[0],child=branch._succeedNodes[0],damage=branch._failNodes[0],final=n.templates['kormr_t[final_attack]'].eventToActions.ON_BUFF_TRIGGER;
 if(branch._conditionNode._compareValue!==5||child._isDerivedBuff!==false||child._buff.lifeTime!==1||child._buff.triggerCnt!==1||child._buff.firstTriggerInterval!==.5||child._buff.triggerInterval!==.5||child._buff.waitFirstTriggerInterval!==true
  ||child._buff.independentCharacterSource!==false||child._buff.isDamageMissable!==false||damage._atkScaleVar!=='atk_scale'||damage._ignoreCancelReasonMask!=='MISS'
  ||final[0]._ownerType!=='BUFF_SOURCE'||final[1]._atkScaleVar!=='final_atk_scale'||final[1]._ignoreCancelReasonMask!=='MISS'||final.at(-1)._buffKey!=='fear'
  ||n.selector._postFilter!==11||n.otherSelector._postFilter!==4||n.selector._targetMotion!==1||n.selector._maxNum!==1)throw Error('Changed original Koromaru passive graph');
}
export function prepareKoromaru(b,u,{contract}={}){
 if(contract!==KOROMARU_CONTRACT||u.def.charId!==ID||u.deploySeq!==0||u.mem.koromaru)throw Error('Fresh selected Koromaru and exact contract required');verify();
 const r=selectedKoromaruBuild(u.def.raw.arkpedia);
 if(!same(u.def.stats,normalizeChess({stats:r.stats}).stats)||!same(u.rangeGrid,r.rangeGrid)||!same(u.def.tags,r.tags)||!same(u.def.talents.map(t=>t.bb),r.talentBb)||u.def.skill)throw Error('Incomplete selected passive Koromaru inputs');
 const controller=new Koromaru(b,u,r);u.deploymentSlotCost=0;u.mem.koromaru=controller;
 return{record:r,controller,kit:{talents:[],skill:null,trait:{noAttack:true,attackDrivenSkill:true,attack:'melee',dmgType:'phys',projectile:'none',canHitFly:false,maxTargets:1,hits:1,hitsFn:null,chain:null,splashRadius:0,allInRange:false,hitAllBlocked:false,windup:0,requiresAcceptedLaunch:true,
  acceptAreaAttack:(_b,_u,_p,ts)=>controller.admit(ts),launchAreaAttack:(_b,_u,_p,ts,info)=>controller.release(ts,info)}}};
}
export class Koromaru{
 constructor(b,u,r){Object.assign(this,{b,u,record:r,bb:r.talentBb[0],seq:null,stopped:false,phase:null,handles:[],children:new Map(),facing:u.dir,visualSeq:0,accepting:false});}
 valid(){return !this.stopped&&!this.b.finished&&present(this.u)&&this.u.deploySeq===this.seq;}
 model(){const face=this.facing==='UP'?'Back':'Front';return{...e.models[ID][face],...clocks.models[face]};}
 visual(clip,speed=1,loop=false){if(this.model().exactDurations[clip]==null)throw Error('Missing original Koromaru clip');this.u.mem.regularVisualDirection=this.facing;this.u.mem.regularFormVisual={clip,speed,loop,...(!loop?{playId:`koromaru:${this.seq}:${++this.visualSeq}`}:{})};this.u.mem.regularDeathVisual=this.facing==='UP'?{hide:true,duration:1}:{die:'Die',clip:'Die',duration:1};}
 face(t){const x=t.x-this.u.x,y=t.y-this.u.y;if(Math.hypot(x,y)>1e-8)this.facing=Math.abs(y)>Math.abs(x)?y>0?'UP':'DOWN':x<0?'LEFT':'RIGHT';}
 idle(){this.facing=this.u.dir;this.visual('Idle',1,true);}
 legal(t){return present(t)&&canTargetEnemy(this.u,t,ground)&&(!t.s.flags.camou||!!t.blockedBy);}
 targetLife(p){return this.legal(p.target)&&p.target.deploySeq===p.life;}
 choices(passive=false){if(this.b.rangeChanged(this.u))this.b._refreshRange(this.u);
  const keys=passive?absoluteRangeKeys(e.tables.ranges['x-1'].grids.map(g=>[g.row,g.col]),this.u.tileR,this.u.tileC,this.u.dir):this.u.rangeKeys;
  const ts=this.b.enemiesInKeys(keys,this.u,ground).filter(t=>this.legal(t));sortEnemyTargets(this.b,this.u,ts);
  if(passive)ts.sort((a,z)=>Math.hypot(a.x-this.u.x,a.y-this.u.y)-Math.hypot(z.x-this.u.x,z.y-this.u.y));return ts;
 }
 active(){return this.valid()&&!this.u.hidden&&this.u.canAct&&!this.u.s.flags.disarm;}
 admit(ts){const p=this.phase;return this.accepting&&this.active()&&p&&!p.info&&!p.receiptAttempted&&p.epoch===this.u.attackControlEpoch&&ts.length===1&&ts[0]===p.target&&this.targetLife(p);}
 release(ts,info){if(!this.admit(ts))return false;const p=this.phase;p.info={...info};this.hit(p,p.marker);return true;}
 hit(p,index){if(!this.valid()||!this.targetLife(p))return;const passive=p.kind==='passive',t=p.target,u=this.u;
  if(passive&&index===5){this.attachFinal(p);return;}
  this.b.dealDamage(u,t,{amount:u.s.atk*u.s.atkScaleMul*(passive?this.bb.atk_scale:1),type:passive?'arts':'phys',canDodge:!passive,isAttack:true,isSkill:false,attackId:p.info.attackId,applyWay:'melee',tags:[passive?'koromaru:slash':'koromaru:ordinary']});
 }
 marker(p,index){if(!this.active()||p.epoch!==this.u.attackControlEpoch||!this.targetLife(p))return;p.marker=index;
  if(p.info){this.hit(p,index);return;}if(p.receiptAttempted)return;
  this.accepting=true;try{this.b.forceAttack(this.u,[p.target]);}finally{this.accepting=false;p.receiptAttempted=true;}
 }
 attachFinal(p){const t=p.target,life=p.life,u=this.u,key=`koromaru:final:${u.id}:${this.seq}:${++this.childSeq}`;
  const buff=this.b.addBuff(t,{key,source:u,duration:1,onRemove:()=>this.children.delete(key)});
  if(!buff)return;if(!this.valid()||!this.targetLife(p)||t.findBuff(key)!==buff){if(t.findBuff(key)===buff)this.b.removeBuff(t,buff);return;}
  this.children.set(key,{buff,target:t,life,at:this.b.time+.5,info:p.info});
 }
 tickChildren(){for(const[key,c]of [...this.children]){
  if(!present(c.target)||c.target.deploySeq!==c.life||c.target.findBuff(key)!==c.buff){this.b.removeBuff(c.target,c.buff);this.children.delete(key);continue;}
  if(!due(this.b.time,c.at))continue;this.children.delete(key);this.b.removeBuff(c.target,c.buff);
  // A nonderived accepted child survives ordinary action control, not source loss.
  if(!this.valid()||!present(c.target)||c.target.deploySeq!==c.life)return;
  this.b.dealDamage(this.u,c.target,{amount:this.u.s.atk*this.u.s.atkScaleMul*this.bb.final_atk_scale,type:'arts',canDodge:false,isAttack:true,isSkill:false,attackId:c.info.attackId,applyWay:'melee',tags:['koromaru:final']});
  if(this.valid()&&present(c.target)&&c.target.deploySeq===c.life&&c.target.kind==='enemy'){
   const fearKey=`koromaru:fear:${this.u.id}:${this.seq}`;
   this.b.applyStatus(c.target,'fear',{key:fearKey,source:this.u,duration:this.bb.fear,sourceStatusResistable:true});
   // Application callbacks may replace the recipient life. Remove only this
   // producer's resource, leaving independently accepted foreign fear intact.
   if(!present(c.target)||c.target.deploySeq!==c.life){const own=c.target.findBuff(fearKey);if(own)this.b.removeBuff(c.target,own);}
  }
 }}
 begin(t){this.face(t);const speed=this.u.base.bat/this.u.s.interval,m=this.model(),events=m.eventPayloads.Attack.map(e=>e.time),period=Math.max(this.u.s.interval,events.at(-1)/speed);
  this.phase={kind:'ordinary',target:t,life:t.deploySeq,epoch:this.u.attackControlEpoch,age:0,lastAt:this.b.time,speed,events,next:0,until:period*speed,info:null,receiptAttempted:false};this.u.atkCd=period;this.visual('Attack',speed*this.u.s.slowDownRate);
 }
 tick(){if(!this.valid())return;this.tickChildren();if(!this.valid())return;const{u,b}=this;let p=this.phase;
  if(!p){if(this.active()&&u.atkCd<=1e-9){const t=this.choices()[0];if(t)this.begin(t);else this.idle();}return;}
  if(p.kind==='start'){
   if(!due(b.time,p.until))return;
   if(p.target){this.phase={kind:'passive',target:p.target,life:p.life,epoch:u.attackControlEpoch,age:0,lastAt:b.time,speed:1,events:this.model().eventPayloads.Skill_Loop.map(e=>e.time),next:0,until:this.model().exactDurations.Skill_Loop,info:null,receiptAttempted:false};this.visual('Skill_Loop');p=this.phase;}
   else{this.phase=null;this.idle();return;}
  }
  if(p.kind==='end'){if(due(b.time,p.until)){this.phase=null;this.idle();}return;}
  if(!this.active()||p.epoch!==u.attackControlEpoch){
   if(p.kind==='passive'){this.phase={kind:'end',until:b.time+this.model().exactDurations.Skill_End};this.visual('Skill_End');}
   else{this.phase=null;this.idle();}return;
  }
  p.age+=sourceAbilityDelta(u,Math.max(0,b.time-p.lastAt),p.kind==='ordinary')*p.speed;p.lastAt=b.time;
  u.mem.regularFormVisual.speed=p.speed*(p.kind==='ordinary'?u.s.slowDownRate:1);
  while(p.next<p.events.length&&due(p.age,p.events[p.next])){const index=p.next++;this.marker(p,index);if(!this.valid()||this.phase!==p)return;}
  if(!due(p.age,p.until))return;
  if(p.kind==='passive'){this.phase={kind:'end',until:b.time+this.model().exactDurations.Skill_End};this.visual('Skill_End');}
  else{this.phase=null;this.idle();}
 }
 install(){if(this.stopped||this.handles.length)throw Error('Koromaru cannot be reinstalled');const{b,u}=this;
  this.handles=[b.on('deploy',({unit,move})=>{if(unit!==u||move)return;this.seq=u.deploySeq;this.childSeq=0;this.facing=u.dir;const t=this.choices(true)[0];if(t)this.face(t);const clip=t?'Start_1':'Start_2',until=b.time+this.model().exactDurations[clip];this.phase={kind:'start',target:t??null,life:t?.deploySeq,until};u.mem.regularBornUntil=until;this.visual(clip);},{owner:u}),
   b.on('tick',()=>{if(this.seq!==null&&!this.valid())this.stop();else this.tick();},{owner:u}),b.on('removed',({unit})=>{if(unit===u)this.stop();},{owner:u}),b.on('death',({unit})=>{if(unit===u)this.stop();},{owner:u}),b.on('battleEnd',()=>this.stop(),{owner:u})];
 }
 stop(){if(this.stopped)return;this.stopped=true;this.phase=null;this.accepting=false;for(const h of this.handles)this.b.off(h);this.handles=[];for(const c of [...this.children.values()])this.b.removeBuff(c.target,c.buff);this.children.clear();delete this.u.mem.regularFormVisual;delete this.u.mem.regularVisualDirection;}
}
