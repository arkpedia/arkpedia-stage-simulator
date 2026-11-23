// SPDX-License-Identifier: GPL-3.0-or-later
// Divicellular and Allotropic Hoarders (enemy_1436_dsdivi[_2]). Every number arrives in `p` from the reviewed contract
// (shared/arkpedia/enemy-hoarder-features.js).
import { animatedProjectileAttack } from './arkpedia-enemy-projectiles.js';
import { spawnChildren } from './arkpedia-enemy-spawn.js';

const pos = v => Number.isFinite(v) && v > 0;

export function hoarderSplit(p) {
  const { key, hpRatio, offset, unmovable, cast, ...transport } = p ?? {};
  if (typeof key !== 'string' || !key || !(hpRatio > 0 && hpRatio <= 1) || !(offset >= 0) || !pos(unmovable) || !pos(cast))
    throw Error('Invalid Hoarder parameters');
  const shot = animatedProjectileAttack(transport);
  const ROOT = 'dsdivi_tr_1[unmovable]';
  const split = (b, e, a) => {
    a.split = null; e.profile.noAttack = false; e.skillAnimUntil = b.time;
    if (!e.alive) return;
    const ratio = e.hp / e.s.maxHp;
    // offset_bound: the copy lands at a random point within the bound around the splitter, on its remaining route.
    const dx = (b.rng() * 2 - 1) * offset, dy = (b.rng() * 2 - 1) * offset;
    const [copy] = spawnChildren(b, e, key, 1, { pos: [e.y + dy, e.x + dx] });
    if (!copy) return;
    copy.mem.dsdiviSplitMark = true; // dsdivi_tr_1[split_mark]: a copy never splits
    copy.hp = Math.max(1, copy.s.maxHp * ratio); // dsdivi_tr_1[copy_hp]: CopyHealth by ratio
  };
  return {
    ...shot,
    spawn(b, e, a) {
      shot.spawn(b, e, a);
      a.armed = true; a.split = null;
      // dsdivi_tr_1[listener]: every damage taken; the first one below hp_ratio while not silenced splits it once.
      b.on('damaged', c => {
        if (c.target !== e || !a.armed || !e.alive || e.mem.dsdiviSplitMark) return;
        if (!(e.hp / e.s.maxHp < hpRatio) || e.s.flags.silence) return;
        a.armed = false;
        a.split = { left: cast };
        e.profile.noAttack = true; e.skillAnimUntil = b.time + cast;
        e.attackControlEpoch = (e.attackControlEpoch ?? 0) + 1;
        e.mem.regularFormVisual = { clip: 'Skill', loop: false, speed: 1, playId: `hoarder:${e.id}` };
        b.addBuff(e, { key: ROOT, duration: unmovable, flags: { noMove: true } });
      }, { owner: e });
    },
    tick(b, e, a, dt) {
      shot.tick?.(b, e, a, dt);
      if (!a.split) return;
      a.split.left -= dt * e.s.slowDownRate;
      if (a.split.left <= 1e-9) { e.mem.regularFormVisual = null; split(b, e, a); }
    },
  };
}
