// SPDX-License-Identifier: GPL-3.0-or-later
// Source selectors, aura triggers and projectile controller:
// data/arkpedia-support-prefabs.json (pinned Global Android client).
import { SUPPORT_OPERATORS } from '../../../shared/arkpedia/support-operators.js';
import evidence from '../../../data/arkpedia-support-prefabs.json' with { type: 'json' };
import { acquireTargets } from '../ai.js';

let cloudSequence = 0;
function spores(battle, unit, bb, x, y, cachedAttack) {
  const offset = evidence.podenco.projectileCollider.m_Offset;
  x += offset.x; y += offset.y;
  const radius = evidence.podenco.projectileCollider.m_Radius;
  const end = battle.time + bb.projectile_delay_time;
  const key = `podenco:cloud:${++cloudSequence}`, lastHit = new Map(), attached = new Set();
  const clear = target => {
    battle.removeBuff(target, `${key}:sluggish`);
    battle.removeBuff(target, `${key}:silence`);
  };
  let hook;
  const pulse = () => {
    if (battle.time + 1e-9 >= end) {
      for (const target of attached) clear(target);
      attached.clear(); battle.off(hook); return;
    }
    const inside = new Set(battle.foesInRadius(x, y, radius, true));
    for (const target of attached) if (!inside.has(target)) { clear(target); attached.delete(target); }
    for (const target of inside) {
      if (!attached.has(target)) {
        attached.add(target);
        battle.applyStatus(target, 'sluggish', { key: `${key}:sluggish`, source: unit });
        battle.applyStatus(target, 'silence', { key: `${key}:silence`, source: unit });
      }
      if (battle.time + 1e-9 < (lastHit.get(target) ?? -Infinity) + evidence.podenco.projectileController._keepAlreadyHitTime) continue;
      lastHit.set(target, battle.time);
      // The projectile can outlive its source. Its source's live attributes are
      // used while valid, with the launch ATK retained for an invalid source.
      const attack = unit.alive && unit.deployed ? unit.s.atk : cachedAttack;
      battle.dealDamage(unit, target, { amount: attack * bb.atk_scale,
        type: 'arts', isSkill: true, canDodge: false, tags: ['dot', 'zone', 'podenco:spores'] });
    }
  };
  // managedBySource=0 / stopWhenSourceInvalid=0: bounded cloud ownership must
  // survive retreat. It unregisters its tick hook and attached buffs on expiry.
  hook = battle.on('tick', pulse);
  battle.fx('zone', { x, y, radius, dur: bb.projectile_delay_time, id: unit.id, skill: 'spores' });
  pulse();
}

/** Before setup, for the selected S1/S2 only. */
export function customizeSupportKit({ id, def, kit }) {
  if (!SUPPORT_OPERATORS[id]) return;
  const skill = def.skill, bb = skill.bb;
  if (id === 'char_183_skgoat' && skill.id === 'skchr_skgoat_2') {
    let elapsed = 0; const nextPulse = new Map();
    kit.skill.mods = {};
    kit.skill.flags = { disarm: true };
    kit.skill.attack = { noAttack: true };
    const pulse = ({ battle, unit }) => {
      const inside = new Set(battle.enemiesInKeys(unit.rangeKeys, unit, unit.profile));
      for (const target of nextPulse.keys()) if (!inside.has(target)) nextPulse.delete(target);
      for (const target of inside) {
        const next = nextPulse.get(target) ?? elapsed;
        if (elapsed + 1e-9 < next) continue;
        // slow3_s_2's first trigger is immediate per target. Talent explicitly
        // does not influence the skill blackboard; S2 keeps its own duration.
        battle.applyStatus(target, 'sluggish', { duration: bb.sluggish, source: unit });
        nextPulse.set(target, elapsed + bb.interval);
      }
    };
    kit.skill.onStart = ctx => { elapsed = 0; nextPulse.clear(); pulse(ctx); };
    kit.skill.onTick = ctx => {
      elapsed += Math.min(ctx.dt, ctx.skill.timeLeft);
      if (elapsed < skill.duration - 1e-9) pulse(ctx);
    };
    kit.skill.onEnd = () => nextPulse.clear();
  } else if (id === 'char_258_podego') {
    if (skill.id === 'skchr_podego_1') {
      kit.skill.mods = { atkPct: bb.atk };
      kit.skill.attack = { dmgType: 'heal', healScale: 1, heal: { mode: 'single', count: 1 },
        onHitStatus: null, projectile: 'none' };
    } else {
      kit.skill = {
        kind: 'instant',
        onStart: ({ battle, unit }) => {
          const target = acquireTargets(battle, unit, unit.profile)[0];
          if (!target) return;
          const attack = unit.s.atk;
          battle.addProjectile({ from: unit, target, source: unit, hitDead: true,
            speed: evidence.podenco.projectileMovement._speed, visual: 'lob',
            onHit: ({ x, y }) => spores(battle, unit, bb, x, y, attack) });
        },
      };
    }
  }
}

/** After setup, before deployment; owned auras clean up on removal. */
export function installSupport({ battle, unit, def }) {
  const id = def.charId;
  if (!SUPPORT_OPERATORS[id]) return;
  const talent = def.talents[0]?.bb;
  // The exact normal trait blackboard is separate from Earthspirit's additive
  // talent modifier, avoiding a mistaken .1-second replacement Slow.
  unit.profile.onHitStatus = { key: 'sluggish',
    duration: def.traitBb.sluggish + (id === 'char_183_skgoat' ? talent?.sluggish ?? 0 : 0) };
  if (id === 'char_258_podego') {
    if (def.skill.id === 'skchr_podego_2') {
      // The client requires a valid manual target, and recovers SP if it cannot
      // cast. Refusing before consuming SP preserves that same visible result.
      unit.skill.spec.canActivate = () => acquireTargets(battle, unit, unit.profile).length > 0;
    }
    if (!talent) return;
    const key = `podenco:gardener:${unit.id}`;
    const clear = () => { for (const ally of battle.allyUnits) battle.removeBuff(ally, key); };
    const sync = () => {
      if (!unit.alive || !unit.deployed) return;
      // The client continuously detects targets, with neither target-free nor
      // ally-target-free bypasses. A changing selector removes its old aura.
      for (const ally of battle.allyUnits) {
        const eligible = ally.alive && ally.deployed && !ally.hidden
          && !ally.s.flags.untargetable && battle.allySelectable(ally, unit)
          && ally.def.profession === 'SUPPORT';
        if (!eligible) battle.removeBuff(ally, key);
        else if (!ally.findBuff(key)) battle.addBuff(ally, { key, source: unit, mods: { atkPct: talent.atk } });
      }
    };
    battle.on('deploy', sync, { owner: unit });
    battle.on('tick', sync, { owner: unit });
    battle.on('death', ({ unit: dead }) => { if (dead === unit) clear(); }, { owner: unit });
  }
}
