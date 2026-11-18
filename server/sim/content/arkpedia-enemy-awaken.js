// SPDX-License-Identifier: GPL-3.0-or-later
// 'Awaken' (enemy_1531_bbrain). Every number arrives in `p` from the reviewed
// contract (shared/arkpedia/enemy-awaken-boss-features.js). Her damage sharing
// stays with the separately reviewed markedEnemyDamageShare (talent:DamageSplit).
import { rebornAbility } from './arkpedia-enemy-forms.js';
import { areaSelectable } from '../targeting.js';
import { ALLY_COLLIDER_RADIUS } from '../constants.js';

const CAST_BUFF = 'ab:bbrainCast', BLINK_BUFF = 'bbrain[blink]';
const DIRS = { L: [-1, 0], R: [1, 0], U: [0, 1], D: [0, -1] };
const groundAllies = (b, e) => b.allies(null, { includeTargetableDevices: true }).filter(u => areaSelectable(e, u) && !u.isFlying);

/** Move to the next MOVE checkpoint of her route (BlinkNode `_toNextCheckpoint`); false when none remains. */
export function blinkToNextCheckpoint(e) {
  const R = e.route;
  if (!R || !Array.isArray(R.legs)) return false;
  for (let i = Math.max(0, R.legIdx); i < R.legs.length; i++) {
    const L = R.legs[i];
    if (L.t !== 'move' || L.final) continue;
    e.x = L.c; e.y = L.r; R.legIdx = i + 1; R.pts = null; R.waitLeft = null;
    return true;
  }
  return false;
}

export function awaken(p) {
  validate(p);
  let form = 1;

  const finishCast = (b, e, a) => {
    if (!a.cast) return;
    a.cast = null; e.skillAnimUntil = b.time; b.removeBuff(e, CAST_BUFF);
  };
  const startCast = (b, e, a, cast) => {
    a.cast = { elapsed: 0, released: false, ...cast };
    e.skillAnimUntil = b.time + cast.duration;
    b.addBuff(e, { key: CAST_BUFF, persist: true, flags: { noMove: true } });
  };

  // Journey: a speed-3 shot per direction that hits the first ground unit it touches.
  const journey = (b, e) => {
    const attackId = ++b._attackSeq, reach = p.journey.speed * p.journey.lifetime;
    for (const key of form === 2 ? ['L', 'R', 'U', 'D'] : ['L', 'R']) {
      const [dx, dy] = DIRS[key];
      b.addProjectile({ from: e, to: { x: e.x + dx * reach, y: e.y + dy * reach }, speed: p.journey.speed, visual: 'enemy', source: e,
        onMove: ({ projectile, x, y }) => {
          const hit = groundAllies(b, e).find(u => Math.hypot(u.x - x, u.y - y) <= p.journey.radius + ALLY_COLLIDER_RADIUS);
          if (!hit) return;
          projectile.removed = true;
          b.dealDamage(e, hit, { amount: e.s.atk * p.journey.scale, type: 'phys', isAttack: true, attackId, applyWay: 'ranged', tags: ['awakenJourney'] });
        } });
    }
  };

  // Shattered Vision: the whole field's ground units share scale x ATK; the second form also stuns those on ranged tiles.
  const shatter = (b, e) => {
    const targets = groundAllies(b, e);
    if (targets.length) {
      const amount = e.s.atk * p.vision.scale / targets.length;
      for (const u of targets) b.dealDamage(e, u, { amount, type: 'phys', isSkill: true, applyWay: 'melee', noSp: true, tags: ['awakenVision'] });
    }
    if (form !== 2) return;
    // Ranged (high-ground) tiles: the selector's buildable type 2.
    const high = targets.filter(u => u.alive && !b.grid.isLow(Math.round(u.y), Math.round(u.x)));
    for (const u of high) b.applyStatus(u, 'stun', { duration: p.vision.stun / high.length, source: e });
  };
  const tickCast = (b, e, a, dt) => {
    const cast = a.cast;
    cast.elapsed += dt * e.s.slowDownRate;
    if (!cast.released && cast.elapsed + 1e-9 >= cast.release) { cast.released = true; cast.onRelease(b, e, a); }
    e.skillAnimUntil = b.time + Math.max(0, cast.duration - cast.elapsed);
    if (cast.elapsed + 1e-9 >= cast.duration) finishCast(b, e, a);
  };
  const startVision = (b, e, a) => startCast(b, e, a, { kind: 'vision', duration: p.vision.prepare + p.vision.end,
    release: p.vision.prepare + p.vision.release, onRelease: shatter });

  const rebirth = rebornAbility({
    dur: p.rebirth, hpRatio: p.rebornHp, invincible: 0,
    onKo(b, e, a) { finishCast(b, e, a); a.blinkAt = null; },
    onReborn(b, e, a) {
      form = 2;
      b.addBuff(e, { key: 'bbrain_passive[M2_attack_up]', persist: true, visible: true, mods: { atkPct: p.form2Atk } });
      // At the revive's end: the current wave is released (tracking her at the next), and every R-Series Power Armor
      // still marked inactive gets its SP filled.
      b.stageWaveScheduler?.releaseCurrentWave(e, { trackSourceAtNextWave: true });
      for (const u of b.enemies) if (u.alive && u.findBuff('lypa[car_mark]') && u.skill) u.skill.sp = Math.max(u.skill.sp ?? 0, u.skill.spCost ?? 0);
      e.profile.noAttack = true;
      a.journeyLeft = p.journey.initial;
    },
  });

  return {
    ...rebirth,
    iv: 0,
    spawn(b, e, a) {
      a.cast = null; a.blinkAt = null; a.journeyLeft = p.journey.initial; a.blinkLeft = p.blink.initial;
      // Self-bound: never walks, attacks or gets blocked; her shots and Shattered Vision are her only damage.
      e.profile.noAttack = true;
      b.addBuff(e, { key: 'bbrain_passive', persist: true, flags: { noMove: true, unblockable: true } });
    },
    tick(b, e, a, dt) {
      if (a.state === 'reborn') return;
      a.journeyLeft -= dt; a.blinkLeft -= dt;
      // One second after a blink she casts Shattered Vision (enemy_bbrain[aoe_when_finish]).
      if (a.blinkAt != null && b.time + 1e-9 >= a.blinkAt + p.blink.hide) { a.blinkAt = null; finishCast(b, e, a); startVision(b, e, a); return; }
      if (a.cast) { tickCast(b, e, a, dt); return; }
      if (a.blinkAt != null || !e.canAct) return;
      if (a.blinkLeft <= 1e-9) {
        a.blinkLeft = p.blink.cooldown;
        if (blinkToNextCheckpoint(e)) {
          a.blinkAt = b.time;
          b.addBuff(e, { key: BLINK_BUFF, duration: p.blink.hide, flags: { untargetable: true, invulnerable: true } });
          b.fx?.('telegraph', { x: e.x, y: e.y, r: 1, dur: p.blink.hide, kind: 'awakenBlink', id: e.id });
          return;
        }
      }
      if (a.journeyLeft <= 1e-9 && groundAllies(b, e).length) {
        a.journeyLeft = p.journey.cooldown;
        startCast(b, e, a, { kind: 'journey', duration: p.journey.anim.duration, release: p.journey.anim.release, onRelease: journey });
      }
    },
    killed(c, b, e, a) { return form === 2 ? false : rebirth.killed(c, b, e, a); },
    death(_c, b, e, a) { finishCast(b, e, a); },
  };
}

function validate(p) {
  const pos = v => Number.isFinite(v) && v > 0, nn = v => Number.isFinite(v) && v >= 0;
  const anim = a => a && pos(a.duration) && nn(a.release) && a.release <= a.duration;
  const j = p?.journey, v = p?.vision, bl = p?.blink;
  if (!p || !j || !pos(j.speed) || !pos(j.lifetime) || !pos(j.radius) || !pos(j.scale) || !pos(j.cooldown) || !nn(j.initial) || !anim(j.anim)
    || !v || !pos(v.scale) || !nn(v.prepare) || !nn(v.release) || !(v.end >= v.release) || !nn(v.stun)
    || !bl || !pos(bl.cooldown) || !nn(bl.initial) || !nn(bl.hide)
    || !pos(p.rebirth) || !(p.rebornHp > 0 && p.rebornHp <= 1) || !nn(p.form2Atk)) throw Error("Invalid 'Awaken'");
}
awaken.validate = validate;
