// SPDX-License-Identifier: GPL-3.0-or-later
// Native normal Reconstruction card and lifetime, composed with selected skill adapters.
import evidence from '../../../data/arkpedia-mon3tr-prefabs.json' with { type: 'json' };
import { MON3TR_ID as ID, mon3trSourceComponent as component } from './arkpedia-mon3tr-source.js';
import { prepareMon3trHealing, MON3TR_HEALING_CONTRACT } from './arkpedia-mon3tr-healing.js';
import { prepareMon3trS2, MON3TR_S2_CONTRACT } from './arkpedia-mon3tr-s2.js';
import { prepareMon3trS3, MON3TR_S3_CONTRACT } from './arkpedia-mon3tr-s3.js';
import { normalizeToken, flattenBlackboard } from '../simdata.js';
import { sourceCandidate, summonCardId } from '../../../shared/arkpedia/summons.js';
import { canDeployInViewport } from '../../../shared/arkpedia/squad.js';
import { absoluteRangeKeys } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { COLS } from '../constants.js';

export const MON3TR_RECONSTRUCTION_CONTRACT = Object.freeze({
  scope: 'Diagnostic normal Reconstruction card, selected independent stats, pure HP-loss clock, ATK aura and selected S1/S2/S3 composition',
  mapping: 'One three-DP, zero-slot low-ground summon within current host attack range, without facing selection. Stock stays unavailable while deployed; departure returns one card with a source fifteen-second cooldown. Normal withdrawal refunds floor(half cost). Source trait loses eight HP per 0.10000000149011612-second pulse, with an immediate first pulse matching its non-waiting trigger policy. Selected host Talent 1 supplies a strongest-source ATK-percent aura on adjacent selectable allies. Original Single Start/Idle/Die clips remain literal; healing emits no invented token attack animation.',
  limits: 'Normal-mode initialization, first-pulse scheduling, card/cooldown/withdraw transaction and sampled aura ordering are explicit local mappings; compiled preprocessing, native card/FSM dispatch and game-frame parity remain unverified. S3 marker/respawn/return use the separate selected S3 contract and adapter. Modules, particles and audio are not supplied here. No public roster approval is implied.',
  gameplayCorroboration: 'https://prts.wiki/w/%E9%87%8D%E6%9E%84%E4%BD%93',
  frameParity: false,
});
export const RECONSTRUCTION_ID = 'token_10050_monstr_prosts';
const TOKEN = RECONSTRUCTION_ID, AURA = 'mon3tr:reconstruction-attack';
const present = a => a?.alive && a.deployed && !a._removing;
const live = a => present(a) && !a.hidden;
const due = (b, at) => b.time + 1e-8 >= at;
const nativeDrain = component('9174674518516416032')._buffs[0];

function verify() {
  const token = component('3549317659382103584'), aura = component('-7407317300197343712');
  const damage = evidence.templates['prosts_t_1[born_charge]'].eventToActions.ON_BUFF_TRIGGER[0]._failNodes[0];
  if (token._occupiedRemainingCharacterCnt !== 0 || token._buildCondition.buildableType !== 1
    || token._buildCondition.limitByHostAttackRange !== 1 || token._buildCondition.needSpecifyDirection !== 0
    || token._withdrawCostRecoverRatio !== .5 || token._alwaysShowHp !== 1
    || nativeDrain.triggerInterval !== .10000000149011612 || nativeDrain.waitFirstTriggerInterval !== 0
    || nativeDrain.blackboard.find(e => e.key === 'respawn_stopped')?.value !== 1
    || damage._damageType !== 'PURE' || !damage._ignoreForSp || !damage._skipModifierEvent
    || damage._considerUnhurtable || aura._removeBuffWhenTargetLeave !== 1
    || aura._removeBuffWhenAbilityDetached !== 1 || aura._buffs[0].priorityBBKeys[0] !== 'atk'
    || component('6910241295754575392')._targetOptions.purposeMask !== 0)
    throw Error('Unreviewed normal Reconstruction source');
}

export function selectedReconstruction(record) {
  const selected = record.tokenRecords[TOKEN], raw = selected?.source, phase = selected?.phase;
  if (raw !== evidence.tables.tokens[TOKEN] || !phase) throw Error('Expected exact selected Reconstruction source');
  const lo = phase.attributesKeyFrames[0], hi = phase.attributesKeyFrames.at(-1);
  const fraction = hi.level === lo.level ? 0 : (record.build.level - lo.level) / (hi.level - lo.level);
  const stats = Object.fromEntries(Object.entries(lo.data).filter(([, n]) => typeof n === 'number')
    .map(([k, n]) => [k, n + (hi.data[k] - n) * fraction]));
  for (const key of ['maxHp', 'atk', 'def']) stats[key] = Math.round(stats[key]);
  const trait = flattenBlackboard(sourceCandidate(raw.trait.candidates, record.build).blackboard);
  if (trait.damage_per_second !== 80 || stats.cost !== 3 || stats.respawnTime !== 15
    || stats.maxDeployCount !== 1 || stats.atk !== 0 || stats.blockCnt !== 0)
    throw Error('Unreviewed selected Reconstruction stats');
  const rangeGrid = evidence.tables.ranges[phase.rangeId].grids.map(g => [g.row, g.col]);
  const def = normalizeToken(TOKEN, { name: raw.name, position: raw.position, profession: raw.profession,
    stats, rangeGrid, arkpedia: { ...record.build },
    skill: { ...selected.skill, ...selected.skill.spData, skillId: selected.skillId } });
  return { ...selected, ...def, stats: { ...def.stats, maxDeployCount: stats.maxDeployCount, maxDeckStackCnt: stats.maxDeckStackCnt },
    arkpedia: { ...record.build }, trait,
    aura: record.talentBb[0].atk, interval: nativeDrain.triggerInterval };
}

function syncAuras(b) {
  const state = b._mon3trReconstructionAuras;
  if (!state) return;
  if (state.syncing) { state.dirty = true; return; }
  state.syncing = true;
  try {
    let passes = 0;
    do {
      state.dirty = false;
      for (const ally of [...b.allyUnits]) {
        let best;
        if (live(ally) && ally.side === 'ally' && ally.kind !== 'device' && !ally.s.flags.untargetable)
          for (const deck of state.decks) {
            const point = deck.point;
            if (!deck.valid(point) || ally === point.unit || !b.allySelectable(ally, point.unit)
              || !bodyInKeys(ally, deck.keys(point))) continue;
            if (!best || deck.record.aura > best.deck.record.aura) best = { deck, token: point.unit };
          }
        const old = ally.findBuff(AURA);
        if (!best) { if (old) b.removeBuff(ally, old); }
        else if (old?.source !== best.token || old?.mods.atkPct !== best.deck.record.aura) {
          b.addBuff(ally, { key: AURA, source: best.token, mods: { atkPct: best.deck.record.aura } });
          if (!best.deck.valid(best.deck.point) || best.deck.point.unit !== best.token) state.dirty = true;
        }
      }
    } while (state.dirty && ++passes < 8);
  } finally { state.syncing = false; }
}

export class ReconstructionDeck {
  constructor(core) {
    this.core = core; this.b = core.b; this.u = core.u; this.record = selectedReconstruction(core.record);
    this.stock = 0; this.readyAt = Infinity; this.point = null; this.placing = false; this.stopped = false; this.handles = [];
    const deck = this;
    this.state = { key: summonCardId(ID), ownerId: ID, owner: this.u, tokenId: TOKEN, record: this.record, deck: this,
      config: Object.freeze({ deploymentSlotCost: 0, chooseFacing: false, limitByHostAttackRange: true,
        healFree: true, noAttack: true, refundRatio: .5 }),
      get stock() { return deck.stock; }, get readyAt() { return deck.readyAt; } };
  }
  valid(s) { return !this.stopped && this.core.valid() && live(s?.unit) && s.unit.deploySeq === s.seq && !s.finished; }
  own() { return present(this.point?.unit) ? [this.point.unit] : []; }
  keys(s) { return new Set(absoluteRangeKeys(this.record.rangeGrid, s.unit.tileR, s.unit.tileC, 'RIGHT')); }
  placementError(row, col) {
    const b = this.b;
    if (!canDeployInViewport(b.viewport)) return 'Open the fullscreen workspace to deploy.';
    if (b.finished) return 'Battle has ended.';
    if (this.stopped || !this.core.valid() || !live(this.u)) return 'Deploy Mon3tr first.';
    if (this.placing || this.stock <= 0 || this.own().length) return 'Reconstruction is already deployed.';
    if (!due(b, this.readyAt)) return 'Reconstruction is still redeploying.';
    if (!Number.isInteger(row) || !Number.isInteger(col) || !b.grid.inRect(row, col)) return 'Select a tile on the map.';
    if (b.rangeChanged(this.u)) b._refreshRange(this.u);
    if (!this.u.rangeKeySet.has(row * COLS + col)) return "Choose a tile inside Mon3tr's attack range.";
    const tile = b.grid.tile(row, col);
    if (tile.height !== 'LOW' || !['MELEE', 'ALL'].includes(tile.build) || b.grid.isObstacle(row, col)) return 'Choose a low-ground deployment tile.';
    if (b.unitAt(row, col) || b.tileReservation(row, col) || b.downOn(row, col)) return 'Tile is occupied or reserved.';
    if (b.dp < this.record.stats.cost) return 'Not enough DP.';
    return null;
  }
  visual(s, clip, loop = false) {
    s.unit.mem.regularModelFacing = 'front';
    s.unit.mem.regularFormVisual = { clip, loop, speed: 1 };
    s.unit.mem.regularDeathVisual = { clip: 'Die', die: 'Die', duration: this.record.models.Single.durations.Die };
  }
  place(row, col) {
    const error = this.placementError(row, col); if (error) throw Error(error);
    const b = this.b, paid = this.record.stats.cost;
    this.placing = true; this.stock = 0; b.addDp(this.u.ownerId, -paid);
    let unit, point;
    try {
      unit = b.spawnToken(this.u, TOKEN, row, col, { def: this.record, dir: 'RIGHT',
        kit: { talents: [], skill: { kind: 'passive' }, trait: { noAttack: true, noBlock: true },
          install: (_b, token) => {
            token.deploymentSlotCost = 0; token.mem.regularSummonCard = this.state.key;
            b.addBuff(token, { key: 'mon3tr:reconstruction-native', source: this.u, persist: true, allowDead: true,
              flags: { healFree: true, noMove: true, unblockable: true }, mods: { taunt: -1 } });
          } } });
      if (!unit || !this.core.valid() || !live(unit) || this.stopped) throw Error('Reconstruction deployment failed.');
      this.core.attachReconstruction(unit);
      point = { unit, seq: unit.deploySeq, bornAt: b.time, nextLoss: b.time, mode: 'born', finished: false };
      this.point = point; this.readyAt = Infinity;
      this.visual(point, 'Start'); this.tick();
      return unit;
    } catch (error) {
      if (!point) {
        if (present(unit)) { unit.mem.regularDeathVisual = { hide: true }; b._remove(unit, 'mon3tr-placement-cancelled', null, true); }
        b.addDp(this.u.ownerId, paid);
        if (!this.stopped && this.core.valid()) { this.stock = 1; this.readyAt = b.time; }
      }
      throw error;
    } finally { this.placing = false; }
  }
  tick() {
    const s = this.point, b = this.b;
    if (s && this.valid(s)) {
      if (s.mode === 'born' && due(b, s.bornAt + this.record.models.Single.durations.Start)) {
        s.mode = 'idle'; this.visual(s, 'Idle', true);
      }
      while (this.valid(s) && due(b, s.nextLoss)) {
        s.nextLoss += this.record.interval;
        b.loseHp(s.unit, Math.fround(this.record.trait.damage_per_second * this.record.interval),
          { source: s.unit, silent: true, tags: ['mon3tr:reconstruction-hp-loss'] });
      }
    }
    syncAuras(b);
  }
  finish(s, { remove = false, reason = 'removed' } = {}) {
    if (!s || s.finished) return;
    s.finished = true;
    if (this.point === s) this.point = null;
    const attached = this.core.reconstructions.get(s.unit);
    if (attached?.seq === s.seq) { this.b.off(attached.guard); this.core.reconstructions.delete(s.unit); }
    if (!this.stopped && this.core.valid()) { this.stock = 1; this.readyAt = this.b.time + this.record.stats.respawnTime; }
    syncAuras(this.b);
    if (remove && present(s.unit)) {
      s.unit.mem.regularDeathVisual = { hide: true };
      this.b._remove(s.unit, `mon3tr-reconstruction-${reason}`, null, true);
    }
  }
  retreat(token) {
    if (!canDeployInViewport(this.b.viewport) || this.b.finished || token !== this.point?.unit || !this.valid(this.point))
      throw Error('Select the current Reconstruction in fullscreen.');
    this.b.addDp(this.u.ownerId, Math.floor(this.record.stats.cost * .5));
    this.finish(this.point, { remove: true, reason: 'withdrawal' }); return true;
  }
  install() {
    if (this.stopped || this.handles.length) throw Error('Reconstruction deck cannot be reinstalled');
    (this.b.regularSummons ??= new Map()).set(this.state.key, this.state);
    (this.b._mon3trReconstructionAuras ??= { decks: new Set(), syncing: false, dirty: false }).decks.add(this);
    this.handles = [this.b.on('deploy', ({ unit, move }) => {
      if (unit === this.u && !move) { this.stock = 1; this.readyAt = this.b.time; }
      syncAuras(this.b);
    }), this.b.on('tick', () => { if (!this.stopped) this.tick(); }),
    this.b.on('death', ({ unit }) => { if (unit === this.point?.unit) this.finish(this.point); syncAuras(this.b); }),
    this.b.on('battleEnd', () => this.stop())];
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.stock = 0; this.readyAt = Infinity;
    this.finish(this.point, { remove: true, reason: 'owner-finished' });
    this.b._mon3trReconstructionAuras?.decks.delete(this); syncAuras(this.b);
    if (this.b.regularSummons?.get(this.state.key) === this.state) this.b.regularSummons.delete(this.state.key);
    for (const h of this.handles) this.b.off(h); this.handles = [];
  }
}

export function prepareMon3trReconstruction(b, u, { contract } = {}) {
  if (contract !== MON3TR_RECONSTRUCTION_CONTRACT) throw Error('Mon3tr requires its normal Reconstruction contract');
  verify();
  const prepared = u.def.skill?.id === 'skchr_monstr_2' ? prepareMon3trS2(b, u, { contract: MON3TR_S2_CONTRACT })
    : u.def.skill?.id === 'skchr_monstr_3' ? prepareMon3trS3(b, u, { contract: MON3TR_S3_CONTRACT })
      : prepareMon3trHealing(b, u, { contract: MON3TR_HEALING_CONTRACT });
  const deck = new ReconstructionDeck(prepared.controller);
  const install = prepared.controller.install.bind(prepared.controller), stop = prepared.controller.stop.bind(prepared.controller);
  prepared.controller.install = () => { install(); deck.install(); };
  prepared.controller.stop = () => { deck.stop(); stop(); };
  prepared.controller.deck = deck;
  return { ...prepared, deck };
}
