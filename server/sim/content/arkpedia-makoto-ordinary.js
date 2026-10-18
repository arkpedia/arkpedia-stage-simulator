// SPDX-License-Identifier: GPL-3.0-or-later
// Held default-body attack only. The form/skill controller supplies its own dispatcher.
import e from'../../../data/arkpedia-native-operators/char_4217_makoto.json'with{type:'json'};
import clocks from'../../../data/arkpedia-makoto-clocks.json'with{type:'json'};
import{MAKOTO_ID as ID,selectedMakotoInputs,makotoDefaultInputs}from'./arkpedia-makoto-source.js';
import{sourceAbilityDelta}from'./arkpedia-slow-down.js';import{canTargetEnemy,sortEnemyTargets}from'../targeting.js';import{bodyInKeys}from'../body.js';
export const MAKOTO_ORDINARY_CONTRACT=Object.freeze({
 scope:'Selected original default-mode single-input Physical melee and literal A/B clocks only; no persona/skill/fatal/all-out or public admission.',
 mapping:'The owning mode controller must provide an explicit mayBegin predicate and original A/B replacement dispatcher; this component supplies neither a guessed loopType0 picker nor a substitute skill. Fresh default-body acquisition selects one legal ground enemy with normal priority, retaining blocked inputs and one original life. Original Start bounds the initial opening. An uncapped sampled BAT/current-interval animation clock uses the selected clip OnAttack and full duration, applying live affectedBySlowDown once. One accepted marker owns one shared attack receipt and a direct live-ATK Physical melee hit. Lost/replaced/hidden/now-illegal inputs do not acquire a replacement at the marker. Target/range movement alone does not redirect the retained input. Source control, mode departure, hiding, withdrawal/death/replacement and explicit removal cancel unborn work. Reentrancy claims before output, rejects changed command targets and preserves foreign presentation state.',
 limitations:'Source numeric selector aliases, clip dispatcher, initial default Born timing, input retention/legality, cooldown origin, facing/idle and same-tick callback order remain explicit local boundaries. Replacement loopType0, full mode graph, skill/SP, trait fatal transitions, persona attacks/heals, all-out/group effects and original public art delivery compose separately. No copied Dollkeeper runtime, native particles/audio/modules or compiled/frame/pixel parity is claimed.',frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u.removed&&!u._removing,due=(a,z)=>a>=z-1e-6;
export function verifyMakotoOrdinary(n=makotoDefaultInputs()){
 const{root:r,mode:m,attack:a,trigger:t,selector:s,replacement:p,art}=n;
 if(r._modes[0].m_PathID!=='-3985492384108261851'||r._useRealBornTimeFromAnim!==0||r.m_overrideBornTime!==-1||r._clearProjectileWhenDead!==0||m._attack.m_PathID!=='-7239676370760577499'||m._attackTrigger.m_PathID!=='3975289686999354917'||m._animatorHooker.m_PathID!=='0'
  ||a._selector.m_PathID!=='0'||a._allowNoTarget!==0||a._waitForAttackEvent!==1||a._timeMode!==0||a._maxAnimScale!==-1||a._affectedBySlowDown!==1||a._ignorePalsyInterrupt!==0||a._animKey!=='Attack_A'||a._endAnimKey!==''||a._preDelay!==0||a._selectTargetSource!==2||a._selectTargetTiming!==0||a._interuptIfTargetDead!==0||a._alwaysIncludeTarget!==1
  ||a._faceToTarget!==1||a._forceFaceToDirection!==0||a._activeBuffs.length||a._resetCdStrategy!==1||a._damageType!==1||a._attackType!==1||a._atkScale!==1||a._atkScaleKey!=='atk_scale'||a._elementDamageType!==0||a._epDamageRatio!==0
  ||t._keepTarget!==0||t._minTargetNum!==1||t._overrideSearchTargetTick!==-1||s._targetSide!==2||s._targetMotion!==1||s._targetCategory!==1||s._postFilter!==4||s._ignoreTargetFree!==0||s._ignoreHitRange!==0||s._ignoreMotionMode!==0||s._forceIgnoreCamouflage!==0||s._limitTargetNum!==1||s._maxNum!==1||s._limitedMaxTargetNumToBlockedCnt!==0
  ||p._sourceAnimKey!=='Attack_A'||p._loopType!==0||p._recalculatePlaybackSpeed!==0||p._replaceGroup.map(v=>v.anim).join()!=='Attack_A,Attack_B'||art._mixSettings.length)throw Error('Changed original Makoto default-body attack inputs');
 for(const[key,name]of[['Born','Start'],['Idle','Idle'],['Attack_A','Attack_A'],['Attack_B','Attack_B']])if(art._animations.find(v=>v.animKey===key)?.animName!==name)throw Error('Changed original Makoto default-body aliases');
}
export class MakotoOrdinaryAttacks{
 constructor(b,u,{contract,mayBegin,pickClip}={}){
  if(contract!==MAKOTO_ORDINARY_CONTRACT||typeof mayBegin!=='function'||typeof pickClip!=='function'||u.def.charId!==ID||u.deploySeq!==0)throw Error('Fresh selected Makoto, exact ordinary contract and explicit mode/clip dispatchers required');
  verifyMakotoOrdinary();this.record=selectedMakotoInputs(u);Object.assign(this,{b,u,mayBegin,pickClip,seq:null,stopped:false,phase:null,selecting:false,accepting:false,bornUntil:Infinity,facing:u.dir,visualSeq:0,visuals:new WeakSet(),handles:[]});
 }
 valid(){return !this.stopped&&!this.b.finished&&present(this.u)&&this.u.deploySeq===this.seq;}
 legal(t){return present(t)&&t.side==='enemy'&&!t.hidden&&canTargetEnemy(this.u,t,{canHitFly:false,groundOnly:true})&&(!t.s.flags.camou||!!t.blockedBy);}
 model(){const face=this.facing==='UP'?'Back':'Front';return{...e.models[ID][face],...clocks.models[face]};}
 visual(clip,speed=1,loop=false){if(!this.valid())return null;if(!Object.hasOwn(this.model().exactDurations,clip))throw Error('Missing original Makoto default-body clip');const v={clip,speed,loop,...(loop?{replace:true}:{playId:`makoto:ordinary:${this.seq}:${++this.visualSeq}`})};this.visuals.add(v);this.u.mem.regularFormVisual=v;this.u.mem.regularVisualDirection=this.facing;return v;}
 idle(){this.facing=this.u.dir;this.visual('Idle',1,true);}
 choices(){if(this.b.rangeChanged(this.u))this.b._refreshRange(this.u);const rows=this.b.enemies.filter(t=>this.legal(t)&&bodyInKeys(t,this.u.rangeKeySet));for(const t of this.b.blockedTargets(this.u,{canHitFly:false,groundOnly:true,canTarget:(_u,t)=>this.legal(t)}))if(!rows.includes(t))rows.push(t);return sortEnemyTargets(this.b,this.u,rows,'normal').slice(0,1);}
 begin(t){if(this.selecting||this.phase||!this.valid())return false;const epoch=this.u.attackControlEpoch,life=t.deploySeq;let clip;this.selecting=true;try{clip=this.pickClip();}finally{this.selecting=false;}
  if(!['Attack_A','Attack_B'].includes(clip))throw Error('Explicit Makoto dispatcher must return an original default-body clip');
  // The owning mode callback can re-enter; recheck this original life afterward.
  if(!this.valid()||!this.mayBegin()||!this.valid()||!this.u.canAct||this.u.hidden||this.u.s.flags.disarm||this.u.attackControlEpoch!==epoch||t.deploySeq!==life||!this.legal(t))return false;
  const dx=t.x-this.u.x,dy=t.y-this.u.y;if(Math.hypot(dx,dy)>1e-8)this.facing=Math.abs(dy)>Math.abs(dx)?dy>0?'UP':'DOWN':dx<0?'LEFT':'RIGHT';
  const m=this.model(),speed=this.u.base.bat/this.u.s.interval,marker=m.eventPayloads[clip].filter(v=>v.name==='OnAttack');if(marker.length!==1)throw Error('Missing original Makoto single attack marker');
  const p={clip,target:t,life,epoch,speed,age:0,lastAt:this.b.time,releaseAge:marker[0].time,endAge:m.exactDurations[clip],released:false,accepted:false};this.phase=p;this.u.atkCd=Math.max(this.u.s.interval,p.endAge/speed);p.visual=this.visual(clip,speed*this.u.s.slowDownRate);return true;
 }
 admit(ts){const p=this.phase;return this.accepting&&this.valid()&&this.mayBegin()&&this.valid()&&this.phase===p&&this.u.canAct&&!this.u.hidden&&!this.u.s.flags.disarm&&p&&!p.accepted&&p.epoch===this.u.attackControlEpoch&&due(p.age,p.releaseAge)&&ts.length===1&&ts[0]===p.target&&p.target.deploySeq===p.life&&this.legal(p.target);}
 release(ts,info){if(!this.admit(ts))return false;const p=this.phase;p.accepted=true;this.b.dealDamage(this.u,p.target,{amount:this.u.s.atk*this.u.s.atkScaleMul,type:'phys',isAttack:true,isSkill:false,attackId:info.attackId,applyWay:'melee',tags:['makoto:ordinary']});return true;}
 tick(){if(!this.valid())return;const{u,b}=this,allowed=this.mayBegin();if(!this.valid())return;if(!allowed){this.phase=null;return;}if(!due(b.time,this.bornUntil))return;const p=this.phase;
  if(!u.canAct||u.hidden||u.s.flags.disarm||p&&p.epoch!==u.attackControlEpoch){this.phase=null;this.idle();return;}
  if(p){p.age+=sourceAbilityDelta(u,Math.max(0,b.time-p.lastAt),true)*p.speed;p.lastAt=b.time;if(u.mem.regularFormVisual===p.visual)p.visual.speed=p.speed*u.s.slowDownRate;
   if(!p.released&&due(p.age,p.releaseAge)){p.released=true;this.accepting=true;try{b.forceAttack(u,[p.target]);}finally{this.accepting=false;}}
   if(!this.valid()||this.phase!==p||!due(p.age,p.endAge))return;this.phase=null;this.idle();
  }
  if(u.atkCd>1e-8)return;const t=this.choices()[0];if(t)this.begin(t);
 }
 trait(){return{noAttack:true,attackDrivenSkill:true,attack:'melee',dmgType:'phys',applyWay:'melee',canHitFly:false,groundOnly:true,heal:null,projectile:'none',maxTargets:1,maxTargetsByBlock:false,hitAllBlocked:false,allInRange:false,hits:1,hitsFn:null,chain:null,splashRadius:0,windup:0,attackVisual:'none',requiresAcceptedLaunch:true,acceptAreaAttack:(_b,_u,_p,ts)=>this.admit(ts),launchAreaAttack:(_b,_u,_p,ts,info)=>this.release(ts,info)};}
 install(){if(this.stopped||this.handles.length||this.u.mem.makotoOrdinary&&this.u.mem.makotoOrdinary!==this)throw Error('Makoto ordinary attacks cannot be reinstalled');this.u.mem.makotoOrdinary=this;const{b,u}=this;this.handles=[
  b.on('deploy',({unit,move})=>{if(unit!==u||move)return;if(this.seq!==null){if(this.seq!==u.deploySeq)this.stop();return;}this.seq=u.deploySeq;this.facing=u.dir;this.bornUntil=b.time+this.model().exactDurations.Start;this.visual('Start');},{owner:u}),
  b.on('tick',()=>{if(this.seq!==null&&!this.valid())this.stop();else this.tick();},{owner:u}),b.on('removed',({unit})=>{if(unit===u)this.stop();},{owner:u}),b.on('death',({unit})=>{if(unit===u)this.stop();},{owner:u}),
  b.on('palsyTriggered',({unit})=>{if(unit===u&&this.phase){this.phase=null;if(this.valid()&&this.mayBegin())this.idle();}},{owner:u}),b.on('battleEnd',()=>this.stop(),{owner:u})];
 }
 stop(){if(this.stopped)return;this.stopped=true;this.phase=null;this.accepting=false;for(const h of this.handles)this.b.off(h);this.handles=[];if(this.seq===this.u.deploySeq&&this.visuals.has(this.u.mem.regularFormVisual)){delete this.u.mem.regularFormVisual;delete this.u.mem.regularVisualDirection;}}
}
