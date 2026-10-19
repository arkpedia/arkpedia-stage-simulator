// SPDX-License-Identifier: GPL-3.0-or-later
// Held relay lifecycle with the original literal S1 permanence check.
import {selectedAphrissaRelay} from './arkpedia-aphrissa-relay-source.js';
import {APHRISSA_ID as ID, APHRISSA_RELAY_ID as TOKEN, selectedAphrissaInputs,
  aphrissaNativeInputs} from './arkpedia-aphrissa-source.js';
import {normalizeToken} from '../simdata.js';
import {canSpendDp} from './arkpedia-dp-budget.js';
import {canDeployInViewport} from '../../../shared/arkpedia/squad.js';
import clocks from '../../../data/arkpedia-aphrissa-clocks.json' with {type: 'json'};

export const APHRISSA_RELAY_CONTRACT = Object.freeze({
  scope: 'Diagnostic normal relay deployment, literal S1 marker expiry check and retirement only; no public registration.',
  mapping: 'One independent three-DP card, chosen facing, low/high deployable tiles, no host-range restriction, zero deployment slots. The promotion-selected lifetime starts at accepted deployment. Removal restores one card with a thirty-second redeployment timer. Manual withdrawal refunds floor(cost × source ratio); expiry and owner retirement do not refund. Original single-facing Start/Idle/Die and passive invulnerability, ally-target-free and heal-free flags are retained.',
  limits: 'Tile/card acceptance, floor refund, stock/cooldown dispatch, timeout ordering and native flag aliases use explicit local simulator rules. At the original lifetime finish, a literal aphris_sk1_token marker suppresses withdrawal once; the timer does not restart if that marker is later removed. Marker production, S2/S3 and owner talent effects compose separately. No native particles/audio, module or compiled/frame parity approval.',
  frameParity: false,
});
export const APHRISSA_S3_RELAY_CONTRACT = Object.freeze({
  scope: 'Held S3 relay charge lease, multiple current relay lives, original host-birth marker and reset/withdraw actions; no owner account or public admission.',
  mapping: 'An explicit caller begins one selected S3 lease. Source token_recharge_cnt adds two card slots before forced withdrawal of current tracked relays and immediate reset of all card cooldowns. Each free ready slot spends three DP and permits another relay; each removed relay returns its own slot on the source thirty-second clock. A relay born under any original CheckHostContainsBuff key receives the same self-sourced nonderived infinite aphris_sk1_token marker. Ending the exact lease subtracts the two extra slots, withdraws all tracked relay lives without refund and resets the remaining baseline card immediately. Unrelated same-ID summons, replacement decks and stale lease tickets are not adopted.',
  limits: 'Card slots, independent recovery, action transaction/reentry guards, tracked-token ownership, fixed-tick expiry and integer withdrawal refunds are local simulator mappings. ForceRechargeToken and ResetTokenRespawnTime compiled ordering, charge cancellation versus ON_OWNER_FINISH dispatch and native frame parity remain unverified. The caller owns charge/active/end phases and decides when these retained action sequences run. This resource component implements neither S3 damage nor its skill account, animations, native particles/audio or public admission.',
  frameParity: false,
});
const present = unit => unit?.alive && unit.deployed && !unit._removing;
const due = (battle, time) => battle.time + 1e-8 >= time;
const CLAIMED = Symbol('aphrissa:card-placement');

export function prepareAphrissaRelay(b, u, {contract} = {}) {
  if (contract !== APHRISSA_RELAY_CONTRACT || u.def.charId !== ID || u.deploySeq !== 0
    || u.mem.aphrissaRelay) throw Error('Fresh selected Aphrissa and explicit normal relay contract required');
  return prepareRelay(b, u, false);
}
export function prepareAphrissaS3Relay(b, u, {contract} = {}) {
  if (contract !== APHRISSA_S3_RELAY_CONTRACT || u.def.charId !== ID || u.deploySeq !== 0
    || u.mem.aphrissaRelay) throw Error('Fresh selected Aphrissa S3 and exact relay lease contract required');
  const selected = selectedAphrissaInputs(u), n = aphrissaNativeInputs(), t = n.templates;
  const start = t['aphris_sk3[token-withdraw]'].eventToActions.ON_BUFF_START;
  const end = t['aphris_sk3[on_finish]'].eventToActions.ON_BUFF_FINISH;
  const birth = t['aphris_pc_t[with-draw]'].eventToActions.ON_BUFF_START[0];
  if (selected.index !== 2 || selected.bb.token_recharge_cnt !== 2
    || start[0]._cntKey !== 'token_recharge_cnt' || start[0]._rechargeTiming !== 'NORMAL'
    || start[0]._refreshRemainingCnt !== false || start[1]._force !== true || start[1]._checkContainsBuff !== false
    || start[3]._waitFirstPeriod !== false || end[0]._minusParamKey !== 'token_recharge_cnt'
    || end[1]._cntKey !== 'minus_recharge_cnt' || end[1]._rechargeTiming !== 'ON_FINISH'
    || end[2]._force !== true || end[4]._waitFirstPeriod !== false
    || birth._conditionsNode[0]._buffKeys.join(',') !== 'aphris_sk1,aphris_sk3[sheltering],aphris_sk3[on_finish],aphris_sk3[mark]'
    || birth._conditionsNode[0].isAND !== false || birth._succeedNodes[0]._isDerivedBuff !== false
    || birth._succeedNodes[0]._buff.buffKey !== 'aphris_sk1_token'
    || birth._succeedNodes[0]._buff.disableOverride !== true || birth._succeedNodes[0]._buff.lifeTimeType !== 'INFINITY')
    throw Error('Changed original Aphrissa S3 relay actions');
  return prepareRelay(b, u, true);
}
function prepareRelay(b, u, s3) {
  const selected = selectedAphrissaInputs(u), record = selectedAphrissaRelay(selected.build);
  const native = aphrissaNativeInputs(), templates = native.templates;
  const passive = native.relayPassive._buffs;
  const expiry = templates['aphris_pc_t[with-draw]'].eventToActions.ON_BUFF_FINISH;
  if (templates['charge_token[born]'].eventToActions.ON_OWNER_BORN[0]._cntKey !== 'cnt'
    || templates['aphris_pc[recharge]'].eventToActions.ON_BUFF_FINISH[0]._rechargeTiming !== 'ON_FINISH'
    || expiry[2]._force !== true || expiry[0]._buffKeys.join(',') !== 'aphris_sk1_token'
    || expiry[0]._checkBuffSource !== false || !expiry[1].$type.includes('+IfNot,')
    || passive.length !== 1 || passive[0].attributes.abnormalFlags.join(',') !== '5,15,7'
    || passive[0].attributes.attributeModifiers[0].attributeType !== 5
    || passive[0].attributes.attributeModifiers[0].value !== 0
    || record.stats.cost !== 3 || record.stats.respawnTime !== 30 || record.stats.maxDeployCount !== 1)
    throw Error('Changed original Aphrissa normal relay graph');
  const deck = new AphrissaRelay(b, u, record, s3);
  u.mem.aphrissaRelay = deck;
  return deck;
}

class AphrissaRelay {
  constructor(b, u, record, s3) {
    Object.assign(this, {b, u, record, s3, seq: null, cards: [], points: new Map(),
      lease: null, leaseSeq: 0, generation: 0, mutating: false, placing: false, stopped: false, handles: []});
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
  valid() { return !this.stopped && this.seq === this.u.deploySeq && present(this.u)
    && this.u.mem.aphrissaRelay === this; }
  get stock() { return this.cards.filter(card => card.unit === null).length; }
  get readyAt() { return Math.min(...this.cards.filter(card => card.unit === null).map(card => card.readyAt)); }
  get point() { return this.points.values().next().value ?? null; }
  own() {
    return [...this.points.values()].filter(s => !s.finished && present(s.unit)
      && s.seq === s.unit.deploySeq).map(s => s.unit);
  }
  placementError(row, col) {
    const b = this.b;
    if (!canDeployInViewport(b.viewport)) return 'Open the fullscreen workspace to deploy.';
    if (b.finished) return 'Battle has ended.';
    if (!this.valid() || this.u.hidden) return 'Deploy Aphrissa first.';
    if (this.placing || this.mutating || this.stock < 1 || this.own().length >= this.cards.length) return 'Relay is already deployed.';
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
  lifetimeSpec(currentUnit) {
    return {kind: 'passive', duration: this.record.duration,
      formCountdown: () => {
        const s = this.points.get(currentUnit());
        return this.valid() && s && present(s.unit) && s.seq === s.unit.deploySeq
          && !s.timerHidden && !s.unit.findBuff('aphris_sk1_token')
          ? {remaining: Math.max(0, s.expiresAt - this.b.time),
          duration: this.record.duration, label: 'Relay remaining'} : null;
      }};
  }
  place(row, col, dir = 'RIGHT') {
    const error = this.placementError(row, col);
    if (error) throw Error(error);
    if (!['UP', 'DOWN', 'LEFT', 'RIGHT'].includes(dir)) throw Error('Choose a facing direction.');
    const b = this.b, paid = this.record.stats.cost, generation = this.generation;
    const card = this.cards.find(card => card.unit === null && due(b, card.readyAt));
    const previousReady = card.readyAt;
    this.placing = true; card.unit = CLAIMED;
    b.addDp(this.u.ownerId, -paid);
    let token, created;
    try {
      token = b.spawnToken(this.u, TOKEN, row, col, {dir, def: this.def,
        kit: {trait: {noAttack: true}, talents: [], skill: this.lifetimeSpec(() => created),
          install: (_b, unit) => {
            created = unit; unit.deploymentSlotCost = 0;
            unit.mem.regularSummonCard = this.state.key;
            b.addBuff(unit, {key: 'aphrissa:relay-passive', source: unit, persist: true, allowDead: true,
              flags: {invulnerable: true, isolated: true, healFree: true}, mods: {blockCntMul: 0}});
          }}});
      if (!token || !present(token) || !this.valid() || this.generation !== generation
        || !this.cards.includes(card) || card.unit !== CLAIMED) throw Error('Relay deployment failed.');
      if (this.s3) this.birthMarker(token);
      if (!this.valid() || !present(token) || this.generation !== generation
        || !this.cards.includes(card) || card.unit !== CLAIMED) throw Error('Relay deployment failed.');
      const point = {unit: token, seq: token.deploySeq, card, bornAt: b.time,
        expiresAt: b.time + this.record.duration, lifetimeResolved: false,
        timerHidden: !!token.findBuff('aphris_sk1_token'), finished: false, mode: 'born'};
      this.points.set(token, point); card.unit = token; card.readyAt = Infinity;
      this.visual(point, 'Start');
      return token;
    } catch (error) {
      token ??= created;
      if (present(token)) b._remove(token, 'aphrissa-relay-placement-cancelled', null, true);
      else if (token) { b.offOwner(token); token.removed = true; }
      b.addDp(this.u.ownerId, paid);
      if (this.valid() && this.generation === generation && this.cards.includes(card) && card.unit === CLAIMED) {
        card.unit = null; card.readyAt = previousReady;
      }
      throw error;
    } finally { this.placing = false; }
  }
  finish(s, {remove = false, reason = 'removed'} = {}) {
    if (!s || s.finished) return;
    s.finished = true;
    if (this.points.get(s.unit) === s) this.points.delete(s.unit);
    if (this.valid() && this.cards.includes(s.card) && s.card.unit === s.unit) {
      s.card.unit = null; s.card.readyAt = this.b.time + this.record.stats.respawnTime;
    }
    if (remove && present(s.unit) && s.unit.deploySeq === s.seq)
      this.b._remove(s.unit, `aphrissa-relay-${reason}`, null, true);
  }
  retreat(token) {
    if (!canDeployInViewport(this.b.viewport) || this.b.finished || !this.valid()
      || this.mutating || this.points.get(token)?.seq !== token.deploySeq
      || !this.own().includes(token)) throw Error('Select the current relay in fullscreen.');
    // Same integer refund policy as StandardBattle; native token ratio is 0.5.
    this.b.addDp(this.u.ownerId, Math.floor(this.record.stats.cost * this.record.deployment.refundRatio));
    this.finish(this.points.get(token), {remove: true, reason: 'withdrawal'});
    return true;
  }
  tick() {
    if (this.seq === null && !this.stopped && !this.b.finished) return;
    if (!this.valid()) { this.stop(); return; }
    for (const s of [...this.points.values()]) this.tickPoint(s);
  }
  tickPoint(s) {
    if (!this.valid() || this.points.get(s.unit) !== s) return;
    if (!present(s.unit) || s.unit.deploySeq !== s.seq) { this.finish(s); return; }
    if (s.unit.findBuff('aphris_sk1_token')) s.timerHidden = true;
    if (!s.lifetimeResolved && due(this.b, s.expiresAt)) {
      s.lifetimeResolved = true;
      if (!s.unit.findBuff('aphris_sk1_token')) { this.finish(s, {remove: true, reason: 'expired'}); return; }
    }
    if (s.mode === 'born' && due(this.b, s.bornAt + clocks.tokens[TOKEN].models.Single.exactDurations.Start)) {
      s.mode = 'idle'; this.visual(s, 'Idle', true);
    }
  }
  birthMarker(token) {
    const hostKeys = ['aphris_sk1', 'aphris_sk3[sheltering]', 'aphris_sk3[on_finish]', 'aphris_sk3[mark]'];
    if (!this.valid() || !hostKeys.some(key => this.u.findBuff(key)) || token.findBuff('aphris_sk1_token')) return;
    const life = token.deploySeq, generation = this.generation, ticket = Object.freeze({life, generation});
    const permit = (unit, buff) => unit === token && this.valid() && generation === this.generation
      && token.ownerUnit === this.u && token.deploySeq === life && present(token)
      && hostKeys.some(key => this.u.findBuff(key)) && !token.findBuff('aphris_sk1_token')
      && buff.source === token && buff.key === 'aphris_sk1_token' && buff.duration === Infinity
      && buff.data?.aphrissaRelayBirth === ticket && !Object.keys(buff.mods ?? {}).length && !Object.keys(buff.flags ?? {}).length;
    this.b.addBuff(token, {key: 'aphris_sk1_token', source: token, duration: Infinity,
      data: {nativeKey: 'aphris_sk1_token', aphrissaRelayBirth: ticket}, admit: permit});
  }
  beginS3() {
    if (!this.s3 || !this.valid() || this.b.finished || this.lease || this.placing || this.mutating) return null;
    this.mutating = true;
    const lease = this.lease = Object.freeze({life: this.seq, id: ++this.leaseSeq});
    this.generation++;
    try {
      this.cards.push(...Array.from({length: this.record.owner.bb.token_recharge_cnt}, () => ({unit: null, readyAt: this.b.time})));
      for (const point of [...this.points.values()]) {
        this.finish(point, {remove: true, reason: 's3-start'});
        if (!this.valid() || this.lease !== lease) return null;
      }
      for (const card of this.cards) if (card.unit === null) card.readyAt = this.b.time;
      return this.valid() && this.lease === lease ? lease : null;
    } finally { this.mutating = false; }
  }
  endS3(lease) {
    if (!lease || !this.s3 || !this.valid() || this.lease !== lease || this.mutating) return false;
    this.mutating = true; this.lease = null; this.generation++;
    try {
      this.cards = this.cards.slice(0, 1);
      for (const point of [...this.points.values()]) {
        this.finish(point, {remove: true, reason: 's3-end'});
        if (!this.valid()) return false;
      }
      for (const card of this.cards) if (card.unit === null || card.unit === CLAIMED) {
        card.unit = null; card.readyAt = this.b.time;
      }
      return this.valid();
    } finally { this.mutating = false; }
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
        this.seq = u.deploySeq; this.cards = [{unit: null, readyAt: b.time}];
      }, {owner: u}),
      b.on('tick', () => this.tick(), {owner: u}),
      b.on('death', ({unit}) => { if (unit === u) this.stop(); else this.finish(this.points.get(unit)); }, {owner: u}),
      b.on('removed', ({unit}) => { if (unit === u) this.stop(); else this.finish(this.points.get(unit)); }, {owner: u}),
      b.on('battleEnd', () => this.stop(), {owner: u}),
    ];
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.cards = []; this.lease = null; this.generation++;
    for (const point of [...this.points.values()]) this.finish(point, {remove: true, reason: 'owner-finished'});
    if (this.b.regularSummons?.get(this.state.key) === this.state) this.b.regularSummons.delete(this.state.key);
    for (const handle of this.handles) this.b.off(handle);
    this.handles = [];
  }
}
