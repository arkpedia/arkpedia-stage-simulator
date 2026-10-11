// SPDX-License-Identifier: GPL-3.0-or-later
import { FIVE_STAR_GUARD_EXPANSION_OPERATORS } from '../../../shared/arkpedia/five-star-guard-expansion-operators.js';
import { acquireTargets, performAttack, resolveHit } from '../ai.js';
import { canTargetEnemy } from '../targeting.js';
import { applyHpLoss, makeDamageInfo } from '../damage.js';

const windup = (seconds, cap = Infinity) => (_b, u) => seconds / Math.min(cap, u.s.aspd / 100);
function akafuyuDouble(b, u, p, target, info) {
  resolveHit(b, u, p, target, info, target.x, target.y);
  const seq = u.deploySeq, activation = u.skill.activations, controlEpoch = u.attackControlEpoch;
  let interrupted = false;
  const valid = () => u.alive && u.deployed && u.deploySeq === seq && u.canAct && !u.s.flags.disarm
    && u.skill.active && u.skill.activations === activation && u.attackControlEpoch === controlEpoch;
  const watch = b.every(b.dt, () => { if (!valid()) interrupted = true; }, { owner: u });
  // Original MultimagicAttack does not wait for a second event; triggerDelta=.03.
  b.after(.03, () => {
    watch.cancel();
    if (!interrupted && valid() && canTargetEnemy(u, target, p))
      resolveHit(b, u, p, target, info, target.x, target.y);
  }, { owner: u });
}

export function customizeFiveStarGuardExpansionKit({ id, def, kit }) {
  if (!FIVE_STAR_GUARD_EXPANSION_OPERATORS[id]) return;
  kit.install = null;
  const skill = def.skill, bb = skill.bb;
  kit.trait = { attack: 'melee', projectile: 'none', dmgType: 'phys', canHitFly: false,
    install: null, hitAllBlocked: false, maxTargets: 1, hits: 1, hitsFn: null, attackVisual: 'Attack' };
  const duration = mods => ({ id: skill.id, name: skill.name, kind: 'duration', duration: skill.duration, mods });
  const instant = { id: skill.id, name: skill.name, kind: 'instant' };
  if (id === 'char_230_savage') {
    Object.assign(kit.trait, { maxTargetsByBlock: true, windup: windup(.4, 1.1) });
    kit.skill = skill.id === 'skchr_savage_1'
      ? { ...instant, attack: { atkScale: bb.atk_scale, windup: windup(.4) } }
      : { ...instant, targeting: { rangeGrid: skill.rangeGrid },
        attack: { atkScale: bb.atk_scale, maxTargetsByBlock: false, maxTargets: bb.max_target,
          windup: windup(.6), attackVisual: 'Skill' }, onStart: ({ battle, unit }) => {
        const p = { ...unit.profile, isSkill: true, maxTargetsByBlock: false, maxTargets: bb.max_target,
          atkScale: bb.atk_scale, windup: windup(.6), attackVisual: 'Skill' };
        const targets = acquireTargets(battle, unit, p);
        if (targets.length) performAttack(battle, unit, p, targets);
        else unit.skill.end('instant');
      } };
  } else if (id === 'char_155_tiger') {
    kit.trait.windup = windup(.567, 1);
    kit.skill = skill.id === 'skchr_tiger_1'
      ? { ...instant, mods: { atkPct: bb.atk, defIgnorePct: bb.def_penetrate }, attack: { attackVisual: 'Attack' } }
      : { ...duration({ atkPct: bb.atk }), attack: { dmgType: 'arts', attackVisual: 'Skill', windup: windup(.533, 1) } };
  } else if (id === 'char_333_sidero') {
    Object.assign(kit.trait, { dmgType: 'arts', windup: windup(.5) });
    kit.skill = skill.id === 'skchr_sidero_2'
      ? { ...duration({ atkPct: bb.atk, hpRegenRatio: bb.hp_recovery_per_sec_by_max_hp_ratio }),
        targeting: { rangeGrid: skill.rangeGrid } }
      : { ...instant, onStart: ({ battle, unit }) => {
        battle.heal(unit, unit, unit.s.maxHp * bb.heal_scale, { self: true });
      } };
  } else if (id === 'char_415_flint') {
    const second = skill.id === 'skchr_flint_2';
    Object.assign(kit.trait, { windup: windup(.267, 1), interruptOnSkillChange: second });
    kit.skill = second
      ? { ...duration({ atkPct: bb.atk, aspd: bb.attack_speed, blockCntMul: 0 }), attack: {
        windup: (b, u) => {
          const clips = ['Skill2_A', 'Skill2_B', 'Skill2_C'].filter(v => v !== u.mem.flintClip);
          u.mem.flintClip = b.rng.pick(clips); return .367 / Math.min(1, u.s.aspd / 100);
        }, attackVisual: (_b, u) => u.mem.flintClip,
        onEachHit: ({ battle, unit, target }) => {
          if (target.alive) battle.applyStatus(target, 'sluggish', { source: unit, duration: bb['attack@sluggish'] });
        } } }
      : { ...instant, attack: { atkScale: bb.atk_scale, attackVisual: 'Skill1', windup: windup(.367),
        onEachHit: ({ battle, unit, target }) => {
          if (!target.alive) return;
          battle.push(target, bb.force, { from: unit, dir: { x: unit.fwd[1], y: unit.fwd[0] } });
          battle.applyStatus(target, 'sluggish', { source: unit, duration: bb.sluggish });
        } } };
  } else {
    const second = skill.id === 'skchr_akafyu_2';
    Object.assign(kit.trait, { noHeal: true, windup: windup(.467), retargetOnRelease: true,
      interruptOnSkillChange: second });
    kit.skill = second
      ? { ...duration({ atkPct: bb.atk, defPct: bb.def }), attack: { attackVisual: 'Skill2', windup: windup(.3) },
        onStart: ({ battle, unit }) => {
          // The original PURE cut skips modifiers and is independently nonlethal.
          applyHpLoss(battle, unit, unit, Math.max(0, Math.min(unit.hp * bb.hp_ratio,
            unit.hp - Math.min(1, unit.s.maxHp))), makeDamageInfo({ type: 'true', canDodge: false, tags: ['akafuyu:skill-cut'] }));
          battle.addBuff(unit, { key: 'akafuyu:skill-shield', shieldHits: 1 });
        }, onEnd: ({ battle, unit }) => battle.removeBuff(unit, 'akafuyu:skill-shield') }
      : { ...duration({ atkPct: bb.atk, blockCntMul: 0 }),
        attack: { attackVisual: 'Skill', launchAttack: akafuyuDouble } };
  }
}

export function installFiveStarGuardExpansion({ battle: b, unit: u, def }) {
  const id = def.charId;
  if (!FIVE_STAR_GUARD_EXPANSION_OPERATORS[id]) return;
  const talent = def.talents[0];
  if (id === 'char_230_savage' && talent) {
    const sync = () => {
      const count = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([r, c]) => {
        r += u.tileR; c += u.tileC; if (!b.grid.inRect(r, c)) return false;
        const tile = b.grid.tile(r, c); return tile.height === 'HIGH' && ['RANGED', 'ALL'].includes(tile.build);
      }).length;
      if (u.alive && u.deployed && count >= talent.bb.cnt) {
        if (!u.findBuff('savage:valley')) b.addBuff(u, { key: 'savage:valley', mods: { atkPct: talent.bb.atk, defPct: talent.bb.def } });
      } else b.removeBuff(u, 'savage:valley');
    };
    sync(); b.on('tick', sync, { owner: u });
  } else if (id === 'char_155_tiger') {
    if (talent) b.on('hit', ({ source, target, dmg }) => {
      if (target !== u || source?.side === u.side || dmg.type !== 'phys' || dmg.applyWay !== 'melee' || !dmg.canDodge) return;
      if (b.rng() < talent.bb['tiger_t_1[evade].prob']) {
        dmg.cancel = true; b.fx('dodge', { x: u.x, y: u.y, id: u.id }); b.emit('dodge', { source, target, dmg });
      }
    }, { owner: u });
    if (talent) b.on('dodge', ({ target }) => {
      if (target === u && u.alive && u.deployed)
        b.addBuff(u, { key: 'indra:next-attack', mods: { atkPct: talent.bb['charge_on_evade.atk'] } });
    }, { owner: u });
    b.on('damaged', ({ source, dmg, amount }) => {
      if (source !== u) return;
      if (dmg.isAttack) u.mem.indraOutput = true;
      if (amount > 0 && u.skill.active && u.skill.id === 'skchr_tiger_2')
        b.heal(u, u, amount * u.skill.bb.heal_scale, { self: true });
    }, { owner: u });
    b.on('attack', ({ attacker }) => {
      if (attacker === u && u.mem.indraOutput) { u.mem.indraOutput = false; b.removeBuff(u, 'indra:next-attack'); }
    }, { owner: u });
  } else if (id === 'char_333_sidero' && talent) {
    let kills = 0;
    b.on('kill', ({ killer, victim }) => {
      if (killer !== u || victim.side !== 'enemy' || !u.alive || !u.deployed || kills >= talent.bb.times) return;
      if (++kills >= talent.bb.times) {
        b.addBuff(u, { key: 'sideroca:tenacity', mods: { aspd: talent.bb.attack_speed } });
        b.applyStatus(u, 'resist', { source: u, value: -talent.bb.one_minus_status_resistance });
      }
    }, { owner: u });
  } else if (id === 'char_415_flint' && talent) {
    b.on('hit', ({ source, target, dmg }) => {
      if (source === u && target.side === 'enemy' && target.blockedBy !== u) dmg.mul *= talent.bb.damage_scale;
    }, { owner: u });
  } else if (id === 'char_475_akafyu') {
    b.on('damaged', ({ source, target, dmg }) => {
      if (source === u && target.side === 'enemy' && dmg.isAttack && u.alive && u.deployed)
        b.heal(u, u, def.traitBb.value, { self: true, ignoreHealFree: true });
    }, { owner: u });
    if (!talent) return;
    const sync = () => {
      if (!u.alive || !u.deployed) return;
      const aspd = talent.bb.min_attack_speed * Math.min(1, Math.max(0, (1 - u.hpRatio) / (1 - talent.bb.min_hp_ratio)));
      const buff = u.findBuff('akafuyu:tenacity');
      if (!buff || Math.abs(buff.mods.aspd - aspd) > 1e-6) b.addBuff(u, { key: 'akafuyu:tenacity', mods: { aspd } });
    };
    sync(); b.every(.25, sync, { owner: u });
  }
}
