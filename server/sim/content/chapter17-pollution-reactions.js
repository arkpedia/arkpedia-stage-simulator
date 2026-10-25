// SPDX-License-Identifier: GPL-3.0-or-later
// Source-backed candidates; attaching these does not admit a stage or record.
import { attackStand } from '../ai.js';
const live = e => e?.alive && e.deployed;

function reaction(b, e, a, onContact) {
  const life = e.deploySeq;
  a.active = true;
  a.contact = () => { if (a.active && live(e) && e.deploySeq === life) onContact(); };
  e.mem.ch17PollutionReaction = a.contact;
  a.detach = () => {
    a.active = false;
    if (e.mem.ch17PollutionReaction === a.contact) delete e.mem.ch17PollutionReaction;
  };
  b.on('battleEnd', a.detach, { owner: e });
}

export function pollutionInfantry(r) {
  const ratio = r.talents.bb['MuradPollut.hp_ratio'];
  if (!(Number.isFinite(ratio) && ratio > 0)) throw Error('Invalid native infantry heal ratio');
  return {
    spawn(b, e, a) {
      // HealViaMaxHpRatio: ordinary healing, respecting heal-free and modifiers.
      reaction(b, e, a, () => b.heal(e, e, e.s.maxHp * ratio));
    },
    death(c, b, e, a) { a.detach(); },
  };
}

export function pollutionBowman(r) {
  return {
    spawn(b, e, a) {
      a.mode = 0; a.pending = null;
      e.profile.deferHit = true;
      const life = e.deploySeq;
      a.clearFx = () => { const fx = a.fx; a.fx = null; if (fx) b.removeBuff(e, fx); };
      a.finish = pending => {
        if (a.pending !== pending) return;
        a.pending = null; pending.task?.cancel();
        if (!a.active || !live(e) || e.deploySeq !== life) return;
        a.mode = 0; e.profile.dmgType = 'phys';
        // enemy_mubow_switch_back restores the default mode and resets its
        // Attack cooldown to a full period at cast end, not at projectile hit.
        e.atkCd = e.s.interval;
        a.clearFx();
      };
      reaction(b, e, a, () => {
        if (a.mode === 1) return; // one enhanced mode, never a queue of charges
        a.mode = 1; e.profile.dmgType = 'arts'; e.atkCd = 0;
        e.atkStandUntil = -Infinity;
        a.fx = b.addBuff(e, { key: 'enemy_mubow_fx', source: e, persist: true });
      });
      b.on('battleEnd', () => { a.pending?.task.cancel(); a.pending = null; a.clearFx(); }, { owner: e });
    },
    tick(b, e, a) {
      // A control interruption ends a born cast but does not recall its shot.
      if (a.pending && e.attackControlEpoch !== a.pending.epoch) a.finish(a.pending);
    },
    attack(c, b, e, a) {
      const enhanced = a.mode === 1, type = enhanced ? 'arts' : 'phys';
      for (const target of c.targets) b.addProjectile({ from: e, target, source: e, speed: 10, maxAge: 10,
        onHit: hit => { if (hit.target) b.dealDamage(e, hit.target, { amount: e.s.atk, type,
          isAttack: true, canDodge: true, applyWay: 'ranged', tags: ['chapter17'] }); } });
      if (enhanced) {
        const pending = { epoch: e.attackControlEpoch };
        a.pending = pending;
        // Use the existing engine attack-end model (including its documented
        // clip fallback), not a fabricated native frame duration.
        pending.task = b.after(attackStand(e).rest, () => a.finish(pending), { owner: e });
      }
    },
    death(c, b, e, a) {
      a.detach(); a.pending?.task.cancel(); a.pending = null; a.clearFx();
    },
  };
}
