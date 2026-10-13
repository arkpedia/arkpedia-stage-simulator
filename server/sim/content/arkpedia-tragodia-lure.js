// SPDX-License-Identifier: GPL-3.0-or-later
// Opt-in S2 diagnostic; this does not register Tragodia in the public roster.
import evidence from '../../../data/arkpedia-tragodia-prefabs.json' with { type: 'json' };
import { TRAGODIA_ID as ID, tragodiaSourceComponent as component } from './arkpedia-tragodia-source.js';
import { prepareTragodiaOwnerSkills, TRAGODIA_OWNER_SKILLS_CONTRACT } from './arkpedia-tragodia-owner-skills.js';
import { normalizeToken, flattenBlackboard } from '../simdata.js';
import { sourceCandidate, summonCardId } from '../../../shared/arkpedia/summons.js';
import { canDeployInViewport } from '../../../shared/arkpedia/squad.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys, bodyDist } from '../body.js';

export const TRAGODIA_LURE_CONTRACT = Object.freeze({
  scope: 'Source-selected Blood’s Whisper deck, strict attraction and S2 detonation diagnostic; no public approval',
  mapping: 'One 5-DP, zero-slot low-ground lure while S2 is active, with its own 25-second recharge after finish. Original token stats remain independent of host stats. Up to four distinct reachable enemies are acquired, elites/leaders first, with the original projectile scan interval and ten-second lifetime. Owned attraction retains targets outside range, ignores status resistance and ends with the lure or target disappearance. Arrival within the selected radius or the ten-second timeout starts the original End clip; native predelay plus On_Attack releases it. Finish selects the original x-1 grid, caches host ATK once and admits independent Slow/damage lifetimes: first 0.1-second receipt then selected interval, Nervous before Arts.',
  limits: 'Selector numeric aliases, accepted-hit accounting, immediate first scan, strict path smoothing, Begin/End event ordering, combined predelay/event clock, finish-on-withdrawal, independent damage resistance duration and cached source lifetime are explicit simulator policies, not recovered compiled Unity dispatch. Arts scaling follows the selected English skill description; native FixedValueDamage has no explicit atk_scale operand, so the compiled scale transport remains unresolved. Native particles, shaders and audio, S3 cage, delivered artwork and public review remain held.',
  frameParity: false,
});
export const TRAGODIA_LURE_ID = 'token_10054_phatm2_encdool';
const TOKEN = TRAGODIA_LURE_ID, marker = 'token_phatm2_encdool_target';
const present = u => u?.alive && u.deployed && !u._removing;
const live = u => present(u) && !u.hidden;
const due = (b, at) => b.time + 1e-8 >= at;
const selectable = Object.freeze({ canHitFly: true });
const actions = key => evidence.templates[key].eventToActions;
// Native max-stack 1 / non-independent producer: reserve before status hooks.
const attractionOwners = new WeakMap();

function verify() {
  const ctl = component('9056605678497710654'), attract = component('9175765109509538366');
  const selector = component('-7319848684153398234'), projectile = component('-753584899020219354');
  const scan = component('-1084758919623992282'), arrival = component('-1970970520776041153');
  const boom = component('3976805645232807231'), range = component('-2615134406389424833');
  const target = attract._activeBuffs[0], finish = actions('token_phatm2_encdool_kill').ON_BUFF_FINISH;
  const dot = actions('token_phatm2_encdool_host').ON_BUFF_START[2];
  const damage = actions('phatm2_s_2[damage]').ON_BUFF_TRIGGER;
  if (ctl._occupiedRemainingCharacterCnt !== 0 || ctl._buildCondition.buildableType !== 1
    || ctl._buildCondition.limitByHostAttackRange || ctl._buildCondition.needSpecifyDirection
    || ctl._buildCondition._excludeOccupiedByWalkEnemy || ctl._withdrawCostRecoverRatio !== 0
    || attract._atkScale !== 0 || target.durationKey !== 'duration' || target.statusResistable !== 1
    || target.refreshRemainingTimeWhenStackMax || !target.attributes.abnormalFlags.includes(41)
    || selector._targetMotion !== 3 || selector._postFilter !== 53 || selector._maxTargetKey !== 'max_target'
    || !selector._checkReachableToOwner || !selector._avoidObstacleLike || !selector._filterAbnormalImmune
    || selector._abnormalFlagImmune !== 41 || projectile._lifeTime !== 10
    || projectile._getLifeTimeFromBB !== 0 || !projectile._getMaxHitNumFromBB || !projectile._stopAfterMaxHit
    || projectile._canHitSameTargetMultipleTimes || projectile._actionController._detachBuffsWhenTargetLeave !== 0
    || scan._interval !== .10000000149011612 || scan._waitFirstPeriod
    || arrival._filterBuffSource || arrival._buffs[0] !== marker
    || boom._animKey !== 'End' || !boom._waitForAttackEvent || boom._preDelay !== .10000000149011612
    || range._limitTargetNum || range._forceIgnoreCamouflage
    || finish[0]._attributeType !== 'ATK' || finish[0]._blackboardKey !== 'cached_atk'
    || finish[2]._abilityName !== 'Range' || finish[2]._isDerivedBuff
    || dot._isDerivedBuff || !dot._buffData.disableOverride || dot._buffData.durationKey !== 'buff_time'
    || dot._buffData.firstTriggerInterval !== .10000000149011612
    || damage[0]._elementType !== 'SANITY' || damage[0]._damageScaleKey !== 'ep_damage_ratio_token'
    || !damage[0]._allowNoSourceDamage || damage[2]._damageType !== 'MAGICAL' || damage[2]._attackType !== 'BUFF')
    throw Error('Unreviewed Tragodia native lure controller');
  const model = evidence.tokenModels[TOKEN].Single;
  if (model.eventPayloads.End[0].name !== 'On_Attack' || model.eventPayloads.End[0].time !== 1.4333332777023315
    || model.durations.Start !== 1 || model.durations.End !== 1.5)
    throw Error('Unreviewed Tragodia native lure clips');
}

export function selectedTragodiaLure(record) {
  if (record.index !== 1) throw Error('Blood’s Whisper requires selected S2');
  const selected = record.tokenRecords[TOKEN], raw = selected.source, phase = selected.phase;
  const [lo, hi] = [phase.attributesKeyFrames[0], phase.attributesKeyFrames.at(-1)];
  const fraction = hi.level === lo.level ? 0 : (record.build.level - lo.level) / (hi.level - lo.level);
  const stats = Object.fromEntries(Object.entries(lo.data).filter(([, v]) => typeof v === 'number')
    .map(([k, v]) => [k, v + (hi.data[k] - v) * fraction]));
  const talents = raw.talents.map(t => sourceCandidate(t.candidates, record.build)).filter(Boolean);
  const talent = flattenBlackboard(talents[0]?.blackboard);
  const rangeGrid = evidence.tables.ranges[phase.rangeId].grids.map(g => [g.row, g.col]);
  for (const k of ['atk_scale', 'ep_damage_ratio_token', 'buff_time', 'interval_damage', 'max_target']) if (record.bb[k] !== selected.bb[k])
    throw Error(`Unreviewed Blood’s Whisper owner/token parameter ${k}`);
  if (stats.maxHp !== 100 || stats.atk !== 100 || stats.cost !== 5 || stats.blockCnt !== 0
    || stats.respawnTime !== 25 || stats.maxDeployCount !== 1 || talent.max_target !== 4 || talent.duration !== 10)
    throw Error('Unreviewed Blood’s Whisper selected stats');
  return { ...selected, ...normalizeToken(TOKEN, { name: raw.name, position: raw.position,
    profession: raw.profession, stats, rangeGrid, talents,
    skill: { ...selected.skill, ...selected.skill.spData, skillId: selected.skillId } }),
    bb: selected.bb, models: selected.models, talent };
}

export class TragodiaLureDeck {
  constructor(core) {
    this.core = core; this.b = core.b; this.u = core.u; this.record = selectedTragodiaLure(core.record);
    this.stock = 0; this.readyAt = Infinity; this.point = null; this.generation = 0;
    this.stopped = false; this.placing = false; this.finishing = 0; this.handles = []; this.dots = new Set();
    const deck = this;
    this.state = { key: summonCardId(ID), ownerId: ID, owner: this.u, tokenId: TOKEN,
      record: this.record, deck: this,
      config: Object.freeze({ deploymentSlotCost: 0, chooseFacing: false, requiresActiveSkill: true,
        limitByHostAttackRange: false, excludeWalkingEnemy: false, refundRatio: 0 }),
      get stock() { return deck.stock; }, get readyAt() { return deck.readyAt; } };
  }
  valid(s) { return !this.stopped && this.core.valid() && live(s?.unit) && s.unit.deploySeq === s.seq; }
  own() { return present(this.point?.unit) ? [this.point.unit] : []; }
  born() { this.stock = 1; this.readyAt = this.b.time; }
  placementError(row, col) {
    const b = this.b;
    if (!canDeployInViewport(b.viewport)) return 'Open the fullscreen workspace to deploy.';
    if (b.finished) return 'Battle has ended.';
    if (this.stopped || !this.core.valid() || !live(this.u)) return 'Deploy Tragodia first.';
    if (!this.core.skills.active() || this.core.skills.mode !== 2) return 'Activate S2 first.';
    if (this.placing || this.stock <= 0 || this.point) return 'Blood’s Whisper is already placed.';
    if (!due(b, this.readyAt)) return 'Blood’s Whisper is still redeploying.';
    if (!Number.isInteger(row) || !Number.isInteger(col) || !b.grid.inRect(row, col)) return 'Select a tile on the map.';
    const tile = b.grid.tile(row, col);
    if (tile.height !== 'LOW' || !['MELEE', 'ALL'].includes(tile.build) || b.grid.isObstacle(row, col)) return 'Choose a low-ground deployment tile.';
    if (b.unitAt(row, col) || b.tileReservation(row, col) || b.downOn(row, col)) return 'Tile is occupied.';
    if (b.dp < this.record.stats.cost) return 'Not enough DP.';
    return null;
  }
  visual(s, clip, loop = false) {
    s.unit.mem.regularModelFacing = 'front';
    s.unit.mem.regularFormVisual = { clip, loop, speed: 1 };
    s.unit.mem.regularDeathVisual = { clip: 'End', die: 'End', duration: this.record.models.Single.durations.End };
  }
  place(row, col) {
    const error = this.placementError(row, col); if (error) throw Error(error);
    const b = this.b, paid = this.record.stats.cost;
    this.placing = true; this.stock = 0; b.addDp(this.u.ownerId, -paid);
    let s;
    try {
      const token = b.spawnToken(this.u, TOKEN, row, col, { def: this.record, dir: 'RIGHT',
        kit: { talents: [], trait: { noAttack: true, noBlock: true },
          skill: { kind: 'passive', trigger: { rule: 'NEVER' } },
          install: (_b, unit) => {
            unit.deploymentSlotCost = 0; unit.mem.regularSummonCard = this.state.key;
            b.addBuff(unit, { key: 'tragodia:lure-controller', persist: true, allowDead: true,
              flags: { noMove: true }, onTick: () => { if (s) this.tickPoint(s); } });
          } } });
      if (!token || !this.core.valid() || !live(token)) {
        if (present(token)) b._remove(token, 'tragodia-placement-cancelled', null, true);
        throw Error('Blood’s Whisper placement failed.');
      }
      s = { unit: token, seq: token.deploySeq, generation: ++this.generation, targets: new Map(), seen: new Set(),
        startedAt: b.time, nextScan: b.time, timeoutAt: b.time + this.record.bb.interval,
        mode: 'born', finished: false, releaseAt: Infinity };
      this.point = s; this.readyAt = Infinity; this.visual(s, 'Start');
      this.tickPoint(s); return token;
    } catch (err) {
      if (!s) { b.addDp(this.u.ownerId, paid); if (!this.stopped && this.core.valid()) this.stock = 1; }
      throw err;
    } finally { this.placing = false; }
  }
  keys(s) { return new Set(absoluteRangeKeys(this.record.rangeGrid, s.unit.tileR, s.unit.tileC, 'RIGHT', 0)); }
  reachable(s, t) {
    return t.motion === 'FLY' || !!this.b.grid.waypoints(Math.round(t.y), Math.round(t.x),
      s.unit.tileR, s.unit.tileC, { avoidObstacleLike: true });
  }
  dropTarget(s, t, entry = s.targets.get(t)) {
    if (s.targets.get(t) === entry) s.targets.delete(t);
    if (entry && attractionOwners.get(t) === entry) attractionOwners.delete(t);
    if (entry?.buff) this.b.removeBuff(t, entry.buff);
  }
  acquire(s) {
    const b = this.b, keys = this.keys(s), limit = this.record.talent.max_target;
    const candidates = b.enemies.filter(t => live(t) && !s.seen.has(t) && canTargetEnemy(s.unit, t, selectable)
      && (!t.s.flags.camou || !!t.blockedBy) && !t.def.immune.has('attract')
      && !attractionOwners.has(t) && !t.buffs.some(v => v.data?.tragodiaLureTarget)
      && bodyInKeys(t, keys) && this.reachable(s, t));
    sortEnemyTargets(b, s.unit, candidates);
    const elite = t => t.isBoss || ['ELITE', 'BOSS'].includes(t.def.rank) ? 0 : 1;
    candidates.sort((a, z) => elite(a) - elite(z));
    for (const t of candidates) {
      if (!this.valid(s) || s.mode === 'ending' || s.seen.size >= limit) break;
      const seq = t.deploySeq, k = `tragodia:lure:${s.unit.id}:attract`;
      if (attractionOwners.has(t)) continue;
      const entry = { seq, buff: null }; s.targets.set(t, entry); attractionOwners.set(t, entry);
      const accepted = b.applyStatus(t, 'attract', { key: k, source: s.unit,
        duration: this.record.talent.duration, resistApplied: true, sourceStatusResistable: false,
        strictReachable: true, point: [s.unit.tileR, s.unit.tileC] });
      entry.buff = t.findBuff(k);
      if (!accepted || !entry.buff || !this.valid(s) || !live(t) || t.deploySeq !== seq || !this.reachable(s, t)) {
        this.dropTarget(s, t, entry); continue;
      }
      entry.buff.data.tragodiaLureTarget = true;
      const release = () => {
        if (s.targets.get(t) === entry) s.targets.delete(t);
        if (attractionOwners.get(t) === entry) attractionOwners.delete(t);
      };
      entry.buff.onRemove = release; entry.buff.onExpire = release;
      s.seen.add(t);
    }
  }
  beginEnd(s, reason) {
    if (!this.valid(s) || s.mode === 'ending' || s.finished) return;
    s.mode = 'ending'; s.reason = reason;
    s.releaseAt = this.b.time + component('3976805645232807231')._preDelay
      + this.record.models.Single.eventPayloads.End[0].time;
    this.visual(s, 'End');
  }
  tickPoint(s) {
    if (!this.valid(s)) return;
    for (const [t, entry] of s.targets) if (!live(t) || t.deploySeq !== entry.seq
      || !t.buffs.includes(entry.buff) || !this.reachable(s, t)) this.dropTarget(s, t, entry);
    if (s.mode === 'ending') {
      if (due(this.b, s.releaseAt)) this.finish(s, s.reason);
      return;
    }
    if (s.mode === 'born' && due(this.b, s.startedAt + this.record.models.Single.durations.Start)) {
      s.mode = 'idle'; this.visual(s, 'Loop', true);
    }
    if (due(this.b, s.timeoutAt)) { this.beginEnd(s, 'timeout'); return; }
    if (due(this.b, s.nextScan)) {
      s.nextScan += component('-1084758919623992282')._interval;
      this.acquire(s);
    }
    if (!this.valid(s)) return;
    // Native arrival selector accepts this named marker from any lure source.
    if (this.b.enemies.some(t => live(t) && bodyDist(t, s.unit.x, s.unit.y) <= this.record.bb.ability_range_radius + 1e-9
      && t.buffs.some(v => v.data?.tragodiaLureTarget))) this.beginEnd(s, 'arrival');
  }
  attachDamage(s, t, atk) {
    const b = this.b, bb = this.record.bb, source = this.u, seq = t.deploySeq;
    if (!t.def.immune.has('sluggish')) b.applyStatus(t, 'sluggish', { source, duration: bb.sluggish });
    if (!live(t) || t.deploySeq !== seq || b.finished) return;
    const duration = bb.buff_time * (1 - b.resistOf(t));
    const entry = { target: t, seq, buff: null, next: b.time + .10000000149011612, expiresAt: b.time + duration };
    const dispose = () => { this.dots.delete(entry); this.disposeRetired(); };
    this.dots.add(entry);
    entry.buff = b.addBuff(t, { key: `tragodia:lure:${s.unit.id}:${s.generation}:damage`, source,
      duration, onRemove: dispose, onExpire: dispose,
      onTick: () => {
        if (!live(t) || t.deploySeq !== seq || b.finished || due(b, entry.expiresAt)) {
          b.removeBuff(t, entry.buff); dispose(); return;
        }
        if (!due(b, entry.next)) return;
        entry.next += bb.interval_damage;
        const info = { canDodge: false, isAttack: false, isSkill: true, ignoreSelect: true,
          tags: ['tragodia:s2-lure-dot'] };
        b.dealDamage(source, t, { ...info, amount: atk * bb.ep_damage_ratio_token, type: 'element', element: 'neural' });
        if (live(t) && t.deploySeq === seq && !b.finished && t.buffs.includes(entry.buff))
          b.dealDamage(source, t, { ...info, amount: atk * bb.atk_scale, type: 'arts' });
      } });
    if (!entry.buff || !live(t) || t.deploySeq !== seq || b.finished) { b.removeBuff(t, entry.buff); dispose(); }
  }
  finish(s, reason, { remove = true, detonate = !this.b.finished } = {}) {
    if (!s || s.finished) return;
    s.finished = true; s.mode = 'finished';
    this.finishing++;
    try {
      const b = this.b, atk = this.u.s.atk, keys = this.keys(s);
      // Capture recipients before releasing derived attraction. Finish hooks may
      // retire either source or recipient; each admission rechecks that lifetime.
      const recipients = detonate ? b.enemies.filter(t => live(t) && canTargetEnemy(s.unit, t, selectable)
        && (!t.s.flags.camou || !!t.blockedBy) && bodyInKeys(t, keys)).map(t => ({ t, seq: t.deploySeq })) : [];
      for (const t of [...s.targets.keys()]) this.dropTarget(s, t);
      if (this.point === s) { this.point = null; this.readyAt = b.time + this.record.stats.respawnTime; }
      if (!this.stopped && this.core.valid()) this.stock = 1;
      if (remove && present(s.unit)) b._remove(s.unit, `tragodia-lure-${reason}`, null, true);
      for (const { t, seq } of recipients) if (!b.finished && live(t) && t.deploySeq === seq) this.attachDamage(s, t, atk);
    } finally { this.finishing--; this.disposeRetired(); }
  }
  retreat(token) {
    if (!canDeployInViewport(this.b.viewport) || this.b.finished || token !== this.point?.unit || !this.valid(this.point))
      throw Error('Select the current Blood’s Whisper in fullscreen.');
    this.finish(this.point, 'withdrawal'); return true;
  }
  install() {
    if (this.stopped || this.handles.length) throw Error('Blood’s Whisper cannot be installed twice');
    (this.b.regularSummons ??= new Map()).set(this.state.key, this.state);
    this.handles = [this.b.on('deploy', ({ unit, move }) => { if (unit === this.u && !move) this.born(); }),
      this.b.on('death', ({ unit }) => {
        if (unit === this.point?.unit) this.finish(this.point, 'removed', { remove: false });
        else if (this.point?.targets.has(unit)) this.dropTarget(this.point, unit);
        for (const entry of this.dots) if (entry.target === unit) this.dots.delete(entry);
        this.disposeRetired();
      }), this.b.on('enemyHidden', ({ enemy, hidden }) => { if (hidden && this.point?.targets.has(enemy)) this.dropTarget(this.point, enemy); }),
      this.b.on('battleEnd', () => {
        this.stop(); for (const entry of [...this.dots]) this.b.removeBuff(entry.target, entry.buff);
        for (const h of this.handles) this.b.off(h); this.handles = [];
      })];
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.stock = 0; this.readyAt = Infinity;
    if (this.point) this.finish(this.point, 'owner-finished');
    this.readyAt = Infinity;
    if (this.b.regularSummons?.get(this.state.key) === this.state) this.b.regularSummons.delete(this.state.key);
    // Non-derived damage buffs keep ticking on their targets after owner finish.
    // Battle-end owns final hook disposal and never admits new damage.
    this.disposeRetired();
  }
  disposeRetired() {
    if (!this.stopped || this.dots.size || this.point || this.finishing) return;
    for (const h of this.handles) this.b.off(h); this.handles = [];
  }
}

export function prepareTragodiaLure(b, u, { contract } = {}) {
  if (contract !== TRAGODIA_LURE_CONTRACT) throw Error('Tragodia requires the reviewed lure contract');
  if (u.def.skill?.id !== 'skchr_phatm2_2') throw Error('Blood’s Whisper requires selected S2');
  verify();
  const prepared = prepareTragodiaOwnerSkills(b, u, { contract: TRAGODIA_OWNER_SKILLS_CONTRACT });
  const deck = new TragodiaLureDeck(prepared.controller);
  const install = prepared.controller.install.bind(prepared.controller), stop = prepared.skills.stop.bind(prepared.skills);
  prepared.controller.install = () => { install(); deck.install(); };
  prepared.skills.stop = () => { deck.stop(); stop(); };
  return { ...prepared, deck };
}
