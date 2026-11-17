// SPDX-License-Identifier: GPL-3.0-or-later
// "Emperor's Blade", Pursuer (enemy_1520_empgrd). Every number arrives in `p`
// from the reviewed contract (shared/arkpedia/enemy-emperors-blade-features.js).
import { rebornAbility } from './arkpedia-enemy-forms.js';
import { canTargetAlly, areaSelectable, aggroCmp } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { ALLY_COLLIDER_RADIUS, ROWS, COLS } from '../constants.js';

/** The native buff key that marks a unit standing in a Dominion. Collapsing Fear defeats its holders. */
export const DOMINION_BUFF = 'empgrd_blackfog';
const CAST_BUFF = 'ab:empgrdCast';

/** Battle-level Dominion state: the zones outlive the Pursuer who made them. */
function dominion(b) {
  return b.emperorDominion ??= { zones: [] };
}

/** Tile keys of the Dominion range (the native `x-1` diamond) around tile (row, col). */
export function dominionKeys(grids, row, col) {
  const keys = new Set();
  for (const g of grids) {
    const r = row + g.row, c = col + g.col;
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) keys.add(r * COLS + c);
  }
  return keys;
}

/**
 * One Dominion pulse (every `interval` s, the projectile's 0.3 s selector): every unit of either side whose body
 * stands on the zone, untargetable ones included, receives the 0.6 s fog buff. Opponents of the Pursuer get the
 * ASPD reduction; a unit of his own side gets the damage resistance only if it carries his self-mark. Once the
 * Pursuer has left, the side check fails for every unit and enemies are slowed too.
 */
function pulse(b, zone, p) {
  const source = zone.source, present = source.alive;
  const units = [...b.allies(null, { includeTargetableDevices: true }), ...b.enemies];
  for (const u of units) {
    if (!u.alive || u.deployed === false || u.hidden || !bodyInKeys(u, zone.keys)) continue;
    if (!present || u.side !== source.side) {
      b.addBuff(u, { key: DOMINION_BUFF, source, duration: p.fogBuffDuration, visible: true, mods: { aspd: p.fogAspd } });
    } else if (u.mem?.empgrdMark) {
      b.addBuff(u, { key: DOMINION_BUFF, source, duration: p.fogBuffDuration, visible: true,
        mods: { physTakenMul: 1 - p.fogResistance, artsTakenMul: 1 - p.fogResistance } });
    }
  }
}

/** Collapsing Fear: Arts splash damage to each target, then the instant defeat of every selectable fog holder. */
function collapsingFear(b, e, targets, scale) {
  const amount = e.s.atk * scale;
  for (const u of targets) {
    if (!u.alive) continue;
    b.dealDamage(e, u, { amount, type: 'arts', isSplash: true, isSkill: true, applyWay: 'none', noSp: true, tags: ['collapsingFear'] });
  }
  for (const u of targets) {
    if (u.alive && u.findBuff(DOMINION_BUFF) && areaSelectable(e, u)) b.kill(u, e);
  }
}

export function emperorsBlade(p) {
  validate(p);
  let form = 1;
  const formOf = () => form === 2 ? p.form2 : p.form1;

  // --- Dominion trigger: lost HP reaching an integer multiple of the form's ratio of max HP ---
  const thresholds = e => Math.floor((e.s.maxHp - e.hp) / (formOf().hpRatio * e.s.maxHp) + 1e-9);
  const pickTarget = (b, e, a) => {
    const candidates = b.allies(null, { includeTargetableDevices: true }).filter(u => canTargetAlly(e, u, true));
    const tally = u => a.tally.get(u) ?? 0;
    candidates.sort((x, y) => (x.findBuff(DOMINION_BUFF) ? 1 : 0) - (y.findBuff(DOMINION_BUFF) ? 1 : 0)
      || tally(y) - tally(x) || aggroCmp(x, y));
    return candidates[0] ?? null;
  };
  const castDominion = (b, e, a) => {
    const target = pickTarget(b, e, a);
    a.tally.clear();
    if (!target) return;
    const life = target.deploySeq;
    b.fx?.('telegraph', { x: target.x, y: target.y, r: p.aoeRadius, dur: p.fogDelay, kind: 'dominion', id: e.id });
    b.after(p.fogDelay, () => {
      if (!e.alive) return;
      // The target left during the delay: the Dominion appears on the Pursuer instead (EN wiki).
      const at = target.alive && target.deployed !== false && target.deploySeq === life ? target : e;
      const row = Math.round(at.y), col = Math.round(at.x);
      const zone = { source: e, keys: dominionKeys(p.fogRange, row, col), row, col };
      dominion(b).zones.push(zone);
      b.fx?.('explode', { x: col, y: row, r: p.aoeRadius, kind: 'dominion', id: e.id });
      const amount = e.s.atk * p.aoeScale;
      for (const u of b.alliesInRadius(col, row, p.aoeRadius + ALLY_COLLIDER_RADIUS)) {
        if (u.alive && u.deployed !== false && !u.hidden && !u.s.flags.untargetable) {
          b.dealDamage(e, u, { amount, type: 'arts', isSplash: true, applyWay: 'none', noSp: true, tags: ['dominion'] });
        }
      }
      // Pulses from the moment it appears, owned by no unit: the zone is permanent.
      b.every(p.fogInterval, () => pulse(b, zone, p), { immediate: true });
    }, { owner: e });
  };

  // --- Collapsing Fear skill (one per form, 20 s cooldown and initial cooldown) ---
  const inReach = (b, e, radius) => b.alliesInRadius(e.x, e.y, radius + ALLY_COLLIDER_RADIUS).filter(u => areaSelectable(e, u));
  const finishCast = (b, e, a) => {
    if (!a.cast) return;
    a.cast = null; e.profile.noAttack = a.noAttack ?? false; e.skillAnimUntil = b.time; b.removeBuff(e, CAST_BUFF);
  };

  // --- First form → second form ---
  const rebirth = rebornAbility({
    dur: p.rebirth, hpRatio: p.rebornHp, invincible: p.invincible,
    onKo(b, e, a) {
      finishCast(b, e, a);
      a.tally.clear();
      // The revive's Collapsing Fear hits every selectable operator on the field at the Skill_02_Begin strike.
      b.after(p.ringRelease, () => {
        if (!e.alive) return;
        const targets = b.allies(null, { includeTargetableDevices: true }).filter(u => areaSelectable(e, u));
        collapsingFear(b, e, targets, p.ringScale);
      }, { owner: e });
    },
    onReborn(b, e, a) {
      form = 2;
      a.tally.clear();
      b.addBuff(e, { key: 'reborn_up', persist: true, visible: true, mods: { atkPct: p.rebornAtk } });
      // reborn() restores HP only after this callback: count from the restored ratio.
      a.fired = Math.floor((1 - p.rebornHp) / p.form2.hpRatio + 1e-9);
      e.profile.noAttack = false;
    },
  });

  return {
    ...rebirth,
    cd: p.form1.cooldown, icd: p.form1.initial,
    spawn(b, e, a) {
      a.tally = new Map(); a.fired = 0; a.cast = null; a.left = p.form1.initial;
      e.mem.empgrdMark = true;
      e.profile.shot = 'none'; e.profile.deferHit = true; e.profile.melee = false;
      e.profile.canTarget = u => !u.isFlying;
      e.def = { ...e.def, attackAnim: p.attackAnim };
      dominion(b);
    },
    attack(c, b, e) {
      for (const u of c.targets) {
        if (!u.alive) continue;
        const combat = form === 2 && e.blockedBy === u;
        b.dealDamage(e, u, { amount: e.s.atk * (combat ? p.combatScale : 1), type: 'phys', isAttack: true,
          attackId: b._attackSeq, applyWay: combat ? 'melee' : 'ranged', tags: [combat ? 'empgrdCombat' : 'empgrdAttack'] });
      }
    },
    taken(c, b, e, a) {
      const by = c.source ?? c.credit;
      if (by?.side === 'ally' && c.amount > 0) a.tally.set(by, (a.tally.get(by) ?? 0) + c.amount);
      if (!e.alive || e.hp <= 0 || a.state === 'reborn') return;
      const k = thresholds(e);
      if (k > a.fired) { a.fired = k; castDominion(b, e, a); }
    },
    tick(b, e, a, dt) {
      const f = formOf();
      a.left -= dt;
      if (a.cast) {
        if (!e.canAct) { finishCast(b, e, a); return; }
        const cast = a.cast; cast.elapsed += dt * e.s.slowDownRate;
        if (!cast.released && cast.elapsed + 1e-9 >= p.fearRelease) {
          cast.released = true;
          collapsingFear(b, e, inReach(b, e, cast.radius), cast.scale);
        }
        e.skillAnimUntil = b.time + Math.max(0, p.fearDuration - cast.elapsed) / Math.max(.001, e.s.slowDownRate);
        if (cast.elapsed + 1e-9 >= p.fearDuration) finishCast(b, e, a);
        return;
      }
      if (a.left > 1e-9 || !e.canAct || a.state === 'reborn' || !inReach(b, e, f.radius).length) return;
      a.left = f.cooldown;
      a.cast = { elapsed: 0, released: false, radius: f.radius, scale: f.scale };
      a.noAttack = e.profile.noAttack; e.profile.noAttack = true;
      e.skillAnimUntil = b.time + p.fearDuration;
      b.addBuff(e, { key: CAST_BUFF, flags: { noMove: true } });
    },
    killed(c, b, e, a) {
      if (form === 2) return false;
      return rebirth.killed(c, b, e, a);
    },
    death(_c, b, e, a) { finishCast(b, e, a); },
  };
}

function validate(p) {
  const pos = v => Number.isFinite(v) && v > 0, frac = v => pos(v) && v <= 1;
  const formOk = f => f && frac(f.hpRatio) && pos(f.radius) && pos(f.scale) && pos(f.cooldown) && Number.isFinite(f.initial) && f.initial >= 0;
  if (!p || !formOk(p.form1) || !formOk(p.form2) || !pos(p.rebirth) || !frac(p.rebornHp) || !(p.invincible >= 0) || !(p.rebornAtk >= 0)
    || !pos(p.ringScale) || !(p.ringRelease >= 0 && p.ringRelease <= p.rebirth) || !pos(p.combatScale) || !Number.isFinite(p.fogAspd)
    || !frac(p.fogResistance) || !pos(p.aoeRadius) || !pos(p.aoeScale) || !(p.fogDelay >= 0) || !pos(p.fogInterval) || !pos(p.fogBuffDuration)
    || !Array.isArray(p.fogRange) || !p.fogRange.length || !p.fogRange.every(g => Number.isInteger(g.row) && Number.isInteger(g.col))
    || !pos(p.fearDuration) || !(p.fearRelease >= 0 && p.fearRelease <= p.fearDuration)
    || !p.attackAnim || !pos(p.attackAnim.dur) || !(p.attackAnim.hit >= 0)) throw Error("Invalid Emperor's Blade");
}
emperorsBlade.validate = validate;
