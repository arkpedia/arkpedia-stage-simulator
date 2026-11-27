// SPDX-License-Identifier: GPL-3.0-or-later
// Miner Guerrilla (kind minerGuerrilla). Every number arrives in `p` from the reviewed contract
// (shared/arkpedia/enemy-miner-guerrilla-features.js). A neutral unit (the runtime plan's side 'neutral'): operators
// never select it, it holds neither a wave nor the battle, it exits without cost, and the generic enemy attack (which
// looks for operators) is off. It strikes hostile ground enemies in reach itself.
import { canTargetEnemy } from '../targeting.js';
import { COLS } from '../constants.js';

const CAST = 'ab:minerGuerrillaAttack';
/** Its own collider (the prefab's root CircleCollider2D, 0.1): the chapter's circles (the devices' StopMcreep, a
 * soldier's BlockMcreep) catch it when they touch that. */
export const MINER_BODY = .1;
/** An ordinary enemy's root collider; its attack circle takes an enemy whose collider touches it. */
const ENEMY_BODY = .1;
const live = u => u?.alive && u.deployed !== false && !u.hidden;
const dist2 = (a, u) => (u.x - a.x) ** 2 + (u.y - a.y) ** 2;
const rangeKey = (r, c) => r * COLS + c;

export function minerGuerrilla(p) {
  if (!(p?.radius > 0 && p.attack?.dur >= p.attack.hit && p.heal?.interval > 0 && p.heal.scale > 0 && p.fear?.interval > 0 && p.fear.damage > 0 && p.clear?.interval > 0 && p.clear.duration > 0
    && typeof p.mark === 'string')) throw Error('Invalid Miner Guerrilla parameters');
  // Its selector: one ground unit of the enemy side, selectable or not (`_ignoreTargetFree`), never another neutral.
  // Chapter 16's devices (a Heavily Polluted Facility, a Rock Wall) are taken from their own runtime: the ones its
  // circle reaches and the one holding it. No other placed object is a target.
  const hostile = (b, e) => [...b.enemiesInRadius(e.x, e.y, p.radius + ENEMY_BODY)
    .filter(u => u !== e && live(u) && u.kind !== 'device' && u.side === 'enemy' && !u.isFlying && !u.mem?.prtsCarried && canTargetEnemy(e, u, { canHitFly: false, ignoreTargetFree: () => true })),
    ...(b.stageMainline16?.minerTargets(e, p.radius) ?? [])]
    .sort((x, y) => dist2(e, x) - dist2(e, y) || String(x.id).localeCompare(String(y.id)))[0] ?? null;
  // A Medic whose attack range covers its tile (CheckUnitRootTileInTargetAttackRange).
  const medics = (b, e) => b.allyUnits.filter(u => live(u) && u.kind === 'op' && u.def?.profession === 'MEDIC'
    && (u.rangeKeySet ?? new Set(u.rangeKeys ?? [])).has(rangeKey(Math.round(e.y), Math.round(e.x))));
  return {
    spawn(b, e, a) {
      Object.assign(a, { swing: null, healT: 0, fearT: 0, clearT: 0, healed: 0, feared: 0 });
      e.mem.minerGuerrilla = true;
      e.profile.noAttack = true; e.profile.neutralExit = true; e.profile.enemyTargetable = true; e.lpr = 0;
      e.base.rangeRadius = p.radius; e.base.tauntLevel = -1; e.markDirty?.();
      // NeutralTag mark_neutral[effect]: enemy-class neutral units are not blocked.
      b.addBuff(e, { key: p.mark, persist: true, flags: { unblockable: true } });
    },
    tick(b, e, a, dt) {
      if (!e.alive) return;
      // mcreep_t[work_espace_shadow]: unless feared, its tile and the eight around it are cleared of pollution for a while.
      a.clearT += dt;
      if (a.clearT + 1e-9 >= p.clear.interval) { a.clearT -= p.clear.interval; if (!e.s.flags.fear) b.stageMainline16?.clearAround(e, p.clear.duration); }
      // mcreep_t[get_heal]: once a second, each Medic in whose range it stands.
      a.healT += dt;
      if (a.healT + 1e-9 >= p.heal.interval) {
        a.healT -= p.heal.interval;
        for (const m of medics(b, e)) if (e.hp < e.s.maxHp - 1e-9) { b.heal(m, e, m.s.atk * p.heal.scale, { tags: ['minerGuerrilla:heal'] }); a.healed += 1; }
      }
      // mcreep_t[fear_blood]: true damage while feared.
      if (e.s.flags.fear) {
        a.fearT += dt;
        if (a.fearT + 1e-9 >= p.fear.interval) { a.fearT -= p.fear.interval; a.feared += 1; b.dealDamage(null, e, { amount: p.fear.damage, type: 'true', applyWay: 'none', tags: ['minerGuerrilla:fear'] }); }
      } else a.fearT = 0;
      if (!e.alive) return;
      if (a.swing) {
        const s = a.swing; s.elapsed += dt * (e.s.slowDownRate ?? 1);
        if (!s.released && s.elapsed + 1e-9 >= p.attack.hit) {
          s.released = true;
          if (live(s.target)) b.dealDamage(e, s.target, { amount: e.s.atk, mul: b.stageMainline16?.minerScale(s.target) ?? 1, type: 'phys', isAttack: true, applyWay: 'melee', tags: ['minerGuerrilla:attack'] });
        }
        if (s.elapsed + 1e-9 >= p.attack.dur) { a.swing = null; b.removeBuff(e, CAST); }
        return;
      }
      if (!e.canAct || e.s.flags.disarm || e.s.flags.fear || e.atkCd > 1e-9) return;
      const target = hostile(b, e);
      if (!target) return;
      e.atkCd = e.s.interval; a.swing = { target, elapsed: 0, released: false };
      b._ev(['atk', e.id, target.id, 'none']);
      b.addBuff(e, { key: CAST, duration: p.attack.dur, refresh: 'replace', flags: { noMove: true } });
    },
  };
}
