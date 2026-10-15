// SPDX-License-Identifier: GPL-3.0-or-later
// Selected command-center lifecycle only; owner combat/skills stay unregistered.
import e from '../../../data/arkpedia-native-operators/char_4228_closur.json' with { type: 'json' };
import { CLOSUR_ID as ID, CLOSUR_TOKEN_ID as TOKEN, selectedClosurBuild, selectedClosurToken } from './arkpedia-closur-source.js';
import { normalizeChess, normSpType } from '../simdata.js';
import { absoluteRangeKeys } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { canDeployInViewport } from '../../../shared/arkpedia/squad.js';
import { GEO } from '../../../shared/constants.js';
const { COLS } = GEO;
export const CLOSUR_POINT_CONTRACT = Object.freeze({
  scope: 'Selected original command-center placement, fake defeat, regeneration and owned reinforcement marking',
  mapping: 'The one zero-cost fixed-facing token uses its own elite/level stats and selected passive range. It never attacks. A fatal hit or manual withdrawal leaves a nonblocking untargetable tactical point, then a 15-second timer starts original Start playback. Rebirth restores HP/block at the literal OnStart event. Aura recipients are sampled per tick and cleared during fake death.',
  limits: 'Born/rally FSM and event aliases, category flags, body/tile geometry, one-point admission and tick ordering are explicit local mappings. The token is still a local ally token during fake defeat; native TRAP_OR_ITEM is represented by selection/control flags. Owner combat, source skills, public card delivery, native particles/audio/modules and original game-frame/pixel parity remain outside this contract.',
  frameParity: false,
});
const present = u => u?.alive && u.deployed && !u._removing;
const live = u => present(u) && !u.hidden;
const same = (a, z) => JSON.stringify(a) === JSON.stringify(z);
const inactive = 'closur:point:inactive';
const sourcePart = id => e.tokens[TOKEN].flatMap(row => row.components).find(p => p.pathId === id)?.data;
export class ClosurPointController {
  constructor(b, u, record) {
    this.b = b; this.u = u; this.record = record; this.seq = null; this.point = null; this.stopped = false;
    this.handles = []; this.recipients = new Set(); this.friendKey = `closur:friend:${u.id}`; this.readyAt = 0;
  }
  valid() { return !this.stopped && !this.b.finished && present(this.u) && this.seq === this.u.deploySeq; }
  active() { return this.valid() && this.point?.mode === 'active' && live(this.point.unit); }
  range() {
    if (!this.active()) return new Set();
    const t = this.point.unit;
    return new Set(absoluteRangeKeys(this.record.rangeGrid, t.tileR, t.tileC, 'RIGHT'));
  }
  mark() {
    const keys = this.range();
    const all = new Set([...this.recipients, ...this.b.allyUnits]);
    for (const a of all) {
      const inside = this.active() && live(a) && a.kind !== 'device' && this.b.allySelectable(a, this.point.unit)
        && !a.s.flags.untargetable && bodyInKeys(a, keys);
      if (!inside) { this.b.removeBuff(a, this.friendKey); this.recipients.delete(a); continue; }
      if (!a.findBuff(this.friendKey)) this.b.addBuff(a, { key: this.friendKey, source: this.u });
      this.recipients.add(a);
    }
  }
  friends() { this.mark(); return [...this.recipients]; }
  placementError(row, col) {
    const b = this.b;
    if (!canDeployInViewport(b.viewport)) return 'Open the fullscreen workspace to deploy.';
    if (!this.valid() || !live(this.u)) return 'Deploy the current Closure owner first.';
    if (this.point && present(this.point.unit)) return 'Command center is already deployed.';
    if (b.time + 1e-9 < this.readyAt) return 'Command center is still redeploying.';
    if (!Number.isInteger(row) || !Number.isInteger(col) || !b.grid.inRect(row, col)) return 'Select a tile on the map.';
    if (!['ALL', 'MELEE', 'RANGED'].includes(b.grid.tile(row, col).build)) return 'Choose a deployable tile.';
    if (b.unitAt(row, col)) return 'Tile is occupied.';
    if (b.tileReservation(row, col) || b.downOn(row, col)) return 'Tile is reserved for an operator return.';
    if (b.rangeChanged(this.u)) b._refreshRange(this.u);
    if (!this.u.rangeKeySet.has(row * COLS + col)) return "Choose a tile inside Closure's attack range.";
    return null;
  }
  place(row, col) {
    const error = this.placementError(row, col); if (error) throw Error(error);
    const { b, u } = this, t = b.spawnToken(u, TOKEN, row, col, { def: this.record, dir: 'RIGHT', kit: {
      talents: [], skill: null, trait: { noAttack: true, requiresAcceptedLaunch: true,
        acceptAreaAttack: () => false, launchAreaAttack: () => false },
      install: (battle, token) => {
        token.deploymentSlotCost = 0;
        battle.addBuff(token, { key: 'closur:point:heal-free', flags: { healFree: true }, persist: true, allowDead: true });
      },
    } });
    if (!t) throw Error('Command center placement failed.');
    t.deploymentSlotCost = 0; t.mem.regularSummonCard = `summon:${ID}`;
    const state = this.point = { unit: t, mode: 'born', generation: 0, visual: 0, handles: [] };
    t.mem.closurPoint = state; t.mem.metalCrabRest = () => this.rest(state);
    state.handles = [b.on('fatal', ctx => {
      if (ctx.unit !== t || state.mode !== 'active') return;
      ctx.prevented = true; this.rest(state, false); ctx.afterHpLoss = () => { if (present(t)) t.hp = 1; };
    }, { owner: t }), b.on('beforeStatus', ctx => {
      if (ctx.target === t && state.mode !== 'active' && ['stun', 'freeze', 'silence'].includes(ctx.status)) ctx.cancel = true;
    }, { owner: t }), b.on('death', ({ unit }) => {
      if (unit === t) { state.generation++; state.mode = 'removed'; if (this.point === state) this.mark(); }
    }, { owner: t })];
    this.readyAt = b.time + this.record.stats.respawnTime; this.warm(state); return t;
  }
  current(state) { return this.valid() && this.point === state && present(state.unit); }
  model(state) { return e.models[TOKEN][state.unit.dir === 'UP' ? 'Back' : 'Front']; }
  visual(state, clip, loop = false) {
    if (this.model(state).durations[clip] == null) return false;
    state.unit.mem.regularFormVisual = { clip, loop, ...(!loop ? { playId: `closur-point:${state.unit.id}:${++state.visual}` } : {}) };
    return true;
  }
  warm(state) {
    if (!this.current(state)) return;
    const { b } = this, t = state.unit, generation = ++state.generation, model = this.model(state);
    state.mode = 'born'; this.visual(state, 'Start');
    b.addBuff(t, { key: inactive, flags: { invulnerable: true, untargetable: true, isolated: true,
      noHeal: true, noSp: true, disarm: true, undeadable: true }, mods: { blockCntMul: 0 } });
    const event = model.eventPayloads.Start.find(p => p.name === 'OnStart').time;
    b.after(event, () => {
      if (!this.current(state) || state.generation !== generation) return;
      b.removeBuff(t, inactive); t.hp = t.s.maxHp; state.mode = 'active'; this.mark();
    }, { owner: t });
    b.after(model.durations.Start, () => {
      if (this.current(state) && state.generation === generation && state.mode === 'active') this.visual(state, 'Idle', true);
    }, { owner: t });
  }
  rest(state = this.point, restoreHp = true) {
    if (!state || !this.current(state) || state.mode !== 'active') return false;
    const { b } = this, t = state.unit, generation = ++state.generation;
    state.mode = 'recharge'; b.releaseBlocked(t);
    for (const buff of t.buffs.slice()) if (!buff.persist && !buff.key.startsWith('closur:friend:')) b.removeBuff(t, buff.key);
    b.addBuff(t, { key: inactive, flags: { invulnerable: true, untargetable: true, isolated: true,
      noHeal: true, noSp: true, disarm: true, undeadable: true }, mods: { blockCntMul: 0 } });
    if (restoreHp) t.hp = 1;
    this.mark(); this.visual(state, 'Die');
    state.readyAt = b.time + this.record.talents[1].blackboard.find(p => p.key === 'interval').value;
    b.after(state.readyAt - b.time, () => {
      if (this.current(state) && state.generation === generation && state.mode === 'recharge') this.warm(state);
    }, { owner: t });
    return true;
  }
  install() {
    if (this.stopped || this.handles.length) throw Error('Command center controller cannot be reinstalled');
    this.handles = [this.b.on('deploy', ({ unit, move }) => {
      if (unit === this.u && !move) { this.seq = this.u.deploySeq; this.mark(); }
    }, { owner: this.u }), this.b.on('tick', () => {
      if (this.seq !== null && !this.valid()) this.stop(); else this.mark();
    }, { owner: this.u }), this.b.on('death', ({ unit }) => { if (unit === this.u) this.stop(); }, { owner: this.u }),
    this.b.on('battleEnd', () => this.stop())];
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true;
    if (this.point) {
      this.point.generation++;
      for (const h of this.point.handles) this.b.off(h);
      if (present(this.point.unit)) this.b.retreat(this.point.unit, { permanent: true, reason: 'owner-left' });
    }
    for (const a of this.recipients) this.b.removeBuff(a, this.friendKey);
    this.recipients.clear(); for (const h of this.handles) this.b.off(h); this.handles = [];
  }
}
export function prepareClosurPoint(b, u, { contract } = {}) {
  if (contract !== CLOSUR_POINT_CONTRACT || u.def.charId !== ID || u.deploySeq !== 0 || u.mem.closurPointController)
    throw Error('Command center requires a fresh selected Closure owner and explicit contract');
  const build = u.def.raw.arkpedia, selected = selectedClosurBuild(build);
  const skill = u.def.skill, source = selected.source;
  if (!same(u.def.stats, normalizeChess({ stats: selected.stats }).stats) || !same(u.rangeGrid, selected.rangeGrid)
    || skill.id !== build.skillId || !same(skill.bb, selected.bb) || !same(u.def.tags, selected.tags)
    || skill.skillType !== source.skillType || skill.durationType !== source.durationType
    || skill.spType !== normSpType(source.spData.spType) || skill.spCost !== source.spData.spCost
    || skill.initSp !== source.spData.initSp || skill.duration !== source.duration || skill.maxCharges !== source.spData.maxChargeTime
    || !same(skill.rangeGrid ?? [], selected.skillRangeGrid) || !same(u.def.talents.map(t => t.bb), selected.talentBb))
    throw Error('Incomplete Closure source selection');
  const root = sourcePart('9056934687418337401'), aura = sourcePart('5027935209766897785');
  if (root._isFixedRotation !== 1 || root._occupiedRemainingCharacterCnt !== 0 || root._buildCondition.buildableType !== 3
    || root._buildCondition.limitByHostAttackRange !== 1 || aura._ignoreOwnerFakeDeath !== 0)
    throw Error('Unreviewed original command-center lifecycle inputs');
  const record = selectedClosurToken(build), controller = new ClosurPointController(b, u, record);
  u.mem.closurPointController = controller; return { record, controller };
}
