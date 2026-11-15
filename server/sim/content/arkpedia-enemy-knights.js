// SPDX-License-Identifier: GPL-3.0-or-later
import { projectileSingleAttack } from './arkpedia-enemy-projectiles.js';
import { canTargetAlly, sortAllyTargets, areaSelectable } from '../targeting.js';

const alive = u => u?.alive && u.deployed && !u.hidden;
function splash(b, e, target, amount, ranged, tag) {
  // The native AOEDamage excludes the attached target; primary damage is a
  // separate action and may have a different miss/targetability outcome.
  for (const u of b.allies(null, { includeTargetableDevices: true })) {
    if (u === target || !areaSelectable(e, u) || !ranged && u.isFlying
      || Math.abs(u.tileR - Math.round(target.y)) + Math.abs(u.tileC - Math.round(target.x)) > 1) continue;
    b.dealDamage(e, u, { amount, type: ranged ? 'arts' : 'phys', isAttack: true, isSplash: true,
      applyWay: ranged ? 'ranged' : 'melee', tags: [tag] });
  }
}
export function knightPair(p) {
  const shot = projectileSingleAttack({ speed: p.speed, lifetime: p.lifetime, type: 'arts' });
  const candidates = (b, e) => sortAllyTargets(e, b.allies(null, { includeTargetableDevices: true })
    .filter(u => canTargetAlly(e, u, true) && Math.hypot(e.x - u.x, e.y - u.y) <= p.range + 1e-9)).slice(0, 3);
  const finish = (b, e, a) => {
    a.cast = null; e.profile.noAttack = false; e.skillAnimUntil = b.time; b.removeBuff(e, 'ab:knightCast');
  };
  const attachArrow = (b, e, target) => {
    if (!alive(target)) return;
    const life = target.deploySeq, key = `ab:knightArrow:${e.id}:${++e.mem.knightArrowSequence}`;
    const buff = b.addBuff(target, { key, source: e, visible: true });
    b.fx('telegraph', { x: target.x, y: target.y, id: target.id, r: 1, dur: p.delay, tiles: 'plus', kind: 'blastArrow' });
    b.after(p.delay, () => {
      // Original IfTarget checks the source, and a removed recipient loses
      // its attached buff. An unrelated replacement at the same tile is safe.
      if (!e.alive || !alive(target) || target.deploySeq !== life || target.findBuff(key) !== buff) {
        if (target.findBuff(key) === buff) b.removeBuff(target, buff); return;
      }
      const amount = e.s.atk * p.scale;
      splash(b, e, target, amount, true, 'knightArrowSplash');
      b.removeBuff(target, buff);
      b.dealDamage(e, target, { amount, type: 'arts', isAttack: true, applyWay: 'ranged', tags: ['knightArrow'] });
      b.fx('explode', { x: target.x, y: target.y, r: 1, tiles: 'plus', kind: 'blastArrow' });
    });
  };
  return {
    spawn(b, e, a) {
      a.left = p.initial; e.mem.knightArrowSequence = 0;
      e.profile.deferHit = true; e.profile.shot = 'none';
      if (p.ranged) { shot.spawn(b, e); e.profile.maxTargets = 2; }
      a.off = b.on('death', ({ unit, reason }) => {
        if (!e.alive || a.raged || reason !== 'killed' || unit.def.raw?.prefabKey !== p.partner) return;
        a.raged = true; b.addBuff(e, { key: 'ab:knightRage', persist: true, visible: true, mods: p.rage });
      });
    },
    death(_c, b, _e, a) { if (a.off) b.off(a.off); },
    attack(c, b, e) {
      if (p.ranged) { shot.attack(c, b, e); return; }
      for (const target of c.targets) {
        const amount = e.s.atk;
        b.dealDamage(e, target, { amount, type: 'phys', isAttack: true, attackId: b._attackSeq, applyWay: 'melee', tags: ['knightAttack'] });
        splash(b, e, target, amount, false, 'knightAttackSplash');
      }
    },
    tick(b, e, a, dt) {
      a.left -= dt;
      if (a.cast) {
        if (!e.canAct) { finish(b, e, a); return; }
        const cast = a.cast; cast.elapsed += dt * (p.ranged ? e.s.slowDownRate : 1);
        if (!cast.released && cast.elapsed + 1e-9 >= p.release) {
          cast.released = true;
          for (const target of cast.targets) {
            if (p.ranged) {
              if (!alive(target)) continue;
              b.addProjectile({ from: e, target, speed: p.speed, maxAge: p.lifetime, visual: 'lob', source: e, hitDead: true,
                onHit: ({ target }) => attachArrow(b, e, target) });
            } else {
              const amount = e.s.atk * p.scale;
              if (alive(target)) b.dealDamage(e, target, { amount, type: 'phys', isAttack: true, applyWay: 'melee', tags: ['knightCharge'] });
              splash(b, e, target, amount, false, 'knightChargeSplash');
            }
          }
        }
        e.skillAnimUntil = b.time + Math.max(0, p.duration - cast.elapsed) / (p.ranged ? Math.max(.001, e.s.slowDownRate) : 1);
        if (cast.elapsed + 1e-9 >= p.duration) finish(b, e, a);
        return;
      }
      if (a.left > 1e-9 || !e.canAct) return;
      const targets = p.ranged ? candidates(b, e) : alive(e.blockedBy) ? [e.blockedBy] : [];
      if (!targets.length) return;
      a.left = p.cooldown; a.cast = { targets, elapsed: 0, released: false };
      e.profile.noAttack = true; e.skillAnimUntil = b.time + p.duration;
      b.addBuff(e, { key: 'ab:knightCast', flags: { noMove: true } });
    },
    status(_c, b, e, a) { if (a.cast && !e.canAct) finish(b, e, a); },
  };
}
