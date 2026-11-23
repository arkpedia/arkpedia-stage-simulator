// SPDX-License-Identifier: GPL-3.0-or-later
// Uproar (enemy_8015_mcnrhd). Every number arrives in `p` from the reviewed contract
// (shared/arkpedia/enemy-uproar-features.js). Its Rebirth is the shared `reborn` kind.
import { areaSelectable } from '../targeting.js';
import { ALLY_COLLIDER_RADIUS } from '../constants.js';

const KEY = 'enemy_mcnrhd_damage', CAST = 'ab:mcnrhdCast', ASPD = 'enemy_mcnrhd_attack_speed';
const pos = v => Number.isFinite(v) && v > 0;

export function uproarArrowRain(p) {
  if (!(p?.reduction > 0 && p.reduction < 1) || !pos(p.cooldown) || !(p.initial >= 0) || !pos(p.cast?.dur) || !pos(p.cast.hit)
    || !pos(p.speed) || !(p.delay >= 0) || !pos(p.radius) || !pos(p.scale) || !Number.isFinite(p.aspd) || !pos(p.aspdDuration) || !pos(p.attackAnim?.dur))
    throw Error('Invalid Uproar parameters');
  // special: the block checker (min -1, max 0) holds enemy_mcnrhd_damage while not blocked.
  const guard = (b, e) => {
    if (e.blockedBy || !e.alive) b.removeBuff(e, KEY);
    else if (!e.findBuff(KEY)) b.applyStatus(e, 'sanctuary', { key: KEY, source: e, value: p.reduction });
  };
  const finish = (b, e, a) => {
    a.cast = null; e.profile.noAttack = false; e.skillAnimUntil = b.time; b.removeBuff(e, CAST);
    if (e.mem.regularFormVisual?.playId === `uproar:${e.id}`) e.mem.regularFormVisual = null;
  };
  const land = (b, e, shot) => {
    b.fx?.('explode', { x: shot.x, y: shot.y, r: p.radius, kind: 'enemyArea' });
    for (const u of b.alliesInRadius(shot.x, shot.y, p.radius + ALLY_COLLIDER_RADIUS)) {
      if (!u.alive || u.isFlying || !areaSelectable(e, u)) continue;
      b.dealDamage(e, u, { amount: shot.atk * p.scale, type: 'phys', isAttack: true, applyWay: 'ranged', isSplash: u !== shot.target, tags: ['uproarArrowRain'] });
      if (u.alive) b.addBuff(u, { key: ASPD, source: e, duration: p.aspdDuration, visible: true, mods: { aspd: p.aspd } });
    }
  };
  return {
    spawn(b, e, a) {
      e.def = { ...e.def, attackAnim: p.attackAnim }; a.cast = null; a.shots = []; a.readyAt = b.time + p.initial;
      guard(b, e);
      for (const event of ['blocked', 'unblocked']) b.on(event, ({ enemy }) => { if (enemy === e) guard(b, e); }, { owner: e });
    },
    status: (_c, b, e) => guard(b, e),
    hitIn(c, b, e, a) {
      // enemy_mcnrhd_damage, ON_TAKE_DAMAGE, Physical or Arts only: trigger multiAttack on the source if ready (the
      // sanctuary status scales the damage).
      if (!e.findBuff(KEY) || !['phys', 'arts'].includes(c.dmg?.type) || !(c.dmg.amount > 0)) return;
      const source = c.source;
      if (!source?.alive || source.side !== 'ally' || a.cast || b.time + 1e-9 < a.readyAt || !e.canAct || e.s.flags.silence) return;
      a.readyAt = b.time + p.cooldown;
      a.cast = { target: source, elapsed: 0, released: false };
      e.attackControlEpoch = (e.attackControlEpoch ?? 0) + 1; // interrupts the current action
      e.profile.noAttack = true; e.skillAnimUntil = b.time + p.cast.dur;
      e.mem.regularFormVisual = { clip: 'Skill', loop: false, speed: 1, playId: `uproar:${e.id}` };
      b.addBuff(e, { key: CAST, persist: true, flags: { noMove: true } });
    },
    tick(b, e, a, dt) {
      guard(b, e);
      for (const shot of [...a.shots]) {
        if (shot.target?.alive) { shot.x = shot.target.x; shot.y = shot.target.y; }
        shot.left -= dt;
        if (shot.left <= 1e-9) { a.shots.splice(a.shots.indexOf(shot), 1); if (e.alive) land(b, e, shot); }
      }
      if (!a.cast) return;
      if (!e.canAct) { finish(b, e, a); return; }
      a.cast.elapsed += dt * e.s.slowDownRate;
      if (!a.cast.released && a.cast.elapsed + 1e-9 >= p.cast.hit) {
        a.cast.released = true;
        const t = a.cast.target;
        if (t?.alive) {
          const flight = Math.hypot(t.x - e.x, t.y - e.y) / p.speed;
          a.shots.push({ target: t, x: t.x, y: t.y, atk: e.s.atk, left: flight + p.delay });
        }
      }
      if (a.cast.elapsed + 1e-9 >= p.cast.dur) finish(b, e, a);
    },
  };
}
