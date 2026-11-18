// SPDX-License-Identifier: GPL-3.0-or-later
// Mandragora (enemy_1523_mandra). Every number arrives in `p` from the reviewed
// contract (shared/arkpedia/enemy-mandragora-features.js). Her state follows the
// four native modes: first or second form, each with or without the Stoneshield.
import { rebornAbility } from './arkpedia-enemy-forms.js';
import { areaSelectable, absoluteRangeKeys } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { ALLY_COLLIDER_RADIUS } from '../constants.js';

const SHIELD_BUFF = 'mandra_stone_skin', FLOAT_BUFF = 'ab:float', CAST_BUFF = 'ab:mandraCast';
export const GAZE_DEBUFF = 'mandra_ray[attack_speed_down]';
const DIRECTIONS = ['RIGHT', 'LEFT', 'UP', 'DOWN'];
const live = u => u?.alive && u.deployed !== false && !u.hidden;
const isPillar = u => !!u?.mem?.stageUnitDevice?.pillar;

/** A tile the Gaze sealed: no operator can be placed there for the rest of the battle (the native sealed-ground token). */
export function sealTile(b, row, col) {
  const tile = b.grid.tile(row, col);
  if (!tile || !b.grid.inRect(row, col)) return false;
  b.grid.setTile(row, col, { ...tile, build: 'NONE' });
  (b.mandragoraSeals ??= []).push({ row, col });
  b.fx?.('explode', { x: col, y: row, r: .5, kind: 'mandragoraSeal' });
  return true;
}

export function mandragora(p) {
  validate(p);
  let form = 1;

  // --- Stoneshield ---
  const setHover = (b, e, on) => {
    e.flying = on;
    if (on) b.addBuff(e, { key: FLOAT_BUFF, flags: { unblockable: true, float: true, noDisplace: true }, persist: true });
    else b.removeBuff(e, FLOAT_BUFF);
  };
  const shieldOn = (b, e, a) => {
    a.shield = true; a.restore = null;
    b.addBuff(e, { key: SHIELD_BUFF, persist: true, visible: true, mods: { physTakenMul: 1 - p.resistance, artsTakenMul: 1 - p.resistance } });
    if (form === 2) setHover(b, e, true);
  };
  const shieldOff = (b, e, a) => {
    a.shield = false; b.removeBuff(e, SHIELD_BUFF); setHover(b, e, false);
  };
  // ReSummonStoneSkin: back after `restore.duration`, or once HP falls `restore.hpOffset` of max HP below where it broke.
  const startRestore = (b, e, a) => {
    a.restore = { until: b.time + p.restore.duration, hp: e.hp / e.s.maxHp - p.restore.hpOffset };
  };

  // --- Casts (Gaze channel, Collapse, self-stun, Stoneshield recast) ---
  const finishCast = (b, e, a) => {
    const cast = a.cast;
    if (!cast) return;
    a.cast = null;
    if (cast.kind === 'gaze' && cast.target) b.removeBuff(cast.target, GAZE_DEBUFF);
    e.profile.noAttack = false; e.skillAnimUntil = b.time; b.removeBuff(e, CAST_BUFF);
  };
  const startCast = (b, e, a, cast) => {
    a.cast = { elapsed: 0, ...cast };
    e.profile.noAttack = true; e.skillAnimUntil = b.time + cast.duration;
    b.addBuff(e, { key: CAST_BUFF, persist: true, flags: { noMove: true } });
  };
  const gazeTargets = (b, e) => b.alliesInRadius(e.x, e.y, p.gaze.radius + ALLY_COLLIDER_RADIUS)
    .filter(u => areaSelectable(e, u) && (form === 2 || !u.isFlying)).sort((x, y) => y.s.atk - x.s.atk);
  const link = (b, e, cast) => {
    const target = gazeTargets(b, e)[0] ?? null;
    cast.target = target; cast.life = target?.deploySeq; cast.nextHit = cast.elapsed + p.gaze.firstHit - p.gaze.predelay;
    if (target) { cast.row = Math.round(target.y); cast.col = Math.round(target.x);
      b.addBuff(target, { key: GAZE_DEBUFF, source: e, persist: true, visible: true, mods: { aspdMul: p.gaze.aspdMul } }); }
  };
  const tickGaze = (b, e, a, cast) => {
    if (!cast.linked && cast.elapsed + 1e-9 >= cast.linkAt) { cast.linked = true; link(b, e, cast); }
    if (!cast.linked || cast.elapsed >= p.gaze.window) return;
    const t = cast.target;
    if (t && !(live(t) && t.deploySeq === cast.life)) {
      // The target left the field during the channel: its tile is sealed, and the Gaze may pick a new one at once.
      sealTile(b, cast.row, cast.col);
      cast.target = null; cast.linked = false; cast.linkAt = cast.elapsed + p.gaze.predelay;
      return;
    }
    if (!t) { cast.linked = false; cast.linkAt = cast.elapsed + .1; return; }
    cast.row = Math.round(t.y); cast.col = Math.round(t.x);
    while (cast.elapsed + 1e-9 >= cast.nextHit && cast.nextHit < p.gaze.window) {
      cast.nextHit += p.gaze.hitInterval;
      b.dealDamage(e, t, { amount: e.s.atk * p.gaze.scale, type: 'arts', isSkill: true, applyWay: 'none', noSp: true, tags: ['mandragoraGaze'] });
      if (!live(t)) break;
    }
  };
  const tickCast = (b, e, a, dt) => {
    const cast = a.cast;
    cast.elapsed += dt * e.s.slowDownRate;
    if (cast.kind === 'gaze') {
      if (cast.elapsed < p.gaze.window) tickGaze(b, e, a, cast);
      else if (cast.target) { b.removeBuff(cast.target, GAZE_DEBUFF); cast.target = null; }
    } else if (!cast.released && cast.elapsed + 1e-9 >= cast.release) {
      cast.released = true; cast.onRelease?.(b, e, a);
    }
    e.skillAnimUntil = b.time + Math.max(0, cast.duration - cast.elapsed);
    if (cast.elapsed + 1e-9 >= cast.duration) { const done = cast.onEnd; finishCast(b, e, a); done?.(b, e, a); }
  };

  // --- Collapse (second form): the nearest intact pillar with an operator in reach topples toward the most operators ---
  const operatorsIn = (b, keys) => b.allies().filter(u => live(u) && !u.isFlying && bodyInKeys(u, keys)).length;
  const reach = (pillar, dir) => absoluteRangeKeys(p.collapse.range, pillar.tileR, pillar.tileC, dir);
  const pillarCandidates = (b, e) => b.enemies.filter(u => live(u) && isPillar(u) && u.mem.stageUnitDevice.state === 'intact'
    && !u.mem.stageUnitDevice.collapsed && !u.mem.mandragoraWarned && DIRECTIONS.some(dir => operatorsIn(b, reach(u, dir)) > 0))
    .sort((x, y) => Math.hypot(x.x - e.x, x.y - e.y) - Math.hypot(y.x - e.x, y.y - e.y));
  const topple = (b, e, pillar) => {
    let best = DIRECTIONS[0], count = -1;
    for (const dir of DIRECTIONS) { const n = operatorsIn(b, reach(pillar, dir)); if (n > count) { best = dir; count = n; } }
    pillar.mem.mandragoraWarned = true; pillar.dir = best;
    b.fx?.('telegraph', { x: pillar.x, y: pillar.y, r: 1, dur: p.collapse.delay, kind: 'pillarWarning', id: pillar.id });
    b.after(p.collapse.delay, () => {
      const d = pillar.mem.stageUnitDevice;
      if (live(pillar) && d.state === 'intact') b.stageDemolition?.collapse(pillar, best);
    }, { holdsBattle: true });
  };

  const rebirth = rebornAbility({
    dur: p.rebirth, hpRatio: p.rebornHp, invincible: p.invincible,
    onKo(b, e, a) { finishCast(b, e, a); a.restore = null; },
    onReborn(b, e, a) {
      form = 2;
      e.profile.melee = false; e.def = { ...e.def, attackAnim: p.attackAnim2 };
      shieldOn(b, e, a);
      a.gazeLeft = p.gaze.form2Reset; a.collapseLeft = p.collapse.initial;
      e.profile.noAttack = false;
      // finish_current_wave_when_buff_finish, without tracking her at the next wave.
      b.stageWaveScheduler?.releaseCurrentWave(e);
    },
  });

  return {
    ...rebirth,
    iv: 0,
    spawn(b, e, a) {
      a.cast = null; a.restore = null; a.gazeLeft = p.gaze.initial; a.collapseLeft = p.collapse.initial; a.auraLeft = p.aura.interval;
      e.profile.shot = 'none'; e.profile.deferHit = true; e.profile.melee = true;
      e.profile.canTarget = u => !u.isFlying;
      e.def = { ...e.def, attackAnim: p.attackAnim1 };
      shieldOn(b, e, a);
    },
    attack(c, b, e) {
      const attackId = b._attackSeq;
      for (const u of c.targets) {
        if (!u.alive) continue;
        if (form === 1) { b.dealDamage(e, u, { amount: e.s.atk, type: 'arts', isAttack: true, attackId, applyWay: 'melee', tags: ['mandragoraAttack'] }); continue; }
        b.addProjectile({ from: e, target: u, speed: p.shotSpeed, visual: 'enemy', source: e, onHit: hit => {
          if (hit.target?.alive) b.dealDamage(e, hit.target, { amount: e.s.atk, type: 'arts', isAttack: true, attackId, applyWay: 'ranged', tags: ['mandragoraAttack'] });
        } });
      }
    },
    taken(c, b, e, a) {
      if (!e.alive || e.hp <= 0 || a.state === 'reborn') return;
      // Damage from a Tattered Pillar (dupilr_trait) breaks the Stoneshield.
      if (a.shield && isPillar(c.source ?? c.credit)) {
        if (a.cast?.kind === 'gaze') a.gazeLeft = p.gaze.cooldown;
        finishCast(b, e, a); shieldOff(b, e, a);
        if (form === 1) startRestore(b, e, a);
        else startCast(b, e, a, { kind: 'stun', duration: p.stun, onEnd: (bb, ee, aa) => startRestore(bb, ee, aa) });
        return;
      }
      if (a.restore && e.hp / e.s.maxHp < a.restore.hp) a.restore.until = b.time;
    },
    tick(b, e, a, dt) {
      if (a.state === 'reborn') return;
      // The second form's Stoneshield burns everyone around her.
      if (form === 2 && a.shield) {
        a.auraLeft -= dt;
        while (a.auraLeft <= 1e-9) {
          a.auraLeft += p.aura.interval;
          for (const u of b.alliesInRadius(e.x, e.y, p.aura.radius + ALLY_COLLIDER_RADIUS)) if (areaSelectable(e, u))
            b.dealDamage(e, u, { amount: e.s.atk * p.aura.scale, type: 'arts', isSplash: true, applyWay: 'none', noSp: true, tags: ['mandragoraAura'] });
        }
      }
      // Cooldowns run during casts too; they pause only while the Stoneshield is broken.
      if (a.shield) { a.gazeLeft -= dt; if (form === 2) a.collapseLeft -= dt; }
      if (a.cast) { tickCast(b, e, a, dt); return; }
      if (!a.shield) {
        // Skills are unavailable and their cooldowns paused until the Stoneshield is back.
        if (a.restore && b.time + 1e-9 >= a.restore.until && e.canAct) {
          a.restore = null;
          startCast(b, e, a, { kind: 'skin', duration: p.skin.duration, release: p.skin.duration, onEnd: (bb, ee, aa) => shieldOn(bb, ee, aa) });
        }
        return;
      }
      if (!e.canAct) return;
      if (form === 2 && a.collapseLeft <= 1e-9) {
        const pillar = pillarCandidates(b, e)[0];
        if (pillar) {
          a.collapseLeft = p.collapse.cooldown;
          startCast(b, e, a, { kind: 'collapse', duration: p.collapse.anim.duration, release: p.collapse.anim.release,
            onRelease: (bb, ee) => { if (live(pillar) && pillar.mem.stageUnitDevice.state === 'intact') topple(bb, ee, pillar); } });
          return;
        }
      }
      if (a.gazeLeft <= 1e-9 && gazeTargets(b, e).length) {
        a.gazeLeft = p.gaze.window + p.gaze.cooldown;
        startCast(b, e, a, { kind: 'gaze', duration: p.gaze.window + p.gaze.end, linkAt: p.gaze.predelay, linked: false, target: null });
      }
    },
    killed(c, b, e, a) { return form === 2 ? false : rebirth.killed(c, b, e, a); },
    death(_c, b, e, a) { finishCast(b, e, a); },
  };
}

function validate(p) {
  const pos = v => Number.isFinite(v) && v > 0, nn = v => Number.isFinite(v) && v >= 0, frac = v => pos(v) && v < 1;
  const g = p?.gaze, c = p?.collapse;
  if (!p || !frac(p.resistance) || !p.restore || !pos(p.restore.duration) || !frac(p.restore.hpOffset)
    || !g || !pos(g.radius) || !pos(g.scale) || !pos(g.hitInterval) || !pos(g.aspdMul) || !pos(g.window) || !pos(g.cooldown) || !nn(g.initial)
    || !nn(g.predelay) || !(g.firstHit >= g.predelay) || !nn(g.end) || !nn(g.form2Reset)
    || !p.aura || !pos(p.aura.radius) || !pos(p.aura.scale) || !pos(p.aura.interval)
    || !c || !pos(c.cooldown) || !nn(c.initial) || !nn(c.delay) || !Array.isArray(c.range) || !c.range.length
    || !c.anim || !pos(c.anim.duration) || !nn(c.anim.release)
    || !pos(p.rebirth) || !(p.rebornHp > 0 && p.rebornHp <= 1) || !nn(p.invincible) || !pos(p.stun) || !p.skin || !pos(p.skin.duration)
    || !p.attackAnim1 || !pos(p.attackAnim1.dur) || !p.attackAnim2 || !pos(p.attackAnim2.dur) || !pos(p.shotSpeed)) throw Error('Invalid Mandragora');
}
mandragora.validate = validate;
