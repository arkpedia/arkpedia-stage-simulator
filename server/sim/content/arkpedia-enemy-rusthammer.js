// SPDX-License-Identifier: GPL-3.0-or-later
// Faust's kit: Rusthammer Warrior (enemy_2006_flsnip) and Faust (enemy_1508_faust). Every number arrives in `p` from the
// reviewed contracts (shared/arkpedia/enemy-rusthammer-features.js, shared/arkpedia/enemy-faust-features.js).
import { projectileSingleAttack } from './arkpedia-enemy-projectiles.js';

const pos = v => Number.isFinite(v) && v > 0;
const CAST = 'ab:faustSummonCast';

export function rusthammerWarrior(p) {
  const s = p?.summon;
  if (!pos(p?.invincible) || !pos(p.cooldown) || !(p.initial >= 0) || !pos(p.scale) || !['phys', 'arts'].includes(p.criticalType)
    || !pos(p.speed) || !pos(p.lifetime) || !pos(p.attackAnim?.dur)
    || s && (typeof s.branch !== 'string' || !s.branch || !pos(s.cooldown) || !(s.initial >= 0) || !pos(s.cast?.dur) || !(s.cast.hit >= 0)))
    throw Error("Invalid Faust-kit parameters");
  const normal = projectileSingleAttack({ speed: p.speed, lifetime: p.lifetime, type: 'phys' });
  const critical = projectileSingleAttack({ speed: p.speed, lifetime: p.lifetime, type: p.criticalType, damageScale: p.scale });
  const finish = (b, e, a) => {
    a.cast = null; e.profile.noAttack = false; e.skillAnimUntil = b.time; b.removeBuff(e, CAST);
    if (e.mem.regularFormVisual?.playId === `faust:${e.id}`) e.mem.regularFormVisual = null;
  };
  return {
    spawn(b, e, a) {
      normal.spawn(b, e); e.def = { ...e.def, attackAnim: p.attackAnim, immune: new Set([...e.def.immune, 'sleep']) };
      a.readyAt = b.time + p.initial; a.critical = false; a.cast = null;
      if (s) a.summonAt = b.time + s.initial;
      // faust_c_blockfree (BLOCK_FREE, sleep-immune) for life; faust_t_invi (INVINCIBLE) for `invincible` s.
      b.addBuff(e, { key: 'faust_c_blockfree', persist: true, flags: { unblockable: true } });
      b.applyStatus(e, 'invulnerable', { key: 'faust_t_invi', source: e, duration: p.invincible });
    },
    tick(b, e, a, dt) {
      if (e.s.flags.silence) b.removeBuff(e, 'faust_t_invi'); // faust_t_invi is silenceable
      if (!s || !e.alive) return;
      if (a.cast) {
        // _immuneStunWhenAffecting: the cast runs to its end once started.
        a.cast.elapsed += dt * e.s.slowDownRate;
        if (!a.cast.released && a.cast.elapsed + 1e-9 >= s.cast.hit) { a.cast.released = true; b.stageBranches?.advance(s.branch); }
        if (a.cast.elapsed + 1e-9 >= s.cast.dur) finish(b, e, a);
        return;
      }
      // SummonBallis ignores silence; it needs a live, acting body.
      if (b.time + 1e-9 < a.summonAt || !e.canAct) return;
      a.summonAt = b.time + s.cooldown; a.cast = { elapsed: 0, released: false };
      e.attackControlEpoch = (e.attackControlEpoch ?? 0) + 1;
      e.profile.noAttack = true; e.skillAnimUntil = b.time + s.cast.dur;
      e.mem.regularFormVisual = { clip: 'Skill_2', loop: false, speed: 1, playId: `faust:${e.id}` };
      b.addBuff(e, { key: CAST, persist: true, flags: { noMove: true } });
    },
    before(_c, b, e, a) {
      a.critical = b.time + 1e-9 >= a.readyAt; // CriticalHit ignores silence
      e.profile.attackVisual = a.critical ? 'Skill_1' : 'Attack';
    },
    attack(c, b, e, a) {
      if (a.critical) { a.critical = false; a.readyAt = b.time + p.cooldown; critical.attack(c, b, e); }
      else normal.attack(c, b, e);
    },
  };
}
