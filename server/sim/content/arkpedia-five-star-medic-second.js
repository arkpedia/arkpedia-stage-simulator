// SPDX-License-Identifier: GPL-3.0-or-later
import { FIVE_STAR_MEDIC_SECOND_OPERATORS } from '../../../shared/arkpedia/five-star-medic-second-operators.js';
import evidence from '../../../data/arkpedia-five-star-medic-second-prefabs.json' with { type: 'json' };
import { absoluteRangeKeys } from '../targeting.js';
import { bodyInKeys } from '../body.js';

const live = a => a?.alive && a.deployed && !a.hidden;
const model = (u) => evidence.models[u.defId][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const timing = clip => (_b, u) => model(u).hits[clip][0] / Math.min(1, u.s.aspd / 100);
const grid = key => evidence.rangeTable[key].grids.map(p => [p.row, p.col]);
const element = a => a.elem.burn + a.elem.neural + a.elem.necrosis + a.elem.apoptosis + a.elem.erosion;
const healable = (b, a, u) => live(a) && a.kind !== 'device' && !a.s.flags.untargetable
  && !a.s.flags.healFree && b.allySelectable(a, u)
  && (a === u || !(a.s.flags.noHeal || a.profile?.noHeal));
const auraAlly = (b, a, u, ignoreFree = false) => live(a) && a.kind !== 'device'
  // A non-HEAL validator's purposeMask0 does not reject healing immunity.
  && b.allySelectable(a, u) && (ignoreFree || !a.s.flags.untargetable);

function targets(b, u, { count = 1, ep = false, priority = false, hp = 1, ground = false } = {}) {
  const out = b.injuredAlliesInKeys(u.rangeKeys, u, ep).filter(a => healable(b, a, u)
    && a.hpRatio <= hp + 1e-9 && (!ground || !a.isFlying));
  if (priority) out.sort((a, c) => element(c) - element(a) || a.hpRatio - c.hpRatio || a.deploySeq - c.deploySeq);
  return out.slice(0, count + Math.max(0, Math.floor(u.s.maxTargets)));
}

function healFlight(b, u, target, speed, onHit, from = u) {
  if (speed > 0) b.addProjectile({ from, target, source: u, speed, visual: 'orb',
    data: { arkpediaTrackedVisual: true }, onHit: ({ target: a }) => {
      if (healable(b, a, u)) onHit(a);
    } });
  else if (healable(b, target, u)) onHit(target);
}

function form(b, u, begin, loop, end) {
  const seq = u.deploySeq, activation = u.skill.activations;
  u.mem.regularFormVisual = { clip: begin, loop: false };
  b.after(model(u).durations[begin], () => {
    if (live(u) && u.deploySeq === seq && u.skill.active && u.skill.activations === activation)
      u.mem.regularFormVisual = { clip: loop, loop: true };
  }, { owner: u });
  return ({ reason } = {}) => {
    if (reason === 'death' || !end) { u.mem.regularFormVisual = null; return; }
    u.mem.regularFormVisual = { clip: end, loop: false };
    b.after(model(u).durations[end], () => {
      if (u.deploySeq === seq && u.skill.activations === activation) u.mem.regularFormVisual = null;
    }, { owner: u });
  };
}

function outputTuye(b, u, a, atk, def) {
  const talent = def.talents[0]?.bb;
  const ready = talent && b.time - (u.mem.tuyeLastHeal ?? b.time) >= talent.delay - 1e-9;
  b.heal(u, a, atk * (ready ? talent.heal_scale_2 : 1));
}

// Separate manual ability, preserving the native interruptible predelay. Its
// fired projectile is independent of the caster's subsequent deployment life.
function tuyeCast(b, u, def, { emergency = false } = {}) {
  const bb = def.skill.bb, target = targets(b, u, { hp: emergency ? bb.max_hp_ratio : 1 })[0];
  if (emergency && !target) return false;
  const seq = u.deploySeq, activation = u.skill.activations;
  const delay = emergency ? .5 : timing('Skill_1')(b, u);
  const duration = emergency ? delay : model(u).durations.Skill_1 / Math.min(1, u.s.aspd / 100);
  const key = 'tuye:cast';
  u.mem.tuyeCasting = true;
  if (!emergency) u.mem.regularFormVisual = { clip: 'Skill_1', loop: false };
  b.addBuff(u, { key, duration, flags: { disarm: true, noSp: true } });
  let cancelled = false;
  const valid = () => !cancelled && live(u) && u.deploySeq === seq && u.canAct
    && u.skill.activations === activation && (!emergency || u.skill.active);
  const finish = () => {
    if (u.deploySeq !== seq || u.skill.activations !== activation) return;
    u.mem.tuyeCasting = false; b.removeBuff(u, key);
    if (!emergency) u.mem.regularFormVisual = null;
  };
  const watch = b.every(b.dt, () => { if (!valid()) { cancelled = true; watch.cancel(); finish(); } }, { owner: u });
  b.after(delay, () => {
    watch.cancel();
    if (!valid()) { finish(); return; }
    const atk = u.s.atk;
    if (target && healable(b, target, u)) {
      healFlight(b, u, target, 10, a => {
        outputTuye(b, u, a, atk * (emergency ? bb.heal_scale : 1), def);
        if (!emergency) b.addBuff(a, { key: 'tuye:barrier', source: u,
          shield: atk * bb.atk_scale, duration: bb.duration });
      });
      if (emergency && --u.mem.tuyeEmergencyLeft <= 0) u.skill.end('emergency-exhausted');
    }
    if (emergency) finish();
  }, { owner: u });
  b.after(duration, finish, { owner: u });
  return true;
}

function chainHeal(b, u, target, def, prof) {
  const bb = def.skill.bb, talent = def.talents[0]?.bb;
  const skill2 = prof.isSkill && def.skill.id === 'skchr_peper_2';
  const limit = def.traitBb['attack@chain.max_target'] + (skill2 ? bb['attack@chain.extra_value'] : 0);
  const falloff = def.traitBb['attack@chain.atk_scale'], visited = new Set();
  const bounce = (from, next, index) => healFlight(b, u, next, 10, a => {
    visited.add(a);
    const threshold = skill2 ? bb['talent@hp_ratio'] : talent?.hp_ratio;
    const extra = talent && a.hpRatio < threshold ? talent.value : 0;
    b.heal(u, a, u.s.atk * falloff ** index);
    if (extra) b.heal(u, a, extra);
    if (index + 1 >= limit) return;
    const keys = new Set(absoluteRangeKeys(grid('x-4'), a.tileR, a.tileC, 'RIGHT'));
    const candidates = b.injuredAlliesInKeys(keys, u).filter(c => !visited.has(c) && healable(b, c, u));
    if (candidates[0]) bounce({ x: a.x, y: a.y }, candidates[0], index + 1);
  }, from);
  bounce(u, target, 0);
}

/** Original nonstackable elemental-damage protection: strongest same-channel
 * source wins; weaker live producers remain available when it leaves. */
export function registerBerryProtection(b, u, value, eligible = a => bodyInKeys(a, u.rangeKeySet),
  active = () => u.skill.active) {
  const sources = b._arkpediaBerryProtection ??= new Map();
  sources.set(u.id, { unit: u, value, eligible, active });
  const sync = () => {
    for (const ally of b.allyUnits) {
      let highest;
      if (live(ally) && ally.kind !== 'device') for (const entry of sources.values())
        if (live(entry.unit) && entry.active() && entry.eligible(ally)
          && auraAlly(b, ally, entry.unit)
          && (!highest || entry.value > highest.value)) highest = entry;
      const key = 'source:mberry-safe-zone', old = ally.findBuff(key);
      if (!highest) b.removeBuff(ally, key);
      else if (old?.mods.elemTakenMul !== 1 - highest.value || old.source !== highest.unit)
        b.addBuff(ally, { key, source: highest.unit, mods: { elemTakenMul: 1 - highest.value } });
    }
  };
  for (const ev of ['deploy', 'death', 'tick', 'skillStart', 'skillEnd']) b.on(ev, sync, { owner: u });
  return sync;
}

function syncCeylon(b, u, def) {
  const key = `ceylon:resist:${u.id}`;
  for (const ally of b.allyUnits) {
    const eligible = live(u) && u.skill.active && auraAlly(b, ally, u) && bodyInKeys(ally, u.rangeKeySet);
    if (!eligible) b.removeBuff(ally, key);
    else if (!ally.findBuff(key)) b.applyStatus(ally, 'resist', { key, source: u,
      value: -def.skill.bb.one_minus_status_resistance });
  }
}

export function customizeFiveStarMedicSecondKit({ battle: b, id, def, unit: u, kit }) {
  if (!FIVE_STAR_MEDIC_SECOND_OPERATORS[id]) return;
  kit.install = null;
  const s = def.skill, bb = s.bb, first = s.id !== FIVE_STAR_MEDIC_SECOND_OPERATORS[id].skillIds[1];
  const ep = id === 'char_449_glider' || id === 'char_473_mberry';
  kit.trait = { attack: 'ranged', dmgType: 'heal', projectile: 'none', heal: null,
    canHitFly: true, maxTargets: 1, attackVisual: 'Attack', windup: timing('Attack'),
    acquireTargets: (battle, unit) => targets(battle, unit, { ep, ground: id === 'char_4071_peper' }),
    interruptOnSkillChange: true, install: null,
    launchAttack: (battle, unit, prof, target) => {
      if (id === 'char_4071_peper') { chainHeal(battle, unit, target, def, prof); return; }
      const cached = id === 'char_402_tuye' ? unit.s.atk : null;
      healFlight(battle, unit, target, prof.healFlightSpeed, a => {
        const atk = cached ?? unit.s.atk;
        if (id === 'char_402_tuye') { outputTuye(battle, unit, a, atk, def); return; }
        const far = id === 'char_348_ceylon' && !prof.disableFarPenalty
          && !bodyInKeys(a, new Set(absoluteRangeKeys(grid('2-3'), unit.tileR, unit.tileC, unit.dir)))
          ? def.traitBb.heal_scale : 1;
        b.heal(unit, a, atk * (prof.healScale ?? 1) * far);
        if (ep) battle.reduceElement(a, atk * (prof.elementHealRatio ?? def.traitBb.ep_heal_ratio));
        if (prof.honeyberryRecovery) b.addBuff(a, { key: 'honeyberry:recovery', source: unit,
          duration: bb['glider_s_1.duration'], interval: bb['glider_s_1.interval'],
          onTick: () => { if (live(a)) battle.reduceElement(a, unit.s.atk * bb['glider_s_1.ep_heal_ratio']); } });
      });
    } };
  kit.trait.healFlightSpeed = id === 'char_348_ceylon' ? 12 : id === 'char_473_mberry' ? 5 : 10;
  let endForm;
  const formSkill = (begin, loop, end) => ({ onStart: () => { endForm = form(b, u, begin, loop, end); },
    onEnd: ctx => endForm?.(ctx) });
  if (id === 'char_402_tuye') {
    kit.skill = first ? { kind: 'instant', onStart: () => tuyeCast(b, u, def) }
      : { kind: 'toggle', trigger: 'SP_FULL', mods: { atkPct: bb.atk },
        attack: { attackVisual: 'Skill_2_Attack', windup: timing('Skill_2_Attack'),
          acquireTargets: (battle, unit) => targets(battle, unit, { hp: .5 }) },
        onStart: () => { u.mem.tuyeEmergencyLeft = 3; u.mem.tuyeNextEmergency = b.time; u.mem.tuyePoll = 0;
          endForm = form(b, u, 'Skill_2_Begin', 'Skill_2_Idle', null); },
        onEnd: ctx => { u.mem.tuyeCasting = false; b.removeBuff(u, 'tuye:cast'); endForm?.(ctx); },
        onTick: ({ dt }) => {
          u.mem.tuyePoll += dt;
          if (u.mem.tuyePoll < .1 - 1e-9) return;
          u.mem.tuyePoll %= .1;
          if (!u.canAct || u.s.flags.silence || u.mem.tuyeCasting || b.time < u.mem.tuyeNextEmergency - 1e-9) return;
          if (tuyeCast(b, u, def, { emergency: true })) u.mem.tuyeNextEmergency = b.time + bb.skill_interval;
        } };
  } else if (id === 'char_348_ceylon') {
    kit.skill = first ? { kind: 'charges', heal: true,
      attack: { healScale: bb.heal_scale, disableFarPenalty: true } }
      : { kind: 'duration', duration: s.duration, mods: { atkPct: bb.atk },
        attack: { acquireTargets: (battle, unit) => targets(battle, unit, { count: bb['attack@max_target'] }) },
        onStart: () => syncCeylon(b, u, def), onEnd: () => syncCeylon(b, u, def) };
  } else if (id === 'char_4071_peper') {
    kit.skill = { kind: 'duration', duration: s.duration,
      mods: first ? { aspd: bb.attack_speed } : { atkPct: bb.atk },
      ...(!first ? { ...formSkill('Skill_2_Begin', 'Skill_2_Idle', 'Skill_2_End'),
        attack: { attackVisual: 'Skill_2_Loop', windup: timing('Skill_2_Loop') } } : {}) };
  } else if (id === 'char_449_glider') {
    kit.skill = first ? { kind: 'instant', heal: true,
      defaultCondition: () => targets(b, u, { ep: true }).length > 0,
      attack: { acquireTargets: (battle, unit) => targets(battle, unit, { count: 2, ep: true, priority: true }),
        attackVisual: 'Skill', windup: timing('Skill'), honeyberryRecovery: true } }
      : { kind: 'duration', duration: s.duration, mods: { atkPct: bb.atk },
        ...formSkill('skill_2_Begin', 'skill_2_Loop', 'skill_2_End'),
        attack: { windup: .2, attackVisual: 'none',
          acquireTargets: (battle, unit) => targets(battle, unit, { count: bb['attack@max_target'], ep: true, priority: true }) } };
  } else {
    kit.skill = first ? { kind: 'charges', heal: true,
      defaultCondition: () => targets(b, u, { ep: true }).length > 0,
      attack: { acquireTargets: (battle, unit) => targets(battle, unit, { ep: true, priority: true }),
        attackVisual: 'Skill', windup: timing('Skill'), healScale: bb.heal_scale,
        elementHealRatio: bb.ep_heal_ratio } }
      : { kind: 'duration', duration: s.duration, mods: { batMul: bb.base_attack_time },
        ...formSkill('Skill1_Start', 'Skill1_Loop', 'Skill1_End'),
        attack: { windup: 0, attackVisual: 'none', healFlightSpeed: 0,
          acquireTargets: (battle, unit) => targets(battle, unit, { ep: true, priority: true }) } };
  }
  kit.skill.id = s.id; kit.skill.name = s.name;
}

export function installFiveStarMedicSecond({ battle: b, unit: u, def }) {
  const id = def.charId;
  if (!FIVE_STAR_MEDIC_SECOND_OPERATORS[id]) return;
  const talent = def.talents[0]?.bb;
  if (id === 'char_402_tuye') {
    b.on('deploy', ({ unit }) => { if (unit === u) { u.mem.tuyeLastHeal = b.time; u.mem.tuyeCasting = false; } }, { owner: u });
    b.on('heal', ({ source, target }) => { if (source === u && healable(b, target, u)) u.mem.tuyeLastHeal = b.time; }, { owner: u });
  } else if (id === 'char_348_ceylon') {
    b.on('deploy', ({ unit }) => {
      if (unit === u && talent) b.addBuff(u, { key: 'ceylon:water', source: u, mods: {
        atkPct: talent['ceylon_t_1[common].atk'] + (b.mapTags.includes('water') ? talent['celyon_t_1[map].atk'] : 0) } });
    }, { owner: u });
    if (def.skill.id === 'skchr_ceylon_2') for (const ev of ['deploy', 'death', 'tick']) b.on(ev, () => syncCeylon(b, u, def), { owner: u });
  } else if (id === 'char_449_glider' && talent) {
    const sync = () => {
      const key = `honeyberry:hp:${u.id}`;
      for (const ally of b.allyUnits) {
        const eligible = live(u) && auraAlly(b, ally, u) && ally.def.raw.position === 'RANGED'
          && bodyInKeys(ally, u.rangeKeySet);
        if (!eligible) b.removeBuff(ally, key);
        else if (!ally.findBuff(key)) b.addBuff(ally, { key, source: u, mods: { hpPct: talent.max_hp } });
      }
    };
    for (const ev of ['deploy', 'death', 'tick']) b.on(ev, sync, { owner: u });
  } else if (id === 'char_473_mberry') {
    if (def.skill.id === 'skchr_mberry_2') registerBerryProtection(b, u, def.skill.bb.ep_damage_resistance);
    if (talent) {
      const sync = () => {
        const enough = b.allyUnits.filter(a => live(a) && a.def.profession === 'MEDIC').length >= 2;
        const key = `mulberry:medic:${u.id}`;
        for (const ally of b.allyUnits) {
          const eligible = live(u) && enough && auraAlly(b, ally, u, true) && ally.def.profession === 'MEDIC';
          if (!eligible) b.removeBuff(ally, key);
          else if (!ally.findBuff(key)) b.addBuff(ally, { key, source: u, mods: { atkPct: talent.atk } });
        }
      };
      for (const ev of ['deploy', 'death', 'tick']) b.on(ev, sync, { owner: u });
    }
  }
}
