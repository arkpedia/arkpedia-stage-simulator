// SPDX-License-Identifier: GPL-3.0-or-later
import { FIVE_STAR_SUPPORT_EXPANSION_OPERATORS } from '../../../shared/arkpedia/five-star-support-expansion-operators.js';
import evidence from '../../../data/arkpedia-five-star-support-expansion-prefabs.json' with { type: 'json' };
import { absoluteRangeKeys, sortEnemyTargets, canTargetAlly } from '../targeting.js';

const live = u => u?.alive && u.deployed;
const model = id => evidence.models[id].Front;
const windup = (id, clip = 'Attack') => (_b, u) => model(id).hits[clip][0] / Math.min(1, u.s.aspd / 100);
const batAddition = (u, amount) => ({ batPct: amount / u.base.bat });
function form(b, u, clip, loop = false) {
  u.mem.regularFormVisual = { clip, loop };
}
function finishForm(b, u, clip) {
  if (!live(u)) { u.mem.regularFormVisual = null; return; }
  form(b, u, clip); const seq = u.deploySeq;
  b.after(model(u.defId).durations[clip], () => {
    if (u.deploySeq === seq) u.mem.regularFormVisual = null;
  }, { owner: u });
}

export function customizeFiveStarSupportExpansionKit({ id, def, unit: u, kit }) {
  if (!FIVE_STAR_SUPPORT_EXPANSION_OPERATORS[id]) return;
  kit.install = null;
  const s = def.skill, bb = s.bb;
  const stalker = ['char_215_mantic', 'char_478_kirara'].includes(id);
  kit.trait = { attack: stalker ? 'melee' : 'ranged', dmgType: stalker ? 'phys' : 'arts',
    projectile: stalker ? 'none' : 'orb', projectileSpeed: 10, canHitFly: !stalker,
    windup: windup(id), attackVisual: 'Attack', maxTargets: 1, allInRange: stalker,
    hitAllBlocked: false, hits: 1, hitsFn: null, install: null,
    interruptOnSkillChange: true,
    ...(!stalker ? { onHitStatus: { key: 'sluggish', duration: .8 } } : {}) };
  const duration = extra => ({ id: s.id, name: s.name, kind: 'duration', duration: s.duration, ...extra });
  const nextAttack = extra => ({ id: s.id, name: s.name, kind: 'instant', ...extra });
  if (id === 'char_195_glassb') {
    kit.skill = s.id === 'skchr_glassb_1'
      ? duration({ mods: batAddition(u, bb.base_attack_time) })
      : duration({ mods: { atkPct: bb.atk }, targeting: { rangeGrid: s.rangeGrid },
        attack: { maxTargets: bb['attack@max_target'], windup: .5, attackVisual: 'none' },
        onStart: ({ battle: b }) => {
          const begin = model(id).durations.Skill_Start, seq = u.deploySeq;
          b.addBuff(u, { key: 'istina:begin', duration: begin, flags: { disarm: true } });
          form(b, u, 'Skill_Start');
          b.after(begin, () => { if (live(u) && u.deploySeq === seq && u.skill.active) form(b, u, 'Skill_Loop', true); }, { owner: u });
        }, onEnd: ({ battle: b }) => finishForm(b, u, 'Skill_End') });
  } else if (id === 'char_4032_provs') {
    kit.skill = s.id === 'skchr_provs_1'
      ? nextAttack({ attack: { atkScale: bb.atk_scale, onHitStatus: { key: 'sluggish', duration: bb.sluggish } } })
      : duration({ duration: s.duration + model(id).durations.Skill_2_Begin,
        attack: { attackVisual: 'Skill_2_Loop', windup: windup(id, 'Skill_2_Loop') },
        onStart: ({ battle: b }) => {
          const seq = u.deploySeq, begin = model(id).durations.Skill_2_Begin;
          form(b, u, 'Skill_2_Begin');
          b.addBuff(u, { key: 'proviso:begin', duration: begin, flags: { disarm: true } });
          b.after(model(id).hits.Skill_2_Begin[0], () => {
            if (!live(u) || u.deploySeq !== seq || !u.canAct) return;
            const keys = absoluteRangeKeys(s.rangeGrid, u.tileR, u.tileC, u.dir);
            for (const target of b.enemiesInKeys(keys, u, { canHitFly: true })) {
              b.dealDamage(u, target, { amount: u.s.atk * bb.atk_scale, type: 'arts', isSkill: true,
                isAttack: true, applyWay: 'melee' });
              if (!target.alive) continue;
              b.applyStatus(target, 'sluggish', { source: u, duration: bb.sluggish });
              b.applyStatus(target, 'silence', { source: u, duration: bb.silence });
            }
          }, { owner: u });
          b.after(begin, () => {
            if (!live(u) || u.deploySeq !== seq || !u.skill.active) return;
            b.addBuff(u, { key: 'proviso:interval', duration: s.duration, mods: batAddition(u, bb.base_attack_time) });
            form(b, u, 'Skill_2_Idle', true);
          }, { owner: u });
        }, onEnd: ({ battle: b }) => {
          b.removeBuff(u, 'proviso:interval'); b.removeBuff(u, 'proviso:begin'); finishForm(b, u, 'Skill_2_End');
        } });
  } else if (id === 'char_4122_grabds') {
    kit.trait.onHitStatus = null;
    kit.trait.onEachHit = (b, unit, target) => {
      if (target.alive) b.applyStatus(target, 'sluggish', { source: unit,
        duration: .8 + (target.tags.has('wildanimal') ? def.talents[0]?.bb.sluggish_addition ?? 0 : 0) });
    };
    kit.skill = s.id === 'skchr_grabds_1'
      ? nextAttack({ attack: { atkScale: bb.atk_scale, maxTargets: 2,
        attackVisual: 'Skill_1', windup: windup(id, 'Skill_1') } })
      : duration({ mods: { aspd: bb.attack_speed }, attack: { maxTargets: bb.max_target, windup: .2, attackVisual: 'none' },
        onStart: ({ battle: b }) => {
          const seq = u.deploySeq;
          b.addBuff(u, { key: 'grain-buds:singing', duration: bb.sleep, flags: { disarm: true } });
          const keys = absoluteRangeKeys(s.rangeGrid, u.tileR, u.tileC, u.dir);
          const targets = b.enemiesInKeys(keys, u, { canHitFly: true }); sortEnemyTargets(b, u, targets);
          for (const target of targets.slice(0, bb.max_target)) b.applyStatus(target, 'sleep', {
            source: u, key: `grain-buds:sleep:${u.id}`, duration: bb.sleep });
          form(b, u, 'Skill_2_Begin');
          b.after(model(id).durations.Skill_2_Begin, () => {
            if (live(u) && u.deploySeq === seq && u.skill.active) form(b, u, 'Skill_2_Loop', true);
          }, { owner: u });
        }, onEnd: ({ battle: b }) => { b.removeBuff(u, 'grain-buds:singing'); finishForm(b, u, 'Skill_2_End'); } });
  } else if (id === 'char_215_mantic') {
    kit.skill = s.id === 'skchr_mantic_1' ? { id: s.id, name: s.name, kind: 'passive',
      attack: { onEachHit: ({ battle: b, unit, target }) => {
        if (target.alive) b.addBuff(target, { key: 'manticore:movement', source: unit,
          duration: bb.duration, mods: { moveMul: 1 + bb.move_speed } });
      } } } : duration({ mods: { atkPct: bb.atk, ...batAddition(u, bb.base_attack_time) },
        attack: { retargetOnRelease: true, windup: windup(id, 'Skill'), attackVisual: 'Skill',
          onHitStatus: { key: 'stun', duration: bb['attack@stun'] } } });
  } else {
    kit.skill = s.id === 'skchr_kirara_1'
      ? nextAttack({ attack: { onEachHit: ({ battle: b, unit, target }) => {
        if (!target.alive) return;
        b.after(.15, () => {
          if (target.alive) b.dealDamage(unit, target, { amount: unit.s.atk * bb['kirara_s_1.atk_scale'],
            type: 'arts', isSkill: true, applyWay: 'none', tags: ['kirara:s1-rider'] });
        });
      } } }) : duration({ attack: { noAttack: true }, onStart: ({ battle: b }) => {
        u.mem.kiraraClock = 0; u.mem.kiraraPulses = 0;
        form(b, u, 'Skill_Start'); const seq = u.deploySeq;
        b.after(model(id).durations.Skill_Start, () => {
          if (live(u) && u.deploySeq === seq && u.skill.active) form(b, u, 'Skill_Loop', true);
        }, { owner: u });
        syncKirara(b, u, def);
      }, onTick: ({ battle: b, dt, skill }) => {
        if (!u.canAct) return;
        u.mem.kiraraClock += Math.min(dt, skill.timeLeft);
        while (u.mem.kiraraClock + 1e-9 >= .45 + u.mem.kiraraPulses) {
          u.mem.kiraraPulses++;
          for (const target of b.enemiesInKeys(u.rangeKeys, u, { canHitFly: false }))
            b.dealDamage(u, target, { amount: u.s.atk * bb['attack@atk_scale'], type: 'arts',
              isAttack: true, isSkill: true, applyWay: 'melee' });
        }
      }, onEnd: ({ battle: b }) => { syncKirara(b, u, def); finishForm(b, u, 'Skill_End'); } });
  }
}

function syncKirara(b, u, def) {
  const talent = def.talents[0]?.bb;
  if (!talent || !live(u)) return;
  const nearby = b.allyUnits.some(a => a !== u && live(a) && a.kind === 'op'
    && (a.tileR - u.tileR) ** 2 + (a.tileC - u.tileC) ** 2 <= 2);
  const ratio = talent[nearby ? 'hp_recovery_per_sec_by_max_hp_ratio' : 'kirara_t_2.hp_recovery_per_sec_by_max_hp_ratio']
    * (u.skill?.active && u.skill.id === 'skchr_kirara_2' ? u.skill.bb.talent_scale : 1);
  if (u.findBuff('kirara:regen')?.mods.hpRegenRatio !== ratio)
    b.addBuff(u, { key: 'kirara:regen', mods: { hpRegenRatio: ratio } });
}

export function installFiveStarSupportExpansion({ battle: b, unit: u, def }) {
  if (!FIVE_STAR_SUPPORT_EXPANSION_OPERATORS[def.charId]) return;
  const id = def.charId, talent = def.talents[0]?.bb;
  if (id === 'char_195_glassb' && talent) b.addBuff(u, {
    key: 'istina:explorer', persist: true, allowDead: true, mods: { defPct: talent.def, aspd: talent.attack_speed } });
  if (id === 'char_4122_grabds' && talent) b.addBuff(u, {
    key: 'grain-buds:talent', persist: true, allowDead: true, mods: { aspd: talent.attack_speed } });
  if (id === 'char_4032_provs' && talent) {
    const key = `proviso:ally:${u.id}`; let chosen;
    b.addBuff(u, { key: 'proviso:self', persist: true, allowDead: true, mods: { aspd: talent.attack_speed } });
    const sync = () => {
      if (!live(u)) { if (chosen) b.removeBuff(chosen, key); chosen = null; return; }
      const eligible = a => a !== u && live(a) && a.kind === 'op' && a.def.raw.tags?.includes('kazimierz')
        && canTargetAlly(u, a, false);
      if (chosen && !eligible(chosen)) { b.removeBuff(chosen, key); chosen = null; }
      if (!chosen) chosen = b.rng.pick(b.allyUnits.filter(eligible));
      if (chosen && !chosen.findBuff(key)) b.addBuff(chosen, { key, source: u, mods: { aspd: talent.attack_speed } });
    };
    b.on('deploy', sync, { owner: u }); b.on('death', sync, { owner: u }); b.on('tick', sync, { owner: u });
  }
  if (['char_215_mantic', 'char_478_kirara'].includes(id)) b.addBuff(u, {
    key: 'stalker:dodge', persist: true, allowDead: true,
    mods: { dodgePhys: def.traitBb.prob, dodgeArts: def.traitBb.prob } });
  if (id === 'char_215_mantic' && talent) {
    const hidden = 'manticore:invisible', charge = 'manticore:charged-attack';
    u.mem.manticLastAttack = b.time;
    const sync = () => {
      if (!live(u) || b.time - u.mem.manticLastAttack < talent.delay - 1e-9) return;
      if (!u.findBuff(hidden)) b.addBuff(u, { key: hidden, flags: { stealth: true } });
      if (!u.findBuff(charge)) b.addBuff(u, { key: charge, mods: { atkPct: talent.atk } });
    };
    b.on('beforeAttack', ({ attacker }) => {
      if (attacker !== u) return;
      u.mem.manticLastAttack = b.time; u.mem.manticOutput = false; b.removeBuff(u, hidden);
    }, { owner: u });
    b.on('damaged', ({ source, dmg }) => { if (source === u && dmg.isAttack) u.mem.manticOutput = true; }, { owner: u });
    b.on('attack', ({ attacker }) => {
      if (attacker === u && u.mem.manticOutput) b.removeBuff(u, charge);
    }, { owner: u });
    b.on('tick', sync, { owner: u });
  }
  if (id === 'char_478_kirara') {
    const sync = () => syncKirara(b, u, def);
    b.on('deploy', sync, { owner: u }); b.on('death', sync, { owner: u }); b.on('tick', sync, { owner: u });
  }
}
