// SPDX-License-Identifier: GPL-3.0-or-later
// Explicit native-source tactical-point diagnostic; active skills and public approval are separate.
import evidence from '../../../data/arkpedia-mitm-prefabs.json' with { type: 'json' };
import { summonCardId } from '../../../shared/arkpedia/summons.js';
import { canDeployInViewport } from '../../../shared/arkpedia/squad.js';
import { flattenBlackboard as flat } from '../simdata.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { makeDamageInfo } from '../damage.js';
import { MITM_ID as ID, MITM_CORE_CONTRACT, prepareMitmCore,
  mitmSourceComponent as component } from './arkpedia-mitm.js';

export const MITM_DEVICE_CONTRACT = Object.freeze({
  scope: 'Selected Cherry-3 tactical point, ordinary token attack, accepted defeat/respawn and independent wreckage diagnostic',
  mapping: 'One zero-cost/zero-slot ground tactical point inside current host attack range. Initial/rebirth one-second Start warmup, source normal block attachment, one retained ground Physical input at the original hit event. Accepted fatal HP loss spawns unforced same-host wreckage on eligible source-cross cells before resting the original point. Wreckage has half max HP, one block, zero ATK/DEF and no attack/rebirth. Point restores after selected interval plus rebirth warmup. Owner finish removes every generation; card stock and point count do not include wreckage.',
  limits: 'Active skills, original artwork delivery and public approval remain held. Compiled RallyPoint withdrawal/fatal/HP/event ordering, abnormal numeric aliases, animation/FSM clocks, automatic tile selectors and Unity frame parity remain explicit local mappings. Manual point withdrawal maps to the same soft defeat transition. Native particle/shader/audio and modules remain unsupported.',
  frameParity: false,
});
const TOKEN = 'token_10037_mitm_trshrb';
const REST = 'mitm:point-rest', BLOCK = 'mitm:point-block', WASTE = 'mitm:wreckage';
const present = u => u?.alive && u.deployed && !u._removing;
const live = u => present(u) && !u.hidden;
const due = (b, time) => b.time + 1e-9 >= time;
const grid = id => evidence.tables.ranges[id].grids.map(g => [g.row, g.col]);

function verifyNative() {
  const attack = component('-8804709210525108281'), spawn = component('-113505676959385657');
  const selector = component('-5454132628107659321');
  const dead = evidence.templates['trshrb_t_1[dead_listener]'].eventToActions.ON_BEFORE_TRY_SET_HP_ZERO;
  if (attack._waitForAttackEvent !== 1 || attack._maxAnimScale !== 1 || attack._damageType !== 1
    || spawn._tokenId !== TOKEN || spawn._forceSpawn !== 0 || spawn._useOwnerHost !== 1
    || spawn._checkTokenMaxDeployCnt !== 0 || selector._options.buildableType !== 1
    || selector._options.checkHeightType !== 1 || selector._options.heightType !== 0
    || dead[2]._abilityName !== 'SpawnTrash' || !dead[3]._loadModeFromBlackboard
    || evidence.templates['trshrb_t_1[trash_born]'].eventToActions.ON_BUFF_START[0]._modeIndex !== 2)
    throw Error('Unreviewed Mitm tactical-point source');
}

export class MitmDeviceDeck {
  constructor(core) {
    this.core = core; this.b = core.b; this.u = core.u; this.record = core.record.token;
    this.talent = flat(this.record.talents[0].blackboard);
    this.stock = 0; this.readyAt = Infinity; this.point = null; this.tokens = new Map();
    this.stopped = false; this.handles = []; this.generation = 0;
    if (this.record.id !== TOKEN || this.record.stats.cost !== 0 || this.record.stats.blockCnt !== 0
      || this.record.native.deploymentSlotCost !== 0 || this.record.native.chooseFacing
      || !this.record.native.limitByHostAttackRange || this.talent.block_cnt !== 1
      || this.talent.interval !== [20, 17, 15][core.record.build.elite])
      throw Error('Unreviewed Cherry-3 selected source');
    const deck = this;
    this.state = { key: summonCardId(ID), ownerId: ID, owner: this.u, tokenId: TOKEN,
      record: this.record, deck: this,
      config: Object.freeze({ deploymentSlotCost: 0, chooseFacing: false, tacticalPoint: true,
        limitByHostAttackRange: true, healFree: true, noAttack: true, refundRatio: 0 }),
      get stock() { return deck.stock; }, get readyAt() { return deck.readyAt; } };
  }
  own() { return present(this.point?.unit) ? [this.point.unit] : []; }
  all() { return [...this.tokens.keys()].filter(present); }
  born() { this.stock = 1; this.readyAt = this.b.time; }
  placementError(row, col) {
    const { b } = this;
    if (!canDeployInViewport(b.viewport)) return 'Open the fullscreen workspace to deploy.';
    if (b.finished) return 'Battle has ended.';
    if (!this.core.valid() || this.u.hidden) return 'Deploy Mitm first.';
    if (this.placing || !this.stock || this.own().length) return 'Tactical point is already placed.';
    if (!Number.isInteger(row) || !Number.isInteger(col) || !b.grid.inRect(row, col)) return 'Select a tile on the map.';
    if (!this.u.rangeKeySet.has(row * 21 + col)) return "Choose a tile inside Mitm's attack range.";
    if (!['ALL', 'MELEE'].includes(b.grid.tile(row, col).build)) return 'Choose a melee tile.';
    if (b.unitAt(row, col)) return 'Tile is occupied.';
    if (b.tileReservation(row, col) || b.downOn(row, col)) return 'Tile is reserved for an operator return.';
    return null;
  }
  visual(state, clip, loop = false, speed = 1) {
    state.unit.mem.regularModelFacing = 'front';
    state.unit.mem.regularFormVisual = { clip, loop, speed };
    state.unit.mem.regularDeathVisual = { clip: 'Die', die: 'Die', duration: this.record.models.Single.durations.Die };
  }
  create(row, col, wreckage = false) {
    const { b } = this; let state;
    const t = b.spawnToken(this.u, TOKEN, row, col, { def: this.record, dir: 'RIGHT',
      kit: { talents: [], skill: { kind: 'passive' },
        trait: { noAttack: true, attack: 'melee', dmgType: 'phys', projectile: 'none',
          canHitFly: false, maxTargets: 1, hits: 1, hitAllBlocked: false,
          requiresAcceptedLaunch: true, attackVisual: 'none',
          launchAttack: (_b, _u, _p, target, info) => this.release(state, target, info) },
        install: (_b, unit) => {
          unit.deploymentSlotCost = 0; unit.mem.regularSummonCard = summonCardId(ID);
          b.addBuff(unit, { key: 'mitm:healfree', persist: true, allowDead: true,
            flags: { healFree: true, noMove: true } });
          if (wreckage) b.addBuff(unit, { key: WASTE, persist: true, allowDead: true,
            mods: { hpPct: this.talent['trshrb_t_1[trash_born].max_hp'],
              atkPct: this.talent['trshrb_t_1[trash_born].atk'],
              defPct: this.talent['trshrb_t_1[trash_born].def'],
              blockCnt: this.talent['trshrb_t_1[trash_born].block_cnt'] } });
          else b.addBuff(unit, { key: REST, flags: { invulnerable: true, untargetable: true,
            isolated: true, noHeal: true, noSp: true, disarm: true }, mods: { blockCntMul: 0 } });
        } } });
    if (!t) return null;
    if (!this.core.valid() || !present(t)) { if (present(t)) b._remove(t, 'mitm-owner-unavailable', null, true); return null; }
    state = { unit: t, seq: t.deploySeq, mode: wreckage ? 2 : 'warming', generation: ++this.generation,
      phase: null, readyAt: b.time + 1, accepting: false, skillBuff: false };
    t.mem.mitmMode = state.mode; t.mem.mitmGeneration = state.generation;
    this.tokens.set(t, state); this.visual(state, wreckage ? 'Waste' : 'Start', false);
    if (wreckage) t.hp = t.s.maxHp;
    return state;
  }
  place(row, col) {
    const error = this.placementError(row, col); if (error) throw Error(error);
    // Reserve the sole card before deploy hooks can attempt another placement.
    this.placing = true; this.stock = 0;
    let state;
    try { state = this.create(row, col); }
    finally { this.placing = false; if (!state && !this.stopped && this.core.valid()) this.stock = 1; }
    if (!state) throw Error('Tactical-point placement failed.');
    this.point = state;
    // The point keeps its tile/stock while recovering; this is not card redeploy.
    this.readyAt = Infinity;
    state.unit.mem.metalCrabRest = () => this.rest(state);
    return state.unit;
  }
  valid(state) { return !this.stopped && this.core.valid() && present(state?.unit) && state.seq === state.unit.deploySeq; }
  spawnWreckage(state) {
    const { b } = this, t = state.unit;
    for (const [dr, dc] of grid('x-5')) {
      if (!this.core.valid() || this.stopped) return;
      const row = t.tileR + dr, col = t.tileC + dc;
      if (!b.grid.inRect(row, col)) continue;
      const tile = b.grid.tile(row, col);
      if (tile.height !== 'LOW' || !['ALL', 'MELEE'].includes(tile.build)
        || b.unitAt(row, col) || b.tileReservation(row, col) || b.downOn(row, col)) continue;
      this.create(row, col, true);
    }
  }
  rest(state, { restoreHp = true } = {}) {
    if (!this.valid(state) || state.transitioning || ![1, 3].includes(state.mode)) return false;
    // Native listener dispatches SpawnTrash before switching the original point.
    // Its centre remains occupied; unforced spawn skips it and other occupants.
    state.transitioning = true;
    try { this.spawnWreckage(state); } finally { state.transitioning = false; }
    if (!this.valid(state)) return false;
    state.mode = 0; state.phase = null; state.accepting = false; state.skillBuff = false;
    state.generation = ++this.generation; state.readyAt = this.b.time + this.talent.interval;
    state.unit.mem.mitmMode = 0; state.unit.mem.mitmGeneration = state.generation;
    this.b.removeBuff(state.unit, BLOCK); this.b.removeBuff(state.unit, 'mitm:token-s2');
    this.b.releaseBlocked(state.unit);
    this.b.addBuff(state.unit, { key: REST, flags: { invulnerable: true, untargetable: true,
      isolated: true, noHeal: true, noSp: true, disarm: true }, mods: { blockCntMul: 0 } });
    if (restoreHp) state.unit.hp = 1;
    state.dieUntil = this.b.time + this.record.models.Single.durations.Die;
    state.unit.mem.mitmReadyAt = state.readyAt + 1;
    this.visual(state, 'Die'); return true;
  }
  activate(state) {
    const { b } = this, t = state.unit;
    if (!this.valid(state)) return;
    b.removeBuff(t, REST); state.mode = 1; t.mem.mitmMode = 1;
    b.addBuff(t, { key: BLOCK, mods: { blockCnt: this.talent.block_cnt } });
    b.heal(t, t, t.s.maxHp, { self: true, ignoreHealFree: true, skipModifierEvent: true });
    if (!this.valid(state) || state.mode !== 1) return;
    t.atkCd = 0; this.visual(state, 'Idle_1', true);
  }
  targets(state) {
    const t = state.unit, keys = new Set(absoluteRangeKeys(this.record.rangeGrid, t.tileR, t.tileC, 'RIGHT'));
    const rows = this.b.enemies.filter(e => live(e) && canTargetEnemy(t, e, { canHitFly: false })
      && (!e.s.flags.camou || e.blockedBy) && (bodyInKeys(e, keys) || e.blockedBy === t));
    sortEnemyTargets(this.b, t, rows); return rows.slice(0, 1);
  }
  release(state, target, info) {
    const { b } = this, p = state?.phase, t = state?.unit;
    if (!state?.accepting || !this.valid(state) || state.mode !== 1 || !live(t)
      || !t.canAct || t.s.flags.disarm || !p || p.accepted || p.target !== target
      || p.targetSeq !== target.deploySeq || p.epoch !== t.attackControlEpoch
      || !due(b, p.releaseAt) || !canTargetEnemy(t, target, { canHitFly: false })) return false;
    p.accepted = true;
    b.dealDamage(t, target, makeDamageInfo({ amount: t.s.atk * t.s.atkScaleMul,
      type: 'phys', isAttack: true, isSkill: false, applyWay: 'melee', attackId: info.attackId ?? 0,
      tags: ['mitm:buggy-ordinary'] }));
    return true;
  }
  tickAttack(state) {
    const { b } = this, t = state.unit; let p = state.phase;
    if (!live(t) || !t.canAct || t.s.flags.disarm || p && p.epoch !== t.attackControlEpoch) {
      state.phase = null; this.visual(state, 'Idle_1', true); return;
    }
    if (p) {
      if (!p.released && due(b, p.releaseAt)) {
        p.released = true;
        if (live(p.target) && p.target.deploySeq === p.targetSeq) {
          state.accepting = true;
          try { b.forceAttack(t, [p.target]); } finally { state.accepting = false; }
        }
      }
      if (!this.valid(state) || state.phase !== p || !due(b, p.readyAt)) return;
      state.phase = null;
    }
    if (t.atkCd > 1e-9) return;
    const target = this.targets(state)[0]; if (!target) { this.visual(state, 'Idle_1', true); return; }
    const m = this.record.models.Single, speed = Math.min(1, t.base.bat / t.s.interval);
    state.phase = { target, targetSeq: target.deploySeq, epoch: t.attackControlEpoch,
      accepted: false, released: false, startedAt: b.time,
      releaseAt: b.time + m.eventPayloads.Attack[0].time / speed,
      readyAt: b.time + Math.max(t.s.interval, m.durations.Attack / speed) };
    this.visual(state, 'Attack', false, speed); t.atkCd = t.s.interval;
  }
  tick() {
    for (const state of [...this.tokens.values()]) {
      if (!this.valid(state)) { this.removed(state.unit); continue; }
      if (state.mode === 2) continue;
      if (state.mode === 0) {
        if (due(this.b, state.readyAt)) {
          state.mode = 'warming'; state.unit.mem.mitmMode = 'warming';
          state.readyAt = this.b.time + 1; this.visual(state, 'Start');
        } else if (due(this.b, state.dieUntil)) this.visual(state, 'Idle_2', false);
      }
      if (state.mode === 'warming' && due(this.b, state.readyAt)) this.activate(state);
      if (state.mode === 1) this.tickAttack(state);
    }
  }
  retreat(t) {
    const state = this.tokens.get(t);
    if (!this.valid(state)) throw Error('Summon is not deployed.');
    if (state === this.point) this.rest(state);
    else this.b._remove(t, 'retreat', null, true);
  }
  removed(t) {
    const state = this.tokens.get(t); if (!state) return;
    this.tokens.delete(t); state.phase = null; state.accepting = false;
    if (state === this.point) this.point = null;
    t.mem.regularFormVisual = null;
  }
  install() {
    (this.b.regularSummons ??= new Map()).set(this.state.key, this.state);
    this.handles.push(this.b.on('fatal', ctx => {
      const state = this.tokens.get(ctx.unit);
      if (!this.valid(state) || state !== this.point || ![1, 3].includes(state.mode)) return;
      // A deploy callback during SpawnTrash can itself inflict fatal damage.
      // Keep the same point alive without recursively spawning another cross.
      if (state.transitioning) {
        ctx.prevented = true;
        ctx.afterHpLoss = () => { if (this.valid(state)) state.unit.hp = 1; };
        return;
      }
      if (!this.rest(state, { restoreHp: false })) return;
      ctx.prevented = true;
      ctx.afterHpLoss = () => { if (this.valid(state) && state.mode === 0) state.unit.hp = 1; };
    }, { owner: this.u }));
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.stock = 0; this.readyAt = Infinity;
    for (const t of this.all()) this.b._remove(t, 'mitm-owner-removed', null, true);
    for (const t of [...this.tokens.keys()]) this.removed(t);
    for (const h of this.handles) this.b.off(h); this.handles = [];
    if (this.b.regularSummons?.get(this.state.key) === this.state) this.b.regularSummons.delete(this.state.key);
  }
}

export function prepareMitmDevices(b, u, { contract } = {}) {
  if (contract !== MITM_DEVICE_CONTRACT) throw Error('Mitm requires the reviewed device contract');
  verifyNative();
  const prepared = prepareMitmCore(b, u, { contract: MITM_CORE_CONTRACT });
  prepared.controller.devices = new MitmDeviceDeck(prepared.controller);
  return { ...prepared, deck: prepared.controller.devices };
}
