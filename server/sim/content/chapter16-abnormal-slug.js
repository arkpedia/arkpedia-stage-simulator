// SPDX-License-Identifier: GPL-3.0-or-later
// Test-only controller candidate. The source shield is a miner-only physical pool;
// ordinary damage reduction and retaliation do not consume that pool.
import { blockMcreep } from './chapter16-engagement.js';
import { shieldedClocks, installShieldedAttackClock, shieldedTransitionClock, advanceShieldedTransition } from './chapter16-shielded-clocks.js';
import review from '../../../data/candidates/arkpedia-ch16-reviewed-abnormal-slug.json' with { type: 'json' };
const SHIELD = 'rkbomb_m0_t[shield]', EFFECT = 'rkbomb_m1_s[effect]';
const live = u => u?.alive && u.deployed && !u.hidden;
const marked = u => !!u?.findBuff('enemy_mcreep_self_mark');
const ground = u => !u.isFlying && !u.s.flags.liftoff;
export function abnormalSlug(r) {
  const proof = review.enemies[r.key];
  if (!proof || r.prefabKey !== r.key || JSON.stringify(r.talents.bb) !== JSON.stringify(proof.bb)
    || JSON.stringify(r.talents.groups) !== JSON.stringify(proof.groups)
    || JSON.stringify(r.abilities) !== JSON.stringify(proof.abilities)
    || JSON.stringify(r.skills) !== JSON.stringify(proof.skills)) throw Error('Unreviewed Abnormal Slug contract');
  const bb = r.talents.bb, reduction = bb['Shield.damage_resistance'], counter = bb['Shield.value'];
  const clocks = shieldedClocks(r, 'abnormal-slug');
  const engagement = blockMcreep({ cnt: bb['BlockMcreep.block_mcreep_cnt'], range: bb['BlockMcreep.range_radius'],
    rangeAdd: bb['BlockMcreep.range_radius_add'], attackRange: review.defaults.attackRange });
  return {
    spawn(b, e, a) {
      engagement.spawn(b, e, a); const life = e.deploySeq;
      a.active = true; a.mode = 0; a.phase = null; a.pool = e.s.maxHp * bb['Shield.init_shield_hp_ratio'];
      a.shield = b.addBuff(e, { key: SHIELD, persist: true, mods: { taunt: review.defaults.taunt } });
      const valid = () => a.active && e.alive && e.deployed && e.deploySeq === life;
      a.valid = valid;
      a.shieldLive = () => valid() && a.mode === 0 && !!a.shield && e.buffs.includes(a.shield);
      e.profile.canTarget = ground;
      e.profile.attackCooldowns = { m0Attack: 0, m0Combat: 0, m1Attack: 0, m1Combat: 0 };
      e.profile.attackMode = () => `m${a.mode}${e.blockedBy ? 'Combat' : 'Attack'}`;
      installShieldedAttackClock(b, e, a, clocks);
      a.damageModifier = (source, target, dmg) => target === e && a.shieldLive() && !marked(source)
        && ['phys', 'arts'].includes(dmg.type) ? 1 - reduction : 1;
      b._takenMultipliers ??= new Map(); b._takenMultipliers.set(e, a.damageModifier);
      a.clearShield = () => {
        if (b._takenMultipliers.get(e) === a.damageModifier) b._takenMultipliers.delete(e);
        if (a.shield) b.removeBuff(e, a.shield); a.shield = null;
        b.off(a.counterHook); b.off(a.poolHook);
      };
      a.finishPhase = phase => {
        if (a.phase !== phase) return;
        a.phase = null; b.removeBuff(e, phase.hold);
      };
      a.changeMode = () => {
        if (!valid() || a.mode !== 0) return;
        if (a.ordinary.pending) a.ordinary.finish(a.ordinary.pending);
        a.mode = 1; a.clearShield(); b.removeBuff(e, 'palsy'); e.atkStandUntil = -Infinity;
        const phase = a.phase = shieldedTransitionClock(b, e, clocks);
        phase.hold = b.addBuff(e, { key: 'ch16:slug-trans', persist: true, flags: { noMove: true, disarm: true } });
        a.effect = b.addBuff(e, { key: EFFECT, source: e, duration: review.defaults.transitionEffectDuration });
      };
      // Native InverseDamage does not filter a cancelled modifier. It still
      // requires a valid, non-protected source; HP loss has no hit event.
      a.counterHook = b.on('hit', c => {
        const s = c.source;
        if (c.target !== e || !a.shieldLive() || !(c.dmg.amount > 0) || !live(s) || s === e
          || s.kind === 'device' || s.mem?.stageUnitDevice || s.s.flags.untargetable || s.s.flags.invulnerable || s.s.flags.sleep) return;
        b.dealDamage(null, s, { amount: counter, type: 'arts', isAttack: true, canDodge: true, tags: ['chapter16', 'inverseDamage'] });
      }, { owner: e, priority: -450 });
      a.poolHook = b.on('damageFinal', c => {
        if (c.target !== e || !a.shieldLive() || !marked(c.source) || c.dmg.type !== 'phys' || !(c.amount > 0)) return;
        const blocked = Math.min(a.pool, c.amount); a.pool -= blocked; c.amount -= blocked;
        if (a.pool <= 1e-9) { a.pool = 0; a.changeMode(); }
      }, { owner: e });
      a.stunHook = b.on('beforeStatus', c => {
        if (c.target === e && valid() && a.phase && c.status === 'stun') c.cancel = true;
      }, { owner: e });
      a.detach = () => {
        a.releaseAll();
        a.active = false; a.clearShield(); if (a.phase) a.finishPhase(a.phase);
        if (a.ordinary.pending) a.ordinary.finish(a.ordinary.pending);
        if (a.effect) b.removeBuff(e, a.effect); b.off(a.stunHook);
      };
      b.on('battleEnd', a.detach, { owner: e });
      b.on('removed', ({ unit }) => { if (unit === e) a.detach(); }, { owner: e });
    },
    tick(b, e, a, dt) {
      if (!a.valid()) { a.detach(); return; }
      engagement.tick(b, e, a, dt);
      if (a.ordinary.pending) a.ordinary.advance(a.ordinary.pending);
      if (a.shield && !e.buffs.includes(a.shield)) a.clearShield();
      // Stun is immune during the forced transition. Other control changes
      // retire the local clip lock; the completed mode switch is permanent.
      if (a.phase && (e.actionControlEpoch !== a.phase.epoch || e.s.flags.freeze || e.s.flags.sleep || e.s.flags.levitate
        || advanceShieldedTransition(b, e, a.phase, clocks))) a.finishPhase(a.phase);
    },
    death(c, b, e, a) { a.detach(); },
  };
}
