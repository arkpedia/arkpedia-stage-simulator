// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-muelsyse-prefabs.json' with { type: 'json' };
import donors from '../../../data/arkpedia-muelsyse-copy-source.json' with { type: 'json' };
import { summonCardId } from '../../../shared/arkpedia/summons.js';
import { canDeployInViewport } from '../../../shared/arkpedia/squad.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { makeDamageInfo } from '../damage.js';
import { MUELSYSE_ID as ID, MUELSYSE_CORE_CONTRACT, prepareMuelsyseCore, muelsyseSourceComponent as component } from './arkpedia-muelsyse.js';

export const MUELSYSE_DEVICE_CONTRACT = Object.freeze({
  scope: 'Original Flowing Shape placement, explicit undeployed-card copying, ordinary melee/ranged attacks, stealing, split and recovery diagnostic',
  mapping: 'A zero-cost/zero-slot both-terrain point in host range. Manual 95/100-SP copy selection lasts up to twenty seconds and selects an undeployed squad card and facing. Four card stats scale; block and BAT do not; ASPD, skills, talents, healing and attack shapes are not inherited. Original initial damage type selects Physical or the native Magical fallback. Both copied forms use the native ground/flying selector; default water form is ground-only. Melee steals up to 250 ATK/DEF; ranged casts split to one random eligible source-cross tile, refreshing a same-host copy there. Spawned copies override the ordinary defeat listener and retire after twenty-five seconds; the original point recovers in thirty/twenty-eight/twenty-five seconds. Owner finish removes all generations.',
  limits: 'All owner active skills, squad cost talent, delivered artwork and public UI approval remain held. Card snapshot composition, stealing arithmetic, tile-selector numeric aliases, clone expiry/rebirth, manual soft withdrawal, native FSM/animation clocks and event dispatch are explicit simulator mappings, not certified compiled Unity parity. The spawned invincible attachment carries three numeric flags and duration indirection; its compiled release/protection ordering is unresolved and the diagnostic only protects the warming interval. EmitProjectile and SpawnTokenCommon use separate native selectors; this diagnostic shares a selected tile. Native copy-opening interruption of other token skills is represented by one deck-wide selection lock. Modules and native particle/shader/audio support remain unavailable.',
  frameParity: false,
});
const TOKEN = 'token_10030_mlyss_wtrman', REST = 'muelsyse:rest', WARM = 'muelsyse:warm';
const BLOCK = 'muelsyse:default-block', STEAL = 'muelsyse:stolen';
const present = u => u?.alive && u.deployed && !u._removing;
const live = u => present(u) && !u.hidden;
const due = (b, time) => b.time + 1e-9 >= time;
const grid = id => evidence.tables.ranges[id].grids.map(g => [g.row, g.col]);
const copyFields = ['maxHp', 'atk', 'def', 'res', 'blockCnt', 'bat'];

function validateDeviceSource() {
  for (const [id, motion] of [['3118243801896605803', 1], ['-5492087658117441429', 3], ['-907056457082120085', 3]]) {
    const selector = component(id);
    if (selector._targetMotion !== motion || selector._maxNum !== 1 || selector._limitTargetNum !== 1)
      throw Error('Unreviewed Flowing Shape attack selector');
  }
  const spawn = component('4692281838629771371');
  const override = spawn._buffsToToken.find(v => v.buffKey === 'mlyss_wtrman_summon[override]');
  const listener = component('-6017481588822484885')._buffs.find(v => v.buffKey === 'mlyss_wtrman_t_1[listener]');
  if (spawn._forceSpawn !== 0 || spawn._addBuffsIfOverlay !== 1 || spawn._checkTokenMaxDeployCnt !== 0
    || spawn._useOwnerHost !== 1 || spawn._useOwnerDirection !== 1
    || override.overrideKey !== listener.overrideKey
    || override.blackboard.find(v => v.key === 'priority_flag')?.value !== 2
    || listener.blackboard.find(v => v.key === 'priority_flag')?.value !== 1)
    throw Error('Unreviewed Flowing Shape spawn ownership');
  for (const id of ['1941241512984926315', '-6309947762518042517']) {
    const steal = component(id);
    if (steal._formulaType !== 2 || steal._finishTargetBuffWhenInvalid !== 1 || steal._finishOwnerBuffWhenTargetInvalid !== 0)
      throw Error('Unreviewed Flowing Shape steal ownership');
  }
}

// Input is the selected undeployed card definition, never a live Unit/profile.
export function flowingShapeSnapshot(def, scale, dir) {
  const type = donors.subProfessionDamageTypePairs[def.subProf];
  if (!Object.hasOwn(donors.subProfessionDamageTypePairs, def.subProf)
    || !['PHYSICAL', 'MAGICAL', 'HEAL', 'NONE'].includes(type) || !['UP', 'DOWN', 'LEFT', 'RIGHT'].includes(dir)
    || ![.5, .7, .9].includes(scale) || !['MELEE', 'RANGED'].includes(def.position)
    || !Array.isArray(def.rangeGrid) || !def.rangeGrid.length
    || !copyFields.every(k => Number.isFinite(def.stats[k]))) throw Error('Unreviewed Flowing Shape donor card');
  return { donorId: def.charId, dir, ranged: def.position === 'RANGED',
    damageType: type === 'PHYSICAL' ? 'phys' : 'arts', initialDamageType: type,
    stats: Object.fromEntries(copyFields.map(k => [k, def.stats[k] * (['maxHp', 'atk', 'def', 'res'].includes(k) ? scale : 1)])),
    rangeGrid: def.rangeGrid.map(([r, c]) => [r, c]) };
}

export class FlowingShapeDeck {
  constructor(core) {
    this.core = core; this.b = core.b; this.u = core.u; this.record = core.record.token;
    this.talent = core.record.copyBb;
    this.stock = 0; this.readyAt = Infinity; this.point = null; this.tokens = new Map();
    this.stopped = false; this.handles = []; this.generation = 0; this.copying = null;
    const deck = this;
    this.state = { key: summonCardId(ID), ownerId: ID, owner: this.u, tokenId: TOKEN,
      record: this.record, deck: this,
      config: Object.freeze({ deploymentSlotCost: 0, chooseFacing: false, tacticalPoint: true,
        limitByHostAttackRange: true, healFree: true, refundRatio: 0 }),
      get stock() { return deck.stock; }, get readyAt() { return deck.readyAt; } };
  }
  valid(s) { return !this.stopped && this.core.valid() && present(s?.unit) && s.seq === s.unit.deploySeq; }
  own() { return present(this.point?.unit) ? [this.point.unit] : []; }
  all() { return [...this.tokens.keys()].filter(present); }
  born() { this.stock = 1; this.readyAt = this.b.time; }
  placementError(row, col) {
    const b = this.b;
    if (!canDeployInViewport(b.viewport)) return 'Open the fullscreen workspace to deploy.';
    if (b.finished) return 'Battle has ended.';
    if (!this.core.valid() || this.stopped) return 'Deploy Muelsyse first.';
    if (this.placing || this.stock <= 0 || this.point) return 'Flowing Shape is already placed.';
    if (!this.tileEligible(row, col)) return 'Choose an unoccupied deployable tile in host range.';
    if (!this.u.rangeKeySet.has(row * 21 + col)) return 'Choose a tile inside the summoner range.';
    return null;
  }
  tileEligible(row, col, existing = null) {
    const b = this.b;
    if (!Number.isInteger(row) || !Number.isInteger(col) || !b.grid.inRect(row, col)) return false;
    if (!['ALL', 'MELEE', 'RANGED'].includes(b.grid.tile(row, col).build)) return false;
    const occupant = b.unitAt(row, col);
    return (!occupant || occupant === existing) && !b.tileReservation(row, col) && !b.downOn(row, col);
  }
  visual(s, clip, loop = false, speed = 1) {
    s.unit.mem.regularModelFacing = 'front';
    s.unit.mem.regularFormVisual = { clip, loop, speed };
    s.unit.mem.regularDeathVisual = { clip: 'Die', die: 'Die', duration: this.record.models.Single.durations.Die };
  }
  form(s, suffix) { return s.copy ? `${s.copy.ranged ? 'B' : 'A'}_${suffix}` : suffix === 'Idle' ? 'Idle_1' : suffix; }
  create(row, col, copy = null) {
    const b = this.b; let s;
    const t = b.spawnToken(this.u, TOKEN, row, col, { def: this.record, dir: copy?.dir ?? 'RIGHT',
      kit: { talents: [],
        skill: { kind: 'duration', trigger: { rule: 'NEVER' },
          canActivate: () => this.valid(s) && !s.clone && !this.copying && [1, 2, 3].includes(s.mode),
          onStart: () => { s.phase = null; this.copying = s; s.selecting = true; },
          onEnd: () => { if (this.copying === s) this.copying = null; s.selecting = false; } },
        trait: { noAttack: true, attack: 'melee', dmgType: 'arts', projectile: 'none', canHitFly: false,
          maxTargets: 1, hits: 1, hitAllBlocked: false, maxTargetsByBlock: false,
          requiresAcceptedLaunch: true, attackVisual: 'none',
          launchAttack: (_b, _u, _p, target, info) => this.release(s, target, info) },
        install: (_b, unit) => {
          unit.deploymentSlotCost = 0; unit.mem.regularSummonCard = summonCardId(ID);
          b.addBuff(unit, { key: 'muelsyse:healfree', persist: true, allowDead: true,
            flags: { healFree: true, noMove: true } });
          b.addBuff(unit, { key: WARM, flags: { disarm: true, invulnerable: true, untargetable: true }, mods: { blockCntMul: 0 } });
        } } });
    if (!t) return null;
    if (!this.core.valid() || !present(t)) { if (present(t)) b._remove(t, 'muelsyse-owner-unavailable', null, true); return null; }
    s = { unit: t, seq: t.deploySeq, mode: 'warming', generation: ++this.generation,
      phase: null, readyAt: b.time + this.record.models.Single.durations.Start,
      accepting: false, copy: null, clone: !!copy, stolenAtk: 0, stolenDef: 0, casts: 0, selecting: false,
      victims: new Map() };
    this.tokens.set(t, s);
    if (copy) {
      if (!this.applySnapshot(s, copy)) return null;
      t.skill.sp = 0; t.skill.charges = 0;
      b.addBuff(t, { key: 'muelsyse:clone-copy-disabled', flags: { noSp: true } });
      s.readyAt = b.time + this.record.models.Single.durations.B_Start;
    }
    this.visual(s, copy ? 'B_Start' : 'Start');
    this.sync(s);
    return s;
  }
  sync(s) {
    Object.assign(s.unit.mem, { muelsyseMode: s.mode, muelsyseGeneration: s.generation,
      muelsyseDonorId: s.copy?.donorId ?? null, muelsyseClone: s.clone,
      muelsyseReadyAt: ['warming', 'changing', 0].includes(s.mode) ? s.readyAt : null });
  }
  place(row, col) {
    const error = this.placementError(row, col); if (error) throw Error(error);
    this.placing = true; this.stock = 0; let s;
    try { s = this.create(row, col); }
    finally { this.placing = false; if (!s && !this.stopped && this.core.valid()) this.stock = 1; }
    if (!s) throw Error('Flowing Shape placement failed.');
    this.point = s; this.readyAt = Infinity; return s.unit;
  }
  beginCopy(t) {
    const s = this.tokens.get(t);
    if (!canDeployInViewport(this.b.viewport) || !this.valid(s)) throw Error('Copy workspace is inactive.');
    return t.skill.activate('manual');
  }
  donorIds() {
    return Object.entries(this.b.bench).filter(([id, entry]) => id !== ID && !entry.unit?.alive)
      .map(([id]) => id);
  }
  copyFrom(t, id, dir) {
    const s = this.tokens.get(t), b = this.b;
    if (!canDeployInViewport(b.viewport) || !this.valid(s) || this.copying !== s || !s.selecting || !t.skill.active)
      throw Error('Open the Flowing Shape copy skill first.');
    if (!this.donorIds().includes(id)) throw Error('Choose an undeployed operator from this squad.');
    const snapshot = flowingShapeSnapshot(b.data.getChess(id), this.talent.scale, dir);
    if (!this.applySnapshot(s, snapshot)) throw Error('Flowing Shape was removed during copying.');
    s.mode = 'changing'; s.readyAt = b.time + this.record.models.Single.durations[snapshot.ranged ? 'Change_B' : 'Change_A'];
    t.skill.end('copy-complete');
    b.addBuff(t, { key: WARM, flags: { disarm: true }, mods: { blockCntMul: 0 } });
    this.visual(s, snapshot.ranged ? 'Change_B' : 'Change_A'); this.sync(s);
    b.heal(t, t, t.s.maxHp, { self: true, ignoreHealFree: true, skipModifierEvent: true });
    return true;
  }
  applySnapshot(s, snapshot) {
    const t = s.unit;
    this.clearVictims(s);
    this.b.releaseBlocked(t); this.b.removeBuff(t, BLOCK); this.b.removeBuff(t, STEAL);
    if (!this.valid(s)) return false;
    s.copy = structuredClone(snapshot); s.stolenAtk = 0; s.stolenDef = 0; s.casts = 0; s.phase = null;
    Object.assign(t.base, snapshot.stats); t.dir = snapshot.dir;
    t.rangeGrid = snapshot.rangeGrid.map(([r, c]) => [r, c]);
    Object.assign(t.profile, { canHitFly: true, attack: snapshot.ranged ? 'ranged' : 'melee',
      dmgType: snapshot.damageType, heal: null });
    t.markDirty(); this.b.refreshRange(t); return true;
  }
  activate(s) {
    if (!this.valid(s)) return;
    const b = this.b, t = s.unit;
    b.removeBuff(t, REST); b.removeBuff(t, WARM);
    s.mode = s.copy ? s.copy.ranged ? 3 : 2 : 1;
    if (!s.copy) b.addBuff(t, { key: BLOCK, mods: { blockCnt: this.talent.block_cnt } });
    t.atkCd = 0; this.sync(s); this.visual(s, this.form(s, 'Idle'), true);
    b.heal(t, t, t.s.maxHp, { self: true, ignoreHealFree: true, skipModifierEvent: true });
  }
  targets(s) {
    const t = s.unit, keys = t.rangeKeySet ?? new Set(absoluteRangeKeys(t.rangeGrid, t.tileR, t.tileC, t.dir));
    const rows = this.b.enemies.filter(e => live(e) && canTargetEnemy(t, e, { canHitFly: !!s.copy })
      && (!e.s.flags.camou || e.blockedBy) && (bodyInKeys(e, keys) || e.blockedBy === t));
    sortEnemyTargets(this.b, t, rows); return rows.slice(0, 1);
  }
  steal(s, target) {
    if (target !== s.unit && present(target)) {
      let record = s.victims.get(target);
      if (!record || record.seq !== target.deploySeq) record = { seq: target.deploySeq, atk: 0, def: 0 };
      // Native formula 2 is a final addition. Each victim and the owner's
      // retained gains have independent caps, not a transfer budget.
      for (const stat of ['atk', 'def']) record[stat] = Math.min(250, record[stat] + 10);
      s.stolenAtk = Math.min(250, s.stolenAtk + 10);
      s.stolenDef = Math.min(250, s.stolenDef + 10);
      const key = `muelsyse:stolen-from:${s.unit.id}:${s.seq}:${s.generation}`;
      record.key = key; s.victims.set(target, record);
      const victimBuff = this.b.addBuff(target, { key, source: s.unit, mods: { atkFinalFlat: -record.atk, defFinalFlat: -record.def } });
      if (!this.valid(s)) { if (victimBuff) this.b.removeBuff(target, victimBuff); return; }
      const selfBuff = this.b.addBuff(s.unit, { key: STEAL,
        mods: { atkFinalFlat: s.stolenAtk, defFinalFlat: s.stolenDef }, persist: true, allowDead: true });
      if (!this.valid(s)) {
        if (victimBuff) this.b.removeBuff(target, victimBuff);
        if (selfBuff) this.b.removeBuff(s.unit, selfBuff);
      }
    }
  }
  clearVictims(s) {
    for (const [target, record] of s.victims) this.b.removeBuff(target, record.key);
    s.victims.clear();
  }
  release(s, target, info) {
    const p = s?.phase, t = s?.unit, b = this.b;
    if (!s?.accepting || !this.valid(s) || ![1, 2, 3].includes(s.mode) || !live(t) || !t.canAct || t.s.flags.disarm
      || s.selecting || !p || p.accepted || p.target !== target || p.targetSeq !== target.deploySeq
      || p.epoch !== t.attackControlEpoch || !due(b, p.releaseAt)
      || !canTargetEnemy(t, target, { canHitFly: !!s.copy })) return false;
    p.accepted = true;
    if (s.copy && !s.copy.ranged) this.steal(s, target);
    if (!this.valid(s) || ![1, 2, 3].includes(s.mode) || !t.canAct || t.s.flags.disarm
      || !live(target) || target.deploySeq !== p.targetSeq) return false;
    b.dealDamage(t, target, makeDamageInfo({ amount: t.s.atk * t.s.atkScaleMul,
      type: s.copy?.damageType ?? 'arts', isAttack: true, isSkill: false,
      applyWay: s.copy?.ranged ? 'ranged' : 'melee', attackId: info.attackId ?? 0,
      tags: ['muelsyse:shape-ordinary'] }));
    if (this.valid(s) && s.mode === 3 && s.copy?.ranged && ++s.casts >= 10) { s.casts = 0; this.split(s); }
    return true;
  }
  split(s) {
    if (!this.valid(s) || !s.copy?.ranged || ![3].includes(s.mode)) return;
    const candidates = grid('x-5').map(([dr, dc]) => [s.unit.tileR + dr, s.unit.tileC + dc])
      .map(([r, c]) => ({ r, c, state: this.tokens.get(this.b.unitAt(r, c)) }))
      .filter(v => this.tileEligible(v.r, v.c, this.valid(v.state) ? v.state.unit : null)
        && (!v.state || v.state.copy?.ranged));
    const chosen = this.b.rng.pick(candidates); if (!chosen) return;
    this.b.addProjectile({ from: s.unit, to: { x: chosen.c, y: chosen.r }, source: s.unit,
      speed: 4, maxAge: 10, visual: 'arrow',
      data: { arkpediaTrackedVisual: true, projectileKey: 'projectile_chr_mlyss_wtrman', zeroDamage: true } });
    if (!this.valid(s) || s.mode !== 3) return;
    if (chosen.state) {
      const t = chosen.state.unit;
      this.b.heal(t, t, t.s.maxHp, { self: true, ignoreHealFree: true, skipModifierEvent: true });
      return;
    }
    const copy = structuredClone(s.copy);
    copy.stats = Object.fromEntries(copyFields.map(k => [k, s.unit.base[k]]));
    const clone = this.create(chosen.r, chosen.c, copy);
    if (clone) clone.expiresAt = this.b.time + 25;
  }
  tickAttack(s) {
    const b = this.b, t = s.unit; let p = s.phase;
    if (!live(t) || !t.canAct || t.s.flags.disarm || s.selecting || p && p.epoch !== t.attackControlEpoch) {
      s.phase = null; this.visual(s, this.form(s, 'Idle'), true); return;
    }
    if (p) {
      if (!p.released && due(b, p.releaseAt)) {
        p.released = true;
        if (live(p.target) && p.targetSeq === p.target.deploySeq) {
          s.accepting = true;
          try { b.forceAttack(t, [p.target]); } finally { s.accepting = false; }
        }
      }
      if (!this.valid(s) || s.phase !== p || !due(b, p.readyAt)) return;
      s.phase = null;
    }
    if (t.atkCd > 1e-9) return;
    const target = this.targets(s)[0]; if (!target) { this.visual(s, this.form(s, 'Idle'), true); return; }
    const m = this.record.models.Single, clip = this.form(s, 'Attack'), speed = Math.min(1, t.base.bat / t.s.interval);
    s.phase = { target, targetSeq: target.deploySeq, epoch: t.attackControlEpoch,
      accepted: false, released: false, startedAt: b.time,
      releaseAt: b.time + m.eventPayloads[clip][0].time / speed,
      readyAt: b.time + Math.max(t.s.interval, m.durations[clip] / speed) };
    this.visual(s, clip, false, speed); t.atkCd = t.s.interval;
  }
  rest(s, { restoreHp = true } = {}) {
    if (!this.valid(s) || ![1, 2, 3, 'changing'].includes(s.mode)) return false;
    if (s.clone) { this.b._remove(s.unit, 'muelsyse-copy-finished', null, true); return true; }
    this.clearVictims(s);
    s.unit.skill.end('shape-defeat');
    s.mode = 0; s.phase = null; s.accepting = false; s.generation = ++this.generation;
    s.readyAt = this.b.time + this.talent.interval;
    this.b.releaseBlocked(s.unit); this.b.removeBuff(s.unit, BLOCK); this.b.removeBuff(s.unit, WARM);
    this.b.addBuff(s.unit, { key: REST, flags: { invulnerable: true, untargetable: true, isolated: true,
      noSp: true, disarm: true }, mods: { blockCntMul: 0 } });
    s.unit.skill.sp = 0; s.unit.skill.charges = 0;
    if (restoreHp) s.unit.hp = 1;
    this.visual(s, this.form(s, 'Die')); s.dieUntil = this.b.time + this.record.models.Single.durations[this.form(s, 'Die')];
    s.expiresAt = null; this.sync(s); return true;
  }
  tick() {
    for (const s of [...this.tokens.values()]) {
      if (!this.valid(s)) { this.removed(s.unit); continue; }
      for (const [target, record] of s.victims) if (!live(target) || target.s.flags.untargetable || target.deploySeq !== record.seq) {
        this.b.removeBuff(target, record.key); s.victims.delete(target);
      }
      if (s.expiresAt != null && due(this.b, s.expiresAt)) this.rest(s);
      if (!this.valid(s)) continue;
      if (s.mode === 0) {
        if (due(this.b, s.readyAt)) {
          s.mode = 'warming'; s.readyAt = this.b.time + this.record.models.Single.durations[this.form(s, 'Start')];
          this.visual(s, this.form(s, 'Start')); this.sync(s);
        } else if (due(this.b, s.dieUntil)) this.visual(s, 'Idle_2');
      }
      if (['warming', 'changing'].includes(s.mode) && due(this.b, s.readyAt)) this.activate(s);
      if ([1, 2, 3].includes(s.mode)) this.tickAttack(s);
    }
  }
  retreat(t) {
    const s = this.tokens.get(t); if (!this.valid(s)) throw Error('Summon is not deployed.');
    this.rest(s);
  }
  removed(t) {
    const s = this.tokens.get(t); if (!s) return;
    this.clearVictims(s);
    if (this.copying === s) this.copying = null;
    this.tokens.delete(t); s.phase = null; s.accepting = false;
    if (s === this.point) this.point = null;
    t.mem.regularFormVisual = null;
  }
  install() {
    if (this.stopped || this.handles.length) throw Error('Flowing Shape deck cannot be installed twice');
    (this.b.regularSummons ??= new Map()).set(this.state.key, this.state);
    this.handles.push(this.b.on('fatal', ctx => {
      const s = this.tokens.get(ctx.unit);
      if (!this.valid(s) || s.clone || ![1, 2, 3, 'changing'].includes(s.mode)) return;
      if (!this.rest(s, { restoreHp: false })) return;
      ctx.prevented = true;
      ctx.afterHpLoss = () => { if (this.valid(s) && s.mode === 0) s.unit.hp = 1; };
    }, { owner: this.u }));
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.stock = 0; this.readyAt = Infinity; this.copying = null;
    for (const t of this.all()) this.b._remove(t, 'muelsyse-owner-removed', null, true);
    for (const t of [...this.tokens.keys()]) this.removed(t);
    for (const h of this.handles) this.b.off(h); this.handles = [];
    if (this.b.regularSummons?.get(this.state.key) === this.state) this.b.regularSummons.delete(this.state.key);
  }
}

export function prepareMuelsyseDevices(b, u, { contract } = {}) {
  if (contract !== MUELSYSE_DEVICE_CONTRACT) throw Error('Muelsyse requires the reviewed device contract');
  validateDeviceSource();
  const prepared = prepareMuelsyseCore(b, u, { contract: MUELSYSE_CORE_CONTRACT });
  prepared.controller.devices = new FlowingShapeDeck(prepared.controller);
  return { ...prepared, deck: prepared.controller.devices };
}
