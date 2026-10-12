// SPDX-License-Identifier: GPL-3.0-or-later
// Opt-in native-source device diagnostic. Public approval and owner skills are separate.
import evidence from '../../../data/arkpedia-stainless-prefabs.json' with { type: 'json' };
import { sourceCandidate, summonCardId } from '../../../shared/arkpedia/summons.js';
import { canDeployInViewport } from '../../../shared/arkpedia/squad.js';
import { flattenBlackboard as flat } from '../simdata.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys, bodyInRadius } from '../body.js';
import { makeDamageInfo } from '../damage.js';
import { STAINLESS_ID as ID, STAINLESS_CORE_CONTRACT, prepareStainlessCore,
  stainlessSourceComponent as component } from './arkpedia-stainless.js';

export const STAINLESS_DEVICE_CONTRACT = Object.freeze({
  scope: 'Selected three-device deck, ordinary support auras, device drain, allied-input turret and recycling diagnostic',
  mapping: 'Native targeting side/category and zero slots; independent device stats/ranks/capacity, selected owner recharge bounded by deck capacity, placement-start cooldown. Per-recipient aura attachment timers, source self-drain without modifier/SP callbacks, accepted post-dodge allied HP inputs cancel damage and award hurt SP, Artificer repair bypasses HealFree. Retained turret input, native hit event, homing speed, arrival-only splash excluding trace input and current host ATK. Finish recycling uses selected source range/probability/count.',
  limits: 'Owner active skills and public/artwork approval remain held. Numeric abnormal/immunity aliases, native aura/FSM/action-event dispatch, modifier/SP/cancel ordering and Unity frame parity are not certified. Born/bleed/cast clocks, source-category filtering and placed-token bookkeeping are explicit local mappings. Modules, original shader/particle/audio effects are unsupported.',
  frameParity: false,
});
const present = u => u?.alive && u.deployed && !u._removing;
const live = u => present(u) && !u.hidden;
const due = (b, time) => b.time + 1e-9 >= time;
const directions = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
const operatorProfessions = new Set(['PIONEER', 'WARRIOR', 'TANK', 'SNIPER', 'CASTER', 'MEDIC', 'SUPPORT', 'SPECIAL']);
const grid = id => evidence.tables.ranges[id].grids.map(g => [g.row, g.col]);

function verifyNative() {
  const projectile = component('-1786530382255460688'), move = component('-5453172424858702160');
  const aura = component('8591311451631757850'), supply = component('-5567476958443701656');
  const resistance = evidence.templates['damage_resistance[phy]'].eventToActions.ON_TAKE_DAMAGE[0];
  if (projectile._onlyCheckHitWhenReachTarget !== 1 || projectile._exceptTraceTarget !== 1
    || move._speed !== 10 || move._clearTraceTargetWhenReached !== 1
    || aura._removeBuffWhenTargetLeave !== 1 || aura._removeBuffWhenAbilityDetached !== 1
    || aura._buffs[0].attributes.attributeModifiers[0].attributeType !== 1
    || supply._metadata.blackboardPrefix !== 'default.' || flat(supply._buffs[0].blackboard).sp !== 1
    || resistance._damageMask !== 'PHYSICAL' || !resistance._isOneMinus || resistance._isStackable
    || evidence.templates.ironmn_pile3_trait.eventToActions.ON_TAKE_DAMAGE[0]._reason !== 'UNHURTABLE')
    throw Error('Unreviewed Stainless device source');
}

export class StainlessDeviceDeck {
  constructor(core) {
    this.core = core; this.b = core.b; this.u = core.u; this.record = core.record.token;
    this.index = core.record.index; this.stock = 0; this.readyAt = Infinity;
    this.devices = new Map(); this.handles = []; this.stopped = false;
    if (this.record.native.side !== (this.index === 2 ? 2 : 1)
      || this.record.native.category !== (this.index === 2 ? 1 : 2)
      || this.record.native.buildableType !== (this.index === 2 ? 1 : 3)
      || this.record.native.deploymentSlotCost !== 0 || !this.record.native.chooseFacing)
      throw Error('Unreviewed Stainless device placement/target rules');
    const deck = this;
    this.state = { key: summonCardId(ID), ownerId: ID, owner: this.u, tokenId: this.record.id,
      record: this.record, deck: this, config: Object.freeze({ deploymentSlotCost: 0, chooseFacing: true,
        noAttack: true, healFree: true, refundRatio: .5 }),
      get stock() { return deck.stock; }, get readyAt() { return deck.readyAt; } };
    this.talent = flat(this.record.talents.find(t => t.prefabKey === '2')?.blackboard);
    this.drain = flat(this.record.talents.find(t => t.prefabKey === '3')?.blackboard).hp_ratio ?? 0;
    this.skill = flat(this.record.skill.blackboard);
    this.repair = flat(sourceCandidate(this.record.source.trait?.candidates ?? [], core.record.build)?.blackboard).hp_ratio ?? 0;
  }
  own() { return [...this.devices.keys()].filter(present); }
  born() {
    this.stock = Math.min(this.record.stats.maxDeckStackCnt, this.core.record.recharge.cnt);
    this.readyAt = this.b.time;
  }
  recharge(count) { this.stock = Math.min(this.record.stats.maxDeckStackCnt, this.stock + count); }
  placementError(row, col) {
    const { b, core } = this;
    if (!canDeployInViewport(b.viewport)) return 'Open the fullscreen workspace to deploy.';
    if (b.finished) return 'Battle has ended.';
    if (!core.valid() || this.u.hidden) return 'Deploy Stainless first.';
    if (this.stock <= 0) return 'No devices remaining.';
    if (!due(b, this.readyAt)) return 'Device is still redeploying.';
    if (this.own().length >= this.record.stats.maxDeployCount) return 'Device deployment limit reached.';
    if (!Number.isInteger(row) || !Number.isInteger(col) || !b.grid.inRect(row, col)) return 'Select a tile on the map.';
    const build = b.grid.tile(row, col).build;
    const allowed = this.record.native.buildableType === 3 ? ['ALL', 'MELEE', 'RANGED'] : ['ALL', 'MELEE'];
    if (!allowed.includes(build)) return this.index === 2 ? 'Choose a melee tile.' : 'Choose a deployable tile.';
    if (b.unitAt(row, col)) return 'Tile is occupied.';
    if (b.tileReservation(row, col) || b.downOn(row, col)) return 'Tile is reserved for an operator return.';
    if (b.dp < this.record.stats.cost) return 'Not enough DP.';
    return null;
  }
  place(row, col, dir = 'RIGHT') {
    const error = this.placementError(row, col); if (error) throw Error(error);
    if (!directions.includes(dir)) throw Error('Choose a facing direction.');
    const { b, core } = this;
    let state;
    const t = b.spawnToken(this.u, this.record.id, row, col, { def: this.record, dir,
      targetSide: this.index === 2 ? 'enemy' : 'ally', kit: { talents: [],
        trait: { noAttack: true, attack: 'melee', projectile: 'none', dmgType: 'phys', canHitFly: false },
        skill: this.index === 2 ? { kind: 'instant', trigger: { rule: 'NEVER' },
          canActivate: () => !!state && this.castEligible(state), onStart: () => this.startCast(state) }
          : { kind: 'passive' },
        install: (_b, unit) => {
          unit.deploymentSlotCost = 0; unit.mem.regularSummonCard = summonCardId(ID);
          if (this.index !== 2) unit.kind = 'device';
          b.addBuff(unit, { key: 'ironmn:device-trait', persist: true, allowDead: true,
            flags: { healFree: true, noMove: true, unblockable: true, ...(this.index !== 2 ? { untargetable: true } : {}) } });
        } } });
    if (!t) throw Error('Device placement failed.');
    if (!core.valid() || !present(t)) {
      if (present(t)) b._remove(t, 'ironmn-owner-unavailable', null, true);
      throw Error('Device owner became unavailable.');
    }
    state = { unit: t, seq: t.deploySeq, recipients: new Map(), bornAt: b.time + this.model(t).durations.Start,
      bleedAt: b.time + 1, phase: null, cooldownAt: b.time };
    this.devices.set(t, state); this.visual(t, 'Start');
    this.stock--; this.u.player.dp -= this.record.stats.cost;
    this.readyAt = b.time + this.record.stats.respawnTime;
    this.syncAura(state); return t;
  }
  model(t) {
    return this.record.models[this.index !== 2 ? 'Single' : t.dir === 'UP' ? 'Back' : t.dir === 'DOWN' ? 'Down' : 'Front'];
  }
  visual(t, clip, loop = false, speed = 1) {
    t.mem.regularFormVisual = { clip, speed, loop };
    if (this.index === 2) t.mem.regularDeathVisual = { clip: 'Die', die: 'Die', duration: this.model(t).durations.Die };
    else t.mem.regularDeathVisual = { clip: 'End', die: 'End', duration: this.model(t).durations.End };
  }
  auraRecipients(t) {
    const keys = new Set(absoluteRangeKeys(this.index === 2 ? grid('b-1') : this.record.rangeGrid, t.tileR, t.tileC, t.dir));
    return this.b.allyUnits.filter(a => live(a) && a.kind === 'op' && operatorProfessions.has(a.def.profession)
      && !a.s.flags.isolated && (this.index === 2 || !a.s.flags.untargetable)
      && bodyInKeys(a, keys));
  }
  syncAura(state) {
    const { b } = this, t = state.unit, key = `ironmn:device-aura:${t.id}`;
    const next = new Set(live(t) && this.core.valid() ? this.auraRecipients(t) : []);
    for (const a of state.recipients.keys()) if (!next.has(a)) {
      b.removeBuff(a, key); state.recipients.delete(a);
    }
    for (const a of next) {
      if (!state.recipients.has(a)) state.recipients.set(a, { seq: a.deploySeq,
        nextSp: b.time + (this.talent['default.interval'] ?? Infinity) });
      if (this.index === 1) continue;
      if (!a.findBuff(key)) b.addBuff(a, { key, source: t,
        ...(this.index === 2 ? { status: 'sanctuary', data: { value: this.talent.damage_resistance },
          mods: { physTakenMul: 1 - this.talent.damage_resistance } } : { mods: { atkPct: this.talent.atk } }) });
    }
  }
  targets(t) {
    const keys = new Set(absoluteRangeKeys(this.record.skill.rangeGrid, t.tileR, t.tileC, t.dir));
    const out = this.b.enemies.filter(v => v.kind !== 'token' && live(v)
      && canTargetEnemy(t, v, { canHitFly: true }) && (!v.s.flags.camou || v.blockedBy)
      && bodyInKeys(v, keys));
    sortEnemyTargets(this.b, t, out); return out;
  }
  valid(state) { return this.core.valid() && live(state.unit) && state.seq === state.unit.deploySeq; }
  castEligible(state) {
    const t = state.unit;
    return this.valid(state) && due(this.b, state.bornAt) && !state.phase && due(this.b, state.cooldownAt)
      && t.canAct && !t.s.flags.disarm && this.targets(t).length > 0;
  }
  startCast(state) {
    if (!this.castEligible(state)) return;
    const t = state.unit, target = this.targets(t)[0], model = this.model(t);
    const speed = Math.min(1, t.base.bat / t.s.interval);
    state.phase = { target, targetSeq: target.deploySeq, epoch: t.attackControlEpoch,
      releaseAt: this.b.time + model.eventPayloads.Attack[0].time / speed,
      finishAt: this.b.time + model.durations.Attack / speed, released: false };
    state.cooldownAt = state.phase.finishAt;
    this.visual(t, 'Attack', false, speed);
    // Explicit local ON_START mapping for the original action-event-3 drain.
    // Pure skip-modifier/no-SP damage bypasses the turret's unhurtable trait.
    this.b.loseHp(t, t.s.maxHp * this.skill.hp_ratio, { source: t, tags: ['ironmn:turret-drain'] });
  }
  release(state, phase) {
    const { b } = this, t = state.unit, target = phase.target;
    if (!this.valid(state) || t.attackControlEpoch !== phase.epoch || !t.canAct || t.s.flags.disarm
      || !live(target) || target.deploySeq !== phase.targetSeq
      || !canTargetEnemy(t, target, { canHitFly: true })) return;
    const damage = (v, scale, splash) => b.dealDamage(t, v, makeDamageInfo({
      amount: t.s.atk * t.s.atkScaleMul * scale, type: 'phys', isAttack: true,
      isSkill: true, isSplash: splash, applyWay: 'ranged', tags: [splash ? 'ironmn:turret-splash' : 'ironmn:turret-main'] }));
    b.addProjectile({ from: t, target, source: t, speed: component('-5453172424858702160')._speed,
      maxAge: component('8870901807755652784')._lifeTime, visual: 'bolt',
      data: { stainlessCore: this.core, sourceKey: 'projectile_chr_ironmn_pile3' },
      onHit: ({ target: arrived, x, y }) => {
        if (b.finished || arrived !== target || !live(target) || target.deploySeq !== phase.targetSeq) return;
        // Snapshot neighbours before the main hit can kill or move its input.
        const neighbours = b.enemies.filter(v => v !== target && v.kind !== 'token' && live(v)
          && canTargetEnemy(t, v, { canHitFly: true })
          && bodyInRadius(v, x, y, component('-1975730290488414544').m_Radius));
        damage(target, this.skill.atk_scale, false);
        for (const v of neighbours) if (live(v)) damage(v, this.skill.atk_scale_2, true);
      } });
  }
  incoming(ctx) {
    const { source, target, dmg } = ctx;
    const state = this.devices.get(target);
    if (this.index !== 2 || !state || !this.valid(state)) return;
    // damageFinal runs after miss/evade/invulnerability and before HP/shields.
    // Native cancellation still permits accepted input SP and Artificer repair.
    ctx.cancel = true;
    if (!source || source.side !== 'ally') return;
    if (source.def.profession === 'SUPPORT' && source.def.subProf === 'craftsman')
      this.b.heal(target, target, target.s.maxHp * this.repair, { ignoreHealFree: true });
    if (!dmg.noSp && !state.phase) target.skill.onDamaged();
  }
  tick() {
    const { b } = this;
    for (const state of [...this.devices.values()]) {
      const t = state.unit;
      if (!present(t) || t.deploySeq !== state.seq) { this.removed(t); continue; }
      this.syncAura(state);
      if (this.index === 1 && live(t)) {
        while (due(b, state.bleedAt) && present(t)) {
          state.bleedAt += 1;
          b.loseHp(t, t.s.maxHp * this.drain, { source: t, tags: ['ironmn:device-drain'] });
        }
        for (const [a, clock] of state.recipients) {
          if (a.deploySeq !== clock.seq) { state.recipients.delete(a); continue; }
          if (due(b, clock.nextSp)) {
            clock.nextSp = b.time + this.talent['default.interval'];
            a.skill?.gainSp(1, 'ironmn-device');
          }
        }
      }
      if (!live(t)) continue;
      if (due(b, state.bornAt) && !state.phase) this.visual(t, 'Idle', true);
      if (this.index !== 2) continue;
      const phase = state.phase;
      if (phase && (phase.epoch !== t.attackControlEpoch || !t.canAct || t.s.flags.disarm)) state.phase = null;
      else if (phase) {
        if (!phase.released && due(b, phase.releaseAt)) { phase.released = true; this.release(state, phase); }
        if (due(b, phase.finishAt)) state.phase = null;
      }
      if (t.skill.ready && this.castEligible(state)) t.skill.activate('ironmn-device');
    }
  }
  retreat(t) {
    if (!this.devices.has(t) || !present(t)) throw Error('Device is not deployed.');
    this.b.addDp(this.u.ownerId, Math.floor(this.record.stats.cost * this.state.config.refundRatio));
    this.b._remove(t, 'retreat', null, true);
  }
  removed(t) {
    const state = this.devices.get(t); if (!state) return;
    this.devices.delete(t); state.phase = null;
    for (const a of state.recipients.keys()) this.b.removeBuff(a, `ironmn:device-aura:${t.id}`);
    state.recipients.clear(); t.mem.regularFormVisual = null;
    const talent = this.core.record.talents.find(v => v.prefabKey === '2');
    if (!this.stopped && this.core.valid() && talent
      && new Set(absoluteRangeKeys(grid(talent.rangeId), this.u.tileR, this.u.tileC, this.u.dir)).has(t.tileR * 21 + t.tileC)
      && this.b.rng() < this.core.record.recycle.prob) {
      this.recharge(this.core.record.recycle.cnt);
      this.readyAt = this.b.time + this.record.stats.respawnTime;
    }
  }
  install() {
    const { b } = this;
    (b.regularSummons ??= new Map()).set(this.state.key, this.state);
    this.handles.push(b.on('damageFinal', ctx => this.incoming(ctx), { owner: this.u }));
    this.handles.push(b.on('spGain', ctx => {
      if (this.devices.get(ctx.unit)?.phase) ctx.amount = 0;
    }, { owner: this.u }));
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.stock = 0; this.readyAt = Infinity;
    for (const t of this.own()) this.b._remove(t, 'ironmn-owner-removed', null, true);
    for (const t of [...this.devices.keys()]) this.removed(t);
    for (const handle of this.handles) this.b.off(handle); this.handles = [];
    if (this.b.regularSummons?.get(this.state.key) === this.state) this.b.regularSummons.delete(this.state.key);
    if (this.b.finished) this.b.projectiles.remove(p => p.data?.stainlessCore === this.core);
  }
}

export function prepareStainlessDevices(b, u, { contract } = {}) {
  if (contract !== STAINLESS_DEVICE_CONTRACT) throw Error('Stainless requires the reviewed device contract');
  verifyNative();
  const prepared = prepareStainlessCore(b, u, { contract: STAINLESS_CORE_CONTRACT });
  prepared.controller.devices = new StainlessDeviceDeck(prepared.controller);
  return { ...prepared, deck: prepared.controller.devices };
}
