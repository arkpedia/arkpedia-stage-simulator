// SPDX-License-Identifier: GPL-3.0-or-later
import { RITUALIST_OPERATORS } from '../../../shared/arkpedia/ritualist-operators.js';
import evidence from '../../../data/arkpedia-ritualist-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { canTargetEnemy } from '../targeting.js';

const model = u => evidence.models[u.defId][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const windup = clip => (_b, u) => model(u).hits[clip][0] / Math.min(1, u.s.aspd / 100);

function launch(b, u, p, e, info) {
  // The ability which was emitted retains its skill injury even after the
  // timed skill ends. Unlike a real-damage rider, this is independent of RES,
  // the strike's ATK scale and absorbed HP damage.
  const bb = u.def.skill.bb;
  const ratio = info.isSkill ? u.skill.id.endsWith('_1')
    ? bb.ep_damage_ratio : bb['attack@ep_damage_ratio'] : 0;
  b.addProjectile({ from: u, source: u, target: e, speed: 8, maxAge: 10,
    visual: 'orb', data: { arkpediaTrackedVisual: true }, onHit: ({ target }) => {
      if (!target || !canTargetEnemy(u, target, p)) return;
      const atk = u.s.atk * u.s.atkScaleMul;
      let observed = false, hook;
      if (ratio > 0) hook = b.on('damaged', ctx => {
        if (observed || ctx.source !== u || ctx.target !== target || ctx.type !== 'arts'
          || !ctx.dmg?.isAttack || ctx.dmg.attackId !== info.attackId
          || !ctx.dmg.tags?.includes('ritualist:primary')) return;
        observed = true;
        b.dealDamage(u, target, { amount: atk * ratio, type: 'element', element: 'apoptosis',
          isAttack: false, isSkill: info.isSkill, attackId: info.attackId,
          canDodge: false, tags: ['ritualist:injury'] });
      });
      try {
        // Prototype accepted-output ordering is deliberate. Native dispatch
        // relative to dodge/shields and same-hit burst ordering is not verified.
        resolveHit(b, u, { ...p, hits: 1, hitsFn: null, chain: null, splashRadius: 0,
          dmgMul: null, tags: ['ritualist:primary'] }, target, info, target.x, target.y);
      } finally { if (hook) b.off(hook); }
    } });
}

export function customizeRitualistKit({ id, def, kit }) {
  if (!RITUALIST_OPERATORS[id]) return;
  kit.install = null;
  const s = def.skill, bb = s.bb;
  kit.trait = { attack: 'ranged', dmgType: 'arts', projectile: 'none', heal: null,
    canHitFly: true, maxTargets: 1, hits: 1, rangeAoe: false, allInRange: false,
    attackVisual: 'Attack', windup: windup('Attack'), launchAttack: launch,
    interruptOnSkillChange: true, install: null };
  kit.skill = s.id.endsWith('_1') ? { kind: 'charges', charges: bb.cnt,
    attack: { atkScale: bb.atk_scale, attackVisual: 'Skill_2', windup: windup('Skill_2') } }
    : { kind: 'duration', duration: s.duration, mods: { aspd: bb.attack_speed },
      attack: { maxTargets: 2, attackVisual: 'Skill_2', windup: windup('Skill_2') } };
  kit.skill.id = s.id; kit.skill.name = s.name;
  // The One Who Reveals is conditioned on the original rogue_sami map tag.
  // The regular-stage adapter does not implement that Integrated Strategies mode.
}
