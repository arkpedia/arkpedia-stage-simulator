// SPDX-License-Identifier: GPL-3.0-or-later
// Persona S1 combat only. The owning form/skill controller composes this component.
import evidence from '../../../data/arkpedia-native-operators/char_4217_makoto.json' with {type:'json'};
import clocks from '../../../data/arkpedia-makoto-clocks.json' with {type:'json'};
import {MAKOTO_ID as ID, selectedMakotoInputs, makotoS1Inputs} from './arkpedia-makoto-source.js';
import {absoluteRangeKeys, canTargetEnemy, sortEnemyTargets} from '../targeting.js';
import {bodyInKeys} from '../body.js';
import {sourceAbilityDelta} from './arkpedia-slow-down.js';

export const MAKOTO_S1_COMBAT_CONTRACT = Object.freeze({
  scope: 'Selected original S1 persona single-recipient heal or cached-ATK single-ground-target Arts projectile, original attack clocks and source-life ownership.',
  mapping: 'The owning form controller supplies an explicit mayBegin predicate and persona stats. The native ordered heal/attack configs map to heal-first selection in the selected nonextended x-1 range. Max-HP filter0.5 with maxHpExcludeEqual0 maps to inclusive half HP; lowest HP ratio, newest deployment then stable ID break ties. Both branches retain one input life through the original .800000011920929 marker. Uncapped sampled base-BAT/current-interval animation playback and live slowdown apply once; cooldown is at least the release and otherwise the current attack interval, independent of the longer clip tail. Heal is immediate at that marker using live ATK/scale and ordinary heal modifiers. Enemy output uses a finite speed-ten ten-second projectile with cached launch ATK/scale/coefficient. The present same-life source supplies typed outgoing attributes at impact; retirement uses its launch view and old ledger. Born transport survives form departure and owner exit; missing/replaced/hidden input never redirects.',
  limitations: 'Numeric selector aliases, inclusive threshold, branch priority/ties, retained-input legality, animation/cooldown/FSM ordering, cached-attribute split and source-invalid view are explicit local mappings rather than compiled/game-frame proof. The half-HP class/fields match separately reviewed Global Saria First Aid source; that corroborates reuse of the local inclusive mapping, not compiled client comparison. No persona entry/return/fatal action interpreter, SP account, talent stats/all-out, public artwork, modules, native effects/audio or pixel parity is granted.',
  frameParity: false,
});
const present = t => t?.alive && t.deployed && !t.removed && !t._removing;
const retained = (t, life, side) => present(t) && !t.hidden && t.deploySeq === life && t.side === side;
const due = (a,z) => a >= z - 1e-7;
const same = (a,z) => JSON.stringify(a) === JSON.stringify(z);
export function verifyMakotoS1Combat(n = makotoS1Inputs()) {
  const {mode:m, wrapper:w, union, trigger, heal:h, attack:a, healSelector:hs, attackSelector:as} = n;
  const configs = w._abilityConfigs.map(c => [c._ability.m_PathID,c._trigger.m_PathID,c._alwaysUseTrigger,c._useInputTarget]);
  if (m._attack.m_PathID !== '-8120082265187824091' || m._attackTrigger.m_PathID !== '2913041643974151717'
    || !same(configs,[['-3514085099072598491','-6308989604904907227',0,0],['7294260590432538149','-2938589107860353499',0,0]])
    || w._category !== 4 || w._coolDownAbilityIndex !== 0 || w._timeMode !== 0 || w._selectAbilitySequentially !== 0
    || w._resetSubAbilityCooldown !== 1 || w._useSubAbilityEscapeTime !== 0
    || !same(union._rangeSelectorsList.map(p=>p.m_PathID),['1470367085020237349','916953614000180773'])
    || union._limitTargetNum !== 0 || union._distinctTargets !== 0) throw Error('Changed original Makoto S1 mixed selector');
  for (const t of [trigger,n.healTrigger,n.attackTrigger]) if (t._keepTarget !== 0 || t._minTargetNum !== 1 || t._overrideSearchTargetTick !== -1) throw Error('Changed original Makoto S1 trigger');
  for (const s of [hs,as]) if (s._targetCategory !== 1 || s._ignoreTargetFree !== 0 || s._ignoreAllyTargetFree !== 0
    || s._ignoreHealFree !== 0 || s._ignoreMotionMode !== 0 || s._forceIgnoreCamouflage !== 0
    || s._needProfessionMask !== 0 || s._limitTargetNum !== 1 || s._maxNum !== 1
    || s._excludeOwner !== 0 || s._ignoreHitRange !== 0) throw Error('Changed original Makoto S1 selectability');
  if (hs._targetSide !== 1 || hs._targetMotion !== 3 || hs._postFilter !== 3 || hs._filerMaxHp !== 1
    || hs._maxHpExcludeEqual !== 0 || hs._maxHpRatio !== .5 || hs._filterMinHp !== 0
    || as._targetSide !== 2 || as._targetMotion !== 1 || as._postFilter !== 4) throw Error('Changed original Makoto S1 HP/ground filter');
  for (const t of [h,a]) if (t._animKey !== 'Doll_Skill_1_Attack' || t._waitForAttackEvent !== 1 || t._timeMode !== 0
    || t._maxAnimScale !== -1 || t._affectedBySlowDown !== 1 || t._selectTargetSource !== 1
    || t._selectTargetTiming !== 0 || t._alwaysIncludeTarget !== 1 || t._allowNoTarget !== 0
    || t._interuptIfTargetDead !== 0 || t._preDelay !== 0 || t._escapeTime !== 0 || t._endAnimKey !== ''
    || t._faceToTarget !== 1 || t._faceToFront !== 0 || t._activeBuffs.length || t._ignorePalsyInterrupt !== 0) throw Error('Changed original Makoto S1 ability clock');
  if (h._isCont !== 0 || h._isHpRatio !== 0 || h._hasNoActionNode !== 0 || h._ignoreHealFree !== 0 || h._applyEPHeal !== 0
    || a._projectileKey !== 'projectile_chr_makoto_s1' || a._useCachedAtkOnly !== 1 || a._transferSource !== 1
    || a._damageType !== 2 || a._attackType !== 1 || a._atkScale !== 1 || a._atkScaleKey !== 'atk_scale'
    || a._waitForProjectileInvalid !== 0 || a._emitToInputPosWhenTargetIsInvalid !== 0) throw Error('Changed original Makoto S1 heal/projectile actions');
  const parts = n.projectile.flatMap(r=>r.components.map(c=>c.data)), p=parts.find(d=>d._lifeTime!=null), v=parts.find(d=>d._speed!=null);
  if (p._lifeTime !== 10 || p._managedBySource !== 0 || p._stopWhenSourceInvalid !== 0 || p._canHitSameTargetMultipleTimes !== 0
    || p._maxHitNum !== 1 || p._hitNumType !== 1 || p._stopAfterMaxHit !== 1 || p._alwaysHitTraceTargetInTheEnd !== 1
    || p._fixDealHitTargetLeft !== 1 || v._speed !== 10 || v._moveType !== 1 || v._delayToStart !== 0
    || v._forceReachedWhenTimeup !== 1 || v._flyToTargetLocationOnly !== 0) throw Error('Changed original Makoto S1 transport');
  if (!same(n.hook._replaceAnimPairs.map(p=>[p.fromAnimKey,p.toAnimKey]),[
    ['Idle','Doll_Skill_1_Idle'],['Attack','Doll_Skill_1_Attack'],['Die','Doll_Skill_1_Die'],['SwitchOut','Doll_Skill_1_SwitchOut'],['Stun','Doll_Skill_1_Stun']])) throw Error('Changed original Makoto S1 aliases');
}
function captureSource(u) {
  const view = Object.assign(Object.create(Object.getPrototypeOf(u)), {...u,base:{...u.base},mem:{},buffs:u.buffs.slice(),tags:new Set(u.tags),
    profile:{hitSleep:u.profile.hitSleep},stats:u.stats,alive:false,deployed:false,removed:true});
  Object.defineProperty(view,'s',{value:structuredClone(u.s),enumerable:true}); return view;
}
export class MakotoSkillOneCombat {
  constructor(b,u,{contract,mayBegin}={}) {
    if (contract !== MAKOTO_S1_COMBAT_CONTRACT || typeof mayBegin !== 'function' || u.def.charId !== ID || u.deploySeq !== 0)
      throw Error('Fresh selected Makoto S1, exact combat contract and explicit persona predicate required');
    const record=selectedMakotoInputs(u); if(record.index!==0) throw Error('Fresh selected Makoto S1 required');
    verifyMakotoS1Combat();
    Object.assign(this,{b,u,record,mayBegin,seq:null,stopped:false,ended:false,phase:null,busy:false,accepting:false,
      facing:u.dir,visualSeq:0,visuals:new WeakSet(),handles:[],watchers:[],flights:new Map()});
  }
  valid() {return !this.stopped && !this.b.finished && this.seq!==null && present(this.u) && this.u.deploySeq===this.seq;}
  allowed() {try {const yes=this.mayBegin(); return this.valid() && yes===true;} catch(error) {this.phase=null; throw error;}}
  model() {const face=this.facing==='UP'?'Back':'Front'; return {...evidence.models[ID][face],...clocks.models[face]};}
  keys() {return new Set(absoluteRangeKeys(this.record.skillRangeGrid,this.u.tileR,this.u.tileC,this.u.dir));}
  healable(t) {return present(t) && !t.hidden && t.side==='ally' && t.kind!=='device' && !t.s.flags.untargetable
    && !t.s.flags.healFree && this.b.allySelectable(t,this.u) && (t===this.u || !t.s.flags.noHeal && !t.profile?.noHeal);}
  enemyLegal(t) {return present(t) && !t.hidden && t.side==='enemy' && canTargetEnemy(this.u,t,{canHitFly:false,groundOnly:true})
    && (!t.s.flags.camou || !!t.blockedBy);}
  choices() {
    const keys=this.keys(), heals=this.b.allyUnits.filter(t=>this.healable(t) && t.hp/t.s.maxHp<=.5 && bodyInKeys(t,keys))
      .sort((a,z)=>a.hp/a.s.maxHp-z.hp/z.s.maxHp || z.deploySeq-a.deploySeq || String(a.id).localeCompare(String(z.id)));
    if(heals.length) return {kind:'heal',target:heals[0]};
    const enemies=this.b.enemies.filter(t=>this.enemyLegal(t)&&bodyInKeys(t,keys));
    const target=sortEnemyTargets(this.b,this.u,enemies,'normal')[0]; return target?{kind:'attack',target}:null;
  }
  visual(clip,speed=1,loop=false) {
    if(!this.valid()) return null;
    if(!Object.hasOwn(this.model().exactDurations,clip)) throw Error('Missing original Makoto S1 clip');
    const v={clip,speed,loop,...(loop?{replace:true}:{playId:`makoto:s1:${this.seq}:${++this.visualSeq}`})};
    this.visuals.add(v); this.u.mem.regularFormVisual=v; this.u.mem.regularVisualDirection=this.facing; return v;
  }
  idle() {this.facing=this.u.dir; this.visual('Doll_Skill_1_Idle',1,true);}
  begin(choice) {
    if(this.busy || this.phase || !this.valid() || !choice || !['heal','attack'].includes(choice.kind)) return false;
    this.busy=true;
    try {
      const {u}=this,t=choice.target,life=t?.deploySeq,epoch=u.attackControlEpoch;
      if(!this.allowed() || !this.valid() || !u.canAct || u.hidden || u.s.flags.disarm || epoch!==u.attackControlEpoch
        || !retained(t,life,choice.kind==='heal'?'ally':'enemy') || !(choice.kind==='heal'?this.healable(t):this.enemyLegal(t))) return false;
      // Entry is also callable by the future owning kit. It cannot turn that
      // bridge into an override of the original range, HP gate or branch priority.
      const current=this.choices();
      if(this.phase || !this.valid() || epoch!==u.attackControlEpoch || !u.canAct || u.hidden || u.s.flags.disarm
        || current?.kind!==choice.kind || current.target!==t || t.deploySeq!==life) return false;
      const dx=t.x-u.x,dy=t.y-u.y;
      if(Math.hypot(dx,dy)>1e-8) this.facing=Math.abs(dy)>Math.abs(dx)?dy>0?'UP':'DOWN':dx<0?'LEFT':'RIGHT';
      const speed=u.base.bat/u.s.interval,marker=this.model().eventPayloads.Doll_Skill_1_Attack;
      if(marker?.length!==1 || marker[0].name!=='OnAttack' || marker[0].time!==0.800000011920929) throw Error('Changed original Makoto S1 marker');
      const releaseAge=marker[0].time,period=Math.max(u.s.interval,releaseAge/speed),p={...choice,life,epoch,speed,releaseAge,
        untilAge:period*speed,age:0,lastAt:this.b.time,released:false,accepted:false};
      this.phase=p; u.atkCd=period; p.visual=this.visual('Doll_Skill_1_Attack',speed*u.s.slowDownRate); return true;
    } finally {this.busy=false;}
  }
  admit(ts) {
    const p=this.phase;
    return this.accepting && this.valid() && this.allowed() && this.valid() && this.phase===p && p && !p.accepted
      && this.u.canAct && !this.u.hidden && !this.u.s.flags.disarm && this.u.attackControlEpoch===p.epoch && due(p.age,p.releaseAge)
      && ts.length===1 && ts[0]===p.target && retained(p.target,p.life,p.kind==='heal'?'ally':'enemy')
      && (p.kind==='heal'?this.healable(p.target):this.enemyLegal(p.target));
  }
  release(ts,info) {
    if(!this.admit(ts)) return false;
    const p=this.phase; p.accepted=true;
    if(p.kind==='heal') this.b.heal(this.u,p.target,this.u.s.atk*this.u.s.atkScaleMul*this.record.bb['attack@heal_scale'],
      {isAttack:true,isSkill:false,isProjectile:false,attackId:info.attackId,tags:['makoto:s1-heal']});
    else this.emit(p.target,p.life,info.attackId);
    return true;
  }
  emit(target,life,attackId) {
    const {b,u}=this, flight={target,life,sourceLife:this.seq,snapshot:captureSource(u),atk:u.s.atk*u.s.atkScaleMul,
      scale:this.record.bb['attack@atk_scale'],attackId,retired:false,claimed:false};
    let projectile;
    projectile=b.addProjectile({from:u,target,source:u,speed:10,maxAge:10,visual:'orb',
      data:{arkpediaTrackedVisual:true,projectileKey:'projectile_chr_makoto_s1',makotoS1:true},onHit:()=>{
        if(flight.claimed || projectile.removed || !this.flights.has(projectile)) return; flight.claimed=true; this.flights.delete(projectile);
        if(!this.ended && !b.finished && retained(target,life,'enemy')) {
          const src=!flight.retired && present(u) && u.deploySeq===flight.sourceLife?u:flight.snapshot;
          b.dealDamage(src,target,{amount:flight.atk*flight.scale,type:'arts',isAttack:true,isSkill:false,isProjectile:true,
            applyWay:'ranged',attackId,tags:['makoto:s1']});
        }
        this.unwatch();
      }});
    this.flights.set(projectile,flight); if(b.finished) this.drain(); else this.watch();
  }
  tick() {
    if(!this.valid()) return;
    if(!this.allowed()) {this.phase=null; return;}
    if(!this.valid()) return;
    const {u,b}=this,p=this.phase;
    if(!u.canAct || u.hidden || u.s.flags.disarm || p && p.epoch!==u.attackControlEpoch) {
      this.phase=null;
      if(u.hidden) this.clearVisual();
      else if(!u.mem.regularFormVisual || this.visuals.has(u.mem.regularFormVisual)) this.idle();
      return;
    }
    if(p) {
      p.age+=sourceAbilityDelta(u,Math.max(0,b.time-p.lastAt),true)*p.speed; p.lastAt=b.time;
      if(u.mem.regularFormVisual===p.visual) p.visual.speed=p.speed*u.s.slowDownRate;
      if(!p.released && due(p.age,p.releaseAge)) {p.released=true; this.accepting=true; try {b.forceAttack(u,[p.target]);} finally {this.accepting=false;}}
      if(!this.valid() || this.phase!==p || !due(p.age,p.untilAge)) return;
      this.phase=null; this.idle();
    }
    if(u.atkCd>1e-8) return; const choice=this.choices(); if(choice) this.begin(choice);
  }
  trait() {return {noAttack:true,attackDrivenSkill:true,attack:'ranged',dmgType:'arts',heal:null,applyWay:'ranged',
    canHitFly:false,groundOnly:true,projectile:'none',maxTargets:1,maxTargetsByBlock:false,hitAllBlocked:false,allInRange:false,
    hits:1,hitsFn:null,chain:null,splashRadius:0,windup:0,attackVisual:'none',requiresAcceptedLaunch:true,
    acceptAreaAttack:(_b,_u,_p,ts)=>this.admit(ts),launchAreaAttack:(_b,_u,_p,ts,info)=>this.release(ts,info)};}
  watch() {
    if(this.watchers.length || !this.flights.size) return;
    this.watchers=[this.b.on('tick',()=>{
      for(const [p,f] of this.flights) {if(!present(this.u) || this.u.deploySeq!==f.sourceLife) f.retired=true;
        if(!this.b.projectiles.list.includes(p) && !this.b.projectiles.arriving.includes(p)) this.flights.delete(p);}
      this.unwatch();}),this.b.on('battleEnd',()=>this.drain())];
  }
  unwatch() {if(this.flights.size) return; for(const h of this.watchers) this.b.off(h); this.watchers=[];}
  clearVisual() {if(this.seq===this.u.deploySeq && this.visuals.has(this.u.mem.regularFormVisual)) {delete this.u.mem.regularFormVisual; delete this.u.mem.regularVisualDirection;}}
  drain() {this.ended=true; this.b.removeProjectiles(p=>this.flights.has(p)); this.flights.clear(); this.unwatch();}
  install() {
    if(this.stopped || this.handles.length || this.u.mem.makotoS1Combat && this.u.mem.makotoS1Combat!==this) throw Error('Makoto S1 combat cannot be reinstalled');
    this.u.mem.makotoS1Combat=this; const {b,u}=this;
    this.handles=[b.on('deploy',({unit,move})=>{if(unit!==u || move) return; if(this.seq!==null) {if(this.seq!==u.deploySeq) this.stop(); return;} this.seq=u.deploySeq;},{owner:u}),
      b.on('tick',()=>{if(this.seq!==null && !this.valid()) this.stop(); else this.tick();},{owner:u}),
      ...['removed','death'].map(event=>b.on(event,({unit})=>{if(unit===u) this.stop();},{owner:u})),
      b.on('palsyTriggered',({unit})=>{if(unit===u) {this.phase=null; if(this.valid() && this.allowed()) this.idle();}},{owner:u}),
      b.on('battleEnd',()=>{this.stop(); this.drain();},{owner:u})];
  }
  stop() {
    if(this.stopped) return; this.stopped=true; this.phase=null; this.accepting=false;
    for(const f of this.flights.values()) f.retired=true;
    for(const h of this.handles) this.b.off(h); this.handles=[];
    this.clearVisual();
    if(this.b.finished) this.drain();
  }
}
