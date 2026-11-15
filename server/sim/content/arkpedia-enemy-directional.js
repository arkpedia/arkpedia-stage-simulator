// SPDX-License-Identifier: GPL-3.0-or-later
// Content owns the polling cadence and presentation clock. Damage uses the
// common conditional Sanctuary channel, so protection never stacks twice.
export function faceOperatorCrowd(b, e) {
  let left = 0, right = 0;
  for (const u of b.allies()) {
    if (u.kind !== 'op') continue;
    if (u.x < e.x) left++; else if (u.x > e.x) right++;
  }
  if (left !== right) e.mem.nativeFacing = right > left ? 1 : -1;
}

export function crowdDirectionalGuard(p) {
  const finish = (b, e, a) => {
    a.show = null; b.removeBuff(e, 'ab:directionalShow');
    e.mem.regularFormVisual = null; e.skillAnimUntil = b.time;
  };
  return {
    spawn(b, e, a) {
      e.mem.nativeFacing = 1; a.poll = 0; a.back = false; a.left = p.interval;
      a.px = e.x; a.py = e.y; a.moveDir = null; a.show = null; a.sequence = 0;
      e.profile.noAttack = true;
      b.addBuff(e, { key: 'ab:directionalGuard', persist: true, status: 'sanctuary',
        data: { frontSourceSanctuary: p.reduction }, flags: { unblockable: true } });
    },
    tick(b, e, a, dt) {
      const dx = e.x - a.px, dy = e.y - a.py; a.px = e.x; a.py = e.y;
      if (e.moving && Math.hypot(dx, dy) > 1e-8) a.moveDir = Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) : 0;
      a.poll += dt;
      if (a.poll + 1e-9 >= p.poll) {
        a.poll %= p.poll;
        const old = a.back;
        if (a.moveDir === -e.mem.nativeFacing) a.back = true;
        else if (a.moveDir === e.mem.nativeFacing) a.back = false;
        if (a.back !== old) { a.left = p.interval; if (a.show) finish(b, e, a); }
        // The original profession mask includes operators, ignores their
        // targetability and includes air; devices and summons do not count.
        faceOperatorCrowd(b, e);
      }
      if (a.back) {
        a.left -= dt;
        if (a.left <= 1e-9) {
          a.left = p.interval;
          if (e.canAct) { a.show = { elapsed: 0, id: ++a.sequence };
            b.addBuff(e, { key: 'ab:directionalShow', flags: { noMove: true } }); }
        }
      }
      if (a.show) {
        if (!e.canAct) { finish(b, e, a); return; }
        a.show.elapsed += dt * e.s.slowDownRate;
        e.mem.regularFormVisual = { clip: 'Special', speed: e.s.slowDownRate, loop: false, playId: `directional:${a.show.id}` };
        e.skillAnimUntil = b.time + (p.showDuration - a.show.elapsed) / Math.max(.001, e.s.slowDownRate);
        if (a.show.elapsed + 1e-9 >= p.showDuration) finish(b, e, a);
      } else e.mem.regularFormVisual = a.back && e.moving ? { clip: 'Move_2', loop: true, speed: 1 } : null;
    },
    status(_c, b, e, a) { if (a.show && !e.canAct) finish(b, e, a); },
  };
}
