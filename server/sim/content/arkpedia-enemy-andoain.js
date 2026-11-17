// SPDX-License-Identifier: GPL-3.0-or-later
// "Martyr", Andoain (enemy_1527_martyr). Every number arrives in `p` from the
// reviewed contract (shared/arkpedia/enemy-andoain-features.js).
import { rebornAbility } from './arkpedia-enemy-forms.js';
import { enemyAmmo } from './arkpedia-enemy-ammo.js';
import { inProjectileBox } from './arkpedia-enemy-projectiles.js';
import { areaSelectable, auraSelectable } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { ROWS, COLS } from '../constants.js';

/** The native field buff on the enemies standing in Light Unto Sufferers. */
export const FIELD_BUFF = 'enemy_martyr_smoke_bomb';
/** The native lock mark of Ashes to Ashes, Dust to Dust. */
export const LOCK_BUFF = 'enemy_martyr_skill_select_mark';
const CAST_BUFF = 'ab:martyrCast';

function tileKeys(grids, row, col) {
  const keys = new Set();
  for (const g of grids) {
    const r = row + g.row, c = col + g.col;
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) keys.add(r * COLS + c);
  }
  return keys;
}
const allies = b => b.allies(null, { includeTargetableDevices: true });

export function andoain(p) {
  validate(p);
  let form = 1;
  const ratio = () => form === 2 ? p.field.form2 : p.field.form1;
  const thresholds = e => Math.floor((e.s.maxHp - e.hp) / (ratio() * e.s.maxHp) + 1e-9);

  // --- Physical shots: the plain 1x shot, and the bouncing round (Ammo) with its extra hit on Gelato Stops ---
  const physical = (b, e, u, scale, tags, attackId = 0) => b.dealDamage(e, u, { amount: e.s.atk * scale, type: 'phys',
    isAttack: true, attackId, applyWay: 'ranged', tags });
  const stationBonus = (b, e, u, scale, tag) => {
    if (u.alive && u.tags?.has(p.stationTag)) b.dealDamage(e, u, { amount: e.s.atk * scale, type: 'phys',
      isAttack: false, applyWay: 'none', noSp: true, tags: [tag, 'enemyTrapBonus'] });
  };
  const bounce = (b, e, from, target, left, attackId) => {
    b.addProjectile({ from, target, speed: p.bounce.speed, visual: 'enemy', source: e, onHit: c => {
      const u = c.target;
      if (!u?.alive) return;
      physical(b, e, u, p.bounce.scale, ['martyrBounce'], attackId);
      stationBonus(b, e, u, p.bounce.stationScale, 'martyrBounceStation');
      if (left <= 1) return;
      const at = { x: u.x, y: u.y }, keys = tileKeys(p.bounce.grids, Math.round(u.y), Math.round(u.x));
      b.after(p.bounce.interval, () => {
        // The next unit around the last hit, Gelato Stops first, picked at random; never the one just hit.
        const near = allies(b).filter(x => x !== u && areaSelectable(e, x) && bodyInKeys(x, keys));
        const stations = near.filter(x => x.tags?.has(p.stationTag)), pool = stations.length ? stations : near;
        if (!pool.length) return;
        bounce(b, e, at, pool[b.rng.int(pool.length)], left - 1, attackId);
      });
    } });
  };

  // --- Light Unto Sufferers: a permanent x-1 field on his tile, 1.45 s after the threshold ---
  const fields = b => b.andoainFields ??= [];
  const castField = (b, e) => {
    const row = Math.round(e.y), col = Math.round(e.x);
    b.fx?.('telegraph', { x: col, y: row, r: 1, dur: p.field.delay, kind: 'martyrField', id: e.id });
    b.after(p.field.delay, () => {
      const field = { keys: tileKeys(p.field.grids, row, col), row, col, side: e.side };
      fields(b).push(field);
      b.every(p.field.interval, () => {
        for (const u of b.enemies) {
          if (!u.alive || u.side !== field.side || !bodyInKeys(u, field.keys)) continue;
          b.addBuff(u, { key: FIELD_BUFF, source: e, duration: p.field.buffDuration, visible: true,
            mods: { dodgePhys: p.field.prob, dodgeArts: p.field.prob, physTakenMul: p.field.damageScale, artsTakenMul: p.field.damageScale } });
        }
      }, { immediate: true });
    });
  };

  // --- Ashes to Ashes, Dust to Dust (second form) ---
  const n = p.noon, scanEnd = n.begin + n.scan, releaseAt = scanEnd + n.release, castEnd = scanEnd + n.end;
  const finishNoon = (b, e, a, refill) => {
    if (!a.noon) return;
    for (const u of a.noon.locks) b.removeBuff(u, LOCK_BUFF);
    a.noon = null; e.profile.noAttack = false; e.skillAnimUntil = b.time; b.removeBuff(e, CAST_BUFF);
    if (refill) a.ammo.modify(n.sp);
  };
  const lineX = (b, t) => {
    const R = b.grid.rect, progress = Math.max(0, Math.min(1, (t - n.begin) / n.scan));
    return R.c0 - .5 + progress * (R.c1 - R.c0 + 1) + n.lineOffset;
  };
  const tickNoon = (b, e, a, dt) => {
    const cast = a.noon;
    cast.t += dt;
    while (cast.nextLock <= Math.min(cast.t, scanEnd) + 1e-9 && cast.locks.length < n.maxLocks) {
      const x = lineX(b, cast.nextLock), R = b.grid.rect, cy = (R.r0 + R.r1) / 2;
      cast.nextLock += n.lockInterval;
      // At most one new lock per check: the touched unit nearest the top of the field (bottom-origin rows).
      const touched = allies(b).filter(u => auraSelectable(e, u) && !cast.locks.includes(u) && inProjectileBox(u, x, cy, n.lineWidth, n.lineHeight))
        .sort((u, v) => v.y - u.y || u.x - v.x);
      if (touched[0]) { cast.locks.push(touched[0]); b.addBuff(touched[0], { key: LOCK_BUFF, source: e, duration: n.duration, visible: true }); }
    }
    if (!cast.released && cast.t + 1e-9 >= releaseAt) {
      cast.released = true;
      const attackId = ++b._attackSeq;
      for (const u of cast.locks) {
        if (!u.alive || !u.findBuff(LOCK_BUFF) || !areaSelectable(e, u)) continue;
        b.addProjectile({ from: e, target: u, speed: n.speed, visual: 'enemy', source: e, onHit: c => {
          if (!c.target?.alive) return;
          physical(b, e, c.target, n.scale, ['martyrSkill'], attackId);
          stationBonus(b, e, c.target, n.stationScale, 'martyrSkillStation');
        } });
      }
    }
    e.skillAnimUntil = b.time + Math.max(0, castEnd - cast.t);
    if (cast.t + 1e-9 >= castEnd) finishNoon(b, e, a, true);
  };

  const rebirth = rebornAbility({
    dur: p.rebirth, hpRatio: p.rebornHp, invincible: p.form2.invincible,
    onKo(b, e, a) { finishNoon(b, e, a, false); },
    onReborn(b, e, a) {
      form = 2;
      b.addBuff(e, { key: 'martyr_p2_atk_up', persist: true, visible: true, mods: { atkPct: p.form2.atk } });
      a.fired = Math.floor((1 - p.rebornHp) / p.field.form2 + 1e-9);
      a.noonLeft = n.initial;
      e.profile.noAttack = false;
      // FinishCurrentWave: the waves waiting on him go on, and he joins the next one.
      b.stageWaveScheduler?.releaseCurrentWave(e, { trackSourceAtNextWave: true });
    },
  });

  return {
    ...rebirth,
    iv: 0,
    spawn(b, e, a) {
      a.ammo = e.mem.enemyAmmo = enemyAmmo(p.ammo.max, p.ammo.initial);
      a.fired = 0; a.noon = null; a.noonLeft = n.initial;
      e.profile.shot = 'none'; e.profile.deferHit = true; e.profile.melee = false;
      e.def = { ...e.def, attackAnim: p.attackAnim };
    },
    attack(c, b, e, a) {
      const attackId = b._attackSeq;
      for (const u of c.targets) {
        if (!u.alive) continue;
        if (a.ammo.current >= 1) {
          a.ammo.modify(-1);
          bounce(b, e, e, u, p.bounce.times, attackId);
        } else {
          b.addProjectile({ from: e, target: u, speed: p.plainSpeed, visual: 'enemy', source: e,
            onHit: hit => { if (hit.target?.alive) physical(b, e, hit.target, 1, ['martyrAttack'], attackId); } });
        }
      }
    },
    taken(_c, b, e, a) {
      if (!e.alive || e.hp <= 0 || a.state === 'reborn') return;
      const k = thresholds(e);
      if (k > a.fired) { a.fired = k; castField(b, e); }
    },
    tick(b, e, a, dt) {
      if (form !== 2 || a.state === 'reborn') return;
      if (a.noon) { tickNoon(b, e, a, dt); return; }
      a.noonLeft -= dt;
      if (a.noonLeft > 1e-9 || !e.canAct || !allies(b).some(u => areaSelectable(e, u))) return;
      a.noonLeft = n.cooldown;
      a.noon = { t: 0, nextLock: n.begin, locks: [], released: false };
      e.profile.noAttack = true; e.skillAnimUntil = b.time + castEnd;
      b.addBuff(e, { key: CAST_BUFF, persist: true, flags: { noMove: true } });
    },
    killed(c, b, e, a) { return form === 2 ? false : rebirth.killed(c, b, e, a); },
    death(_c, b, e, a) { finishNoon(b, e, a, false); },
  };
}

function validate(p) {
  const pos = v => Number.isFinite(v) && v > 0, nn = v => Number.isFinite(v) && v >= 0, frac = v => pos(v) && v <= 1;
  const grids = g => Array.isArray(g) && g.length && g.every(x => Number.isInteger(x.row) && Number.isInteger(x.col));
  const f = p?.field, bo = p?.bounce, n = p?.noon;
  if (!p || !Number.isSafeInteger(p.ammo?.max) || p.ammo.max < 1 || !nn(p.ammo.initial) || !pos(p.plainSpeed)
    || !p.attackAnim || !pos(p.attackAnim.dur) || !nn(p.attackAnim.hit) || typeof p.stationTag !== 'string'
    || !bo || !pos(bo.scale) || !Number.isSafeInteger(bo.times) || bo.times < 1 || !nn(bo.stationScale) || !pos(bo.speed) || !nn(bo.interval) || !grids(bo.grids)
    || !f || !frac(f.form1) || !frac(f.form2) || !nn(f.delay) || !pos(f.interval) || !pos(f.buffDuration) || !(f.prob >= 0 && f.prob <= 1)
    || !(f.damageScale >= 0) || !grids(f.grids)
    || !pos(p.rebirth) || !frac(p.rebornHp) || !p.form2 || !nn(p.form2.atk) || !nn(p.form2.invincible)
    || !n || !pos(n.cooldown) || !nn(n.initial) || !pos(n.scale) || !nn(n.stationScale) || !nn(n.begin) || !pos(n.scan) || !nn(n.release)
    || !(n.end >= n.release) || !Number.isSafeInteger(n.maxLocks) || n.maxLocks < 1 || !pos(n.lockInterval) || !pos(n.lineWidth) || !pos(n.lineHeight)
    || !Number.isFinite(n.lineOffset) || !pos(n.speed) || !nn(n.sp) || !pos(n.duration)) throw Error('Invalid Andoain');
}
andoain.validate = validate;
