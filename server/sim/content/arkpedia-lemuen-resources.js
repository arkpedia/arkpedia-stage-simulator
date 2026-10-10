// SPDX-License-Identifier: GPL-3.0-or-later
// Unregistered resource/talent links. Cast clocks, release events and managed
// bombardment remain the responsibility of the future complete controller.
import { LEMUEN_ID, selectedLemuenBlackboard } from './arkpedia-lemuen-links.js';
import { bodyInKeys } from '../body.js';
import { canTargetAlly, canTargetEnemy, sortEnemyTargets } from '../targeting.js';

const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const profile = Object.freeze({ canHitFly: true });
const laterano = u => live(u) && u.kind === 'op' && u.tags.has('laterano');
const key = (u, suffix) => `lemuen:${u.id}:${suffix}`;

/** Capacity changes never restore current rounds. The controller supplies one
 * accepted attack ID per group, and explicitly ends the cast after its own
 * original finish phase. Unborn/cancelled work must not call consume(). */
export class LemuenAmmunition {
  constructor(skill, rank) {
    this.base = selectedLemuenBlackboard(skill, rank)['attack@trigger_time'];
    if (!Number.isInteger(this.base) || this.base <= 0) throw Error('Unreviewed Lemuen ammunition');
    this.bonuses = new Map(); this.accepted = new Set();
    this.active = false; this.current = 0; this.removed = false;
  }
  get maximum() { return this.base + [...this.bonuses.values()].reduce((a, n) => a + n, 0); }
  get ammoUi() { return { current: this.current, maximum: Math.max(this.current, this.maximum) }; }
  capacity(source, count) {
    if (this.removed) return false;
    if (!source || !Number.isInteger(count) || count < 0) throw Error('Invalid Lemuen capacity contribution');
    if (count) this.bonuses.set(source, count); else this.bonuses.delete(source);
    // Removing a capacity contribution does not discard rounds already granted
    // by the current cast; the reduced capacity applies to the next cast.
    return true;
  }
  begin() {
    if (this.removed || this.active) return false;
    this.active = true; this.current = this.maximum; this.accepted.clear(); return true;
  }
  consume(attackId) {
    if (!(typeof attackId === 'string' && attackId || Number.isSafeInteger(attackId) && attackId > 0))
      throw Error('Missing accepted Lemuen attack identity');
    if (this.removed || !this.active || this.current <= 0 || this.accepted.has(attackId)) return false;
    this.accepted.add(attackId); this.current--; return true;
  }
  end() { this.active = false; this.current = 0; this.accepted.clear(); }
  remove() { this.removed = true; this.end(); this.bonuses.clear(); }
}

// One modifier per battle keeps nonstacking Wanted bonuses from multiplying
// through multiple Lemuen owners. Strongest surviving source is a deliberate
// local overlap policy, not a recovered native override-map ordering.
function registerWanted(links) {
  const b = links.b;
  if (!b._lemuenWantedRegistry) {
    const registry = { owners: new Set(), hook: null };
    registry.hook = b.on('hit', ctx => {
      if (!laterano(ctx.source) || ctx.dmg.sourceless) return;
      let scale = 1;
      for (const owner of registry.owners) if (owner.live && owner.hasWanted(ctx.target))
        scale = Math.max(scale, owner.t1.damage_scale);
      ctx.dmg.mul *= scale;
    });
    b._lemuenWantedRegistry = registry;
  }
  b._lemuenWantedRegistry.owners.add(links);
}

/** Explicit local clock contract: the union of current Laterano attack ranges
 * preserves a victim's entry time while any contributor remains; an empty
 * union resets unfinished tracking. Wanted persists outside those ranges until
 * cleansed, victim death or source removal. Native stacked/derived callback
 * ordering is not decoded; installation requires a recorded review choice. */
export class LemuenTalentLinks {
  constructor(b, u, ammunition, { wantedContract, reviewNote } = {}) {
    if (u.def.charId !== LEMUEN_ID || !(ammunition instanceof LemuenAmmunition))
      throw Error('Lemuen talents require source identity and ammunition');
    if (wantedContract !== 'continuous-union-v1' || typeof reviewNote !== 'string' || !reviewNote.trim())
      throw Error('Lemuen Wanted timing requires an explicit reviewed local contract');
    this.b = b; this.u = u; this.ammunition = ammunition;
    this.reviewNote = reviewNote; this.pending = new Map(); this.wanted = new Map();
    this.stopped = false; this.talent2Applied = false; this.hooks = [];
    this.t1 = u.def.talents.find(t => t.bb.damage_scale != null)?.bb;
    this.t2 = u.def.talents.find(t => t.bb.add_count != null)?.bb;
    if (this.t1 && ![[10, 1], [8, 1], [8, 1.15], [6, 1.18]].some(([interval, scale]) =>
      this.t1.interval === interval && this.t1.damage_scale === scale)) throw Error('Missing Lemuen Wanted source');
    if (this.t2 && (this.t2.interval !== 20 || this.t2.atk !== .1 || this.t2.add_count !== 1
      || this.t2.ex_add_count !== 0)) throw Error('Unreviewed Lemuen no-module talent');
    this.talent2At = (Number.isFinite(u.deployedAt) ? u.deployedAt : b.time) + (this.t2?.interval ?? Infinity);
    if (this.t1) registerWanted(this);
    this.hooks.push(b.on('tick', () => this.tick()));
    this.hooks.push(b.on('death', ({ unit }) => {
      if (unit === u) this.stop(); else this.removeWanted(unit);
    }));
  }
  get live() { return !this.stopped && live(this.u); }
  hasWanted(e) { return this.live && live(e) && this.wanted.has(e) && !!e.findBuff(key(this.u, 'wanted')); }
  removeWanted(e) {
    this.pending.delete(e); this.wanted.delete(e);
    this.b.removeBuff(e, key(this.u, 'wanted'));
  }
  contributors(e) {
    if (!this.t1 || !live(e) || !['ELITE', 'BOSS'].includes(e.def.rank)
      || !canTargetEnemy(this.u, e, profile)) return [];
    return this.b.allies().filter(a => laterano(a) && canTargetAlly(this.u, a, false)
      && bodyInKeys(e, a.rangeKeySet));
  }
  mark(e) {
    if (!this.live || !this.t1 || !live(e) || this.hasWanted(e)) return false;
    this.pending.delete(e);
    const buff = this.b.addBuff(e, { key: key(this.u, 'wanted'), source: this.u,
      onRemove: () => { this.wanted.delete(e); } });
    this.wanted.set(e, buff); return true;
  }
  tick() {
    if (!this.live) { this.stop(); return; }
    if (this.t2 && !this.talent2Applied && this.b.time + 1e-9 >= this.talent2At) {
      this.talent2Applied = true;
      this.b.addBuff(this.u, { key: key(this.u, 'talent2'), source: this.u,
        mods: { atkPct: this.t2.atk } });
      this.ammunition.capacity(this, this.t2.add_count);
    }
    for (const e of [...this.wanted.keys()]) if (!this.hasWanted(e)) this.removeWanted(e);
    for (const e of [...this.pending.keys()]) if (!live(e)) this.pending.delete(e);
    if (!this.t1) return;
    for (const e of this.b.enemies) {
      if (this.hasWanted(e)) continue;
      const sources = this.contributors(e);
      if (!sources.length) { this.pending.delete(e); continue; }
      let entry = this.pending.get(e);
      if (!entry) { entry = { since: this.b.time, contributors: new Set(sources) }; this.pending.set(e, entry); }
      else entry.contributors = new Set(sources);
      if (this.b.time + 1e-9 >= entry.since + this.t1.interval) this.mark(e);
    }
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true;
    for (const e of [...this.wanted.keys()]) this.removeWanted(e);
    this.pending.clear(); this.ammunition.capacity(this, 0);
    this.b.removeBuff(this.u, key(this.u, 'talent2'));
    for (const h of this.hooks) this.b.off(h);
    this.hooks = [];
    const registry = this.b._lemuenWantedRegistry;
    if (registry) {
      registry.owners.delete(this);
      if (!registry.owners.size) { this.b.off(registry.hook); delete this.b._lemuenWantedRegistry; }
    }
  }
}

export function lemuenCandidates(b, u, talents, max = 1) {
  if (!Number.isInteger(max) || max <= 0) throw Error('Invalid Lemuen target cap');
  if (!live(u) || !talents.live) return [];
  const rows = b.enemies.filter(e => canTargetEnemy(u, e, profile)
    && (!e.s.flags.camou || e.blockedBy)
    && (bodyInKeys(e, u.rangeKeySet) || e.blockedBy === u || talents.hasWanted(e)));
  sortEnemyTargets(b, u, rows, 'lowDef'); return rows.slice(0, max);
}
