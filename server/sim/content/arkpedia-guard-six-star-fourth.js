// SPDX-License-Identifier: GPL-3.0-or-later
import { GUARD_SIX_STAR_FOURTH_OPERATORS } from '../../../shared/arkpedia/guard-six-star-fourth-operators.js';
import evidence from '../../../data/arkpedia-guard-six-star-fourth-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { absoluteRangeKeys, canTargetEnemy } from '../targeting.js';
import { bodyInKeys, bodyOnTile } from '../body.js';
import { frontOf } from '../dir.js';

const ID = 'char_4082_qiubai';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.originalModels[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const s2 = u => u.skill.active && u.skill.id === 'skchr_qiubai_2';
const s3 = u => u.skill.active && u.skill.id === 'skchr_qiubai_3';
const combat = (u, e) => e.blockedBy === u || bodyOnTile(e, u.tileR, u.tileC)
  || bodyOnTile(e, ...frontOf(u.tileR, u.tileC, u.dir));
const plain = p => ({ ...p, hits: 1, hitsFn: null, chain: null, splashRadius: 0, dmgMul: null });
const bindImmune = e => e.def.immune?.has('bind') || e.def.immune?.has('unmovable');
const opening = e => e.s.flags.bind || e.buffs.some(v => v.status === 'sluggish'
  || v.key === 'sluggish' || v.key === 'sluggish[inf]');

function delayedOpening(b, u, target, scale, info) {
  // Native ON_CALCULATE_DAMAGE creates one DEFAULT .1s marker on the victim;
  // its ON_BUFF_FINISH tests Bind/Sluggish then reads current source ATK.
  const output = () => {
    if (!live(target) || !opening(target)) return;
    b.dealDamage(u, target, { amount: u.s.atk * scale, type: 'arts', applyWay: 'none',
      isAttack: false, isSplash: true, isSkill: info.isSkill, attackId: info.attackId,
      canDodge: true, tags: ['qiubai:opening'] });
  };
  b.addBuff(target, { key: 'qiubai:opening-marker', source: u, duration: .10000000149011612,
    onExpire: output, onRemove: output });
}
function s1Mark(b, u, target, bb, info) {
  if (bindImmune(target)) return;
  b.applyStatus(target, 'bind', { source: u, duration: bb.duration });
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    b.off(death);
    if (bindImmune(target)) return;
    // The native AOEDamage explicitly does not require a living central target.
    // Owner death is mapped to its buff finish; the exact native shutdown frame
    // remains documented alongside the ordinary timer/dispel finish.
    for (const e of b.enemiesInRadius(target.x, target.y, 1.7000000476837158))
      if (canTargetEnemy(u, e, { canHitFly: true }))
        b.dealDamage(u, e, { amount: u.s.atk * bb.aoe_scale, type: 'arts', applyWay: 'none',
          isAttack: false, isSplash: true, isSkill: true, attackId: info.attackId,
          tags: ['qiubai:s1-end'] });
  };
  const death = b.on('death', ({ unit }) => { if (unit === target) finish(); });
  const key = `qiubai:s1-marker:${u.id}`;
  const previous = target.findBuff(key);
  // Replacement is native DEFAULT, not a second independent explosion.
  if (previous?.data?.cancel) previous.data.cancel();
  b.addBuff(target, { key, source: u, duration: bb.duration,
    data: { cancel: () => { finished = true; b.off(death); } },
    onExpire: finish, onRemove: finish });
}
function impact(b, u, p, target, info) {
  if (!canTargetEnemy(u, target, p)) return;
  const talents = u.def.talents, first = talents.find(t => t.bb.atk_scale != null)?.bb;
  const second = talents.find(t => t.bb.prob != null)?.bb;
  // A born unmanaged projectile retains its passive contract after its owner
  // withdraws. Scope an unowned hook to this exact synchronous damage call.
  const hook = b.on('hit', ctx => {
    if (ctx.source !== u || ctx.target !== target || !ctx.dmg.isAttack
      || ctx.dmg.attackId !== info.attackId || ctx.dmg.cancel) return;
    if (p.qiubaiS1) s1Mark(b, u, target, p.qiubaiS1, info);
    if (second && b.rng() < second.prob && !bindImmune(target))
      b.applyStatus(target, 'bind', { source: u, duration: second.duration });
    if (first) delayedOpening(b, u, target, first.atk_scale * (p.qiubaiTalentScale ?? 1), info);
  });
  try { resolveHit(b, u, plain(p), target, info, target.x, target.y); }
  finally { b.off(hook); }
}
function sourceWindup(b, u, targets) {
  const instant = u.skill.pending && u.skill.id === 'skchr_qiubai_1';
  u.mem.qiubaiCombat = !instant && !s3(u) && combat(u, targets[0]);
  u.mem.qiubaiClip = s3(u) ? 'Skill_3_Loop' : u.mem.qiubaiCombat
    ? b.rng.pick(['Combat_A', 'Combat_B']) : 'Attack';
  const speed = s3(u) ? Math.min(1, u.s.aspd / 100) : u.s.aspd / 100;
  return model(u).hits[u.mem.qiubaiClip][0] / speed;
}
function launch(b, u, p, target, info) {
  if (!canTargetEnemy(u, target, p)) return;
  const instant = info.isSkill && u.skill.id === 'skchr_qiubai_1';
  const enhanced = info.isSkill && u.skill.id === 'skchr_qiubai_3';
  const melee = !instant && !enhanced && combat(u, target);
  const hit = { ...plain(p), applyWay: melee ? 'melee' : 'ranged',
    atkScale: (p.atkScale ?? 1) * (melee || enhanced || instant ? 1 : .8),
    qiubaiTalentScale: enhanced ? u.def.skill.bb.talent_scale ?? 1 : 1,
    qiubaiS1: instant ? u.def.skill.bb : null };
  if (instant) u.mem.qiubaiEmitted = info.attackId;
  if (melee) impact(b, u, hit, target, info);
  else b.addProjectile({ from: u, target, source: u, speed: 10, maxAge: instant ? 1 : 10,
    visual: 'bolt', data: { arkpediaTrackedVisual: true },
    onHit: ({ target: e }) => { if (e) impact(b, u, hit, e, info); } });
}

function slowField(b, u) {
  const key = `qiubai:s2-slow:${u.id}`;
  const active = live(u) && s2(u) && u.mem.qiubaiField;
  for (const e of b.enemies) {
    // The original non-attack validator is WALK/purposeNONE and does not
    // ignore target-free; concealment/Sluggish are separate native concepts.
    if (active && live(e) && !e.isFlying && !e.s.flags.untargetable && bodyInKeys(e, u.rangeKeys)) {
      if (!e.findBuff(key)) b.applyStatus(e, 'sluggish', { key, source: u });
    } else b.removeBuff(e, key);
  }
}
function lineDamage(b, u, bb, beginning, attackId) {
  const keys = absoluteRangeKeys(evidence.ranges['4-1'], u.tileR, u.tileC, u.dir);
  const targets = b.enemiesInKeys(keys, u, { canHitFly: false });
  for (const e of targets) impact(b, u, { ...plain(u.profile), canHitFly: false,
    attack: beginning ? 'melee' : 'ranged', applyWay: beginning ? 'melee' : 'ranged',
    dmgType: beginning ? 'arts' : 'phys',
    atkScale: bb[beginning ? 'sword_begin_atk_scale' : 'sword_end_atk_scale'],
    qiubaiTalentScale: 1, qiubaiS1: null }, e, { isSkill: true, attackId });
  if (beginning) for (const e of targets) if (live(e))
    b.applyStatus(e, 'sluggish', { source: u, duration: 1.2000000476837158 });
}
function finishField(b, u, token) {
  if (!token || u.mem.qiubaiField !== token || token.finished) return;
  token.finished = true;
  // Original end_damage is emitted before FinishBuffsById removes the ATK.
  if (live(u) && u.deploySeq === token.seq) lineDamage(b, u, token.bb, false, token.attackId);
  b.removeBuff(u, 'qiubai:s2-atk');
}
function startS2(b, u, s) {
  const token = {}, seq = u.deploySeq, activation = u.skill.activations;
  const delay = model(u).hits.Skill_2[0], duration = model(u).durations.Skill_2;
  u.mem.qiubaiCasting = token;
  u.mem.regularFormVisual = { clip: 'Skill_2', loop: false };
  const lock = b.addBuff(u, { key: 'qiubai:cast', source: u, duration, flags: { disarm: true, noSp: true } });
  const epoch = u.attackControlEpoch;
  u.skill.timeLeft = s.duration + delay;
  const valid = () => live(u) && s2(u) && u.deploySeq === seq && u.skill.activations === activation
    && u.mem.qiubaiCasting === token && u.attackControlEpoch === epoch && u.canAct;
  b.after(delay, () => {
    if (!valid()) { if (live(u) && s2(u)) u.skill.end('interrupted'); return; }
    const attackId = ++b._attackSeq;
    lineDamage(b, u, s.bb, true, attackId);
    const field = { seq, activation, bb: s.bb, attackId, finished: false };
    u.mem.qiubaiField = field;
    b.addBuff(u, { key: 'qiubai:s2-atk', source: u, mods: { atkPct: s.bb.atk } });
    slowField(b, u);
    // CombinedAbility's exact advance phase is not recovered. Explicitly bind
    // both the source field4.88 and mode5 to the first original .5 emission.
    b.after(s.bb.sword_end_duration, () => finishField(b, u, field), { owner: u });
  }, { owner: u });
  b.after(duration, () => {
    b.removeBuff(u, lock);
    if (u.mem.qiubaiCasting === token) { u.mem.qiubaiCasting = null; u.mem.regularFormVisual = null; }
  }, { owner: u });
}
function s3Form(b, u, ending = false) {
  const clip = ending ? 'Skill_3_End' : 'Skill_3_Start', duration = model(u).durations[clip];
  const seq = u.deploySeq, activation = u.skill.activations;
  if (!live(u)) { u.mem.regularFormVisual = null; return; }
  u.mem.regularFormVisual = { clip, loop: false };
  b.addBuff(u, { key: 'qiubai:form', source: u, duration, flags: { disarm: true } });
  b.after(duration, () => {
    if (live(u) && u.deploySeq === seq && u.skill.activations === activation
      && (ending ? !u.skill.active : s3(u)))
      u.mem.regularFormVisual = ending ? null : { clip: 'Skill_3_Idle', loop: true };
  }, { owner: u });
}
export function customizeGuardSixStarFourthKit({ battle: b, id, def, unit: u, kit }) {
  if (!GUARD_SIX_STAR_FOURTH_OPERATORS[id]) return;
  kit.install = null;
  kit.trait = { install: null, attack: 'ranged', projectile: 'none', dmgType: 'phys', hits: 1,
    hitsFn: null, chain: null, splashRadius: 0, maxTargets: 1, maxTargetsByBlock: false,
    hitAllBlocked: false, allInRange: false, rangeAoe: false, canHitFly: true, dmgMul: null,
    retargetOnRelease: true, interruptOnSkillChange: true, launchAttack: launch,
    windup: sourceWindup, attackVisual: (_b, unit) => unit.mem.qiubaiClip };
  const s = def.skill, bb = s.bb;
  if (s.id === 'skchr_qiubai_1') kit.skill = { kind: 'instant', attack: {
    afterAttack: (_b, unit, targets, meta) => {
      if (unit.mem.qiubaiEmitted !== meta.attackId && !targets.some(e => e.alive)
        && meta.inputTargets.length && meta.inputTargets.every(e => !e.alive)) unit.skill.addCharge(1);
    } } };
  else if (s.id === 'skchr_qiubai_2') kit.skill = { kind: 'duration', duration: s.duration,
    targeting: { rangeGrid: s.rangeGrid }, attack: {}, onStart: () => startS2(b, u, s),
    onEnd: () => { finishField(b, u, u.mem.qiubaiField); u.mem.qiubaiField = null;
      u.mem.qiubaiCasting = null; u.mem.regularFormVisual = null;
      b.removeBuff(u, 'qiubai:cast'); b.removeBuff(u, 'qiubai:s2-atk'); slowField(b, u); } };
  else kit.skill = { kind: 'duration', duration: s.duration, mods: { atkPct: bb.atk },
    targeting: { rangeGrid: s.rangeGrid, maxTargets: 3 }, attack: { dmgType: 'arts' },
    onStart: () => { u.mem.qiubaiStacks = 0; s3Form(b, u); },
    onAttack: ({ targets }) => { if (!targets?.length) return;
      u.mem.qiubaiStacks = Math.min(bb.max_stack_cnt, u.mem.qiubaiStacks + 1);
      b.addBuff(u, { key: 'qiubai:s3-aspd', source: u, mods: { aspd: bb.attack_speed * u.mem.qiubaiStacks } }); },
    onEnd: ({ reason }) => { u.mem.qiubaiStacks = 0; b.removeBuff(u, 'qiubai:s3-aspd');
      if (!['death', 'retreat'].includes(reason)) s3Form(b, u, true); else u.mem.regularFormVisual = null; } };
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installGuardSixStarFourth({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  u.mem.qiubaiStacks = 0; u.mem.qiubaiField = null; u.mem.qiubaiCasting = null;
  b.on('tick', () => slowField(b, u), { owner: u });
  for (const ev of ['death', 'retreat']) b.on(ev, ({ unit }) => {
    if (unit !== u) return;
    u.mem.qiubaiField = null; u.mem.qiubaiCasting = null; u.mem.regularFormVisual = null;
    b.removeBuff(u, 'qiubai:s2-atk'); b.removeBuff(u, 'qiubai:s3-aspd'); slowField(b, u);
  }, { owner: u });
}
