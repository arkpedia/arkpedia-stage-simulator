// SPDX-License-Identifier: GPL-3.0-or-later
import { resolveHit } from '../ai.js';
import { absoluteRangeKeys } from '../targeting.js';
import { bodyInKeys } from '../body.js';

/** Source boomerang: outward speed15, return speed15*.25, .01s turnaround. */
function throwCaper(battle, unit, profile, target, info) {
  const seq = unit.deploySeq;
  const home = () => unit.alive && unit.deployed && unit.deploySeq === seq;
  const count = profile.isSkill && unit.skill.def.id === 'skchr_caper_2' ? 2 : 1;
  for (let i = 0; i < count; i++) {
    unit.trait.boomerangsOut++;
    battle.addProjectile({ from: unit, target, speed: 15, visual: 'boomerang', source: unit,
      hitDead: true, data: { arkpediaTrackedVisual: true },
      onHit: ctx => {
        if (ctx.target) resolveHit(battle, unit, profile, ctx.target, info, ctx.x, ctx.y);
        if (!home()) return;
        battle.after(.01, () => {
          if (!home()) return;
          battle.addProjectile({ from: { x: ctx.x, y: ctx.y }, target: unit, speed: 3.75,
            visual: 'boomerangReturn', source: unit, hitDead: true,
            data: { arkpediaTrackedVisual: true },
            onHit: () => { if (home()) unit.trait.boomerangsOut = Math.max(0, unit.trait.boomerangsOut - 1); },
          });
        }, { owner: unit });
      },
    });
  }
}

export function customizeSniperExpansionKit({ id, def, kit }) {
  if (!['char_366_acdrop', 'char_4100_caper'].includes(id) || !def.skill) return;
  const skill = def.skill, bb = skill.bb;
  // Remove text-inferred talent/skill effects; each field is bound to its prefab.
  kit.install = null;
  kit.skill = { id: skill.id, name: skill.name, kind: 'duration', duration: skill.duration };
  if (id === 'char_366_acdrop') {
    kit.trait = { projectileSpeed: 10, windup: (_b, u) => .333 * 100 / u.s.aspd,
      attackVisual: 'Attack', interruptOnSkillChange: true };
    if (skill.id === 'skchr_acdrop_1') kit.skill.mods = { aspd: bb.attack_speed };
    else {
      kit.skill.mods = { atkPct: bb.atk };
      // additionalProjectile is the same full-damage bullet, splitDamage=0.
      kit.skill.attack = { hits: 2, atkScale: 1, dmgType: 'phys' };
    }
  } else {
    kit.trait = { launchAttack: throwCaper, hits: 1, windup: (_b, u) => .533 * 100 / u.s.aspd,
      attackVisual: 'Attack', interruptOnSkillChange: true };
    if (skill.id === 'skchr_caper_1') {
      kit.skill.kind = 'instant';
      kit.skill.attack = { atkScale: bb.atk_scale, hits: 1, dmgType: 'phys' };
    } else {
      kit.skill.mods = { atkPct: bb.atk };
      kit.skill.attack = { atkScale: 1, hits: 1, dmgType: 'phys',
        windup: (_b, u) => .367 * 100 / u.s.aspd, attackVisual: 'Skill_Loop' };
    }
  }
}

export function installSniperExpansion({ battle, unit, def }) {
  const talent = def.talents[0]?.bb;
  if (def.charId === 'char_366_acdrop' && talent) {
    // acdrop_t_1 ON_OUTPUT_MODIFIER: EnsureDmgOrHeal uses range2-2 for
    // the stronger floor. It applies per Physical hit after DEF mitigation.
    const front = absoluteRangeKeys([[0, 0], [0, 1], [0, 2]], unit.tileR, unit.tileC, unit.dir);
    battle.on('hit', ({ source, target, dmg }) => {
      if (source !== unit || !dmg.isAttack || dmg.type !== 'phys') return;
      const scale = bodyInKeys(target, front) ? talent.atk_scale_2 : talent.atk_scale;
      dmg.minimumAmount = Math.max(dmg.minimumAmount ?? 0, unit.s.atk * scale);
    }, { owner: unit });
  }
  if (def.charId === 'char_4100_caper') {
    if (talent) {
      // critical_atkscale rolls ON_CALCULATE_DAMAGE, for each emitted projectile.
      battle.on('hit', ({ source, dmg }) => {
        if (source === unit && dmg.isAttack && battle.rng.chance(talent.prob))
          dmg.amount *= talent.atk_scale;
      }, { owner: unit });
    }
    unit.profile.launchAttack = throwCaper;
  }
}
