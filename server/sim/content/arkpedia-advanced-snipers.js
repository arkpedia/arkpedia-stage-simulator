// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-advanced-sniper-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { bodyInKeys } from '../body.js';
import { COLS, ROWS } from '../constants.js';
import { canTargetEnemy, enemyStealthed } from '../targeting.js';

const globalGrid = Array.from({ length: (ROWS * 2 - 1) * (COLS * 2 - 1) }, (_, i) =>
  [Math.floor(i / (COLS * 2 - 1)) - ROWS + 1, i % (COLS * 2 - 1) - COLS + 1]);
const outsideNormal = (unit, target) => !bodyInKeys(target, unit.baseRangeKeys);

// Original projectile_yuki_s2 travels at 8 tiles/s, damages on collision (not
// only arrival), forgets each hit after 1 second and remains for 2 seconds after
// reaching its target. Its lifetime and callbacks survive the shooter's retreat.
function throwShuriken(battle, unit, profile, target, info) {
  const source = evidence.shirayuki.projectile;
  let x = unit.x, y = unit.y, tx = target.x, ty = target.y, arrived = false, stopAt = Infinity;
  const deployment = target.deploySeq, hitAt = new Map();
  // Keep presentation on this very same collision trajectory. The renderer uses
  // its existing placeholder marker until the original projectile art is imported.
  const visual = { x, y, source: unit, visual: 'arts' };
  (battle.regularVisualProjectiles ??= new Set()).add(visual);
  const end = () => { battle.off(handle); lifetime.cancel(); battle.regularVisualProjectiles.delete(visual); };
  const lifetime = battle.after(source.lifeTime, end, { holdsBattle: true });
  const handle = battle.on('tick', ({ dt }) => {
    if (!arrived) {
      if (target.alive && !target.hidden && target.deploySeq === deployment) { tx = target.x; ty = target.y; }
      const dx = tx - x, dy = ty - y, distance = Math.hypot(dx, dy), travel = source.speed * dt;
      if (distance <= travel) { x = tx; y = ty; arrived = true; stopAt = battle.time + source.dwell; }
      else { x += dx / distance * travel; y += dy / distance * travel; }
    }
    visual.x = x; visual.y = y;
    if (battle.time >= stopAt - 1e-9) { end(); return; }
    // Collision radius is the original CircleCollider2D, with the engine's
    // ordinary enemy body geometry. Only selectable targets receive the attack.
    for (const enemy of battle.enemiesInRadius(x + source.offset.x, y + source.offset.y, source.radius)) {
      if (!canTargetEnemy(unit, enemy, profile)) continue;
      if (battle.time < (hitAt.get(enemy) ?? -Infinity) + source.hitCooldown - 1e-9) continue;
      hitAt.set(enemy, battle.time);
      resolveHit(battle, unit, profile, enemy, info, enemy.x, enemy.y);
    }
  });
}

export function customizeAdvancedSniperKit({ id, def, unit, kit }) {
  const skill = def.skill;
  if (!skill) return;
  const bb = skill.bb;
  if (id === 'char_118_yuki' && skill.id === 'skchr_yuki_2') {
    delete kit.skill.onHit;
    kit.skill.mods = {};
    kit.skill.attack = {
      dmgType: 'arts', atkScale: bb['attack@atk_scale'], splashRadius: 0,
      projectile: 'none', launchAttack: throwShuriken,
      onEachHit: ({ battle, unit, target }) => battle.addBuff(target, {
        key: 'shirayuki:slow', source: unit, duration: bb['attack@duration'],
        mods: { moveMul: 1 + bb['attack@move_speed'] }, refresh: 'replace',
      }),
    };
  }
  if (id === 'char_440_pinecn') {
    if (skill.id === 'skchr_pinecn_1') {
      // This is an immediate independent shot with an explicit, unscaled prefab
      // pre-delay, not a buff waiting for the next normal attack. During the cast
      // normal attacks and SP recovery stop; its existing attack cooldown stays.
      kit.skill.mods = { defIgnoreFlat: bb.def_penetrate_fixed };
      kit.skill.flags = { noSp: true };
      kit.skill.attack = { atkScale: bb.atk_scale, dmgType: 'phys', windup: 0, noAttack: true };
      kit.skill.onStart = ({ battle, unit, skill }) => {
        const activation = skill.activations;
        battle.after(evidence.pinecone.preDelay, () => {
          if (!skill.active || skill.activations !== activation) return;
          if (unit.canAct && !unit.s.flags.disarm) {
            skill.spec.attack.noAttack = false;
            battle.forceAttack(unit);
          }
          if (skill.active) skill.end('cast');
        }, { owner: unit });
      };
      kit.skill.onEnd = ({ skill }) => { skill.spec.attack.noAttack = true; };
    } else {
      // The source has four separate ATK buffs (a→d); the selected buff advances
      // once per cast and caps at d, then resets with a fresh deployment.
      kit.skill.trigger = { rule: 'SP_FULL' };
      kit.skill.mods = {};
      kit.skill.targeting = { rangeGrid: skill.rangeGrid };
      kit.skill.attack = { windup: evidence.pinecone.hits.Skill_2[0], dmgType: 'phys' };
      kit.skill.onStart = ({ battle, unit, skill }) => {
        const step = 'abcd'[Math.min(3, skill.activations - 1)];
        battle.addBuff(unit, { key: 'pinecone:overcharge', source: unit,
          mods: { atkPct: bb[`pinecn_s_2[${step}].atk`] } });
        unit.atkCd = 0; // switch_mode_restart_fsm restarts the attack state.
      };
      kit.skill.onEnd = ({ battle, unit }) => {
        battle.removeBuff(unit, 'pinecone:overcharge'); unit.atkCd = 0;
      };
    }
  }
  if (id === 'char_302_glaze') {
    if (skill.id === 'skchr_glaze_1') {
      delete kit.skill.onHit;
      kit.skill.attack = { dmgType: 'phys', onEachHit: ({ battle, unit, target }) =>
        battle.applyStatus(target, 'sluggish', { duration: bb['attack@sluggish'], source: unit }) };
    } else {
      // Original BASE_ATTACK_TIME is ADDITION (+0.9 seconds), not +90%.
      kit.skill.mods = { atkPct: bb.atk, batPct: bb.base_attack_time / unit.base.bat };
      kit.skill.targeting = { rangeGrid: globalGrid, noRangeExtend: true };
      kit.skill.attack = { dmgType: 'phys', windup: (battle, unit, targets) =>
        outsideNormal(unit, targets[0]) ? evidence.ambriel.hits.Skill[0] : evidence.ambriel.hits.Attack[0] };
    }
  }
  if (id === 'char_4062_totter') {
    kit.skill.attack = { dmgType: 'phys', ignoreStealth: true };
    if (skill.id === 'skchr_totter_1') {
      kit.skill.attack.atkScale = bb.atk_scale;
      kit.skill.targeting = { maxTargets: bb.max_target };
    } else {
      kit.skill.mods = { aspd: bb.attack_speed };
      kit.skill.targeting = { maxTargets: bb['attack@s2n.max_target'] };
      kit.skill.attack.atkScale = 1;
      kit.skill.onStart = ({ unit }) => { unit.atkCd = 0; };
      kit.skill.onEnd = ({ unit }) => { unit.atkCd = 0; };
    }
  }
}

export function installAdvancedSniper({ battle, unit, def }) {
  const talent = def.talents[0]?.bb;
  if (unit.defId === 'char_118_yuki') {
    unit.profile.windup = evidence.shirayuki.hits.Attack[0];
    if (talent) battle.addBuff(unit, { key: 'shirayuki:heavy', source: unit, persist: true, allowDead: true,
      mods: { batPct: talent.base_attack_time / unit.base.bat } });
  }
  if (unit.defId === 'char_440_pinecn') {
    // Both original Pinecone attack abilities are direct AoE; there is no
    // projectileKey on either the normal attack or the Overcharge attack.
    unit.profile.projectile = 'none';
    unit.profile.windup = evidence.pinecone.hits.Attack[0];
    unit.profile.retargetOnRelease = true;
    unit.profile.interruptOnSkillChange = true;
    if (talent) battle.on('deploy', ({ unit: deployed }) => {
      if (deployed === unit) battle.addBuff(unit, { key: 'pinecone:power', source: unit,
        duration: talent.duration, mods: { spRecoveryFlat: talent.sp_recovery_per_sec } });
    }, { owner: unit });
  }
  if (unit.defId === 'char_302_glaze') {
    unit.profile.windup = evidence.ambriel.hits.Attack[0];
    unit.profile.attackVisual = 'attack';
    unit.profile.attackDrivenSkill = true;
    if (talent) unit.profile.onEachHit = (battle, unit, target) => {
      if (target.alive && outsideNormal(unit, target) && battle.rng.chance(talent.buff_prob))
        battle.applyStatus(target, 'stun', { duration: talent.stun, source: unit });
    };
    if (def.skill.id === 'skchr_glaze_2') battle.on('beforeAttack', (ctx) => {
      if (ctx.attacker !== unit || !ctx.isSkill) return;
      const far = outsideNormal(unit, ctx.targets[0]);
      ctx.profile.projectile = far ? 'none' : 'arrow';
      ctx.profile.attackVisual = far ? 'skill' : 'attack';
    }, { owner: unit });
  }
  if (unit.defId === 'char_4062_totter') {
    unit.profile.ignoreStealth = true;
    unit.profile.windup = evidence.totter.hits.Attack[0];
    unit.profile.projectileSpeed = evidence.totter.projectileSpeed;
    unit.profile.interruptOnSkillChange = true;
    const updateTalent = () => {
      if (!unit.alive || !unit.deployed || !talent) return;
      const hiddenTarget = battle.enemiesInKeys(unit.rangeKeys, unit, unit.profile).some(enemyStealthed);
      if (hiddenTarget) battle.addBuff(unit, { key: 'totter:eyes', source: unit, mods: { atkMul: 1 + talent.atk } });
      else battle.removeBuff(unit, 'totter:eyes');
    };
    battle.every(evidence.totter.talentInterval, updateTalent, { owner: unit });
    if (def.skill.id === 'skchr_totter_2') battle.on('beforeAttack', (ctx) => {
      if (ctx.attacker === unit && ctx.isSkill)
        ctx.profile.atkScale = ctx.targets.length === 1 ? def.skill.bb['attack@s2c.atk_scale'] : 1;
    }, { owner: unit });
  }
}
