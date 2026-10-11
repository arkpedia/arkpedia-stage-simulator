// SPDX-License-Identifier: GPL-3.0-or-later
// Native graphs and bounded dispatch choices: data/arkpedia-vulpis-prefabs.json.
import evidence from '../../../data/arkpedia-vulpis-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { isHpLoss } from '../damage.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
const ID = 'char_4026_vulpis';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => Math.min(1, u.s.aspd / 100);
const s3 = u => u.skill?.active && u.skill.id === 'skchr_vulpis_3';
const clip3 = (u, part) => `Skill_${u.dir === 'DOWN' ? 'Down_' : ''}3_${part}`;
const plain = { attack: 'melee', projectile: 'none', dmgType: 'phys',
  canHitFly: false, hits: 1, hitsFn: null, maxTargets: 1, splashRadius: 0,
  chain: null, dmgMul: null, applyWay: 'melee' };
function clearCast(b, u, state = u.mem.vulpisCast) {
  if (!state || u.mem.vulpisCast !== state) return;
  state.watch?.cancel(); u.mem.vulpisCast = null;
  b.removeBuff(u, 'vulpis:cast');
  u.mem.regularFormVisual = null;
}
function castValid(u, state) {
  return live(u) && u.mem.vulpisCast === state && u.deploySeq === state.seq
    && u.attackControlEpoch === state.epoch && u.canAct;
}
function castState(b, u, n, clip, lock) {
  const state = { n, seq: u.deploySeq, activation: u.skill.activations,
    playback: rate(u), emitted: false };
  u.mem.vulpisCast = state;
  b.addBuff(u, { key: 'vulpis:cast', flags: { noSp: true, ...(lock ? { disarm: true } : {}) } });
  state.epoch = u.attackControlEpoch;
  u.mem.regularFormVisual = { clip, loop: false, speed: state.playback };
  state.duration = model(u).durations[clip] / state.playback;
  state.watch = b.every(b.dt, () => {
    if (!castValid(u, state)) {
      if (u.skill.active && u.skill.activations === state.activation) u.skill.end('interrupt');
      clearCast(b, u, state);
    }
  }, { owner: u });
  b.after(state.duration, () => {
    if (u.mem.vulpisCast !== state) return;
    if (u.skill.active && u.skill.activations === state.activation) u.skill.end('cast');
    clearCast(b, u, state);
  }, { owner: u });
  return state;
}
function windup(b, u) {
  const charged = u.skill.id === 'skchr_vulpis_1' && u.skill.pending;
  if (charged) {
    const state = castState(b, u, 1, 'Skill_1', false);
    b.addDp(u.ownerId, u.def.skill.bb.cost);
    u.mem.vulpisAttackVisual = 'Skill_1';
    return model(u).hits.Skill_1[0] / state.playback;
  }
  const clip = s3(u) ? clip3(u, 'Loop') : 'Attack';
  u.mem.vulpisAttackVisual = clip;
  return model(u).hits[clip][0] / rate(u);
}
function strike(b, u, p, e, info) {
  if (!canTargetEnemy(u, e, p)) return false;
  resolveHit(b, u, p, e, info, e.x, e.y);
  return true;
}
function launch(b, u, p, e, info) {
  if (!canTargetEnemy(u, e, p)) return;
  const state = u.mem.vulpisCast;
  if (info.isSkill && state?.n === 1) {
    state.emitted = true;
    // This is NORMAL Arts, unlike the talent's non-recursing ADDITION rider.
    strike(b, u, { ...p, dmgType: 'arts', atkScale: u.def.skill.bb.extra_damage_ratio }, e, info);
  } else if (s3(u)) {
    b.applyStatus(e, 'stun', { duration: u.def.skill.bb['attack@stun'], source: u });
  }
  strike(b, u, p, e, info);
}
function s2Targets(b, u) {
  const keys = absoluteRangeKeys(u.def.skill.rangeGrid, u.tileR, u.tileC, u.dir);
  const out = b.enemiesInKeys(keys, u, { ...plain, canHitFly: true });
  sortEnemyTargets(b, u, out, null);
  return out.slice(0, u.def.skill.bb.max_target);
}
function castS2(b, u) {
  const state = castState(b, u, 2, 'Skill_2', true), bb = u.def.skill.bb;
  b.addDp(u.ownerId, bb.cost);
  u.skill.timeLeft = state.duration;
  const info = { isSkill: true, attackId: ++b._attackSeq };
  b.after(model(u).hits.Skill_2[0] / state.playback, () => {
    if (!castValid(u, state) || !u.skill.active) return;
    for (const e of s2Targets(b, u)) {
      const slow = e.buffs.some(x => (x.status ?? x.key) === 'sluggish');
      b.applyStatus(e, 'sluggish', { duration: bb.sluggish, source: u });
      if (slow) b.applyStatus(e, 'stun', { duration: bb.stun, source: u });
      strike(b, u, { ...plain, canHitFly: true, dmgType: 'arts', atkScale: bb.atk_scale }, e, info);
    }
    state.emitted = true;
  }, { owner: u });
}
function camCheck(b, u) {
  const on = live(u) && u.mem.vulpisCam && !u.blocking.length;
  if (on && !u.findBuff('vulpis:camouflage')) b.addBuff(u, {
    key: 'vulpis:camouflage', flags: { camou: true }, status: 'camou', source: u });
  else if (!on) b.removeBuff(u, 'vulpis:camouflage');
}
function clearCam(b, u) {
  u.mem.vulpisCam = false;
  b.removeBuff(u, 'vulpis:cam-check'); b.removeBuff(u, 'vulpis:camouflage');
}
function aspd(b, u) {
  if (!s3(u)) return;
  b.addBuff(u, { key: 'vulpis:aspd', mods: {
    aspd: u.def.skill.bb.attack_speed * Math.max(0, u.skill.timeLeft) / u.skill.duration }, refresh: 'replace' });
}
export function customizeVulpisKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  kit.trait = { ...plain, install: null, allInRange: false, hitAllBlocked: false, attackDrivenSkill: true,
    maxTargetsByBlock: false, retargetOnRelease: false, interruptOnSkillChange: true,
    canAttack: () => !u.mem.vulpisCast && b.time >= (u.mem.vulpisBeginUntil ?? -Infinity),
    windup: () => windup(b, u), attackVisual: () => u.mem.vulpisAttackVisual, launchAttack: launch };
  const s = def.skill, n = Number(s.id.at(-1));
  if (n === 1) kit.skill = { kind: 'instant', charges: 3, trigger: 'DEFAULT',
    canActivate: () => !u.mem.vulpisCast, attack: {
      afterAttack: (_b, _u, _targets, meta) => {
        const state = u.mem.vulpisCast;
        if (!state || state.n !== 1 || state.emitted) return;
        if (meta.inputTargets.length && meta.inputTargets.every(e => !e.alive)) u.skill.addCharge(1);
        clearCast(b, u, state);
      } } };
  else if (n === 2) kit.skill = { kind: 'toggle', charges: 2,
    attack: { noAttack: true }, canActivate: () => !u.mem.vulpisCast,
    onStart: () => castS2(b, u),
    onTick: ({ dt, skill }) => { skill.timeLeft = Math.max(0, skill.timeLeft-dt); },
    onEnd: () => clearCast(b, u) };
  else kit.skill = { kind: 'duration', mods: { atkPct: s.bb.atk },
    targeting: { rangeGrid: s.rangeGrid },
    attack: { maxTargetsByBlock: true, retargetOnRelease: true },
    onStart: () => {
      clearCam(b, u); u.mem.vulpisKill = false;
      b.addDp(u.ownerId, s.bb.cost); aspd(b, u);
      const clip = clip3(u, 'Begin'), activation = u.skill.activations;
      u.mem.regularFormVisual = { clip, loop: false, speed: rate(u) };
      u.mem.vulpisBeginUntil = b.time + model(u).durations[clip] / rate(u);
      b.after(u.mem.vulpisBeginUntil-b.time, () => {
        if (live(u) && s3(u) && u.skill.activations === activation)
          u.mem.regularFormVisual = { clip: clip3(u, 'Idle'), attack: clip3(u, 'Loop'), loop: true };
      }, { owner: u });
    },
    onEnd: () => {
      b.removeBuff(u, 'vulpis:aspd');
      if (!live(u)) { clearCam(b, u); u.mem.regularFormVisual = null; return; }
      if (u.mem.vulpisKill) {
        u.mem.vulpisCam = true; camCheck(b, u);
        b.addBuff(u, { key: 'vulpis:cam-check', interval: .5, onTick: () => camCheck(b, u) });
      }
      const visual = { clip: clip3(u, 'End'), loop: false, speed: rate(u), vulpisEnd: true };
      u.mem.regularFormVisual = visual;
      b.after(model(u).durations[visual.clip] / rate(u), () => {
        if (u.mem.regularFormVisual === visual) u.mem.regularFormVisual = null;
      }, { owner: u });
    } };
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installVulpis({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  const hunt = def.talents.find(t => t.bb.atk_scale != null)?.bb;
  const accel = def.talents.find(t => t.bb.delta_cost_increase_time != null)?.bb;
  const marks = new Map(), key = `vulpis:hunt:${u.id}`;
  u.mem.regularDpRegenScale = accel?.delta_cost_increase_time ?? 1;
  u.mem.vulpisQuietAt = b.time;
  b.on('damageFinal', ctx => {
    if (!live(u) || isHpLoss(ctx.dmg)) return;
    if (accel && ctx.target === u) {
      u.mem.vulpisQuietAt = b.time; b.removeBuff(u, 'vulpis:regen');
    }
    if (!hunt || ctx.source !== u || ctx.target.side !== 'enemy'
      || ctx.dmg.tags.includes('addition')) return;
    const e = ctx.target, old = marks.get(e);
    if (old && b.time >= old.until - 1e-9) return;
    if (!old) {
      marks.set(e, { until: b.time+hunt.interval });
      b.addBuff(e, { key, source: u });
    }
    b.dealDamage(u, e, { amount: u.s.atk*hunt.atk_scale, type: 'arts',
      isSkill: ctx.dmg.isSkill, attackId: ctx.dmg.attackId, tags: ['talent', 'addition', 'vulpis:hunt'] });
  }, { owner: u });
  b.on('beforeAttack', ({ attacker }) => {
    if (attacker !== u) return;
    aspd(b, u);
    // End presentation yields to a real attack without adding gameplay duration.
    if (u.mem.regularFormVisual?.vulpisEnd) u.mem.regularFormVisual = null;
  }, { owner: u });
  b.on('kill', ({ killer, victim }) => {
    if (killer === u && victim.side === 'enemy' && s3(u)) u.mem.vulpisKill = true;
  }, { owner: u });
  b.on('tick', () => {
    if (!live(u) || !accel) return;
    if (b.time-u.mem.vulpisQuietAt >= accel.interval - 1e-9 && !u.findBuff('vulpis:regen'))
      b.addBuff(u, { key: 'vulpis:regen', mods: {
        hpRegenRatio: accel['vulpis_t_2[heal][interval].hp_recovery_per_sec_by_max_hp_ratio'] } });
  }, { owner: u });
  b.on('death', ({ unit }) => {
    if (unit !== u) return;
    clearCast(b, u); clearCam(b, u); b.removeBuff(u, 'vulpis:regen');
    u.mem.regularFormVisual = null;
    for (const e of marks.keys()) b.removeBuff(e, key);
    marks.clear();
  }, { owner: u });
}
