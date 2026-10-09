// SPDX-License-Identifier: GPL-3.0-or-later
// Source graph, bindings and dispatch limits: data/arkpedia-irene-prefabs.json.
import evidence from '../../../data/arkpedia-irene-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
const ID = 'char_4009_irene';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => u.s.aspd / 100;
const plain = { attack: 'melee', projectile: 'none', dmgType: 'phys',
  canHitFly: false, hits: 1, hitsFn: null, maxTargets: 1, splashRadius: 0,
  chain: null, dmgMul: null, applyWay: 'melee' };
function clear(b, u, state) {
  if (!state || u.mem.ireneCast !== state) return;
  state.watch?.cancel(); u.mem.ireneCast = null;
  b.removeBuff(u, 'irene:cast'); u.mem.regularFormVisual = null;
}
function valid(u, state) {
  return live(u) && u.mem.ireneCast === state && u.deploySeq === state.seq
    && u.attackControlEpoch === state.epoch && u.canAct;
}
function begin(b, u, n, clip, playback, duration) {
  const state = { n, seq: u.deploySeq, epoch: u.attackControlEpoch,
    activation: u.skill.activations, rate: playback, duration, emitted: false };
  u.mem.ireneCast = state; u.mem.regularFormVisual = { clip, loop: false };
  state.watch = b.every(b.dt, () => {
    if (!valid(u, state)) {
      if (u.skill.active && u.skill.activations === state.activation) u.skill.end('interrupt');
      clear(b, u, state);
    }
  }, { owner: u });
  b.after(duration, () => {
    if (u.mem.ireneCast !== state) return;
    if (u.skill.active && u.skill.activations === state.activation) u.skill.end('cast');
    clear(b, u, state);
  }, { owner: u });
  return state;
}
function strike(b, u, e, scale, info, retained = false) {
  const p = { ...plain, atkScale: scale, canHitFly: retained };
  if (!canTargetEnemy(u, e, p)) return false;
  resolveHit(b, u, p, e, info, e.x, e.y); return true;
}
function levitate(b, u, e) {
  if (live(e)) b.applyStatus(e, 'levitate', { source: u, duration: u.def.skill.bb.levitate });
}
function windup(b, u) {
  const charged = u.skill.id === 'skchr_irene_1' && u.skill.pending;
  const playback = rate(u), m = model(u), clip = charged ? 'Skill_1' : 'Attack';
  u.mem.ireneAttackRate = playback; u.mem.ireneAttackVisual = clip;
  if (charged) {
    begin(b, u, 1, clip, playback, m.durations[clip] / playback);
    b.addBuff(u, { key: 'irene:cast', flags: { noSp: true } });
  }
  return m.hits[clip][0] / playback;
}
function launch(b, u, p, e, info) {
  const state = info.isSkill ? u.mem.ireneCast : null;
  const charged = state?.n === 1, clip = charged ? 'Skill_1' : 'Attack';
  const scale = charged ? u.def.skill.bb.atk_scale : 1;
  if (!strike(b, u, e, scale, info)) return;
  if (charged) {
    state.emitted = true;
    // Damage then Levitate is the local dispatch order; the native C# body is unavailable.
    levitate(b, u, e);
    b.addBuff(u, { key: 'irene:cast', flags: { disarm: true, noSp: true } });
    state.epoch = u.attackControlEpoch;
  }
  const seq = u.deploySeq, victimSeq = e.deploySeq, epoch = u.attackControlEpoch,
    activation = u.skill.activations, playback = u.mem.ireneAttackRate;
  const times = model(u).hits[clip];
  b.after((times[1] - times[0]) / playback, () => {
    if (!live(u) || u.deploySeq !== seq || u.attackControlEpoch !== epoch
      || u.skill.activations !== activation || !u.canAct || e.deploySeq !== victimSeq) return;
    if (charged ? !valid(u, state) : u.s.flags.disarm) return;
    // The second hit keeps this victim, including a newly levitated victim; it never acquires a second enemy.
    strike(b, u, e, scale, info, true);
  }, { owner: u });
}
function candidates(b, u, fly = false) {
  const keys = absoluteRangeKeys(u.def.skill.rangeGrid, u.tileR, u.tileC, u.dir);
  const out = b.enemiesInKeys(keys, u, { ...plain, canHitFly: fly });
  sortEnemyTargets(b, u, out, null); return out;
}
function manual(b, u, n) {
  const m = model(u), playback = n === 3 ? 1 : rate(u), bb = u.def.skill.bb;
  // Authored PRTS notes give 3.5 s. Native sequence C# handoff is not recovered.
  const duration = n === 3 ? 3.5 : m.durations.Skill_2 / playback;
  const state = begin(b, u, n, n === 3 ? 'Skill_3_Start' : 'Skill_2', playback, duration);
  const initial = candidates(b, u).slice(0, n === 2 ? bb.max_target : Infinity);
  const info = { isSkill: true, attackId: ++b._attackSeq };
  b.addBuff(u, { key: 'irene:cast', flags: { disarm: true, noSp: true } });
  state.epoch = u.attackControlEpoch; u.skill.timeLeft = duration;
  const hitTime = m.hits[n === 3 ? 'Skill_3_Start' : 'Skill_2'][0] / playback;
  b.after(hitTime, () => {
    if (!valid(u, state) || !u.skill.active) return;
    for (const e of initial) if (strike(b, u, e, bb.atk_scale, info)) {
      if (n === 3 || e.s.massLevel <= bb.value) levitate(b, u, e);
    }
    state.emitted = true;
  }, { owner: u });
  if (n !== 3) return;
  const start = m.durations.Skill_3_Start;
  b.after(start, () => {
    if (valid(u, state)) u.mem.regularFormVisual = { clip: 'Skill_3_Attack', loop: false };
  }, { owner: u });
  // Native MultiAttack disables attack-event waits. Use rank blackboards, not the six Spine events.
  for (let i = 0; i < bb.multi_times; i++) b.after(start + i * bb.multi_hit_interval, () => {
    if (!valid(u, state) || !u.skill.active) return;
    const pool = candidates(b, u, true);
    if (!pool.length) return;
    const e = pool[Math.floor(b.rng() * pool.length)], x = e.x, y = e.y;
    b.fx('explode', { x, y, radius: 1.1 });
    for (const victim of b.enemiesInRadius(x, y, 1.1))
      strike(b, u, victim, bb.multi_atk_scale, info, true);
  }, { owner: u });
}
export function customizeIreneKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  kit.trait = { ...plain, install: null, allInRange: false, hitAllBlocked: false,
    maxTargetsByBlock: false, retargetOnRelease: false, interruptOnSkillChange: true,
    canAttack: () => !u.mem.ireneCast, windup: () => windup(b, u),
    attackVisual: () => u.mem.ireneAttackVisual, launchAttack: launch };
  const s = def.skill, n = Number(s.id.at(-1));
  kit.skill = n === 1 ? { kind: 'instant', trigger: 'DEFAULT', canActivate: () => !u.mem.ireneCast,
    attack: { atkScale: s.bb.atk_scale,
      afterAttack: (_b, _u, _targets, meta) => {
        const state = u.mem.ireneCast;
        if (state?.n !== 1 || state.emitted) return;
        if (meta.inputTargets.length && meta.inputTargets.every(e => !e.alive)) u.skill.addCharge(1);
        clear(b, u, state);
      } } }
    : { kind: 'toggle', attack: { noAttack: true },
      canActivate: () => !u.mem.ireneCast && candidates(b, u, n === 3).length > 0,
      onStart: () => manual(b, u, n),
      onTick: ({ dt, skill }) => { skill.timeLeft = Math.max(0, skill.timeLeft - dt); },
      onEnd: () => clear(b, u, u.mem.ireneCast) };
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installIrene({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  const t1 = def.talents.find(t => t.bb.prob != null)?.bb;
  const t2 = def.talents.find(t => t.bb.attack_speed != null)?.bb;
  if (t1) {
    b.on('hit', ({ source, target, dmg }) => {
      if (source !== u || dmg.type !== 'phys') return;
      if (target.motion === 'FLY' || target.s.flags.levitate || b.rng() < t1.prob)
        u.mem.irenePenetration = true;
      if (u.mem.irenePenetration) dmg.defIgnorePct += t1.def_penetrate;
    }, { owner: u });
    // Original derived penetration survives a dodge and is consumed after output damage.
    b.on('damaged', ({ source, dmg }) => {
      if (source === u && dmg?.type === 'phys') u.mem.irenePenetration = false;
    }, { owner: u });
  }
  if (t2) b.addBuff(u, { key: 'irene:cleansing', persist: true, allowDead: true,
    mods: { aspd: t2.attack_speed } });
  let doubled = false;
  b.on('tick', () => {
    const present = !!t2 && live(u) && b.enemies.some(e => live(e)
      && (e.tags.has('seamonster') || e.def.tags?.includes('seamonster')));
    if (present !== doubled) {
      doubled = present;
      if (present) b.addBuff(u, { key: 'irene:sea-monster', mods: { aspd: t2.attack_speed } });
      else b.removeBuff(u, 'irene:sea-monster');
    }
  }, { owner: u });
  b.on('death', ({ unit }) => {
    if (unit === u) { clear(b, u, u.mem.ireneCast); u.mem.irenePenetration = false; }
  }, { owner: u });
}
