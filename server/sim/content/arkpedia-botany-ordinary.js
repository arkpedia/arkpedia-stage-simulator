// SPDX-License-Identifier: GPL-3.0-or-later
// Ordinary attack component only. Full Botany skill/public admission is separate.
import evidence from '../../../data/arkpedia-native-operators/char_4223_botany.json' with {type: 'json'};
import clocks from '../../../data/arkpedia-botany-clocks.json' with {type: 'json'};
import {BOTANY_ID, botanyNativeInputs, selectedBotanyInputs} from './arkpedia-botany-source.js';
import {canTargetEnemy, sortEnemyTargets} from '../targeting.js';
import {bodyInKeys} from '../body.js';

export const BOTANY_ORDINARY_CONTRACT = Object.freeze({
  scope: 'Original selected Botany single-input Arts attack and independent speed-ten projectile; no skill or public registration.',
  mapping: 'Native input selector source2 maps to shared normal-path priority and one retained ground/air enemy life. Source-capped playback samples min(1,BAT/interval) at phase entry; the original .5-second marker is independent of projectile flight. A matching present source supplies current ATK/attack scale and normal damage attributes at arrival. Retired/replaced sources use an explicit launch-attribute view and old ledger, following the existing source-snapshot projectile pattern. Born transport is finite, claims arrival before callbacks and cannot hit a replacement recipient.',
  limitations: 'Native numeric aliases, target/FSM ordering, Start timing, source-invalid attribute lookup and launch snapshot fallback are local mappings. Compiled per-callback source lookup, skills, original public artwork delivery, modules, native effects/audio and game-frame/pixel parity remain unverified.',
  frameParity: false,
});
const present = u => u?.alive && u.deployed && !u.removed && !u._removing;
const due = (a, z) => a >= z - 1e-7;
const legal = (u, t) => present(t) && canTargetEnemy(u, t, {canHitFly: true, groundOnly: false});
const retained = t => present(t) && !t.hidden && t.side === 'enemy';
const ordinaryShot = Object.freeze({clip: 'Attack', scale: 1, projectileSpeed: 10, isSkill: false, tag: 'botany:ordinary'});

export function verifyBotanyOrdinarySource(n = botanyNativeInputs()) {
  const a=n.modes[0].attack,parts=n.projectiles.projectile_chr_botany.flatMap(r=>r.components.map(c=>c.data));
  const p=parts.find(d=>d._lifeTime!=null),m=parts.find(d=>d._speed!=null);
  if(a._animKey!=='Attack'||a._endAnimKey!=='Idle'||a._waitForAttackEvent!==1||a._selectTargetTiming!==0
    ||a._selectTargetSource!==2||a._affectedBySlowDown!==0||a._maxAnimScale!==1||a._timeMode!==0
    ||a._projectileKey!=='projectile_chr_botany'||a._useCachedAtkOnly!==0||a._epDamageRatio!==0
    ||a._elementDamageType!==0||a._damageType!==2||a._activeBuffs.length!==0||p._canHitSameTargetMultipleTimes!==0
    ||p._maxHitNum!==1||p._managedBySource!==0||p._stopWhenSourceInvalid!==0||p._lifeTime!==10
    ||p._alwaysHitTraceTargetInTheEnd!==1||p._fixDealHitTargetLeft!==1||p._stopAfterMaxHit!==1
    ||m._speed!==10)throw Error('Changed original Botany ordinary inputs');
}
// The source view preserves the old stats ledger and read-only lookup interface.
// It is deliberately a distinct nonliving entity once the original source life ends.
function captureSource(u){
  const view=Object.assign(Object.create(Object.getPrototypeOf(u)),{...u,base:{...u.base},mem:{},buffs:u.buffs.slice(),tags:new Set(u.tags),
    profile:{hitSleep:u.profile.hitSleep},stats:u.stats,alive:false,deployed:false,removed:true});
  Object.defineProperty(view,'s',{value:structuredClone(u.s),enumerable:true});return view;
}

export class BotanyOrdinaryAttacks {
  constructor(b, u, {contract, mayBegin} = {}) {
    if (contract !== BOTANY_ORDINARY_CONTRACT || typeof mayBegin !== 'function' || u.deploySeq !== 0 || u.def.charId !== BOTANY_ID)
      throw Error('Fresh selected Botany, exact ordinary contract and explicit skill composition predicate required');
    verifyBotanyOrdinarySource();
    this.b = b; this.u = u; this.record = selectedBotanyInputs(u); this.mayBegin = mayBegin;
    this.seq = null; this.stopped = false; this.ended = false; this.accepting = false;
    this.phase = null; this.facing = u.dir; this.visualSeq = 0; this.bornUntil = Infinity;
    this.handles = []; this.watchers = []; this.flights = new Map();
  }
  valid() { return !this.stopped && !this.b.finished && present(this.u) && this.u.deploySeq === this.seq; }
  model() { const face = this.facing === 'UP' ? 'Back' : 'Front';
    return {...evidence.models[BOTANY_ID][face], ...clocks.models[face]}; }
  visual(clip, speed = 1, loop = false) {
    if (this.model().exactDurations[clip] == null) throw Error('Missing original Botany clip: ' + clip);
    this.u.mem.regularVisualDirection = this.facing;
    this.u.mem.regularFormVisual = {clip, speed, loop, ...(loop ? {replace:true} : {}),
      ...(!loop ? {playId: `botany:ordinary:${this.seq}:${++this.visualSeq}`} : {})};
    this.u.mem.regularDeathVisual = this.facing === 'UP' ? {hide: true, duration: 1} : {clip: 'Die', die: 'Die', duration: 1};
  }
  idle() { this.facing = this.u.dir; this.visual('Idle', 1, true); }
  face(t) { const x = t.x - this.u.x, y = t.y - this.u.y;
    if (Math.hypot(x, y) > 1e-8) this.facing = Math.abs(y) > Math.abs(x) ? y > 0 ? 'UP' : 'DOWN' : x < 0 ? 'LEFT' : 'RIGHT'; }
  choices({limit = 1} = {}) {
    if (this.b.rangeChanged(this.u)) this.b._refreshRange(this.u);
    const eligible = t => legal(this.u, t);
    const candidates = this.b.enemies.filter(t => eligible(t)
      && bodyInKeys(t, this.u.rangeKeySet));
    // The shared regular-stage rule keeps an attacker able to hit its own
    // blocker even when the source's long-range grid omits adjacent tiles.
    for (const t of this.b.blockedTargets(this.u, {canHitFly: true, canTarget: (_u, e) => eligible(e)}))
      if (!candidates.includes(t)) candidates.push(t);
    return sortEnemyTargets(this.b, this.u, candidates, 'normal').slice(0, limit);
  }
  begin(target, shot = ordinaryShot) {
    this.face(target);
    const speed = Math.min(1, this.u.base.bat / this.u.s.interval);
    const releaseAge = this.model().eventPayloads[shot.clip][0].time;
    const period = Math.max(this.u.s.interval, releaseAge / speed);
    this.phase = {target, life: target.deploySeq, epoch: this.u.attackControlEpoch, shot,
      speed, releaseAge, age: 0, lastAt: this.b.time, untilAge: period * speed,
      released: false, accepted: false};
    this.u.atkCd = period; this.visual(shot.clip, speed);
  }
  admit(targets) {
    const p = this.phase;
    return this.accepting && this.valid() && !this.u.hidden && this.mayBegin() && this.u.canAct && !this.u.s.flags.disarm
      && p && !p.accepted && p.epoch === this.u.attackControlEpoch && due(p.age, p.releaseAge)
      && targets.length === 1 && targets[0] === p.target && targets[0].deploySeq === p.life && retained(targets[0]);
  }
  release(targets, info) {
    if (!this.admit(targets)) return false;
    const p = this.phase, target = targets[0], sourceLife = this.seq;
    p.accepted = true;
    const snapshot=captureSource(this.u),flight={target,life:p.life,sourceLife,snapshot,retired:false};
    let projectile,claimed=false;
    projectile=this.b.addProjectile({from:this.u,target,source:this.u,speed:p.shot.projectileSpeed,maxAge:10,
      visual:'orb',data:{arkpediaTrackedVisual:true,projectileKey:p.shot.projectileKey??'projectile_chr_botany',botanyOrdinary:!p.shot.isSkill},
      onHit:()=>{
        if(claimed)return;claimed=true;this.flights.delete(projectile);
        if(!this.ended&&!this.b.finished&&target.deploySeq===p.life&&retained(target)){
          const source=()=>!flight.retired&&present(this.u)&&this.u.deploySeq===sourceLife?this.u:snapshot;
          this.impact({source,target,life:p.life,shot:p.shot,info});
        }
        this.unwatch();
      }});
    this.flights.set(projectile,flight);
    if (this.b.finished) this.drain(); else this.watch();
    return true;
  }
  impact({source,target,shot,info}){
    const u=source();this.b.dealDamage(u,target,{amount:u.s.atk*u.s.atkScaleMul*shot.scale,type:'arts',isAttack:true,
      isProjectile:true,isSkill:shot.isSkill,attackId:info.attackId,applyWay:'ranged',tags:[shot.tag]});
  }
  tick() {
    if (!this.valid()) return;
    if (!this.mayBegin()) { this.phase = null; return; }
    if (!due(this.b.time, this.bornUntil)) return;
    const u = this.u; let p = this.phase;
    if (u.hidden || !u.canAct || u.s.flags.disarm || p && p.epoch !== u.attackControlEpoch) {
      this.interrupted(p); this.phase = null; if (this.valid()) this.idle(); return;
    }
    if (p) {
      p.age += Math.max(0, this.b.time - p.lastAt) * p.speed; p.lastAt = this.b.time;
      if (!p.released && due(p.age, p.releaseAge)) {
        p.released = true; this.accepting = true;
        try { this.b.forceAttack(u, [p.target]); } finally { this.accepting = false; }
      }
      if (!this.valid() || this.phase !== p || !due(p.age, p.untilAge)) return;
      this.completed(p);
      if (!this.valid() || this.phase !== p) return;
      this.phase = null;
    }
    if (u.atkCd > 1e-8) return;
    const target = this.choices()[0]; if (target) this.begin(target); else this.idle();
  }
  interrupted(_phase) {}
  completed(_phase) {}
  trait() { return {noAttack: true, attackDrivenSkill: true, attack: 'ranged', dmgType: 'arts', canHitFly: true,
    groundOnly: false, heal: null, projectile: 'none', priority: 'normal', maxTargets: 1, maxTargetsByBlock: false,
    hitAllBlocked: false, allInRange: false, hits: 1, hitsFn: null, chain: null, splashRadius: 0, windup: 0, attackVisual:'none',
    requiresAcceptedLaunch: true, acceptAreaAttack: (_b, _u, _p, ts) => this.admit(ts),
    launchAreaAttack: (_b, _u, _p, ts, info) => this.release(ts, info)}; }
  watch() {
    if (this.watchers.length || !this.flights.size) return;
    this.watchers = [this.b.on('tick', () => {
      for (const p of this.flights.keys()) if (!this.b.projectiles.list.includes(p) && !this.b.projectiles.arriving.includes(p)) this.flights.delete(p);
      this.unwatch();
    }), this.b.on('battleEnd', () => this.drain())];
  }
  unwatch() { if (this.flights.size) return; for (const h of this.watchers) this.b.off(h); this.watchers = []; }
  drain() { this.ended = true; this.b.removeProjectiles(p => this.flights.has(p)); this.flights.clear(); this.unwatch(); }
  install() {
    if (this.handles.length || this.stopped) throw Error('Botany ordinary attacks cannot be reinstalled');
    this.handles = [this.b.on('deploy', ({unit, move}) => {
      if (unit !== this.u || move) return;
      this.seq = unit.deploySeq; this.facing = unit.dir;
      this.bornUntil = this.b.time + this.model().exactDurations.Start;
      unit.mem.regularBornUntil = this.bornUntil; this.visual('Start');
    }, {owner: this.u}),
    this.b.on('tick', () => { if (this.seq !== null && !this.valid()) this.stop(); else this.tick(); }, {owner: this.u}),
    this.b.on('removed', ({unit}) => { if (unit === this.u) this.stop(); }, {owner: this.u}),
    this.b.on('death', ({unit}) => { if (unit === this.u) this.stop(); }, {owner: this.u}),
    this.b.on('battleEnd', () => { this.stop(); this.drain(); }, {owner: this.u})];
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.phase = null; this.accepting = false;
    for(const f of this.flights.values())f.retired=true;
    for (const h of this.handles) this.b.off(h); this.handles = [];
    delete this.u.mem.regularFormVisual; delete this.u.mem.regularVisualDirection;
    if (this.b.finished) this.drain();
  }
}
