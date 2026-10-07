// SPDX-License-Identifier: GPL-3.0-or-later
import { FIVE_STAR_GUARD_OPERATORS } from '../../../shared/arkpedia/five-star-guard-operators.js';

export function customizeFiveStarGuardKit({ id, def, kit }) {
  if (!FIVE_STAR_GUARD_OPERATORS[id]) return;
  kit.install = null;
  const skill = def.skill, bb = skill.bb;
  kit.trait = { attack: 'melee', projectile: 'none', dmgType: 'phys', canHitFly: false,
    hitAllBlocked: false, maxTargets: 1 };
  const duration = mods => ({ id: skill.id, name: skill.name, kind: 'duration', duration: skill.duration, mods });
  if (id === 'char_106_franka') {
    Object.assign(kit.trait, { windup: (_b, u) => .467 * 100 / u.s.aspd, attackVisual: 'Attack' });
    kit.skill = skill.id === 'skchr_franka_2'
      ? { ...duration({ atkPct: bb.atk, defMul: 0 }), attack: { attackVisual: 'Skill' } }
      : duration({ atkPct: bb.atk, aspd: bb.attack_speed });
  } else if (id === 'char_143_ghost') {
    Object.assign(kit.trait, { maxTargetsByBlock: true,
      windup: (_b, u) => .433 * 100 / u.s.aspd, attackVisual: 'Attack' });
    kit.skill = skill.id === 'skchr_ghost_2'
      ? { ...duration({ atkPct: bb.atk }), flags: { undeadable: true },
        onEnd: ({ battle, unit, reason }) => {
          if (reason === 'duration') battle.applyStatus(unit, 'stun', { source: unit, duration: bb.stun });
        } }
      : duration({ atkPct: bb.atk });
  } else if (id === 'char_356_broca') {
    const second = skill.id === 'skchr_broca_2';
    Object.assign(kit.trait, { maxTargetsByBlock: true,
      windup: (_b, u) => .467 * 100 / u.s.aspd, attackVisual: 'Attack',
      interruptOnSkillChange: second });
    kit.skill = { ...duration({ atkPct: bb.atk, ...(second ? { batPct: bb.base_attack_time } : {}) }),
      ...(second ? { targeting: { rangeGrid: skill.rangeGrid } } : {}),
      attack: { dmgType: 'arts', ...(second ? { attackVisual: 'Skill_Loop',
        onEachHit: ({ battle, unit, target }) => {
          if (target.alive) battle.applyStatus(target, 'sluggish', { source: unit, duration: bb['attack@sluggish'] });
        } } : {}) },
      ...(second ? { onEnd: ({ battle, unit, reason }) => {
        if (reason === 'duration') battle.applyStatus(unit, 'stun', { source: unit, duration: bb.stun });
      } } : {}) };
  } else if (id === 'char_274_astesi') {
    Object.assign(kit.trait, { dmgType: 'arts', windup: (_b, u) => .533 * 100 / u.s.aspd, attackVisual: 'Attack' });
    const second = skill.id === 'skchr_astesi_2';
    kit.skill = { ...duration({ atkPct: bb.atk, defPct: bb.def, ...(second ? { blockCnt: bb.block_cnt } : {}) }),
      ...(second ? { attack: { maxTargetsByBlock: true } } : {}) };
  } else {
    const second = skill.id === 'skchr_flameb_2';
    Object.assign(kit.trait, { windup: (_b, u) => .567 * 100 / u.s.aspd,
      attackVisual: 'Attack', interruptOnSkillChange: second });
    kit.skill = second
      ? { id: skill.id, name: skill.name, kind: 'toggle', mods: { atkPct: bb.atk, aspd: bb.attack_speed },
        attack: { attackVisual: 'Skill_2', windup: (_b, u) => .467 * 100 / u.s.aspd } }
      : { id: skill.id, name: skill.name, kind: 'instant', attack: { atkScale: bb.atk_scale, attackVisual: 'Skill_1' } };
  }
}

export function installFiveStarGuard({ battle: b, unit: u, def }) {
  const id = def.charId;
  if (!FIVE_STAR_GUARD_OPERATORS[id]) return;
  const talent = def.talents[0];
  if (id === 'char_106_franka' && talent) {
    b.on('beforeAttack', c => {
      if (c.attacker !== u) return;
      const scale = u.skill.active && u.skill.id === 'skchr_franka_2' ? u.skill.bb.talent_scale : 1;
      u.mem.frankaPierce = b.rng() < talent.bb.prob * scale;
    }, { owner: u });
    b.on('hit', c => {
      if (c.source === u && c.dmg.isAttack && c.dmg.type === 'phys' && u.mem.frankaPierce)
        c.dmg.defIgnorePct = 1;
    }, { owner: u });
  } else if (id === 'char_143_ghost' && talent) {
    b.addBuff(u, { key: 'specter:talent', persist: true, allowDead: true,
      mods: { hpPct: talent.bb.max_hp, hpRegenRatio: talent.bb.hp_recovery_per_sec_by_max_hp_ratio } });
  } else if (id === 'char_356_broca' && talent) {
    const sync = () => {
      const count = u.blocking.filter(e => e.alive && e.blockedBy === u).length;
      if (u.alive && u.deployed && count >= talent.bb.cnt) {
        if (!u.findBuff('broca:talent')) b.addBuff(u, { key: 'broca:talent',
          mods: { atkPct: talent.bb.atk, defPct: talent.bb.def } });
      } else b.removeBuff(u, 'broca:talent');
    };
    b.on('tick', sync, { owner: u });
    b.on('beforeAttack', c => { if (c.attacker === u) sync(); }, { owner: u });
    for (const event of ['blocked', 'unblocked', 'death', 'kill']) b.on(event, sync, { owner: u });
  } else if (id === 'char_274_astesi' && talent) {
    let stacks = 0;
    b.every(talent.bb.interval, () => {
      if (!u.alive || !u.deployed || stacks >= talent.bb.max_stack_cnt) return;
      stacks++;
      b.addBuff(u, { key: 'astesia:celestial-globe', mods: { aspd: talent.bb.attack_speed * stacks } });
    }, { owner: u });
  } else if (id === 'char_131_flameb') {
    if (def.skill.id === 'skchr_flameb_1') b.on('beforeAttack', c => {
      if (c.attacker === u && u.skill.pending && u.skill.id === 'skchr_flameb_1')
        b.heal(u, u, u.s.maxHp * u.skill.bb.hp_ratio, { self: true });
    }, { owner: u });
    if (!talent) return;
    let stacks = 0;
    b.on('kill', ({ killer, victim }) => {
      if (killer !== u || victim.side !== 'enemy' || !u.alive || !u.deployed || stacks >= talent.bb.max_stack_cnt) return;
      stacks++;
      b.addBuff(u, { key: 'flamebringer:bloody-slaughter', mods: { hpFlat: talent.bb.max_hp * stacks } });
      u.s; // synchronize proportional current HP at the source MAX_HP change
    }, { owner: u });
  }
}
