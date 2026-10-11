// SPDX-License-Identifier: GPL-3.0-or-later
import { FIVE_STAR_MEDIC_OPERATORS } from '../../../shared/arkpedia/five-star-medic-operators.js';
import evidence from '../../../data/arkpedia-five-star-medic-prefabs.json' with { type: 'json' };
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { aggregateMods, RESIST_STATUSES } from '../buffs.js';

const live = u => u?.alive && u.deployed;
const model = (id, u) => evidence.models[id][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const timed = (id, clip) => (_b, u) => model(id, u).hits[clip][0] / Math.min(1, u.s.aspd / 100);
const grid = key => evidence.rangeTable[key].grids.map(p => [p.row, p.col]);
const selectableAlly = a => live(a) && !a.hidden && a.kind !== 'device'
  && !a.s.flags.untargetable && !a.s.flags.isolated;
const healable = (a, u, { ignoreFree = false } = {}) => live(a) && !a.hidden && a.kind !== 'device'
  && !a.s.flags.untargetable && (ignoreFree || !a.s.flags.healFree)
  && (a === u || !(a.s.flags.isolated || a.s.flags.noHeal || a.profile?.noHeal));
const injured = (b, u) => b.injuredAlliesInKeys(u.rangeKeys, u).filter(a => healable(a, u));
const healSelector = (count, threshold = 1) => (b, u) => injured(b, u)
  .filter(a => a.hpRatio <= threshold + 1e-9).slice(0, count + Math.max(0, Math.floor(u.s.maxTargets)));
const abnormal = a => [...RESIST_STATUSES].some(s => a.s.flags[s]) || (a.findBuff('palsy')?.stacks ?? 0) > 0;

/** Source named spRecover channel: highest live producer, separate from personal
 * SP buffs. Future source-reviewed producers may share this channel. */
export function registerNamedSpRecovery(b, u, value, eligible = () => true) {
  const sources = b._arkpediaSpRecover ??= new Map();
  sources.set(u.id, { unit: u, value, eligible });
  const sync = () => {
    for (const ally of b.allyUnits) {
      let highest = null;
      if (live(ally) && !ally.hidden && !ally.s.flags.isolated)
        for (const entry of sources.values()) if (live(entry.unit) && entry.eligible(ally)
          && (!highest || entry.value > highest.value)) highest = entry;
      const key = 'source:spRecover', old = ally.findBuff(key);
      if (!highest) b.removeBuff(ally, key);
      else if (old?.mods.spRecoveryFlat !== highest.value || old.source !== highest.unit)
        b.addBuff(ally, { key, source: highest.unit, mods: { spRecoveryFlat: highest.value } });
    }
  };
  for (const event of ['deploy', 'death', 'tick']) b.on(event, sync, { owner: u });
  return sync;
}

export function customizeFiveStarMedicKit({ battle: b, id, def, unit: u, kit }) {
  if (!FIVE_STAR_MEDIC_OPERATORS[id]) return;
  kit.install = null;
  const s = def.skill, bb = s.bb, first = s.id !== FIVE_STAR_MEDIC_OPERATORS[id].skillIds[1];
  const multi = id === 'char_128_plosis' || id === 'char_275_breeze';
  kit.trait = { attack: 'ranged', dmgType: 'heal', projectile: 'none', canHitFly: true,
    heal: { mode: multi ? 'multi' : 'single', count: multi ? 3 : 1 }, maxTargets: 1,
    acquireTargets: healSelector(multi ? 3 : 1), attackVisual: 'Attack', windup: timed(id, 'Attack'),
    interruptOnSkillChange: true, install: null };
  if (id === 'char_128_plosis') {
    kit.skill = first ? { kind: 'duration', duration: s.duration, mods: { atkPct: bb.atk } }
      : { kind: 'duration', duration: s.duration,
        mods: { batFlat: bb.base_attack_time }, targeting: { rangeGrid: s.rangeGrid },
        // Empty native animKey has no loop OnAttack; use its explicit predelay.
        attack: { windup: .2, attackVisual: 'none' },
        onStart: () => {
          const seq = u.deploySeq, activation = u.skill.activations;
          u.mem.regularFormVisual = { clip: 'Skill_Start', loop: false };
          b.after(model(id, u).durations.Skill_Start, () => {
            if (live(u) && u.deploySeq === seq && u.skill.active && u.skill.activations === activation)
              u.mem.regularFormVisual = { clip: 'Skill_Loop', loop: true };
          }, { owner: u });
        }, onEnd: ({ reason }) => {
          if (reason === 'death') u.mem.regularFormVisual = null;
          else {
            const seq = u.deploySeq; u.mem.regularFormVisual = { clip: 'Skill_End', loop: false };
            b.after(model(id, u).durations.Skill_End, () => { if (u.deploySeq === seq) u.mem.regularFormVisual = null; }, { owner: u });
          }
        } };
  } else if (id === 'char_275_breeze') {
    kit.skill = { kind: 'duration', duration: s.duration, mods: { atkPct: bb.atk },
      attack: first ? { heal: { mode: 'multi', count: 2 }, acquireTargets: healSelector(2) }
        : { heal: { mode: 'single' }, acquireTargets: healSelector(1), windup: timed(id, 'Skill'),
          attackVisual: 'Skill', healProjectileSpeed: 10,
          afterHeal: (_battle, unit, target) => {
            const keys = new Set(absoluteRangeKeys(grid('x-4'), target.tileR, target.tileC, 'RIGHT'));
            for (const ally of b.allyUnits) if (ally !== target && bodyInKeys(ally, keys)
              && healable(ally, unit)) b.heal(unit, ally, unit.s.atk * bb['attack@scale']);
          } },
      onStart: () => syncBreeze(b, u, def), onEnd: () => syncBreeze(b, u, def) };
  } else if (id === 'char_171_bldsk') {
    kit.skill = first ? { kind: 'charges', trigger: { rule: 'DEFAULT', allies: true, hpAtMost: .5 },
      attack: { heal: { mode: 'single', hpAtMost: .5 }, acquireTargets: healSelector(1, .5),
        afterHeal: (_battle, unit, target) => b.heal(unit, target, target.s.maxHp * bb.hp_ratio) } }
      : { kind: 'instant', onStart: () => plasmaCast(b, u, bb) };
  } else if (id === 'char_345_folnic') {
    kit.trait.healProjectileSpeed = 5;
    kit.skill = first ? { kind: 'duration', duration: s.duration, mods: { atkPct: bb.atk },
      targeting: { rangeExtend: bb.ability_range_forward_extend } }
      : { kind: 'duration', duration: s.duration,
        attack: { dmgType: 'arts', heal: null, windup: timed(id, 'Skill'), attackVisual: 'Skill',
          acquireTargets: (battle, unit, prof) => {
            const foes = battle.enemiesInKeys(unit.rangeKeys, unit, prof);
            sortEnemyTargets(battle, unit, foes, prof.priority);
            return foes.length ? foes.slice(0, 1) : injured(battle, unit).slice(0, 1);
          }, launchAttack: (battle, unit, prof, target, info) => folinicShell(battle, unit, target, bb, info) } };
  } else {
    const inner = unit => new Set(absoluteRangeKeys(grid('2-3'), unit.tileR, unit.tileC, unit.dir));
    const heal = { mode: 'single', farMul: null, scaleForTarget: (_battle, unit, target) =>
      bodyInKeys(target, inner(unit)) ? 1 : def.traitBb.heal_scale };
    kit.trait.heal = heal;
    const resistAfter = (duration, resistance) => (_battle, unit, target) => b.applyStatus(target, 'resist', {
      key: `whisperain:resist:${unit.id}`, source: unit, duration, value: -resistance });
    kit.skill = first ? { kind: 'instant',
      attack: { heal: { ...heal, mode: 'multi', count: 2 }, healScale: bb.heal_scale,
        acquireTargets: (battle, unit) => injured(battle, unit).sort((a, c) => Number(abnormal(c)) - Number(abnormal(a)))
          .slice(0, 2 + Math.max(0, Math.floor(unit.s.maxTargets))),
        afterHeal: resistAfter(bb['status_resistance[limit]'], bb.one_minus_status_resistance) } }
      : { kind: 'toggle', trigger: 'SP_FULL', mods: { batPct: bb.base_attack_time },
        attack: { attackVisual: 'Skill_2', windup: timed(id, 'Skill_2'),
          afterHeal: resistAfter(bb['attack@status_resistance[limit]'], bb['attack@one_minus_status_resistance']) } };
  }
  kit.skill.id = s.id; kit.skill.name = s.name;
}

function syncBreeze(b, u, def) {
  const talent = def.talents[0]?.bb, key = `breeze:resist:${u.id}`;
  for (const ally of b.allyUnits) {
    const eligible = talent && live(u) && u.skill.active && live(ally) && !ally.hidden && !ally.s.flags.isolated
      && (ally.def.profession === 'MEDIC' || def.raw.arkpedia.elite >= 2 && ally.def.profession === 'SUPPORT');
    if (!eligible) b.removeBuff(ally, key);
    else if (!ally.findBuff(key)) b.applyStatus(ally, 'resist', { key, source: u, value: -talent.one_minus_status_resistance });
  }
}

function plasmaCast(b, u, bb) {
  const targets = b.allyUnits.filter(a => a !== u && selectableAlly(a) && bodyInKeys(a, u.rangeKeySet));
  const random = b.rng.pick(targets), recipients = [u, ...(random ? [random] : [])];
  const seq = u.deploySeq, activation = u.skill.activations, release = timed(u.defId, 'Attack')(b, u);
  const total = model(u.defId, u).durations.Attack / Math.min(1, u.s.aspd / 100);
  u.mem.regularFormVisual = { clip: 'Attack', loop: false };
  b.addBuff(u, { key: 'warfarin:cast', duration: total, flags: { disarm: true, noSp: true } });
  const controlEpoch = u.attackControlEpoch;
  let cancelled = false;
  const valid = () => !cancelled && live(u) && u.deploySeq === seq
    && u.skill.activations === activation && u.canAct && u.attackControlEpoch === controlEpoch;
  // Native interruptible predelay remembers control even when it ends before
  // OnAttack. Checking only at release would incorrectly resume an old cast.
  const watch = b.every(b.dt, () => {
    if (valid()) return;
    cancelled = true; watch.cancel();
    if (u.deploySeq === seq && u.skill.activations === activation) {
      u.mem.regularFormVisual = null; b.removeBuff(u, 'warfarin:cast');
    }
  }, { owner: u });
  b.after(release, () => {
    watch.cancel();
    if (!valid()) {
      if (u.deploySeq === seq && u.skill.activations === activation) {
        u.mem.regularFormVisual = null; b.removeBuff(u, 'warfarin:cast');
      }
      return;
    }
    for (const ally of recipients) if (live(ally)) b.addBuff(ally, { key: 'warfarin:plasma', source: u,
      duration: bb.duration, interval: bb.interval, mods: { atkPct: bb.atk },
      onTick: ({ unit }) => b.loseHp(unit, unit.s.maxHp * bb.hp_ratio, { source: u, tags: ['warfarin:plasma'] }) });
  }, { owner: u });
  b.after(total, () => { if (u.deploySeq === seq && u.skill.activations === activation) u.mem.regularFormVisual = null; }, { owner: u });
}

function folinicShell(b, u, target, bb, info) {
  b.addProjectile({ from: u, target, speed: 8, source: u, visual: 'orb', hitDead: true,
    data: { arkpediaTrackedVisual: true }, onHit: ({ x, y }) => {
      for (const enemy of b.foesInRadius(x, y, 1)) if (canTargetEnemy(u, enemy, { canHitFly: true, ignoreStealth: true }))
        b.dealDamage(u, enemy, { amount: u.s.atk * bb['attack@atk_scale'], type: 'arts',
          isAttack: true, isSkill: true, applyWay: 'ranged', isProjectile: true, attackId: info.attackId });
      for (const ally of b.alliesInRadius(x, y, 1)) if (healable(ally, u))
        b.heal(u, ally, u.s.atk * bb['attack@heal_scale']);
    } });
}

function whisperRecovery(b, u, ally, def) {
  if (!live(u) || !live(ally) || !(b.resistOf(ally) > 0) || !bodyInKeys(ally, u.rangeKeySet)) return;
  const ratio = def.talents[0].bb.atk_to_hp_recovery_ratio *
    (u.skill.active && u.skill.id === 'skchr_whispr_2' ? def.skill.bb.talent_scale : 1);
  const multiplier = aggregateMods(ally.buffs).mul.hpRegenMul ?? 1;
  b.heal(u, ally, u.s.atk * ratio * multiplier, { self: true, regen: true });
}
function syncWhisperain(b, u, def) {
  const key = `whisperain:recovery:${u.id}`;
  for (const ally of b.allyUnits) {
    const eligible = live(u) && live(ally) && !ally.hidden && !ally.s.flags.isolated
      && b.resistOf(ally) > 0 && bodyInKeys(ally, u.rangeKeySet);
    if (!eligible) b.removeBuff(ally, key);
    else if (!ally.findBuff(key)) {
      b.addBuff(ally, { key, source: u, interval: 1, onTick: () => whisperRecovery(b, u, ally, def) });
      whisperRecovery(b, u, ally, def);
    }
  }
}

export function installFiveStarMedic({ battle: b, unit: u, def }) {
  const id = def.charId;
  if (!FIVE_STAR_MEDIC_OPERATORS[id]) return;
  const talent = def.talents[0]?.bb;
  if (!talent) return;
  if (id === 'char_128_plosis') registerNamedSpRecovery(b, u, talent.sp_recovery_per_sec);
  else if (id === 'char_275_breeze') {
    const sync = () => syncBreeze(b, u, def);
    for (const event of ['deploy', 'death', 'tick']) b.on(event, sync, { owner: u });
  } else if (id === 'char_171_bldsk') {
    b.on('kill', ({ victim }) => {
      if (!live(u) || victim.side !== 'enemy' || !bodyInKeys(victim, u.rangeKeySet)) return;
      u.skill.gainSp(talent['bldsk_t_1[self].sp'], 'warfarin:blood-sample');
      // Original random selector explicitly retains its owner as a candidate.
      const choices = b.allyUnits.filter(a => selectableAlly(a) && bodyInKeys(a, u.rangeKeySet));
      b.rng.pick(choices)?.skill?.gainSp(talent['bldsk_t_1[rand].sp'], 'warfarin:blood-sample');
    }, { owner: u });
  } else if (id === 'char_345_folnic') {
    b.on('deploy', ({ unit }) => { if (unit === u) b.applyStatus(u, 'resist', {
      key: 'folinic:resist', source: u, value: -talent.one_minus_status_resistance }); }, { owner: u });
    b.on('hit', ({ target, dmg }) => {
      if (target === u && dmg.isEnvironment && !dmg.tags?.includes('hpLoss')) dmg.mul *= talent.damage_scale;
    }, { owner: u });
  } else {
    const sync = () => syncWhisperain(b, u, def);
    b.every(.1, sync, { owner: u });
    b.on('death', sync, { owner: u });
  }
}
