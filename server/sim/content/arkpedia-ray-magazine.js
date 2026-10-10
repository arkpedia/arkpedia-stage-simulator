// SPDX-License-Identifier: GPL-3.0-or-later
// Ray's source resource/FSM adapter. Deliberately not registered until the
// owner/projectile/Sandbeast combat adapter is complete. Numeric native events
// remain in arkpedia-ray-prefabs.json; these methods are explicit local phases.
import evidence from '../../../data/arkpedia-ray-prefabs.json' with { type: 'json' };
const ID = 'char_4117_ray';
const bb = rows => Object.fromEntries(rows.map(row => [row.key, row.value]));
const count = n => Number.isSafeInteger(n) && n >= 0;
const finiteTime = n => Number.isFinite(n) && n >= 0;

/** Own bullets and collected Sandbeast bullets are distinct resources.
 * Reload uses original fixed-time mode, not ASPD-scaled attack time. The
 * event-free refill is committed at that fixed deadline by a local contract.
 * A legal fire request may break a partial reload only with a bullet in hand;
 * S3's initial refill-only mode cannot break until it has reached capacity.
 */
export class RayMagazine {
  constructor({ elite, direction = 'RIGHT' }) {
    if (![0, 1, 2].includes(elite) || !['RIGHT', 'LEFT', 'UP', 'DOWN'].includes(direction))
      throw Error('Invalid Ray magazine build');
    const candidate = evidence.tables.character.trait.candidates[elite];
    this.capacity = bb(candidate.blackboard).value;
    this.bullets = this.capacity;
    this.extra = 0;
    this.direction = direction;
    this.skillMode = 0;
    this.refillOnly = false;
    this.reload = null;
    this.reloadFlag = false;
    this.resetAt = null;
    this.epoch = 0;
    this.now = 0;
    this.removed = false;
    this.fixedInterval = evidence.tables.character.phases[elite].attributesKeyFrames[0].data.baseAttackTime;
    if (![4, 6, 8].includes(this.capacity) || this.fixedInterval !== 1.6)
      throw Error('Unreviewed Ray resource source');
  }
  time(now) {
    if (!finiteTime(now) || now + 1e-9 < this.now) throw Error('Ray clock must be monotonic');
    this.now = now;
  }
  get modeIndex() {
    if (this.skillMode === 2) return this.direction === 'DOWN' ? 2 : 1;
    if (this.skillMode === 3) return this.refillOnly
      ? this.direction === 'DOWN' ? 6 : 3
      : this.direction === 'DOWN' ? 5 : 4;
    return 0;
  }
  get reloadInterval() {
    return this.fixedInterval + (this.skillMode === 3
      ? bb(evidence.tables.skills.skchr_ray_3.levels[0].blackboard).reload_interval : 0);
  }
  get canFire() { return !this.removed && !this.refillOnly && this.bullets > 0; }
  get ammoUi() { return { current: this.bullets, maximum: this.capacity }; }
  setSkillMode(mode, now) {
    this.time(now);
    if (![0, 2, 3].includes(mode) || this.removed) throw Error('Invalid Ray skill mode');
    this.cancelReload(now);
    this.skillMode = mode;
    this.refillOnly = mode === 3 && this.bullets !== this.capacity;
    this.epoch++;
    return this.modeIndex;
  }
  /** Called only when a projectile is actually born, never by a missed/canceled
   * input. S1's additional special shot does not consume ordinary bullets. */
  commitFire(now, { special = false } = {}) {
    this.time(now);
    if (this.removed || !special && !this.canFire) return false;
    if (!special) this.bullets--;
    this.reload = null;
    this.resetAt = null;
    this.reloadFlag = false;
    this.epoch++;
    return true;
  }
  beginReload(now) {
    this.time(now);
    if (this.removed || this.reload || this.bullets >= this.capacity) return null;
    const generation = ++this.epoch;
    this.reloadFlag = true;
    this.resetAt = null;
    this.reload = { generation, start: now, readyAt: now + this.reloadInterval,
      modeIndex: this.modeIndex, interval: this.reloadInterval };
    return { ...this.reload };
  }
  /** A target appearing during refill can interrupt only the composite's
   * legal fire branch. A zero-bullet refill and initial S3 fill must continue. */
  breakForFire(now) {
    this.time(now);
    if (!this.canFire) return null;
    const wasReloading = this.reloadFlag;
    this.reload = null;
    this.resetAt = null;
    this.epoch++;
    const face = ['LEFT', 'UP'].includes(this.direction) ? 'Back' : 'Front';
    const prefix = this.skillMode ? `Skill_${this.skillMode}_` : '';
    const clip = `${prefix}Reload_Break`;
    return { generation: this.epoch, breakTime: wasReloading
      ? evidence.models[ID][face].durations[clip] : 0, wasReloading };
  }
  cancelReload(now) {
    this.time(now);
    this.reload = null;
    this.epoch++;
    // Native flag reset is conditional on being out of attack state, with its
    // own .2s lifetime. Cancel never adds a bullet or consumes a held kill bonus.
    this.resetAt = this.reloadFlag ? now + .2 : null;
  }
  /** Tick a fixed-time refill, with generation checking against detached work.
   * Exactly one accepted refill is produced, even after a long/late tick.
   * Caller starts a new cycle explicitly; there is no catch-up reload burst. */
  finishReload(now, generation, { canAct = true } = {}) {
    this.time(now);
    const reload = this.reload;
    if (this.removed || !canAct || !reload || reload.generation !== generation
      || now + 1e-9 < reload.readyAt) return 0;
    this.reload = null;
    const old = this.bullets;
    this.bullets = Math.min(this.capacity, this.bullets + 1 + this.extra);
    this.extra = 0;
    if (this.refillOnly && this.bullets === this.capacity) {
      this.refillOnly = false;
      this.epoch++;
    }
    this.resetAt = now + .2;
    return this.bullets - old;
  }
  resetFlag(now, { attacking = false } = {}) {
    this.time(now);
    if (this.resetAt == null || now + 1e-9 < this.resetAt || attacking) return false;
    this.reloadFlag = false;
    this.resetAt = null;
    return true;
  }
  queueKillReload(extra) {
    if (!count(extra) || this.removed) throw Error('Invalid Ray kill reload bonus');
    this.extra += extra;
  }
  /** ON_OWNER_FINISH returns the token's collected counter once, and invokes
   * the same capped add/extra-consumption graph as a reload. Dynamic-extra
   * bonuses are not a second magazine. The native extra_add default is outside
   * the retained tables; the linked adapter must supply an explicitly reviewed
   * zero-bullet seed rather than silently inventing one. */
  receiveCollected(collected, { emptySeed } = {}) {
    if (!count(collected) || !count(emptySeed) || this.removed)
      throw Error('Invalid Ray collected-ammo transfer contract');
    const old = this.bullets;
    this.bullets = Math.min(this.capacity, this.bullets
      + (this.bullets === 0 ? emptySeed : 0) + collected + this.extra);
    this.extra = 0;
    if (this.refillOnly && this.bullets === this.capacity) {
      this.refillOnly = false;
      this.epoch++;
    }
    return this.bullets - old;
  }
  remove(now) {
    this.cancelReload(now);
    this.removed = true;
    this.refillOnly = false;
    this.extra = 0;
    this.resetAt = null;
    this.reloadFlag = false;
  }
}

export class SandbeastMagazine {
  constructor({ elite, enabled }) {
    if (![1, 2].includes(elite) || typeof enabled !== 'boolean') throw Error('Invalid Sandbeast build');
    const candidate = evidence.tables.tokens.token_10034_ray_sndbst.trait.candidates[elite - 1];
    this.capacity = bb(candidate.blackboard).value;
    this.enabled = enabled;
    this.collected = 0;
    this.finished = false;
  }
  /** Collection is driven by the reviewed owner hit callback; no damage or
   * fabricated attack/SP event is emitted by the zero-ATK token controller. */
  collect() {
    if (this.finished || !this.enabled || this.collected >= this.capacity) return false;
    this.collected++;
    return true;
  }
  finish(ownerMagazine, contract) {
    if (this.finished) return 0;
    const received = this.enabled && !ownerMagazine.removed
      ? ownerMagazine.receiveCollected(this.collected, contract) : 0;
    this.finished = true;
    return received;
  }
}
