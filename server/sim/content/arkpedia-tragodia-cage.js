// SPDX-License-Identifier: GPL-3.0-or-later
// Opt-in source-selected S3 capture diagnostic; no public registration.
import evidence from '../../../data/arkpedia-tragodia-prefabs.json' with { type: 'json' };
import { prepareTragodiaOwnerSkills, TRAGODIA_OWNER_SKILLS_CONTRACT } from './arkpedia-tragodia-owner-skills.js';
import { tragodiaSourceComponent as component, TRAGODIA_ID } from './arkpedia-tragodia-source.js';
import { normalizeToken } from '../simdata.js';
import { bodyInKeys } from '../body.js';
import { canTargetEnemy } from '../targeting.js';
import { TragodiaCoreController } from './arkpedia-tragodia.js';

export const TRAGODIA_CAGE = 'token_10055_phatm2_mndclv';
export const TRAGODIA_CAGE_CONTRACT = Object.freeze({
  scope: 'Source-selected S3 automatic Cage of Chaos creation, refresh, captured blocking, attack-count life and cleanup; diagnostic only',
  mapping: 'Current source-range aura owns one non-independent target slot. Existing Nervous bursts at skill start create cages on empty lowland root tiles; a new accepted Nervous burst creates or refreshes the cage already on that tile. Independent token stats, no DP/slots/manual card, no ordinary acquisition. Creation and refresh capture the ground enemies presently on that root tile, respecting ordinary unblockability/levitation/fear. Captures retain normal attack targets with zero ordinary capacity and never catch later arrivals until refresh. Positive landed HP receipts from captured attackers consume one of three HP per attackId; repeated hits of the same attack do not consume extra lives. Refresh searches again without healing. Empty cages vanish. Skill finish starts an owned thirty-second clock, restart clears only owned clocks, and owner retirement kills owned cages.',
  limits: 'Native event97, ignoreBlockMode1, numeric flags7/15 and modifiers13/19, force-spawn/card stock and advanced build-mask dispatch, target-root rounding, immediate capture/transfer, ground/immunity eligibility, sampled aura ownership and attackId frequency counting are explicit local mappings. Attack receipts without an identity count individually. Three-hit life follows the pinned English description, not recovered compiled damage conversion. Capture may transfer a current block from another blocker. Scripted HP loss/removal uses the shared engine. Native particles, modules, audio and compiled Unity frame/event/blocking parity remain unverified; no substitute Spine or public kit approval.',
  frameParity: false,
});
const AURA = 'phatm2_s_3[token]', EXPIRY = 'phatm2_s_3[token_cooldown]';
const auraOwners = new WeakMap(), cageOwners = new WeakMap();
const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const type = n => n.$type.split('+').at(-1).split(',')[0];
const event = (key, name) => evidence.templates[key].eventToActions[name];
const same = (a, z) => JSON.stringify(a) === JSON.stringify(z);

function verify(core, contract) {
  if (contract !== TRAGODIA_CAGE_CONTRACT || !(core instanceof TragodiaCoreController)
    || !core.skills || core.record.index !== 2 || core.u.deploySeq !== 0)
    throw Error('Cage of Chaos requires a fresh S3 owner and the reviewed cage contract');
  const raw = core.record.tokenRecords[TRAGODIA_CAGE];
  const root = component('6352044219529720151'), passive = component('-1339889754114526889')._buffs[0];
  const spawn = JSON.parse(component('-4415508241769316265')._actions.SerializedState);
  const aura = component('6681649672694937866');
  const trigger = event('phatm2_s_3[token][trigger]', 'ON_BUFF_START');
  const native = evidence.originalTemplates['token_phatm2_mndclv[passive]'].eventToActions._items;
  if (root._occupiedRemainingCharacterCnt !== 0 || root._ignoreBlockMode !== 1
    || root._buildCondition.limitByHostAttackRange !== 0 || root._blockMode !== 0
    || !same(passive.attributes.abnormalFlags, [7, 15])
    || !same(passive.attributes.attributeModifiers.map(m => [m.attributeType, m.formulaItem, m.value]), [[13, 3, 0], [19, 3, 0]])
    || passive.overrideEffectKey !== 'phatm2_skill_03_prison_01'
    || native.length !== 1 || native[0].key !== 97
    || type(JSON.parse(native[0].value.SerializedState)[0]) !== 'CharSearchBlockeeImmediate'
    || component('-656703250279448489')._limitTargetNum !== 0
    || spawn[0]._recoveryType !== 'SANITY' || spawn[0]._skipInEPBreakRecoveryCheck
    || spawn[6]._checkBuildableType || !spawn[6]._forceSpawn || !spawn[6]._spawnTokenFromCards
    || aura._removeBuffWhenTargetLeave !== 1 || aura._removeBuffWhenAbilityDetached !== 1
    || aura._buffs[0].independentCharacterSource !== 0 || type(trigger[1]) !== 'CharSearchBlockeeImmediate'
    || !event('phatm2_s_3[token_clear_cooldown]', 'ON_BUFF_START')[0]._checkBuffSource
    || !event('phatm2_s_3[die]', 'ON_SKILL_FINISH')[0]._buffData.disableOverride
    || raw.binding.renderingKind !== 'effect-only' || !same(raw.models, {})
    || raw.source.skills.some(s => s.overridePrefabKey !== 'sktok_empty')
    || raw.skill.skillType !== 'PASSIVE' || raw.skill.spData.spCost !== 0
    || core.record.bb['phatm2_s_3[token_cooldown].interval'] !== 30)
    throw Error('Unreviewed Cage of Chaos native source');
  const frames = raw.phase.attributesKeyFrames;
  const stats = Object.fromEntries(Object.entries(frames[0].data).filter(([, v]) => typeof v === 'number'));
  if (frames.some(f => !same(f.data, frames[0].data)) || stats.maxHp !== 3 || stats.atk !== 100
    || stats.blockCnt !== 0 || stats.cost !== 0 || stats.def !== 0 || stats.respawnTime !== 5)
    throw Error('Unreviewed Cage of Chaos independent stats');
  return normalizeToken(TRAGODIA_CAGE, { name: raw.source.name, position: raw.source.position,
    profession: raw.source.profession, stats, talents: [],
    rangeGrid: evidence.tables.ranges[raw.phase.rangeId].grids.map(g => [g.row, g.col]),
    skill: { ...raw.skill, ...raw.skill.spData, skillId: raw.skillId } });
}

export class TragodiaCages {
  constructor(core, { contract } = {}) {
    this.def = verify(core, contract); this.core = core; this.skills = core.skills;
    this.b = core.b; this.u = core.u; this.tokens = new Map(); this.claims = new Map();
    this.stopped = false; this.handles = []; this.driver = null;
  }
  active() { return !this.stopped && this.skills.active() && this.skills.mode === 3; }
  valid(entry) { return !this.stopped && this.core.valid() && live(entry?.token)
    && entry.token.deploySeq === entry.seq && !entry.removed; }
  eligible(t) { return this.active() && canTargetEnemy(this.u, t, { canHitFly: true })
    && bodyInKeys(t, this.core.keys()); }
  clearClaim(t, entry = this.claims.get(t)) {
    if (!entry) return;
    if (this.claims.get(t) === entry) this.claims.delete(t);
    if (auraOwners.get(t) === entry) auraOwners.delete(t);
    if (entry.buff) this.b.removeBuff(t, entry.buff);
  }
  syncAura() {
    for (const [t, entry] of this.claims) if (!this.eligible(t) || t.deploySeq !== entry.seq
      || !t.buffs.includes(entry.buff)) this.clearClaim(t, entry);
    if (!this.active()) return;
    for (const t of this.b.enemies) {
      if (!this.eligible(t) || this.claims.has(t)) continue;
      const other = auraOwners.get(t);
      if ((other && other.manager.eligible(t) && other.seq === t.deploySeq
        && (other.admitting || t.buffs.includes(other.buff))) || t.findBuff(AURA)) continue;
      const entry = { manager: this, seq: t.deploySeq, buff: null, admitting: true };
      this.claims.set(t, entry); auraOwners.set(t, entry);
      entry.buff = this.b.addBuff(t, { key: AURA, source: this.u, refresh: 'keep',
        onRemove: () => this.clearClaim(t, entry) });
      entry.admitting = false;
      if (!entry.buff || !this.eligible(t) || t.deploySeq !== entry.seq || auraOwners.get(t) !== entry)
        this.clearClaim(t, entry);
    }
  }
  root(t) { return { row: Math.round(t.y), col: Math.round(t.x) }; }
  entryAt(t) { const p = this.root(t); return cageOwners.get(this.b.unitAt(p.row, p.col)); }
  burst({ target, element }) {
    if (element !== 'neural' || !this.active()) return;
    this.syncAura();
    const claim = this.claims.get(target);
    if (!claim || claim.seq !== target.deploySeq || !target.buffs.includes(claim.buff)) return;
    const existing = this.entryAt(target);
    if (existing && existing.manager.valid(existing)) existing.manager.search(existing);
    else this.spawn(target);
  }
  begin() {
    if (!this.active()) return;
    this.syncAura();
    for (const t of this.b.enemies.slice()) {
      if (!this.active()) break;
      if (this.eligible(t) && t.findBuff('neuralBurst') && !this.entryAt(t)) this.spawn(t);
    }
    // Native start clears owned cooldowns after SpawnInRange, not a foreign
    // cage clock merely because that cage was refreshed by this producer.
    if (this.active()) for (const entry of this.tokens.values()) this.clearExpiry(entry);
  }
  end() {
    for (const t of [...this.claims.keys()]) this.clearClaim(t);
    if (!this.core.valid() || !live(this.u)) { this.stop(); return; }
    for (const entry of [...this.tokens.values()]) {
      if (this.active() || this.stopped) break;
      if (!this.valid(entry)) continue;
      const seq = entry.seq;
      entry.expiry = this.b.addBuff(entry.token, { key: EXPIRY, source: this.u,
        duration: this.core.record.bb['phatm2_s_3[token_cooldown].interval'],
        onExpire: () => { if (entry.token.deploySeq === seq) this.finish(entry, 'tragodia-cage-expired'); },
        onRemove: () => { entry.expiry = null; } });
      if (this.active()) this.clearExpiry(entry);
    }
  }
  clearExpiry(entry) {
    const buff = entry.expiry; entry.expiry = null;
    if (buff?.source === this.u) this.b.removeBuff(entry.token, buff);
  }
  capturable(t) { return live(t) && t.side === 'enemy' && !t.isFlying
    && !t.s.flags.unblockable && !t.s.flags.levitate && !t.s.flags.fear; }
  captured(entry, t) { return this.valid(entry) && this.capturable(t)
    && entry.captures.get(t) === t.deploySeq && t.blockedBy === entry.token; }
  search(entry) {
    if (!this.valid(entry) || entry.searching) return;
    entry.searching = true;
    try {
      const t = entry.token;
      for (const e of this.b.enemies.slice()) {
        if (!this.valid(entry)) break;
        if (!this.capturable(e) || Math.round(e.y) !== t.tileR || Math.round(e.x) !== t.tileC) continue;
        if (e.blockedBy && e.blockedBy !== t) this.b._unblock(e);
        if (!this.valid(entry) || !this.capturable(e) || e.blockedBy && e.blockedBy !== t) continue;
        entry.captures.set(e, e.deploySeq);
        if (e.blockedBy !== t) {
          e.blockedBy = t; t.blocking.push(e); e.moving = false;
          this.b.emit('blocked', { blocker: t, enemy: e });
        }
      }
    } finally { entry.searching = false; }
    this.prune(entry);
  }
  prune(entry) {
    if (entry.removed || entry.searching) return;
    if (entry.seq !== entry.token.deploySeq) { this.finish(entry, 'tragodia-cage-stale'); return; }
    for (const [t, seq] of entry.captures) if (!this.capturable(t) || seq !== t.deploySeq
      || t.blockedBy !== entry.token) {
      entry.captures.delete(t);
      if (t.blockedBy === entry.token) this.b._unblock(t);
    }
    if (this.valid(entry) && !entry.captures.size) this.finish(entry, 'tragodia-cage-empty');
  }
  spawn(target) {
    if (!this.active() || !live(target)) return null;
    const { row, col } = this.root(target), b = this.b;
    if (!b.grid.inRect(row, col) || b.grid.tile(row, col).height !== 'LOW'
      || b.unitAt(row, col) || b.tileReservation(row, col)) return null;
    const entry = { manager: this, token: null, seq: null, removed: false,
      captures: new Map(), attacks: new Set(), searching: true, expiry: null };
    const token = b.spawnToken(this.u, TRAGODIA_CAGE, row, col, { def: this.def,
      kit: { talents: [], trait: { noAttack: true,
        retainCapturedBlockee: (_b, _u, t) => this.captured(entry, t) },
      skill: { kind: 'passive', trigger: { rule: 'NEVER' } },
      install: (_b, t) => {
        entry.token = t; this.tokens.set(t, entry); cageOwners.set(t, entry);
        t.deploymentSlotCost = 0; t.mem.noInspire = true;
        t.mem.regularNativeEffect = 'phatm2_skill_03_prison_01';
        b.addBuff(t, { key: 'tragodia:cage-passive', persist: true, allowDead: true,
          flags: { hitCount: true, healFree: true, isolated: true, noHpRecovery: true },
          onTick: () => this.prune(entry) });
        b.addBuff(t, { key: 'immune_to_encourage', persist: true, allowDead: true });
      } } });
    entry.searching = false;
    if (!token || !this.active() || !live(token) || entry.removed
      || !token.findBuff('tragodia:cage-passive') || !token.s.flags.hitCount
      || !token.findBuff('immune_to_encourage')) {
      // Retirement can happen during installation, before spawnToken deploys
      // the half-built unit. A removed entry must still discard that late birth.
      if (token?.alive) b._remove(token, 'tragodia-cage-cancelled', null, true);
      this.finish(entry, 'tragodia-cage-cancelled'); return null;
    }
    entry.seq = token.deploySeq; this.search(entry);
    return this.valid(entry) ? token : null;
  }
  hit(ctx) {
    const entry = this.tokens.get(ctx.target); if (!entry) return;
    const id = ctx.dmg.attackId;
    if (!this.captured(entry, ctx.source) || !ctx.dmg.isAttack || ctx.dmg.sourceless
      || id > 0 && entry.attacks.has(id)) ctx.cancel = true;
  }
  receipt(ctx) {
    const entry = this.tokens.get(ctx.target);
    if (entry && ctx.hpLoss > 0 && ctx.dmg?.isAttack && ctx.dmg.attackId > 0)
      entry.attacks.add(ctx.dmg.attackId);
  }
  finish(entry, reason) {
    if (!entry || entry.removed) return;
    entry.removed = true; this.tokens.delete(entry.token); cageOwners.delete(entry.token);
    this.clearExpiry(entry); entry.captures.clear();
    if (entry.token?.alive && (entry.seq === null || entry.token.deploySeq === entry.seq))
      this.b._remove(entry.token, reason, null, true);
  }
  install() {
    if (this.handles.length) return;
    const b = this.b;
    this.handles = [b.on('elementBurst', ctx => this.burst(ctx), { owner: this.u }),
      b.on('hit', ctx => this.hit(ctx), { owner: this.u }),
      b.on('elementHit', ctx => { if (this.tokens.has(ctx.target)) ctx.cancel = true; }, { owner: this.u }),
      b.on('damaged', ctx => this.receipt(ctx), { owner: this.u }),
      b.on('unblocked', ({ blocker }) => { const e = this.tokens.get(blocker); if (e) this.prune(e); }, { owner: this.u }),
      b.on('death', ({ unit }) => { const e = this.tokens.get(unit); if (e) this.finish(e, 'tragodia-cage-removed'); }, { owner: this.u })];
    this.driver = b.addBuff(this.u, { key: 'tragodia:cage-aura-driver', persist: true, allowDead: true,
      onTick: () => this.syncAura() });
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true;
    for (const t of [...this.claims.keys()]) this.clearClaim(t);
    for (const entry of [...this.tokens.values()]) this.finish(entry, 'tragodia-cage-owner-finish');
    for (const h of this.handles) this.b.off(h); this.handles = [];
    if (this.driver) this.b.removeBuff(this.u, this.driver); this.driver = null;
  }
}

export function prepareTragodiaCages(b, u, { contract } = {}) {
  if (contract !== TRAGODIA_CAGE_CONTRACT || u.def.charId !== TRAGODIA_ID)
    throw Error('Tragodia cages require the reviewed cage contract');
  const prepared = prepareTragodiaOwnerSkills(b, u, { contract: TRAGODIA_OWNER_SKILLS_CONTRACT });
  const cages = new TragodiaCages(prepared.controller, { contract });
  const install = prepared.controller.install.bind(prepared.controller);
  prepared.controller.install = () => { install(); cages.install(); };
  const start = prepared.skills.start.bind(prepared.skills), end = prepared.skills.end.bind(prepared.skills);
  prepared.skills.start = () => { start(); cages.begin(); };
  prepared.skills.end = reason => { const active = prepared.skills.mode === 3; end(reason); if (active) cages.end(); };
  const stop = prepared.skills.stop.bind(prepared.skills);
  prepared.skills.stop = () => { cages.stop(); stop(); };
  return { ...prepared, cages };
}
