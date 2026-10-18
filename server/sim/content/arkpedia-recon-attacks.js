// SPDX-License-Identifier: GPL-3.0-or-later
// Selected original owner combat; art/public admission is a separate gate.
import e from '../../../data/arkpedia-native-operators/char_4215_buddy.json' with {type:'json'};
import clocks from '../../../data/arkpedia-recon-clocks.json' with {type:'json'};
import {RECON_ID as ID,reconOwnerAttackInputs} from './arkpedia-recon-source.js';
import {prepareReconBombs,RECON_BOMBS_CONTRACT} from './arkpedia-recon-bombs.js';
import {canTargetEnemy,sortEnemyTargets} from '../targeting.js';
export const RECON_ATTACK_CONTRACT=Object.freeze({
 scope:'Selected original Recon automatic one-target bomb throwing and alternating ordinary attacks, composed with source-owned bombs/trait and Palamute; no public art/data admission',
 mapping:'Original mode zero prefers an unmarked enemy while stock remains, otherwise using its original trait-projectile ordinary fallback. The third stock spend at bomb impact switches to original mode one. Ordinary A/B sequences alternate independently; each engagement starts its authored Begin clip. Attack_A/B release at their original .433333 markers; Skill releases one zero-ATK bomb at .8, never a three-target burst or invented active skill. Sampled BAT/interval playback has no native cap, including ASPD effects already present at phase start. Literal affectedBySlowDown zero leaves the current owner ability elapsed clock on world time; it does not multiply by a newly attached live slow_down again. A/B and Skill have their authored End-to-Idle mixes, interruptible by a legal next attack. Control epochs and mode detachment cancel unfired phases without clearing positive cooldown. Homing bullets/trait bullets stop on source-life loss; finite zero-damage bomb transport survives but cannot create new source-derived children after its owner parent retires. Explicit receiver damage precedes independent non-missable bomb attachment; spent stock is not reserved at launch. Target life is retained, while same-life ordinary damage reads current ATK and current own-point trait at impact.',
 limits:'Native marker-count comparisons, group/trigger versus ability selection, attach-time input capture, mode-detachment/FSM order, zero-damage versus buff dispatch, sampled playback/Begin/cooldown combination and animation-mix interruption are explicit local mappings. Source parent dispel keeps the body mode counter but prevents new derived recipient resources; compiled behavior of that exceptional case remains unverified. Native muzzle projection, hit/trail effects/audio, modules, physical devices and game-frame/pixel parity remain unverified. Public art/data/browser/full-regression admission is separate.',
 frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u._removing,air={canHitFly:true},due=(a,z)=>a+1e-7>=z;
export function verifyReconOwnerAttacks(){const n=reconOwnerAttackInputs(),keys=['ordinaryCombat','ordinaryAttack','fallbackCombat','fallbackAttack','bombCombat','bombAttack'];
 if(n.root._modes.map(p=>p.m_PathID).join()!=='7458498282236108504,6028356647921213144'||n.modes[0]._combat.m_PathID!=='-4014373505673437480'||n.modes[1]._combat.m_PathID!=='-6400508463124488488'
  ||n.groups.some((g,i)=>g._category!==4||g._selectAbilitySequentially!==([0,0,1,1,1,1][i])||g._updateCooldownAfterSubAbilitiesAttached!==0))throw Error('Changed original Recon mode/group binding');
 for(const key of keys)for(const [i,s]of n.shots[key].entries()){const a=s.ability,bomb=key.startsWith('bomb'),fallback=key.startsWith('fallback');
  if(a._timeMode!==0||a._affectedBySlowDown!==0||a._maxAnimScale!==-1||a._waitForAttackEvent!==1||a._damageType!==1||a._attackType!==1||a._selectTargetSource!==1||a._selectTargetTiming!==0||a._useCachedAtkOnly!==0
   ||a._projectileKey!==(bomb?'projectile_chr_buddy_boom':fallback?'projectile_chr_buddy_tr':'projectile_chr_buddy')||a._atkScale!==(bomb?0:1)
   ||s.animator?._oneshotAnim!==(bomb?'Skill':i?'Attack_B':'Attack_A')||s.animator._beginAnim!==(bomb?'Skill_Begin':'Attack_Begin')||s.animator._onlyPlayBeginAnimWhenFirstAttack!==1||s.animator._maxAnimScale!==-1
   ||s.selector._targetMotion!==3||s.selector._limitTargetNum!==1||s.selector._maxNum!==1)throw Error('Changed original Recon attack/animator input');
  if(bomb&&(a._activeBuffs[0].templateKey!=='buddy[try_add_boom]'||a._activeBuffs[0].isDamageMissable!==0||a._activeBuffs[0].blackboard.find(v=>v.key==='mode')?.value!==1))throw Error('Changed original non-missable bomb receiver/mode');
 }
 if(n.unmarked._buffKey!=='buddy[marker]'||n.unmarked._compareType!==1||n.unmarked._checkBuffSource!==1||n.marked._compareType!==2||n.marked._checkBuffSource!==1
  ||n.animator._animations.find(a=>a.animKey==='Born')?.animName!=='Start'||n.animator._mixSettings.map(m=>`${m.sourceAnimName}:${m.mixAnimName}`).join()!=='Attack_A:Attack_End,Attack_B:Attack_End,Skill:Skill_End')throw Error('Changed original Recon marker/animation binding');
 for(const[key,stop]of[['projectile_chr_buddy',1],['projectile_chr_buddy_tr',1],['projectile_chr_buddy_boom',0]]){const ds=e.projectiles[key].flatMap(r=>r.components.map(c=>c.data)),p=ds.find(d=>'_lifeTime'in d),m=ds.find(d=>'_speed'in d);
  if(p._lifeTime!==10||p._maxHitNum!==1||p._stopWhenSourceInvalid!==stop||p._alwaysHitTraceTargetInTheEnd!==1||m._speed!==10||m._moveType!==1||m._delayToStart!==0)throw Error('Changed original Recon projectile transport');
 }return n;
}
export function prepareReconAttacks(b,u,{contract}={}){
 if(contract!==RECON_ATTACK_CONTRACT)throw Error('Exact selected Recon owner attack contract required');const native=verifyReconOwnerAttacks(),prepared=prepareReconBombs(b,u,{contract:RECON_BOMBS_CONTRACT}),ownerAttacks=new ReconAttacks(prepared.controller,prepared.resources,native),install=prepared.kit.install;
 prepared.kit.install=()=>{install();ownerAttacks.install();};prepared.kit.trait={noAttack:true,attackDrivenSkill:true,install:null,dmgMul:null,attack:'ranged',projectile:'none',dmgType:'phys',canHitFly:true,maxTargets:1,maxTargetsByBlock:false,hitAllBlocked:false,allInRange:false,hits:1,hitsFn:null,chain:null,splashRadius:0,heal:null,windup:0,requiresAcceptedLaunch:true,
  acceptAreaAttack:(_b,_u,_p,ts)=>ownerAttacks.admit(ts),launchAreaAttack:(_b,_u,_p,ts,info)=>ownerAttacks.release(ts,info)};u.mem.reconOwnerAttacks=ownerAttacks;return{...prepared,ownerAttacks};
}
export class ReconAttacks{
 constructor(point,resources,native){Object.assign(this,{point,resources,native,b:point.b,u:point.u,seq:null,stopped:false,phase:null,handles:[],watchers:[],flights:new Set(),ordinary:new Set(),accepting:false,mode:0,normalIndex:0,fallbackIndex:0,engagement:null,facing:point.u.dir,visualSeq:0,idlePending:null});}
 valid(){return !this.stopped&&!this.b.finished&&present(this.u)&&this.u.deploySeq===this.seq;}
 active(){return this.valid()&&!this.u.hidden&&this.u.canAct&&!this.u.s.flags.disarm;}
 model(){const face=this.facing==='UP'?'Back':'Front';return{...e.models[ID][face],...clocks.models[face]};}
 visual(clip,speed=1,loop=false){if(this.model().exactDurations[clip]==null)throw Error('Missing original Recon owner pose');this.u.mem.regularVisualDirection=this.facing;this.u.mem.regularFormVisual={clip,speed,loop,...(!loop?{playId:`recon:${this.seq}:${++this.visualSeq}`}:{})};this.u.mem.regularDeathVisual=this.facing==='UP'?{hide:true,duration:1}:{clip:'Die',die:'Die',duration:1};}
 idle(){if(this.idlePending)return;const from=this.u.mem.regularFormVisual?.clip;this.facing=this.u.dir;
  if(from==='Idle')return;const mix=this.native.animator._mixSettings.find(m=>m.sourceAnimName===from&&m.targetAnimName==='Idle');
  if(mix){this.idlePending={until:this.b.time+this.model().exactDurations[mix.mixAnimName]};this.visual(mix.mixAnimName);}else this.visual('Idle',1,true);
 }
 legal(t){return present(t)&&t.kind==='enemy'&&canTargetEnemy(this.u,t,air)&&(!t.s.flags.camou||!!t.blockedBy);}
 receiver(t,life){return present(t)&&!t.hidden&&t.kind==='enemy'&&t.side==='enemy'&&t.deploySeq===life;}
 choices(){const u=this.u;if(this.b.rangeChanged(u))this.b._refreshRange(u);const out=this.b.enemiesInKeys(u.rangeKeys,u,air).filter(t=>this.legal(t));for(const t of this.b.blockedTargets(u,air))if(this.legal(t)&&!out.includes(t))out.push(t);sortEnemyTargets(this.b,u,out);return out;}
 choose(){const ts=this.choices(),bomb=this.mode===0?ts.find(t=>!this.resources.marked(t)):null;return bomb?{kind:'bomb',target:bomb}:ts[0]?{kind:'ordinary',target:ts[0]}:null;}
 face(t){const x=t.x-this.u.x,y=t.y-this.u.y;if(Math.hypot(x,y)>1e-8)this.facing=Math.abs(y)>Math.abs(x)?y>0?'UP':'DOWN':x<0?'LEFT':'RIGHT';}
 begin({kind,target}){this.face(target);const speed=this.u.base.bat/this.u.s.interval,bomb=kind==='bomb',index=this.mode===0?'fallbackIndex':'normalIndex',clip=bomb?'Skill':this[index]++%2?'Attack_B':'Attack_A',style=bomb?'bomb':`ordinary:${this.mode}`,m=this.model(),begin=this.engagement===style?0:m.exactDurations[bomb?'Skill_Begin':'Attack_Begin'];
  const releaseAge=begin+m.eventPayloads[clip][0].time,period=Math.max(this.u.s.interval,releaseAge/speed);this.engagement=style;this.idlePending=null;
  this.phase={kind,mode:this.mode,target,life:target.deploySeq,epoch:this.u.attackControlEpoch,speed,clip,begin,main:begin===0,age:0,lastAt:this.b.time,releaseAge,untilAge:period*speed,released:false,accepted:false};this.u.atkCd=period;this.visual(begin?bomb?'Skill_Begin':'Attack_Begin':clip,speed);
 }
 admit(ts){const p=this.phase;return this.accepting&&this.active()&&p&&p.kind!=='born'&&!p.accepted&&p.mode===this.mode&&p.epoch===this.u.attackControlEpoch&&due(p.age,p.releaseAge)&&ts.length===1&&ts[0]===p.target&&ts[0].deploySeq===p.life&&this.legal(ts[0]);}
 release(ts,info){if(!this.admit(ts))return false;const p=this.phase,bomb=p.kind==='bomb',variant=bomb?'projectile_chr_buddy_boom':p.mode===0?'projectile_chr_buddy_tr':'projectile_chr_buddy',t=ts[0],life=p.life;p.accepted=true;let projectile;
  projectile=this.b.addProjectile({from:this.u,target:t,source:this.u,speed:10,maxAge:10,visual:bomb?'orb':'bolt',data:{arkpediaTrackedVisual:true,reconOwner:this.u.id,reconVariant:variant},onHit:()=>{
   this.flights.delete(projectile);this.ordinary.delete(projectile);
   if(!this.b.finished&&this.receiver(t,life)&&(bomb||this.valid())){
    this.b.dealDamage(this.u,t,{amount:bomb?0:this.u.s.atk*this.u.s.atkScaleMul,type:'phys',isAttack:true,isSkill:false,canDodge:true,attackId:info.attackId,applyWay:'ranged',tags:[bomb?'recon:throw':'recon:ordinary',variant]});
    if(bomb&&this.receiver(t,life))this.resources.attach(t);
   }this.unwatch();
  }});this.flights.add(projectile);if(!bomb)this.ordinary.add(projectile);this.watch();return true;
 }
 watch(){if(this.watchers.length)return;this.watchers=[this.b.on('tick',()=>{for(const p of this.flights)if(!this.b.projectiles.list.includes(p)&&!this.b.projectiles.arriving.includes(p)){this.flights.delete(p);this.ordinary.delete(p);}this.unwatch();}),this.b.on('battleEnd',()=>this.drain())];}
 unwatch(){if(this.flights.size)return;for(const h of this.watchers)this.b.off(h);this.watchers=[];}
 drain(){this.b.removeProjectiles(p=>this.flights.has(p));this.flights.clear();this.ordinary.clear();this.unwatch();}
 tick(){if(!this.valid())return;const{b,u}=this;let p=this.phase;
  if(this.idlePending&&due(b.time,this.idlePending.until)){this.idlePending=null;this.visual('Idle',1,true);}
  if(p?.kind==='born'){if(!due(b.time,p.until))return;this.phase=p=null;this.visual('Idle',1,true);}
  const mode=this.resources.remaining===0?1:0;if(mode!==this.mode){this.mode=mode;this.phase=p=null;this.engagement=null;this.normalIndex=0;this.idle();}
  if(!this.active()||p&&p.epoch!==u.attackControlEpoch){this.phase=null;this.engagement=null;this.idle();return;}
  if(p){p.age+=Math.max(0,b.time-p.lastAt)*p.speed;p.lastAt=b.time;
   if(!p.main&&due(p.age,p.begin)){p.main=true;this.visual(p.clip,p.speed);}
   if(!p.released&&due(p.age,p.releaseAge)){p.released=true;this.accepting=true;try{b.forceAttack(u,[p.target]);}finally{this.accepting=false;}}
   if(!this.valid()||this.phase!==p||!due(p.age,p.untilAge))return;this.phase=null;
  }
  if(u.atkCd>1e-9){if(!this.phase)this.idle();return;}const choice=this.choose();if(choice)this.begin(choice);else{this.engagement=null;this.idle();}
 }
 install(){if(this.handles.length||this.stopped)throw Error('Recon owner attacks cannot be reinstalled');const{b,u}=this;this.handles=[b.on('deploy',({unit,move})=>{if(unit!==u||move)return;this.seq=u.deploySeq;this.facing=u.dir;this.phase={kind:'born',until:b.time+this.model().exactDurations.Start};u.mem.regularBornUntil=this.phase.until;this.visual('Start');},{owner:u}),b.on('tick',()=>{if(this.seq!==null&&!this.valid())this.stop();else this.tick();},{owner:u}),b.on('death',({unit})=>{if(unit===u)this.stop();},{owner:u}),b.on('removed',({unit})=>{if(unit===u)this.stop();},{owner:u}),b.on('battleEnd',()=>{this.stop();this.drain();},{owner:u})];}
 stop(){if(this.stopped)return;this.stopped=true;this.phase=null;this.engagement=null;this.accepting=false;this.idlePending=null;this.b.removeProjectiles(p=>this.ordinary.has(p));for(const p of this.ordinary)this.flights.delete(p);this.ordinary.clear();this.unwatch();for(const h of this.handles)this.b.off(h);this.handles=[];if(this.b.finished)this.drain();delete this.u.mem.regularFormVisual;delete this.u.mem.regularVisualDirection;}
}
