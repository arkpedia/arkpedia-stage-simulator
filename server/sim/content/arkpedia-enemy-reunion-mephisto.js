// SPDX-License-Identifier: GPL-3.0-or-later
// Mephisto (enemy_1507_mephi). Every number arrives in `p` from the reviewed contract
// (shared/arkpedia/enemy-reunion-mephisto-features.js).
import { OwnedStageAura } from './arkpedia-stage-auras.js';

const CAST = 'ab:mephiHeal', pos = v => Number.isFinite(v) && v > 0;

export function reunionMephisto(p) {
  if (!Number.isSafeInteger(p?.maxTargets) || p.maxTargets < 1 || !pos(p.range) || !pos(p.interval) || !pos(p.cast?.dur) || !(p.cast.hit >= 0)
    || !(p.regenMul >= 1)) throw Error('Invalid Mephisto parameters');
  const healable = (e, t) => t.side === e.side && t.alive && t.deployed && !t.hidden && !t.removed && !t.s.flags.healFree && !t.s.flags.noHeal
    && !t.s.flags.isolated && !t.s.flags.sleep && !t.s.flags.untargetable && t.hp < t.s.maxHp;
  // _postFilter 3: injured, lowest HP ratio first; up to maxTargets within range.
  const targets = (b, e) => b.enemies.filter(t => healable(e, t) && Math.hypot(e.x - t.x, e.y - t.y) <= p.range + .5)
    .sort((a, z) => a.hp / a.s.maxHp - z.hp / z.s.maxHp || a.deploySeq - z.deploySeq).slice(0, p.maxTargets);
  const finish = (b, e, a) => {
    a.cast = null; e.skillAnimUntil = b.time; b.removeBuff(e, CAST);
    if (e.mem.regularFormVisual?.playId === `mephi:${e.id}`) e.mem.regularFormVisual = null;
  };
  // HealAura: every unit of his side, field-wide, HP regeneration x regenMul.
  const auraUpdate = (b, e, a) => {
    const recipients = e.alive && e.deployed && !e.removed ? b.enemies.filter(u => u.alive && u.deployed && !u.hidden && !u.removed
      && u.side === e.side && !u.s.flags.untargetable && !u.s.flags.isolated) : [];
    a.aura.update(recipients);
  };
  return {
    spawn(b, e, a) {
      e.profile.noAttack = true; a.cast = null; a.readyAt = b.time;
      a.aura = new OwnedStageAura(b, e, { key: 'mephi_t_healaura', mods: { hpRegenMul: p.regenMul } }); auraUpdate(b, e, a);
      b.on('enemySpawn', () => auraUpdate(b, e, a), { owner: e });
      b.on('removed', ({ unit }) => { if (unit === e) a.aura.clear(); }, { owner: e });
    },
    death(_c, _b, _e, a) { a.aura?.clear(); finish(_b, _e, a); },
    tick(b, e, a, dt) {
      auraUpdate(b, e, a);
      if (!e.alive) return;
      if (a.cast) {
        if (!e.canAct) { finish(b, e, a); return; }
        a.cast.elapsed += dt * e.s.slowDownRate;
        if (!a.cast.released && a.cast.elapsed + 1e-9 >= p.cast.hit) {
          a.cast.released = true;
          for (const t of targets(b, e)) b.heal(e, t, e.s.atk, { isAttack: true });
        }
        if (a.cast.elapsed + 1e-9 >= p.cast.dur) finish(b, e, a);
        return;
      }
      if (b.time + 1e-9 < a.readyAt || !e.canAct || !targets(b, e).length) return;
      a.readyAt = b.time + p.interval; a.cast = { elapsed: 0, released: false };
      e.skillAnimUntil = b.time + p.cast.dur;
      e.mem.regularFormVisual = { clip: 'Attack', loop: false, speed: 1, playId: `mephi:${e.id}` };
      b.addBuff(e, { key: CAST, persist: true, flags: { noMove: true } });
    },
  };
}
