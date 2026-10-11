// SPDX-License-Identifier: GPL-3.0-or-later
// Exact original components/templates and bounded native dispatch mappings are
// retained in data/arkpedia-eyja-alter-prefabs.json.
import evidence from '../../../data/arkpedia-eyja-alter-prefabs.json' with { type: 'json' };
import { bodyInKeys } from '../body.js';
import { elementIntake } from '../damage.js';
import { COLS, ROWS } from '../constants.js';
import { registerBerryProtection } from './arkpedia-five-star-medic-second.js';

const ID = 'char_1016_agoat2';
const live = a => a?.alive && a.deployed && !a.hidden;
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const rate = (u, cap = 1) => Math.min(cap, u.s.aspd / 100);
const timed = (clip, cap = 1) => (_b, u) => model(u).hits[clip][0] / rate(u, cap);
const globalGrid = Array.from({ length: (ROWS * 2 - 1) * (COLS * 2 - 1) }, (_, i) =>
  [Math.floor(i / (COLS * 2 - 1)) - ROWS + 1, i % (COLS * 2 - 1) - COLS + 1]);
const injury = a => a.elem.burn + a.elem.neural + a.elem.necrosis + a.elem.apoptosis + a.elem.erosion;
const ally = (b, u, a, free = false) => live(a) && a.kind !== 'device'
  && (free || !a.s.flags.untargetable) && b.allySelectable(a, u);
const healable = (b, u, a) => ally(b, u, a) && !a.s.flags.healFree
  && (a === u || !(a.s.flags.noHeal || a.profile?.noHeal));
const global = u => u.skill.active && u.skill.id === 'skchr_agoat2_3' || !!u.mem.eyjaEnding;
const inRange = (u, a) => global(u) || bodyInKeys(a, u.baseRangeKeys);
function candidates(b, u, { all = false, globalRange = global(u), preferFresh = null } = {}) {
  const out = b.allyUnits.filter(a => healable(b, u, a)
    && (globalRange || bodyInKeys(a, u.baseRangeKeys))
    && (all || a.hp < a.s.maxHp - .01 || injury(a) > 0));
  out.sort((a, z) => (preferFresh ? Number(preferFresh.has(a)) - Number(preferFresh.has(z)) : 0)
    || injury(z) - injury(a) || a.hpRatio - z.hpRatio || a.deploySeq - z.deploySeq);
  return out;
}

function heal(b, u, a, scale = 1, periodic = false) {
  if (periodic ? !(a?.alive && a.deployed) : !healable(b, u, a)) return;
  const atk = u.s.atk;
  b.heal(u, a, atk * scale);
  if (!a.s.flags.healFree && (a === u || !(a.s.flags.noHeal || a.profile?.noHeal)))
    b.reduceElement(a, atk * scale * u.def.traitBb.ep_heal_ratio);
}

function healingOverTime(b, u, a, def) {
  const t = def.talents[0]?.bb;
  if (!t || !a.alive || !a.deployed) return;
  let buff = a.findBuff('agoat2_t_1');
  // Native override3 + explicit ON_START snapshot/AssignBuffBlackboard and
  // subsequent cnt increment. Renew lifetime, retain the existing first-pulse
  // clock, latest source ATK snapshot, and one common capped stack counter.
  const data = { atk: u.s.atk, scale: t.heal_scale, ep: def.traitBb.ep_heal_ratio,
    count: Math.min(t.max_stack_cnt, (buff?.data.count ?? 0) + 1) };
  if (buff) { buff.source = u; buff.data = data; buff.timeLeft = t.duration; buff.duration = t.duration; return; }
  b.addBuff(a, { key: 'agoat2_t_1', source: u, duration: t.duration, interval: 1, data,
    onTick: ({ buff: current }) => {
      if (!a.alive || !a.deployed) return;
      const value = current.data.atk * current.data.scale * current.data.count;
      b.heal(current.source, a, value);
      if (!a.s.flags.healFree && (a === current.source || !(a.s.flags.noHeal || a.profile?.noHeal)))
        b.reduceElement(a, value * current.data.ep);
    } });
}
function normalFlight(b, u, a, def, p) {
  const targetSeq = a.deploySeq;
  b.addProjectile({ from: u, target: a, source: u, speed: 7, visual: 'orb',
    data: { arkpediaTrackedVisual: true }, onHit: ({ target }) => {
      if (target.deploySeq !== targetSeq || !healable(b, u, target)) return;
      heal(b, u, target); healingOverTime(b, u, target, def);
    } });
}
function healSequence(b, u, def, initial, info) {
  if (u.mem.eyjaSequenceAttack === info.attackId) return;
  u.mem.eyjaSequenceAttack = info.attackId;
  const seq = u.deploySeq, activation = u.skill.activations, control = u.attackControlEpoch;
  const selected = new Set(), scale = def.skill.bb['attack@heal_scale'];
  const valid = () => live(u) && u.deploySeq === seq && u.skill.active
    && u.skill.activations === activation && u.canAct && !u.s.flags.disarm
    && u.attackControlEpoch === control;
  const pulse = first => {
    if (!valid()) return;
    const target = first && healable(b, u, initial) ? initial : candidates(b, u, { preferFresh: selected })[0];
    if (!target) return;
    selected.add(target); heal(b, u, target, scale); healingOverTime(b, u, target, def);
  };
  pulse(true);
  // One native OnAttack followed by additionalTimes4 at triggerDelta.2. These
  // unborn repetitions are still part of this caster's interrupted attack;
  // they are not independent projectiles or additional normal attack cycles.
  for (let i = 1; i <= 4; i++) b.after(i * .2, () => pulse(false), { owner: u });
}
function syncHpAura(b) {
  for (const a of b.allyUnits) {
    const producers = [...(b._arkpediaEyjaAlter ?? new Map()).values()].filter(u =>
      live(u) && u.def.talents[1]?.bb && ally(b, u, a) && inRange(u, a));
    producers.sort((x, z) => z.def.talents[1].bb.max_hp * auraScale(z)
      - x.def.talents[1].bb.max_hp * auraScale(x) || x.deploySeq - z.deploySeq);
    const strongest = producers[0], old = a.findBuff('agoat2_t_2[maxhp]');
    if (!strongest) b.removeBuff(a, 'agoat2_t_2[maxhp]');
    else {
      const value = strongest.def.talents[1].bb.max_hp * auraScale(strongest);
      if (old?.source !== strongest || old.mods.hpPct !== value)
        b.addBuff(a, { key: 'agoat2_t_2[maxhp]', source: strongest, mods: { hpPct: value } });
    }
  }
}
function auraScale(u) { return global(u) ? u.def.skill.bb.talent_scale : 1; }
function syncOwner(b, u, syncProtection) {
  const entry = b._arkpediaBerryProtection?.get(u.id);
  if (entry) entry.value = u.def.talents[1].bb.ep_damage_resistance * auraScale(u);
  syncProtection?.(); syncHpAura(b);
  for (const a of b.allyUnits) {
    const key = `agoat2_s_1[aura]:${u.id}`;
    const eligible = live(u) && u.skill.active && u.skill.id === 'skchr_agoat2_1'
      && ally(b, u, a, true) && bodyInKeys(a, u.baseRangeKeys);
    if (!eligible) b.removeBuff(a, key);
    else if (!a.findBuff(key)) b.addBuff(a, { key, source: u, interval: 1, onTick: () => {
      if (live(u) && u.skill.active && ally(b, u, a, true) && bodyInKeys(a, u.baseRangeKeys))
        b.reduceElement(a, u.s.atk * u.def.skill.bb['agoat2_s_1[aura].ep_heal_ratio']);
    } });
  }
}
function clearCast(b, u, cast) {
  if (u.mem.eyjaCast !== cast) return;
  u.mem.eyjaCast = null; b.removeBuff(u, 'eyja:cast'); u.mem.regularFormVisual = null;
}
function shieldCast(b, u, def) {
  const clip = 'Skill_2', speed = rate(u, Infinity), seq = u.deploySeq;
  const activation = u.skill.activations, cast = {};
  u.mem.eyjaCast = cast; u.mem.regularFormVisual = { clip, loop: false, speed };
  const total = model(u).durations[clip] / speed;
  b.addBuff(u, { key: 'eyja:cast', duration: total, flags: { disarm: true, noSp: true } });
  const control = u.attackControlEpoch;
  let interrupted = false;
  const valid = () => !interrupted && live(u) && u.mem.eyjaCast === cast
    && u.deploySeq === seq && u.skill.activations === activation
    && u.canAct && u.attackControlEpoch === control;
  const watch = b.every(b.dt, () => {
    if (!valid()) { interrupted = true; clearCast(b, u, cast); watch.cancel(); }
  }, { owner: u });
  b.after(model(u).hits[clip][0] / speed, () => {
    if (!valid()) { clearCast(b, u, cast); return; }
    for (const a of candidates(b, u, { all: true })) heal(b, u, a);
    // Shared pool belongs to the original source, not an independent barrier
    // per ally. Recast renews selected lifetime and replaces cached ATK value.
    u.mem.eyjaBarrier = { value: u.s.atk * def.skill.bb['agoat2_s_2[shield].atk_scale'],
      endAt: b.time + def.skill.bb.duration, nextCheck: b.time + .1 };
  }, { owner: u });
  b.after(total, () => { watch.cancel(); clearCast(b, u, cast); }, { owner: u });
}
function visualBegin(b, u, index) {
  const seq = u.deploySeq, activation = u.skill.activations, clip = `Skill_${index}_Begin`;
  u.mem.regularFormVisual = { clip, loop: false };
  b.after(model(u).durations[clip], () => {
    if (live(u) && u.deploySeq === seq && u.skill.active && u.skill.activations === activation)
      u.mem.regularFormVisual = { clip: `Skill_${index}_Idle`, loop: true };
  }, { owner: u });
}

export function customizeEyjaAlterKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null;
  kit.trait = { attack: 'ranged', dmgType: 'heal', heal: null, projectile: 'none',
    maxTargets: 1, hits: 1, canHitFly: true, hitAllBlocked: false, install: null,
    attackVisual: 'Attack', windup: timed('Attack'), retargetOnRelease: true,
    interruptOnSkillChange: true,
    acquireTargets: (battle, unit, p) => candidates(battle, unit).slice(0,
      (p.eyjaTwoTargets ? 2 : 1) + Math.max(0, Math.floor(unit.s.maxTargets))),
    launchAttack: (battle, unit, p, target, info) => p.eyjaSequence
      ? healSequence(battle, unit, def, target, info) : normalFlight(battle, unit, target, def, p) };
  const s = def.skill, index = Number(s.id.at(-1));
  if (index === 1) kit.skill = { kind: 'toggle', trigger: 'SP_FULL', duration: Infinity,
    mods: { atkPct: s.bb.atk }, attack: { attackVisual: 'Skill_1_Loop',
      windup: timed('Skill_1_Loop'), retargetOnRelease: false, eyjaTwoTargets: true },
    onStart: () => { visualBegin(b, u, 1); u.mem.eyjaSync?.(); },
    onEnd: () => { u.mem.regularFormVisual = null; u.mem.eyjaSync?.(); } };
  else if (index === 2) kit.skill = { kind: 'charges', charges: 1,
    canActivate: () => !u.mem.eyjaCast && u.canAct && !u.s.flags.disarm,
    onStart: () => shieldCast(b, u, def) };
  else kit.skill = { kind: 'duration', duration: s.duration,
    targeting: { rangeGrid: globalGrid, noRangeExtend: true },
    attack: { attackVisual: 'Skill_3_Loop', windup: timed('Skill_3_Loop'),
      retargetOnRelease: false, eyjaSequence: true },
    onStart: () => { u.mem.eyjaEnding = false; visualBegin(b, u, 3); u.mem.eyjaSync?.(); },
    onEnd: ({ reason }) => {
      if (!live(u) || reason === 'death') { u.mem.eyjaEnding = false; u.mem.regularFormVisual = null; u.mem.eyjaSync?.(); return; }
      const seq = u.deploySeq, activation = u.skill.activations;
      u.mem.eyjaEnding = true; u.profile.noAttack = true;
      u.mem.regularFormVisual = { clip: 'Skill_3_End', loop: false };
      u.mem.eyjaSync?.();
      // Empty eventless End ability produces no heal. Explicit original .5s
      // end-marker fallback bounds the global T2/end mode instead of guessing
      // an OnAttack event that is absent from the original .333s End clip.
      b.after(.5, () => {
        if (u.deploySeq !== seq || u.skill.activations !== activation) return;
        u.mem.eyjaEnding = false; u.profile.noAttack = false;
        u.mem.regularFormVisual = null; u.mem.eyjaSync?.();
      }, { owner: u });
    } };
  kit.skill.id = s.id; kit.skill.name = s.name;
}

export function installEyjaAlter({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  (b._arkpediaEyjaAlter ??= new Map()).set(u.id, u);
  const t = def.talents[1]?.bb;
  const protection = t ? registerBerryProtection(b, u, t.ep_damage_resistance,
    a => inRange(u, a), () => live(u)) : null;
  u.mem.eyjaSync = () => syncOwner(b, u, protection);
  for (const event of ['deploy', 'tick', 'skillStart', 'skillEnd', 'death'])
    b.on(event, u.mem.eyjaSync, { owner: u });
  b.on('tick', () => {
    const pool = u.mem.eyjaBarrier;
    if (!pool || !live(u) || b.time < pool.nextCheck - 1e-9) return;
    pool.nextCheck += .1;
    // Source checker does not interrupt Shield during in_skill, and checks
    // strict value<0. An exactly empty pool survives until its next incoming hit.
    if (!u.mem.eyjaCast && (pool.value < 0 || b.time >= pool.endAt - 1e-9)) u.mem.eyjaBarrier = null;
  }, { owner: u });
  b.on('elementHit', ({ target, dmg }) => {
    const pool = u.mem.eyjaBarrier;
    if (!pool || !live(u) || !ally(b, u, target) || !bodyInKeys(target, u.baseRangeKeys)
      || dmg.cancel || dmg.type !== 'element') return;
    const factor = dmg.mul * elementIntake(target), incoming = dmg.amount * factor;
    if (!(incoming > 0) || !(factor > 0)) return;
    const blocked = Math.min(incoming, Math.max(0, pool.value));
    pool.value -= incoming;
    dmg.amount = (incoming - blocked) / factor;
  }, { owner: u, priority: -2000 });
  b.on('death', ({ unit }) => {
    if (unit === u) {
      u.mem.eyjaBarrier = null; u.mem.eyjaCast = null; u.mem.eyjaEnding = false;
      u.mem.regularFormVisual = null; u.profile.noAttack = false;
    }
    u.mem.eyjaSync();
  }, { owner: u });
  u.mem.eyjaSync();
}
