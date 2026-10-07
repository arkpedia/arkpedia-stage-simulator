// SPDX-License-Identifier: GPL-3.0-or-later
import { ROBOT_EXPANSION_OPERATORS } from '../../../shared/arkpedia/robot-expansion-operators.js';
import { canTargetEnemy } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { acquireTargets, effectiveProfile, resolveHit } from '../ai.js';

const live = u => u.alive && u.deployed && !u.hidden;

function splash(b, u, x, y, radius, amount, attackId) {
  for (const target of b.enemiesInRadius(x, y, radius)) {
    if (!canTargetEnemy(u, target, { canHitFly: false })) continue;
    b.dealDamage(u, target, { amount, type: 'phys', isAttack: true,
      isSplash: true, attackId });
  }
}

function palicoLaunch(b, u, profile, target, info) {
  const bb = u.def.talents[0].bb;
  let lottery = -1;
  if (u.mem.palicoBombs < 3) {
    const roll = b.rng();
    let cumulative = 0;
    for (let i = 0; i < 4; i++) {
      cumulative += bb[`attack@prob${i + 1}`];
      if (roll < cumulative) { lottery = i; break; }
    }
    if (lottery === 0) u.mem.palicoBombs++;
  }
  b.addProjectile({ from: u, source: u, target, speed: 10, maxAge: 1.5, visual: 'bomb', hitDead: true,
    data: { arkpediaTrackedVisual: true }, onHit: ({ x, y }) => {
      // The ordinary bomb damages at REACHED, then again at STOP (.15s).
      splash(b, u, x, y, .9, u.s.atk, info.attackId);
      b.after(.15, () => splash(b, u, x, y, .9,
        u.s.atk * u.def.traitBb['attack@append_atk_scale'], info.attackId));
      if (lottery < 0 || lottery === 3) return;
      // A separate source projectile stops 1.5s after REACHED. Its damage
      // radius is 1.7; its Sleep/Stun selectors use radius 1.1, ground only.
      b.after(1.5, () => {
        if (lottery === 0) {
          splash(b, u, x, y, 1.7, u.s.atk * bb['attack@bomb_scale'], info.attackId);
        } else {
          for (const enemy of b.enemiesInRadius(x, y, 1.1)) {
            if (!canTargetEnemy(u, enemy, { canHitFly: false })) continue;
            b.applyStatus(enemy, lottery === 1 ? 'sleep' : 'stun', {
              source: u, duration: bb[lottery === 1 ? 'attack@sleep' : 'attack@stun'],
            });
          }
        }
      });
    } });
}

export function customizeRobotExpansionKit({ id, kit }) {
  if (!ROBOT_EXPANSION_OPERATORS[id]) return;
  kit.install = null;
  kit.skill = null;
  if (id === 'char_4077_palico') kit.trait = {
    launchAttack: palicoLaunch, splashRadius: 0, afterHit: null,
    windup: (_b, u) => {
      u.mem.palicoOpening = u.mem.palicoNeedsBegin;
      u.mem.palicoNeedsBegin = false;
      return (.2 + (u.mem.palicoOpening ? 1.167 : 0)) * 100 / u.s.aspd;
    },
    attackVisual: (_b, u) => u.mem.palicoOpening
      ? { begin: 'Attack_Begin', loop: 'Attack_Loop', beginDuration: 1.167 * 100 / u.s.aspd }
      : 'Attack_Loop',
  };
  else if (id === 'char_4091_ulika') kit.trait = {
    install: null, noAttack: true, heal: null,
  };
  else kit.trait = { dmgType: 'arts', projectile: 'bolt', projectileSpeed: 10,
    windup: (_b, u) => .433 * 100 / u.s.aspd, attackVisual: 'Attack',
    launchAttack: (battle, unit, profile, target, info) => {
      battle.addProjectile({ from: unit, source: unit, target, speed: 10, visual: 'bolt',
        data: { arkpediaTrackedVisual: true }, onHit: c => {
          // The original active hit buff applies fixed DARK injury before the
          // ordinary Arts hit, only while the owner still has phonor_t_1.
          if (c.target && unit.findBuff('phonor:talent'))
            battle.dealDamage(unit, c.target, { type: 'element', element: 'apoptosis',
              amount: unit.def.talents[0].bb['attack@dark_damage_value'],
              isAttack: true, tags: ['phonor:dark'] });
          resolveHit(battle, unit, profile, c.target, info, c.x, c.y);
        } });
    } };
}

function installUlika(b, u, def) {
  const bb = def.talents[0].bb;
  u.mem.noInspire = true;
  const owned = new Set(), regenKey = `ulika:recovery:${u.id}`;
  let rate = 0;
  const clear = () => { for (const ally of owned) b.removeBuff(ally, regenKey); owned.clear(); };
  const sync = () => {
    const next = new Set(live(u) && !u.s.flags.isolated ? b.allyUnits.filter(ally =>
      live(ally) && !ally.s.flags.isolated && bodyInKeys(ally, u.rangeKeySet)) : []);
    for (const ally of owned) if (!next.has(ally)) { b.removeBuff(ally, regenKey); owned.delete(ally); }
    for (const ally of next) {
      const buff = ally.findBuff(regenKey);
      if (!buff || buff.mods.hpRegen !== rate)
        b.addBuff(ally, { key: regenKey, source: u, mods: { hpRegen: rate } });
      owned.add(ally);
    }
  };
  const updateRate = () => {
    rate = u.s.atk * def.traitBb.atk_to_hp_recovery_ratio;
    sync();
  };
  let waiting = false, cast = false, spent = false, startup = null;
  const stun = () => {
    if (!live(u)) return;
    for (const target of [...b.allyUnits, ...b.enemies]) {
      if (target === u || !live(target) || target.s.flags.untargetable
        || target.s.flags.isolated || target.s.flags.sleep
        || !bodyInKeys(target, u.rangeKeySet)) continue;
      b.applyStatus(target, 'stun', { source: u, duration: bb['attack@stun_duration'] });
    }
  };
  b.on('deploy', ({ unit }) => {
    if (unit !== u) return;
    updateRate(); // source waitFirstTriggerInterval=0
    b.after(2, () => { waiting = true; }, { owner: u });
  }, { owner: u });
  b.every(1, updateRate, { owner: u });
  b.on('tick', sync, { owner: u });
  const removed = ({ unit }) => { if (unit === u) clear(); };
  b.on('death', removed, { owner: u }); b.on('retreat', removed, { owner: u });
  b.on('tick', () => {
    if (spent) return;
    if (cast && !u.canAct) {
      startup?.cancel(); startup = null; cast = false; waiting = true;
    }
    if (!waiting || cast || !u.canAct) return;
    waiting = false; cast = true;
    // Trigger lifetime2 + original Skill_Begin_1 duration1. PreAnim2 starts
    // its one-shot stun action. Animation speed is not scaled by ASPD here.
    b._ev(['atk', u.id, u.id, 'none', { animation: 'Skill_Begin_1', windup: 1 }]);
    startup = b.after(1, () => {
      startup = null;
      if (!u.canAct) { cast = false; waiting = true; return; }
      // Only the source stun action finishes ulika_trigger_attack. An interrupted
      // PreAnim1 leaves that permanent trigger eligible to restart on recovery.
      spent = true;
      stun();
      b._ev(['atk', u.id, u.id, 'none', { animation: 'Skill_Begin_2', windup: .7 }]);
    }, { owner: u });
  }, { owner: u });
}

function installPhonor(b, u, def) {
  const bb = def.talents[0].bb, owned = new Set();
  const artsKey = `phonor:arts:${u.id}`, elemKey = `phonor:element:${u.id}`;
  const clear = () => {
    for (const target of owned) {
      b.removeBuff(target, artsKey); b.removeBuff(target, elemKey);
    }
    owned.clear();
  };
  const sync = () => {
    const eligible = live(u) && !u.s.flags.isolated && u.findBuff('phonor:talent');
    const next = new Set(eligible ? b.enemiesInKeys(u.rangeKeys, u, { canHitFly: true }) : []);
    for (const target of owned) if (!next.has(target)) {
      b.removeBuff(target, artsKey); b.removeBuff(target, elemKey); owned.delete(target);
    }
    for (const target of next) if (!owned.has(target)) {
      b.applyStatus(target, 'artsFragile', { key: artsKey, duration: Infinity,
        source: u, value: bb.damage_scale - 1 });
      b.applyStatus(target, 'elemFragile', { key: elemKey, duration: Infinity,
        source: u, value: bb.damage_scale - 1 });
      owned.add(target);
    }
  };
  b.on('deploy', ({ unit }) => {
    if (unit !== u) return;
    b.addBuff(u, { key: 'phonor:talent', duration: bb.duration, onExpire: clear });
    sync();
  }, { owner: u });
  b.on('tick', sync, { owner: u });
  const removed = ({ unit }) => { if (unit === u) clear(); };
  b.on('death', removed, { owner: u }); b.on('retreat', removed, { owner: u });
}

export function installRobotExpansion({ battle, unit, def }) {
  if (def.charId === 'char_4077_palico') {
    unit.mem.palicoBombs = 0; unit.mem.palicoNeedsBegin = true;
    battle.on('tick', () => {
      // The source begin clip is only played at the start of an engagement.
      if (!unit.canAct || !acquireTargets(battle, unit, effectiveProfile(unit)).length)
        unit.mem.palicoNeedsBegin = true;
    }, { owner: unit });
  }
  else if (def.charId === 'char_4091_ulika') installUlika(battle, unit, def);
  else if (def.charId === 'char_4136_phonor') installPhonor(battle, unit, def);
}
