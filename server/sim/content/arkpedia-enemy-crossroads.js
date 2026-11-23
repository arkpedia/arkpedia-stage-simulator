// SPDX-License-Identifier: GPL-3.0-or-later
// 'Crossroads' Production Model and Prototype (enemy_1331_cbsisy[_2]). Every number arrives in `p` from the reviewed
// contract (shared/arkpedia/enemy-crossroads-features.js).
import { canTargetAlly } from '../targeting.js';
import { ALLY_COLLIDER_RADIUS } from '../constants.js';
import { segmentCircleEntry } from '../projectile-collision.js';

const pos = v => Number.isFinite(v) && v > 0;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function crossroads(p) {
  const { close, laser, loops } = p ?? {};
  if (!pos(p?.interval) || !pos(p.maxWait) || !pos(close?.radius) || !(close.scale >= 0) || !pos(laser?.speed) || !pos(laser.life)
    || !pos(laser.radius) || !(laser.scale >= 0) || !['Move', 'Idle'].every(k => pos(loops?.[k]?.dur) && loops[k].events?.length))
    throw Error('Invalid Crossroads parameters');
  const reach = laser.speed * laser.life;
  const fire = (b, e) => {
    const attackId = ++b._attackSeq, atk = e.s.atk;
    // CloseAttack: every ground operator inside the 0.7 collider.
    const near = new Set(b.alliesInRadius(e.x, e.y, close.radius + ALLY_COLLIDER_RADIUS)
      .filter(u => u.alive && !u.isFlying && canTargetAlly(e, u, true)));
    for (const u of near) b.dealDamage(e, u, { amount: atk * close.scale, type: 'arts', isAttack: true, applyWay: 'ranged',
      attackId, tags: ['crossroadsClose'] });
    // Four lasers from the body: each stops at its first unit (ground or aerial). A unit the close attack already hit
    // takes nothing more (the handbook's 0-0.7: 100%, >0.7-1.2: 50%).
    for (const [dx, dy] of DIRS) {
      const to = { x: e.x + dx * reach, y: e.y + dy * reach };
      const hit = b.allies(null, { includeTargetableDevices: true })
        .filter(u => u.alive && canTargetAlly(e, u, true))
        .map(u => ({ u, t: segmentCircleEntry(e, to, u, laser.radius + ALLY_COLLIDER_RADIUS) }))
        .filter(x => x.t != null).sort((x, y) => x.t - y.t || x.u.deploySeq - y.u.deploySeq)[0];
      b.fx('crossroadsLaser', { x: e.x, y: e.y, dx, dy, r: reach, id: e.id });
      if (!hit || near.has(hit.u)) continue;
      const u = hit.u;
      b.after(hit.t * laser.life, () => {
        if (u.alive) b.dealDamage(e, u, { amount: atk * laser.scale, type: 'arts', isAttack: true, applyWay: 'ranged',
          attackId, tags: ['crossroadsLaser'] });
      });
    }
  };
  return {
    spawn(b, e, a) {
      for (const t of b.grid.tiles ?? []) if (String(t?.key ?? '').startsWith('tile_ristar'))
        throw Error('Crossroads debris pushing (tile_ristar_road) is not implemented');
      e.profile.noAttack = true; // an empty Combat: no ordinary attack
      b.addBuff(e, { key: 'enemy_cbsisy_t', persist: true, flags: { noDisplace: true } });
      a.left = 0; a.pending = null; a.clip = null; a.t = 0;
    },
    tick(b, e, a, dt) {
      if (!e.alive) return;
      const clip = e.moving ? 'Move' : 'Idle', loop = loops[clip];
      if (clip !== a.clip) { a.clip = clip; a.t = 0; }
      const from = a.t; a.t += dt;
      a.left -= dt;
      if (a.left <= 1e-9) { a.left += p.interval; if (!a.pending) a.pending = { waited: 0 }; }
      if (!a.pending) return;
      a.pending.waited += dt;
      // The next OnAttack event of the looping clip releases the cast; preDelay caps the wait.
      const crossed = loop.events.some(ev => {
        const k = Math.ceil((from - ev) / loop.dur - 1e-9);
        return ev + k * loop.dur > from + 1e-9 && ev + k * loop.dur <= a.t + 1e-9;
      });
      if (crossed || a.pending.waited + 1e-9 >= p.maxWait) { a.pending = null; fire(b, e); }
    },
  };
}
