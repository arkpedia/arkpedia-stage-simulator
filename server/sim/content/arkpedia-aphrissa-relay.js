// SPDX-License-Identifier: GPL-3.0-or-later
// Held normal relay lifecycle. Skill overlays and ray geometry compose later.
import {selectedAphrissaRelay} from './arkpedia-aphrissa-relay-source.js';
import {APHRISSA_ID as ID, APHRISSA_RELAY_ID as TOKEN, selectedAphrissaInputs,
  aphrissaNativeInputs} from './arkpedia-aphrissa-source.js';
import {normalizeToken} from '../simdata.js';
import {canSpendDp} from './arkpedia-dp-budget.js';
import {canDeployInViewport} from '../../../shared/arkpedia/squad.js';
import clocks from '../../../data/arkpedia-aphrissa-clocks.json' with {type: 'json'};

export const APHRISSA_RELAY_CONTRACT = Object.freeze({
  scope: 'Diagnostic normal relay deployment, source lifetime and retirement only; no public registration.',
  mapping: 'One independent three-DP card, chosen facing, low/high deployable tiles, no host-range restriction, zero deployment slots. The promotion-selected lifetime starts at accepted deployment. Removal restores one card with a thirty-second redeployment timer. Manual withdrawal refunds floor(cost × source ratio); expiry and owner retirement do not refund. Original single-facing Start/Idle/Die and passive invulnerability, ally-target-free and heal-free flags are retained.',
  limits: 'Tile/card acceptance, floor refund, stock/cooldown dispatch, timeout ordering and native flag aliases use explicit local simulator rules. S1 permanence, S2 ray redirection, S3 extra relays and owner talent effects are not implemented here. No attacks, skills, native particles/audio, module or compiled/frame parity approval.',
  frameParity: false,
});
const present = unit => unit?.alive && unit.deployed && !unit._removing;
const due = (battle, time) => battle.time + 1e-8 >= time;

export function prepareAphrissaRelay(b, u, {contract} = {}) {
  if (contract !== APHRISSA_RELAY_CONTRACT || u.def.charId !== ID || u.deploySeq !== 0
    || u.mem.aphrissaRelay) throw Error('Fresh selected Aphrissa and explicit normal relay contract required');
  const selected = selectedAphrissaInputs(u), record = selectedAphrissaRelay(selected.build);
  const native = aphrissaNativeInputs(), templates = native.templates;
  const passive = native.relayPassive._buffs;
  if (templates['charge_token[born]'].eventToActions.ON_OWNER_BORN[0]._cntKey !== 'cnt'
    || templates['aphris_pc[recharge]'].eventToActions.ON_BUFF_FINISH[0]._rechargeTiming !== 'ON_FINISH'
    || templates['aphris_pc_t[with-draw]'].eventToActions.ON_BUFF_FINISH[2]._force !== true
    || passive.length !== 1 || passive[0].attributes.abnormalFlags.join(',') !== '5,15,7'
    || passive[0].attributes.attributeModifiers[0].attributeType !== 5
    || passive[0].attributes.attributeModifiers[0].value !== 0
    || record.stats.cost !== 3 || record.stats.respawnTime !== 30 || record.stats.maxDeployCount !== 1)
    throw Error('Changed original Aphrissa normal relay graph');
  const deck = new AphrissaRelay(b, u, record);
  u.mem.aphrissaRelay = deck;
  return deck;
}

class AphrissaRelay {
  constructor(b, u, record) {
    Object.assign(this, {b, u, record, seq: null, stock: 0, readyAt: Infinity,
      point: null, placing: false, stopped: false, handles: []});
    this.def = normalizeToken(TOKEN, {name: record.source.name, profession: 'TOKEN',
      position: record.source.position, stats: record.stats, rangeGrid: record.rangeGrid,
      talents: record.talents, skill: null, arkpedia: {...record.build}});
    const deck = this;
    this.state = {key: `summon:${ID}`, ownerId: ID, owner: u, tokenId: TOKEN, deck,
      record: {...this.def.raw, id: TOKEN},
      config: Object.freeze({deploymentSlotCost: 0, chooseFacing: true, refundRatio: record.deployment.refundRatio,
        healFree: true, noAttack: true}),
      get stock() { return deck.stock; }, get readyAt() { return deck.readyAt; }};
  }
  valid() { return !this.stopped && this.seq === this.u.deploySeq && present(this.u); }
  own() {
    const s = this.point;
    return s && !s.finished && present(s.unit) && s.seq === s.unit.deploySeq ? [s.unit] : [];
  }
  placementError(row, col) {
    const b = this.b;
    if (!canDeployInViewport(b.viewport)) return 'Open the fullscreen workspace to deploy.';
    if (b.finished) return 'Battle has ended.';
    if (!this.valid() || this.u.hidden) return 'Deploy Aphrissa first.';
    if (this.placing || this.stock < 1 || this.own().length) return 'Relay is already deployed.';
    if (!due(b, this.readyAt)) return 'Relay is still redeploying.';
    if (!Number.isInteger(row) || !Number.isInteger(col) || !b.grid.inRect(row, col)) return 'Select a tile on the map.';
    const tile = b.grid.tile(row, col);
    if (!['LOW', 'HIGH'].includes(tile.height) || !['MELEE', 'RANGED', 'ALL'].includes(tile.build)
      || b.grid.isObstacle(row, col)) return 'Choose a deployable tile.';
    if (b.unitAt(row, col) || b.tileReservation(row, col) || b.downOn(row, col)) return 'Tile is occupied or reserved.';
    if (!canSpendDp(b, this.u.ownerId, this.record.stats.cost)) return 'Not enough DP.';
    return null;
  }
  visual(s, clip, loop = false) {
    s.unit.mem.regularModelFacing = 'single';
    s.unit.mem.regularFormVisual = {clip, loop, speed: 1};
    s.unit.mem.regularDeathVisual = {clip: 'Die', die: 'Die', duration: clocks.tokens[TOKEN].models.Single.exactDurations.Die};
  }
  lifetimeSpec() {
    return {kind: 'passive', duration: this.record.duration,
      formCountdown: () => {
        const s = this.point;
        return this.valid() && this.own().length ? {remaining: Math.max(0, s.expiresAt - this.b.time),
          duration: this.record.duration, label: 'Relay remaining'} : null;
      }};
  }
  place(row, col, dir = 'RIGHT') {
    const error = this.placementError(row, col);
    if (error) throw Error(error);
    if (!['UP', 'DOWN', 'LEFT', 'RIGHT'].includes(dir)) throw Error('Choose a facing direction.');
    const b = this.b, paid = this.record.stats.cost, previousReady = this.readyAt;
    this.placing = true; this.stock = 0;
    b.addDp(this.u.ownerId, -paid);
    let token, created;
    try {
      token = b.spawnToken(this.u, TOKEN, row, col, {dir, def: this.def,
        kit: {trait: {noAttack: true}, talents: [], skill: this.lifetimeSpec(),
          install: (_b, unit) => {
            created = unit; unit.deploymentSlotCost = 0;
            unit.mem.regularSummonCard = this.state.key;
            b.addBuff(unit, {key: 'aphrissa:relay-passive', source: unit, persist: true, allowDead: true,
              flags: {invulnerable: true, isolated: true, healFree: true}, mods: {blockCntMul: 0}});
          }}});
      if (!token || !present(token) || !this.valid()) throw Error('Relay deployment failed.');
      this.point = {unit: token, seq: token.deploySeq, bornAt: b.time,
        expiresAt: b.time + this.record.duration, finished: false, mode: 'born'};
      this.readyAt = Infinity;
      this.visual(this.point, 'Start');
      return token;
    } catch (error) {
      token ??= created;
      if (present(token)) b._remove(token, 'aphrissa-relay-placement-cancelled', null, true);
      else if (token) { b.offOwner(token); token.removed = true; }
      b.addDp(this.u.ownerId, paid);
      if (this.valid()) { this.stock = 1; this.readyAt = previousReady; }
      throw error;
    } finally { this.placing = false; }
  }
  finish(s, {remove = false, reason = 'removed'} = {}) {
    if (!s || s.finished) return;
    s.finished = true;
    if (this.point === s) this.point = null;
    if (this.valid()) { this.stock = 1; this.readyAt = this.b.time + this.record.stats.respawnTime; }
    if (remove && present(s.unit) && s.unit.deploySeq === s.seq)
      this.b._remove(s.unit, `aphrissa-relay-${reason}`, null, true);
  }
  retreat(token) {
    if (!canDeployInViewport(this.b.viewport) || this.b.finished || !this.valid()
      || this.point?.unit !== token || !this.own().length) throw Error('Select the current relay in fullscreen.');
    // Same integer refund policy as StandardBattle; native token ratio is 0.5.
    this.b.addDp(this.u.ownerId, Math.floor(this.record.stats.cost * this.record.deployment.refundRatio));
    this.finish(this.point, {remove: true, reason: 'withdrawal'});
    return true;
  }
  tick() {
    if (this.seq === null && !this.stopped && !this.b.finished) return;
    if (!this.valid()) { this.stop(); return; }
    const s = this.point;
    if (!s) return;
    if (!present(s.unit) || s.unit.deploySeq !== s.seq) { this.finish(s); return; }
    if (due(this.b, s.expiresAt)) { this.finish(s, {remove: true, reason: 'expired'}); return; }
    if (s.mode === 'born' && due(this.b, s.bornAt + clocks.tokens[TOKEN].models.Single.exactDurations.Start)) {
      s.mode = 'idle'; this.visual(s, 'Idle', true);
    }
  }
  install() {
    if (this.stopped || this.handles.length) throw Error('Relay lifecycle cannot be reinstalled');
    const b = this.b, u = this.u, map = b.regularSummons ??= new Map();
    if (map.has(this.state.key)) throw Error('A current Aphrissa relay deck already exists');
    map.set(this.state.key, this.state);
    this.handles = [
      b.on('deploy', ({unit, move}) => {
        if (unit !== u || move) return;
        if (this.seq !== null) { this.stop(); return; }
        this.seq = u.deploySeq; this.stock = 1; this.readyAt = b.time;
      }, {owner: u}),
      b.on('tick', () => this.tick(), {owner: u}),
      b.on('death', ({unit}) => { if (unit === u) this.stop(); else if (unit === this.point?.unit) this.finish(this.point); }, {owner: u}),
      b.on('removed', ({unit}) => { if (unit === u) this.stop(); else if (unit === this.point?.unit) this.finish(this.point); }, {owner: u}),
      b.on('battleEnd', () => this.stop(), {owner: u}),
    ];
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.stock = 0; this.readyAt = Infinity;
    this.finish(this.point, {remove: true, reason: 'owner-finished'});
    if (this.b.regularSummons?.get(this.state.key) === this.state) this.b.regularSummons.delete(this.state.key);
    for (const handle of this.handles) this.b.off(handle);
    this.handles = [];
  }
}
