// SPDX-License-Identifier: GPL-3.0-or-later
// Full native graphs and explicit dispatch limits: data/arkpedia-chen-prefabs.json.
import evidence from '../../../data/arkpedia-chen-prefabs.json' with { type: 'json' };
import { acquireTargets, effectiveProfile, resolveHit } from '../ai.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
const ID = 'char_010_chen';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = (u, cap = Infinity) => Math.min(cap, u.s.aspd / 100);
const plain = { attack: 'melee', projectile: 'none', dmgType: 'phys',
  canHitFly: false, hits: 1, hitsFn: null, maxTargets: 1, splashRadius: 0,
  chain: null, dmgMul: null, applyWay: 'melee' };
function clearCast(b, u, state) {
  if (!state || u.mem.chenCast !== state) return;
  state.watch?.cancel(); u.mem.chenCast = null;
  b.removeBuff(u, 'chen:cast');
  u.mem.regularFormVisual = null; u.mem.regularAttackFacing = null;
}
function castValid(u, state) {
  return live(u) && u.mem.chenCast === state && u.deploySeq === state.seq
    && u.attackControlEpoch === state.epoch && u.canAct;
}
function stateFor(b, u, n, playback, clip, endClip, front) {
  const state = { seq: u.deploySeq, epoch: u.attackControlEpoch,
    activation: u.skill.activations, n, rate: playback, emitted: false };
  u.mem.chenCast = state; u.mem.chenBegun = false;
  u.mem.regularAttackFacing = front ? 'Front' : null;
  u.mem.regularFormVisual = { clip, loop: false, ...(front ? { forceFront: true } : {}) };
  const m = front ? evidence.models[ID].Front : model(u);
  state.duration = (m.durations[clip] + m.durations[endClip]) / playback;
  state.watch = b.every(b.dt, () => {
    if (!castValid(u, state)) {
      if (u.skill.active && u.skill.activations === state.activation) u.skill.end('interrupt');
      clearCast(b, u, state);
    }
  }, { owner: u });
  b.after(m.durations[clip] / playback, () => {
    if (castValid(u, state)) u.mem.regularFormVisual = {
      clip: endClip, loop: false, ...(front ? { forceFront: true } : {}) };
  }, { owner: u });
  b.after(state.duration, () => {
    if (u.mem.chenCast !== state) return;
    if (u.skill.active && u.skill.activations === state.activation) u.skill.end('cast');
    clearCast(b, u, state);
  }, { owner: u });
  return state;
}
function windup(b, u) {
  const charged = u.skill.id === 'skchr_chen_1' && u.skill.pending;
  const playback = rate(u), m = model(u);
  if (charged) {
    stateFor(b, u, 1, playback, 'Skill', 'Skill_End', false);
    // Disarm is added at release, so it cannot cancel the shared attack windup.
    b.addBuff(u, { key: 'chen:cast', flags: { noSp: true } });
    u.mem.chenAttackVisual = 'Skill';
    return m.hits.Skill[0] / playback;
  }
  const opening = !u.mem.chenBegun;
  u.mem.chenAttackRate = playback;
  u.mem.chenAttackVisual = opening ? { begin: 'Attack_Pre', loop: 'Attack',
    beginDuration: m.durations.Attack_Pre / playback } : 'Attack';
  return ((opening ? m.durations.Attack_Pre : 0) + m.hits.Attack[0]) / playback;
}
function strike(b, u, p, e, info) {
  if (!canTargetEnemy(u, e, p)) return false;
  resolveHit(b, u, { ...p, hits: 1, hitsFn: null, chain: null, splashRadius: 0 },
    e, info, e.x, e.y);
  return true;
}
function launch(b, u, p, e, info) {
  const state = u.mem.chenCast;
  if (info.isSkill && state?.n === 1) {
    if (!strike(b, u, p, e, info)) return;
    state.emitted = true;
    if (e.alive) b.applyStatus(e, 'stun', { duration: u.def.skill.bb.stun, source: u });
    b.addBuff(u, { key: 'chen:cast', flags: { disarm: true, noSp: true } });
    state.epoch = u.attackControlEpoch;
    return;
  }
  if (!strike(b, u, p, e, info)) return;
  u.mem.chenBegun = true;
  const seq = u.deploySeq, victimSeq = e.deploySeq, epoch = u.attackControlEpoch,
    activation = u.skill.activations, playback = u.mem.chenAttackRate;
  const times = model(u).hits.Attack;
  b.after((times[1] - times[0]) / playback, () => {
    if (live(u) && u.deploySeq === seq && u.attackControlEpoch === epoch
      && u.skill.activations === activation && u.canAct && !u.s.flags.disarm
      && e.deploySeq === victimSeq) strike(b, u, p, e, info);
  }, { owner: u });
}
function candidates(b, u, n) {
  const s = u.def.skill, p = { ...plain, canHitFly: n === 2 };
  const keys = absoluteRangeKeys(s.rangeGrid, u.tileR, u.tileC, u.dir);
  const out = b.enemiesInKeys(keys, u, p);
  if (n === 3) out.sort((a, z) => Math.hypot(a.x-u.x, a.y-u.y) - Math.hypot(z.x-u.x, z.y-u.y));
  else sortEnemyTargets(b, u, out, null);
  return out;
}
function manualCast(b, u, n) {
  const playback = rate(u, n === 3 ? 1 : Infinity), clip = `Skill_${n}`;
  const state = stateFor(b, u, n, playback, clip, `Skill_End_${n}`, true);
  b.addBuff(u, { key: 'chen:cast', flags: { disarm: true, noSp: true,
    ...(n === 3 ? { invulnerable: true, noBlock: true } : {}) } });
  state.epoch = u.attackControlEpoch;
  u.skill.timeLeft = state.duration;
  const info = { isSkill: true, attackId: ++b._attackSeq };
  const bb = u.def.skill.bb, m = evidence.models[ID].Front;
  const times = n === 2 ? m.hits[clip] : m.hits[clip].slice(0, bb.times);
  for (const [i, time] of times.entries()) b.after(time / playback, () => {
    if (!castValid(u, state) || !u.skill.active) return;
    const p = { ...plain, canHitFly: n === 2, atkScale: bb.atk_scale };
    const legal = candidates(b, u, n);
    if (n === 2) {
      for (const e of legal.slice(0, bb.max_target)) {
        // Extra Arts and primary Physical are separate mitigation receipts.
        strike(b, u, { ...p, dmgType: 'arts' }, e, info);
        strike(b, u, p, e, info);
      }
    } else {
      if (!legal.includes(state.target)) state.target = legal[0];
      if (!state.target) { u.skill.end('no-target'); return; }
      strike(b, u, p, state.target, info);
      if (i === times.length - 1 && state.target.alive)
        b.applyStatus(state.target, 'stun', { duration: bb.stun, source: u });
    }
    state.emitted = true;
  }, { owner: u });
}
export function customizeChenKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  kit.trait = { ...plain, install: null, allInRange: false, hitAllBlocked: false,
    maxTargetsByBlock: false, retargetOnRelease: false, interruptOnSkillChange: true,
    canAttack: () => !u.mem.chenCast, windup: () => windup(b, u),
    attackVisual: () => u.mem.chenAttackVisual, launchAttack: launch };
  const s = def.skill, n = Number(s.id.at(-1));
  kit.skill = n === 1 ? { kind: 'instant', trigger: 'DEFAULT', canActivate: () => !u.mem.chenCast,
    attack: { atkScale: s.bb.atk_scale, retargetOnRelease: true,
      afterAttack: (_b, _u, _targets, meta) => {
        const state = u.mem.chenCast;
        if (state?.n !== 1 || state.emitted) return;
        if (meta.inputTargets.length && meta.inputTargets.every(e => !e.alive)) u.skill.addCharge(1);
        clearCast(b, u, state);
      } } }
    : { kind: 'toggle', attack: { noAttack: true },
      canActivate: () => !u.mem.chenCast && (n === 2 || candidates(b, u, 3).length > 0),
      onStart: () => manualCast(b, u, n),
      onTick: ({ dt, skill }) => { skill.timeLeft = Math.max(0, skill.timeLeft-dt); },
      onEnd: () => clearCast(b, u, u.mem.chenCast) };
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installChen({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  const blade = def.talents.find(t => t.bb.prob != null)?.bb;
  if (blade) b.addBuff(u, { key: 'chen:blade-art', persist: true, allowDead: true,
    mods: { atkPct: blade.atk, defPct: blade.def, dodgePhys: blade.prob } });
  const scolding = def.talents.find(t => t.bb.interval != null)?.bb;
  const recipients = new Set(), key = `chen:scolding:${u.id}`;
  const sync = () => {
    for (const a of recipients) if (!live(u) || !live(a)) {
      b.removeBuff(a, key); recipients.delete(a);
    }
    if (!scolding || !live(u)) return;
    for (const a of b.units) if (live(a) && a.side === 'ally' && a.skill
      && ['attack', 'hurt'].includes(a.skill.spType) && !recipients.has(a)) {
      recipients.add(a);
      b.addBuff(a, { key, source: u, interval: scolding.interval,
        onTick: () => { if (live(u) && live(a)) a.skill.gainSp(scolding.sp, 'talent'); } });
    }
  };
  b.on('deploy', sync, { owner: u });
  b.on('tick', () => {
    sync();
    if (!live(u)) return;
    if (!u.canAct || !acquireTargets(b, u, effectiveProfile(u)).length) u.mem.chenBegun = false;
  }, { owner: u });
  b.on('beforeStatus', ctx => {
    if (ctx.target === u && u.mem.chenCast?.n === 3 && castValid(u, u.mem.chenCast)
      && ['stun', 'freeze'].includes(ctx.status)) ctx.cancel = true;
  }, { owner: u });
  b.on('death', ({ unit }) => {
    if (unit !== u) return;
    clearCast(b, u, u.mem.chenCast); sync();
  }, { owner: u });
}
