// SPDX-License-Identifier: GPL-3.0-or-later
import { ordinaryEnemyAttackSequence } from './arkpedia-enemy-attack-sequence.js';
import { OwnedStageAura } from './arkpedia-stage-auras.js';
import { projectileSingleAttack } from './arkpedia-enemy-projectiles.js';
/** Native confinement keeps a warning mode between the penultimate attack and
 * liberation. Captured casts survive mode changes; new casts use the new mode. */
export function nativePrisoner(p) {
  const shots = ['phys', 'arts'].map(type => projectileSingleAttack({ type, speed: p.speed, lifetime: p.lifetime, noAir: true }));
  const sequence = ordinaryEnemyAttackSequence((_b, _e, a) => a.nextAnimation ?? p.animations[a.mode],
    (b, e, u, c) => p.melee
      ? b.dealDamage(e, u, { amount: e.s.atk, type: 'phys', isAttack: true, isSkill: false, attackId: c.attackId, applyWay: 'melee' })
      : shots[c.animation.type === 'arts' ? 1 : 0].attack({ targets: [u], attackId: c.attackId }, b, e));
  const setMode = (b, e, a, mode) => {
    a.mode = mode; a.free = mode === 2;
    b.removeBuff(e, 'ab:confined'); b.removeBuff(e, 'ab:liberty');
    b.addBuff(e, { key: a.free ? 'ab:liberty' : 'ab:confined', persist: true,
      mods: a.free ? { atkPct: p.atk } : { aspd: p.aspd, defFlat: p.def ?? 0 },
      flags: { disarm: !!p.confinedDisarm && !a.free } });
    if (p.confinedDisarm) { e.profile.noAttack = !a.free; e.profile.dmgType = 'arts'; }
    e.profile.maxTargets = a.free ? p.maxTargets ?? 1 : 1;
    const c = p.animations[mode]; e.def = { ...e.def, attackAnim: { dur: c.duration, hit: c.releases[0] } };
    if (mode === 1) a.listenerAt = b.time + p.warningDelay;
    if (a.free && p.freeAll && !a.freedOthers) {
      a.freedOthers = true; // Guard before callbacks: a chain can release another Recidivist.
      liberatePrisoners(b, e);
    }
  };
  const stance = (e, a) => {
    const form = p.forms?.[a.mode] ?? Object.fromEntries(['Idle','Move','Die'].map(k => [k.toLowerCase(), `${k}${['', '2', '3'][a.mode]}`]));
    return { clip: e.moving ? form.move : form.idle, ...form, replace: true };
  };
  return { ...sequence,
    confine(b, e, a) {
      if (!e.alive || !a.free) return;
      sequence.cancel(b, e, a); a.n = 0; a.listenerAt = Infinity; setMode(b, e, a, 0);
      e.atkCd = e.s.interval;
    },
    liberate(b, e, a) {
      if (!e.alive || a.free) return;
      sequence.cancel(b, e, a); setMode(b, e, a, 2); e.atkCd = e.s.interval;
    },
    spawn(b, e, a) {
      sequence.spawn(b, e, a); a.n = 0; a.listenerAt = Infinity; setMode(b, e, a, 0);
      if (!p.melee) { e.profile.targetPriority = 'tag'; e.profile.priorityTag = 'prison'; e.profile.canTarget = u => !u.isFlying && !u.s.flags.liftoff; }
    },
    before(_c, b, e, a) {
      // The source's restartFSM=false and interruptAbilityOnDetach=false keep
      // the current ability's damage type when its before-attack buff switches modes.
      a.nextAnimation = p.animations[a.mode];
      if (a.mode === 0 && ++a.n >= p.times - 1) setMode(b, e, a, 1);
      else if (a.mode === 1 && b.time + 1e-7 >= a.listenerAt) setMode(b, e, a, 2);
    },
    tick(b, e, a) { sequence.tick(b, e, a); if (!a.cast) e.mem.regularFormVisual = stance(e, a); },
    death(c, b, e, a) { sequence.death(c, b, e, a); const die = stance(e, a).die;
      e.mem.regularFormVisual = { clip: die, die, loop: false };
    },
  };
}

export const sniperPrisoner = nativePrisoner;
/** Same-side selectors ignore opponent-only TARGET_FREE, but respect isolation
 * and sleeping/hidden bodies. Neither camouflage nor ground motion filters apply. */
const sameSideSelectable = (e, u) => u.alive && u.deployed && !u.hidden && u.side === e.side
  && !u.s.flags.untargetable && !u.s.flags.isolated && !u.s.flags.sleep;
export function prisonerAttackSpeedAura(p) {
  const update = (b, e, a) => a.aura.update(e.alive && e.deployed && !e.s.flags.silence
    ? b.enemies.filter(u => sameSideSelectable(e, u) && !u.s.flags.silence) : []);
  return {
    spawn(b, e, a) {
      a.aura = new OwnedStageAura(b, e, { key: 'enemy_atkspeedup[aura]', strength: p.aspd, mods: { aspd: p.aspd } });
      update(b, e, a);
      b.on('enemySpawn', () => update(b, e, a), { owner: e });
      b.on('removed', ({ unit }) => { if (unit === e) a.aura.clear(); }, { owner: e });
    },
    tick: update,
    death(_c, _b, _e, a) { a.aura.clear(); },
  };
}

export function liberatePrisoners(b, e) {
  for (const u of b.enemies.slice().filter(u => u !== e && sameSideSelectable(e, u)))
    for (const ab of u.mem.ab?.list ?? []) ab.liberate?.(b, u, ab);
}
