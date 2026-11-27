// SPDX-License-Identifier: GPL-3.0-or-later
// Kindling Revenant: first form (kind revenantFirst) and second form (kind revenantSecond). Numbers arrive in `p` from
// the reviewed contract (shared/arkpedia/enemy-kindling-revenant-features.js). The guns, cores and beams are
// b.stageRevenant (arkpedia-stage-kindling-revenant.js), which also runs the first form's clocks.

// Without its devices (an enemy placed alone) the first form only stands there and the second form's casts reach no
// beam system; its deadline still runs.
const stageOf = b => b.stageRevenant?.cores?.length ? b.stageRevenant : null;

/** First form: INVINCIBLE, cannot move, be blocked or be healed, and does not attack. Its clocks start when it spawns. */
export function revenantFirst(p) {
  if (!(p?.intervals?.length === 4 && p.intervals.every(x => x >= 0) && p.reborn >= 0 && p.deadline > 0 && p.lifeLoss > 0
    && p.coreCheck > 0 && p.ctrlCheck > 0 && typeof p.second === 'string')) throw Error('Invalid Kindling Revenant parameters');
  return {
    spawn(b, e) {
      e.profile.noAttack = true; e.attackControlEpoch = (e.attackControlEpoch ?? 0) + 1;
      b.addBuff(e, { key: 'ab:revenantFirst', persist: true,
        flags: { invulnerable: true, isolated: true, noMove: true, noDisplace: true, unblockable: true, noHeal: true, healFree: true } });
      stageOf(b)?.adoptFirst(e, p);
    },
  };
}

/** Second form. After `born` s it casts Laser once (the beams start), then LaserS1 on its cooldown; once, at low HP,
 * LaserHalfHp; at `suicide.initial` s Suicide. A cast's trigger lands `windUp` s in; it holds one cast at a time. */
export function revenantSecond(p) {
  if (!(p?.box?.w > 0 && p.born >= 0 && p.ignite?.cast >= p.ignite.windUp && p.surge?.cooldown > 0 && p.surge.cast >= p.surge.windUp
    && p.lowHp?.ratio > 0 && p.lowHp.windUp?.length === 2 && p.suicide?.initial > 0 && p.suicide.lifeLoss > 0 && p.firstCheck > 0))
    throw Error('Invalid Kindling Revenant second-form parameters');
  const start = (b, e, a, kind, windUp, length) => {
    a.cast = { kind, t: 0, windUp, length, fired: false }; a.casts[kind] = (a.casts[kind] ?? 0) + 1;
    e.skillAnimUntil = b.time + length;
  };
  return {
    spawn(b, e, a) {
      const stage = stageOf(b);
      e.hitArea = Object.freeze({ ...p.box }); e.profile.noAttack = true; e.attackControlEpoch = (e.attackControlEpoch ?? 0) + 1;
      b.addBuff(e, { key: 'ab:revenantSecond', persist: true, flags: { noMove: true, noDisplace: true, unblockable: true } });
      // `_delayToBorn`: it is not in play until it has appeared.
      if (p.born > 0) b.addBuff(e, { key: 'ab:revenantBorn', duration: p.born, flags: { invulnerable: true, untargetable: true } });
      Object.assign(a, { bornAt: b.time + p.born, mode: 0, cast: null, casts: {}, igniteAt: b.time + p.born + p.ignite.initial,
        surgeAt: null, lowDone: false, suicideAt: b.time + p.born + p.suicide.initial, dying: null });
      stage?.adoptSecond(e);
      b.on('death', c => {
        if (c.unit !== e) return;
        stage?.secondDied(e);
        // trap_lrdead[kill_p1] on the first form: checked every `firstCheck` s.
        const first = stage?.first?.unit;
        if (first?.alive) b.after(p.firstCheck, () => { if (first.alive) { b.removeBuff(first, 'ab:revenantFirst'); b.kill(first, null); } });
      }, { owner: e });
    },
    tick(b, e, a, dt) {
      if (!e.alive || b.time + 1e-9 < a.bornAt) return;
      const stage = stageOf(b);
      if (a.dying) {
        a.dying.t += dt;
        if (a.dying.t + 1e-9 >= a.dying.length) { a.dying = null; b.life -= p.suicide.lifeLoss; b.kill(e, null); }
        return;
      }
      if (a.cast) {
        const c = a.cast; c.t += dt;
        if (!c.fired && c.t + 1e-9 >= c.windUp) { c.fired = true; stage?.bossTrigger(e); }
        if (c.t + 1e-9 < c.length) return;
        a.cast = null;
        if (c.kind === 'ignite') { a.mode = 1; a.surgeAt = b.time + p.surge.initial; } // enemy_lrdead[switch_mode_after_skill]
      }
      // Suicide (priority 2): Arts damage to the operators, then the life points and its own end.
      if (b.time + 1e-9 >= a.suicideAt) {
        a.suicideAt = Infinity; a.dying = { t: 0, length: 1 };
        for (const u of [...b.allyUnits]) if (u.alive && u.deployed && !u.hidden && u.kind !== 'device')
          b.dealDamage(e, u, { amount: e.s.atk * p.suicide.scale, type: 'arts', applyWay: 'ranged', isSkill: true, tags: ['revenant:suicide'] });
        return;
      }
      if (!a.lowDone && e.hp <= e.s.maxHp * p.lowHp.ratio + 1e-9) {
        a.lowDone = true; start(b, e, a, 'lowHp', p.lowHp.windUp[a.mode], p.lowHp.cast[a.mode]); return;
      }
      if (a.mode === 0 && a.igniteAt != null && b.time + 1e-9 >= a.igniteAt) { a.igniteAt = null; start(b, e, a, 'ignite', p.ignite.windUp, p.ignite.cast); return; }
      if (a.mode === 1 && a.surgeAt != null && b.time + 1e-9 >= a.surgeAt) { a.surgeAt = b.time + p.surge.cooldown; start(b, e, a, 'surge', p.surge.windUp, p.surge.cast); }
    },
  };
}
