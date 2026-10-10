// SPDX-License-Identifier: GPL-3.0-or-later
// Ray combat links. The complete retained native source lives in
// arkpedia-ray-prefabs.json; executable scheduling contracts are explicit.
import evidence from '../../../data/arkpedia-ray-prefabs.json' with { type: 'json' };
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';

export const RAY_ID = 'char_4117_ray';
export const SANDBEAST_ID = 'token_10034_ray_sndbst';
export const SCOUT_MARK = 'ray_sndbst_aura';
const SHOT = 'ray:shot';
const SPECIAL = 'ray:special';
const PROFILE = Object.freeze({ canHitFly: true });
const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const scoutMark = e => !!e.findBuff(SCOUT_MARK) || e.buffs.some(b => b.tags?.includes(SCOUT_MARK));
const grid = id => evidence.tables.ranges[id].grids.map(p => [p.row, p.col]);

/** This range is for placement, excluding the scout's extra targeting region.
 * Both S2 and S3 use their selected source grids; ordinary range extensions
 * continue through the existing engine's absolute-range calculation. */
export function rayPlacementKeys(u) {
  const mode = u.skill?.active ? Number(u.skill.id.at(-1)) : 0;
  const range = mode === 2 || mode === 3 ? u.def.skill.rangeGrid : u.rangeGrid;
  return new Set(absoluteRangeKeys(range, u.tileR, u.tileC, u.dir, u.s.rangeExtend));
}

export function rayCandidates(b, u) {
  const rows = b.enemies.filter(e => canTargetEnemy(u, e, PROFILE)
    && (bodyInKeys(e, u.rangeKeySet) || e.blockedBy === u));
  sortEnemyTargets(b, u, rows);
  // Native secondaryFilter 3 prioritizes the mark without checking its source.
  // It does not keep the last focus victim ahead of a newly marked enemy.
  rows.sort((a, z) => Number(scoutMark(z)) - Number(scoutMark(a)));
  return rows.slice(0, 1);
}

/** Original Loop release payload. Begin/Break clocks are deliberately supplied
 * by the linked FSM rather than guessed by this projectile/hit layer. */
export function rayFireEvent(u, mode = 0) {
  const face = ['LEFT', 'UP'].includes(u.dir) ? 'Back' : 'Front';
  const prefix = mode ? `Skill_${u.dir === 'DOWN' ? 'Down_' : ''}${mode}`
    : u.dir === 'DOWN' ? 'Attack_Down' : 'Attack';
  const clip = `${prefix}_Loop`;
  return { clip, time: evidence.models[RAY_ID][face].eventPayloads[clip][0].time };
}

/** Accepted births, hits and skills have separate boundaries. The owner
 * supplies its reviewed magazine and a required special-shift callback. */
export class RayCombatLinks {
  constructor(b, u, { magazine, specialShift }) {
    if (u.defId !== RAY_ID || !magazine || typeof specialShift !== 'function')
      throw Error('Incomplete Ray combat-link contract');
    this.battle = b;
    this.unit = u;
    this.magazine = magazine;
    this.specialShift = specialShift;
    this.focusTarget = null;
    this.focusStacks = 0;
    this.refund = null;
    this.removed = false;
    this.receipt = null;
    this.scouts = new Set();
    // Link cleanup must run before an old deployment can receive its own
    // tokens' finish callbacks. A detached link can never restore a magazine.
    b.on('death', ({ unit }) => { if (unit === u) this.remove(); }, { owner: u });
    b.on('kill', ({ killer, victim }) => {
      if (killer !== u || this.removed) return;
      if (this.receipt?.mode === 1 && this.receipt.target === victim)
        magazine.queueKillReload(u.def.skill.bb.cnt);
      if (this.refund && u.skill?.active && u.skill.id === 'skchr_ray_3'
        && this.refund.activation === u.skill.activations) this.refund.killed = true;
    }, { owner: u });
    b.on('calculatedDamage', ({ source, target, dmg }) => {
      if (this.removed || source !== u || !dmg.tags?.includes(SHOT)) return;
      for (const t of this.scouts) {
        if (!live(t) || !t.mem.rayBorn || t.mem.rayMagazine.finished) continue;
        // Collection belongs to the linked owner hit in the token's original
        // ground area; it never emits token attacks or attack-SP receipts.
        if (!target.isFlying && bodyInKeys(target, t.rangeKeySet)) t.mem.rayMagazine.collect();
      }
    }, { owner: u });
  }

  /** Native family mask15 counts each selected attack before its damage. A
   * changed target resets to one; idle/reload does not invent a reset. */
  focus(target) {
    const talent = this.unit.def.talents.find(t => t.bb.max_stack_cnt != null);
    if (!talent) return;
    this.focusStacks = target === this.focusTarget
      ? Math.min(talent.bb.max_stack_cnt, this.focusStacks + 1) : 1;
    this.focusTarget = target;
    this.battle.addBuff(this.unit, { key: 'ray_t_2', source: this.unit,
      mods: { atkPct: talent.bb.atk * this.focusStacks } });
  }

  /** Return true only after a legal projectile has been born. No canceled
   * input, absent target or empty ordinary shot spends ammunition. */
  fire(target, { attackId, mode = 0 } = {}) {
    const b = this.battle, u = this.unit;
    if (this.removed || !live(u) || !u.canAct || u.s.flags.disarm
      || target?.side !== 'enemy'
      || !canTargetEnemy(u, target, PROFILE)
      || !bodyInKeys(target, u.rangeKeySet) && target.blockedBy !== u
      || ![0, 1, 2, 3].includes(mode)) return false;
    if (mode && (!u.skill?.active || u.skill.id !== `skchr_ray_${mode}`)) return false;
    const bb = u.def.skill.bb;
    const scale = mode === 1 ? bb.atk_scale : mode === 3 ? bb['attack@atk_scale'] : 1;
    if (!Number.isFinite(scale)) throw Error('Ray selected skill coefficient missing');
    if (!this.magazine.commitFire(b.time, { special: mode === 1 })) return false;
    this.focus(target);
    const shot = { mode, scale, attackId, deployment: u.deploySeq,
      bind: mode === 3 ? bb['attack@unmove_duration'] : 0 };
    b.addProjectile({ from: u, source: u, target, speed: 15, maxAge: 10,
      visual: 'arrow', data: { arkpediaTrackedVisual: true },
      onHit: ({ target: e }) => {
        if (e?.side !== 'enemy' || !canTargetEnemy(u, e, PROFILE)) return;
        // Native useCachedAtkOnly0: read current ATK at impact. The born shot
        // retains its own selected coefficient and bind after skill expiry.
        const previous = this.receipt;
        this.receipt = { ...shot, target: e };
        try {
          b.dealDamage(u, e, { amount: u.s.atk * u.s.atkScaleMul * shot.scale * u.def.traitBb.atk_scale,
            type: 'phys', isAttack: true, isSkill: shot.mode !== 0,
            isProjectile: true, applyWay: 'ranged', attackId: shot.attackId,
            tags: [SHOT, ...(shot.mode === 1 ? [SPECIAL] : [])] });
        } finally { this.receipt = previous; }
        // An emitted projectile may still hit after its owner leaves. Source
        // ammo/refund links are detached, while its victim effects still apply.
        if (live(e) && shot.mode === 1) {
          let fallReported = false;
          this.specialShift(e, {
            force: bb.force, bonus: bb.cnt, owner: u, attackId: shot.attackId,
            onFall: () => {
              if (fallReported || this.removed) return;
              fallReported = true;
              this.magazine.queueKillReload(bb.cnt);
            },
          });
        }
        if (live(e) && shot.bind > 0) b.applyStatus(e, 'bind', { source: u, duration: shot.bind });
      } });
    return true;
  }

  installDamageScale() {
    const b = this.battle, u = this.unit;
    b.on('hit', ({ source, target, dmg }) => {
      if (this.removed || source !== u || dmg.type !== 'phys' || !scoutMark(target)) return;
      // The source graph intentionally has no per-Sandbeast-owner filter.
      const talent = u.def.talents.find(t => t.bb.damage_scale != null);
      if (talent) dmg.amount *= 1 + talent.bb.damage_scale;
    }, { owner: u });
  }

  startThird() {
    const u = this.unit;
    if (!u.skill?.active || u.skill.id !== 'skchr_ray_3' || this.removed)
      throw Error('Ray S3 refund window is not active');
    if (this.refund?.activation === u.skill.activations) return;
    this.refund = { activation: u.skill.activations, killed: false };
  }
  finishThird() {
    const mark = this.refund;
    if (mark && this.unit.skill?.active) throw Error('Finish Ray S3 before applying its refund');
    this.refund = null;
    if (!mark?.killed || this.removed || !live(this.unit)) return 0;
    const u = this.unit;
    // Native forceFlag bypasses skill-SP holds. Caller finishes SkillRuntime
    // first, then applies this one accepted, activation-owned refund.
    u.skill.setSpTotal(u.skill.spTotal + u.def.skill.bb.sp);
    return u.def.skill.bb.sp;
  }

  attachScout(t) {
    if (this.removed || t.ownerUnit !== this.unit || t.defId !== SANDBEAST_ID)
      throw Error('Sandbeast ownership does not match Ray');
    this.scouts.add(t);
    this.syncScoutRange();
  }
  detachScout(t) {
    this.scouts.delete(t);
    this.syncScoutRange();
  }
  syncScoutRange() {
    const keys = new Set();
    if (!this.removed) for (const t of this.scouts)
      if (live(t) && t.mem.rayBorn) for (const key of t.rangeKeys) keys.add(key);
    this.battle.setExtraRange(this.unit, keys);
  }
  remove() {
    if (this.removed) return;
    this.removed = true;
    this.refund = null;
    this.magazine.remove(this.battle.time);
    this.battle.removeBuff(this.unit, 'ray_t_2');
    this.syncScoutRange();
  }
}
