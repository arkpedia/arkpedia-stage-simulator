// SPDX-License-Identifier: GPL-3.0-or-later
// Native graph, literal animation events and dispatch limits are preserved in
// data/arkpedia-chongyue-prefabs.json. Modules are not enabled.
import evidence from '../../../data/arkpedia-chongyue-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
const ID = 'char_2024_chyue';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const plain = { attack: 'melee', projectile: 'none', dmgType: 'phys', canHitFly: false,
  hits: 1, hitsFn: null, maxTargets: 1, splashRadius: 0, chain: null, dmgMul: null, applyWay: 'melee' };
const marked = e => e.buffs.some(f => f.key.startsWith('chyue_t_1_passive:'));
function candidates(b, u, grid = u.rangeGrid, fly = false) {
  const out = b.enemiesInKeys(absoluteRangeKeys(grid, u.tileR, u.tileC, u.dir), u,
    { ...plain, canHitFly: fly });
  sortEnemyTargets(b, u, out, null); return out;
}
function idle(u) {
  u.mem.regularFormVisual = u.mem.chongChanged
    ? { clip: 'Skill_3_Idle', loop: true, attack: 'Skill_3_Loop_A' } : null;
}
function refund(b, u) {
  if (live(u) && u.mem.chongKillUntil >= b.time) {
    const t = u.def.talents.find(t => t.bb.sp != null);
    if (t) u.skill.gainSp(t.bb.sp, 'init'); // Native forceFlag bypasses 阻回.
  }
  u.mem.chongKillUntil = -Infinity;
}
function clear(b, u, state, giveSp = true) {
  if (!state || u.mem.chongCast !== state) return;
  state.watch?.cancel(); u.mem.chongCast = null;
  b.removeBuff(u, 'chong:cast'); b.removeBuff(u, 'chong:sp-lock');
  if (giveSp) refund(b, u);
  idle(u);
}
function valid(u, state) {
  return live(u) && u.mem.chongCast === state && u.deploySeq === state.seq
    && u.attackControlEpoch === state.epoch && u.canAct;
}
function strike(b, u, e, scale, info, fly = false) {
  if (!e || !canTargetEnemy(u, e, { ...plain, canHitFly: fly })) return false;
  resolveHit(b, u, { ...plain, atkScale: scale, canHitFly: fly,
    tags: info.chongSlam ? ['chong:slam'] : [] }, e, info, e.x, e.y);
  return true;
}
function basicWindup(b, u) {
  const suffix = u.stats.attacks % 2 ? 'A' : 'B';
  const clip = u.mem.chongChanged ? 'Skill_3_Loop_' + suffix : 'Attack_' + suffix;
  u.mem.chongAttack = { clip, rate: u.s.aspd / 100 };
  return model(u).hits[clip][0] / u.mem.chongAttack.rate;
}
function basicLaunch(b, u, p, e, info) {
  strike(b, u, e, 1, info);
  if (!u.mem.chongChanged) return;
  const seq = u.deploySeq, targetSeq = e.deploySeq, epoch = u.attackControlEpoch,
    activation = u.skill.activations;
  // Native MultiAttack uses triggerDelta=0, not a second Spine hit event.
  // Queue the derived hit; a ready automatic S3 can interrupt it between steps.
  b.after(0, () => {
    if (live(u) && u.deploySeq === seq && e.deploySeq === targetSeq && u.canAct
      && !u.s.flags.disarm && u.attackControlEpoch === epoch && u.skill.activations === activation)
      strike(b, u, e, 1, info);
  }, { owner: u });
}
function transform(b, u) {
  u.mem.chongChanged = true;
  u.rangeGrid = evidence.tables.ranges['x-6'].grids.map(p => [p.row, p.col]);
  b.refreshRange(u);
}
function manual(b, u, n) {
  const s = u.def.skill, m = model(u), rate = n === 1 ? u.s.aspd / 100 : 1;
  const charged = n === 1 && u.skill.charges === 2;
  // Native ClearCharacterSp runs during the cast, when the general setter is
  // locked. Consume the remaining two charges explicitly in this owned kit.
  if (charged) { u.skill.charges = 0; u.skill.sp = 0; }
  const wasChanged = !!u.mem.chongChanged;
  if (n === 3) {
    u.mem.chongCasts = (u.mem.chongCasts ?? 0) + 1;
    if (!wasChanged && u.mem.chongCasts === s.bb.cast_cnt) transform(b, u);
  }
  const clip = n === 1 ? charged ? 'Skill_1_Charged' : 'Skill_1'
    : n === 2 ? 'Skill_2_Begin' : wasChanged ? 'Skill_3_Charged'
    : u.mem.chongChanged ? 'Skill_3_Change' : 'Skill_3';
  const duration = n === 2 ? m.durations.Skill_2_Begin + m.durations.Skill_2_End : m.durations[clip] / rate;
  const state = { n, seq: u.deploySeq, activation: u.skill.activations };
  u.mem.chongCast = state; u.mem.regularFormVisual = { clip, loop: false, speed: rate };
  b.addBuff(u, { key: 'chong:cast', flags: { disarm: true } });
  b.addBuff(u, { key: 'chong:sp-lock', flags: { noSp: true } });
  state.epoch = u.attackControlEpoch; u.skill.timeLeft = duration; u.skill.duration = duration;
  const info = { isSkill: true, attackId: ++b._attackSeq };
  state.watch = b.every(b.dt, () => {
    if (!valid(u, state)) {
      if (u.skill.active && u.skill.activations === state.activation) u.skill.end('interrupt');
      clear(b, u, state);
    }
  }, { owner: u });
  b.after(duration, () => {
    if (u.mem.chongCast !== state) return;
    if (u.skill.active && u.skill.activations === state.activation) u.skill.end('cast');
    clear(b, u, state);
    if (n >= 2 && live(u)) u.atkCd = 0;
  }, { owner: u });
  if (n === 1) {
    const target = candidates(b, u)[0];
    b.after(m.hits[clip][0] / rate, () => {
      if (!valid(u, state)) return;
      for (let i = 0; i < (charged ? s.bb.times : 1); i++) strike(b, u, target, s.bb.atk_scale, info);
    }, { owner: u });
    return;
  }
  if (n === 2) {
    const initial = candidates(b, u, s.rangeGrid, true);
    initial.sort((a, z) => Number(marked(z)) - Number(marked(a)));
    const targets = initial.slice(0, s.bb.max_target);
    b.after(m.hits.Skill_2_Begin[0], () => {
      if (!valid(u, state)) return;
      for (const e of targets) {
        const issued = strike(b, u, e, s.bb.atk_scale, info, true);
        if (issued && live(e) && marked(e) && e.motion !== 'FLY') b.applyStatus(e, 'levitate', { source: u, duration: 2 });
      }
    }, { owner: u });
    const handoff = m.durations.Skill_2_Begin;
    b.after(handoff, () => {
      if (!valid(u, state)) return;
      // SecAttack is outside the skill window and has its own ability-finish SP refund.
      u.skill.end('phase'); b.removeBuff(u, 'chong:sp-lock'); refund(b, u);
      u.mem.regularFormVisual = { clip: 'Skill_2_End', loop: false };
    }, { owner: u });
    b.after(handoff + m.hits.Skill_2_End[0], () => {
      if (!valid(u, state)) return;
      for (const e of candidates(b, u, s.rangeGrid, true).filter(e => e.s.flags.levitate)) {
        for (const f of [...e.buffs]) if (f.flags?.levitate) b.removeBuff(e, f.key);
        strike(b, u, e, s.bb.atk_scale_down, { ...info, chongSlam: true }, true);
      }
    }, { owner: u });
    return;
  }
  // Immediate native projectile: one 0.8-radius ground-only blast, or two
  // blasts at the first projectile's coordinates after the transformation.
  const input = candidates(b, u)[0], fallback = input ? { x: input.x, y: input.y } : { x: u.x, y: u.y };
  b.after(m.hits[clip][0], () => {
    if (!valid(u, state)) return;
    const target = wasChanged ? input : candidates(b, u)[0];
    const at = live(target) ? target : fallback, x = at.x, y = at.y;
    for (let i = 0; i < (wasChanged ? 2 : 1); i++) {
      for (const e of b.enemiesInRadius(x, y, .8)) strike(b, u, e, s.bb.atk_scale, info);
    }
  }, { owner: u });
}
export function customizeChongyueKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  kit.trait = { ...plain, install: null, allInRange: false, hitAllBlocked: false,
    maxTargetsByBlock: false, retargetOnRelease: false, interruptOnSkillChange: true,
    canAttack: () => !u.mem.chongCast, windup: () => basicWindup(b, u),
    attackVisual: () => u.mem.chongAttack.clip, launchAttack: basicLaunch,
    afterAttack: () => { if (live(u) && u.mem.chongChanged && !u.mem.chongCast) u.skill.gainSp(1, 'init'); } };
  const s = def.skill, n = Number(s.id.at(-1));
  kit.skill = { kind: 'toggle', trigger: 'NEVER', charges: n === 1 ? 3 : n === 2 ? 2 : 1,
    attack: { noAttack: true },
    canActivate: () => !u.mem.chongCast && (n !== 1 || candidates(b, u).length > 0)
      && (!u.mem.chongChanged || candidates(b, u).length > 0),
    chargedState: () => n === 1 && u.skill.charges === 3,
    onStart: () => manual(b, u, n),
    onTick: ({ dt, skill }) => { skill.timeLeft = Math.max(0, skill.timeLeft - dt); },
    onEnd: ({ reason }) => { if (reason !== 'phase') clear(b, u, u.mem.chongCast, !['death','retreat'].includes(reason)); },
    id: s.id, name: s.name };
}
export function installChongyue({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  const baseRange = u.rangeGrid, key = 'chyue_t_1_passive:' + u.id,
    t1 = def.talents.find(t => t.bb.prob != null)?.bb, skillKills = new WeakSet();
  b.on('damageFinal', c => {
    if (c.source !== u || !t1) return;
    if (c.dmg.tags?.includes('chong:slam') || c.dmg.isAttack && !c.dmg.isSkill && b.rng() < t1.prob)
      b.addBuff(c.target, { key, duration: t1.up_duration, source: u, data: { chongMark: true } });
    if (c.target.findBuff(key)) c.amount *= t1.damage_scale;
  }, { owner: u });
  b.on('damaged', ({ source, target, dmg }) => {
    if (source === u && dmg?.isSkill && target.hp <= 0) skillKills.add(target);
  }, { owner: u });
  b.on('kill', ({ killer, victim }) => {
    if (killer === u && skillKills.has(victim)) u.mem.chongKillUntil = b.time + 2;
    skillKills.delete(victim);
  }, { owner: u });
  b.on('tick', () => {
    if (live(u) && u.mem.chongChanged && !u.mem.chongCast && candidates(b, u).length)
      u.skill.activate('chongyue-source-auto');
  }, { owner: u });
  b.on('death', ({ unit }) => {
    if (unit !== u) return;
    clear(b, u, u.mem.chongCast, false); u.mem.chongKillUntil = -Infinity;
    u.mem.chongCasts = 0; u.mem.chongChanged = false; u.rangeGrid = baseRange; idle(u);
  }, { owner: u });
}
