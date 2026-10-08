// SPDX-License-Identifier: GPL-3.0-or-later
// Exact graph plus explicitly bounded attachment/output clocks are retained in evidence.
import evidence from '../../../data/arkpedia-flametail-prefabs.json' with { type: 'json' };
import { canTargetEnemy, absoluteRangeKeys, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { resolveHit } from '../ai.js';
const ID = 'char_420_flamtl';
const present = a => a?.alive && a.deployed;
const live = a => present(a) && !a.hidden;
const third = u => u.skill.active && u.skill.id === 'skchr_flamtl_3';
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const rate = u => Math.min(1, u.base.bat / u.s.interval);
const sourceKeys = (u, range) => new Set(absoluteRangeKeys(evidence.ranges[range].grids.map(g => [g.row, g.col]), u.tileR, u.tileC, u.dir));
const legalAlly = (b, u, a) => live(a) && a.kind !== 'device' && b.allySelectable(a, u) && !a.s.flags.untargetable;
function choose(b, u, p) {
  const list = b.enemiesInKeys(u.rangeKeys, u, p);
  for (const e of b.blockedTargets(u, p)) if (!list.includes(e)) list.push(e);
  sortEnemyTargets(b, u, list, p.priority);
  const enhanced = p.flametailPlan ? p.flametailPlan.pending : u.mem.flametailPending;
  return list.slice(0, enhanced && u.def.raw.arkpedia.elite >= 2
    ? Math.max(1, Math.floor(u.s.blockCnt)) : 1);
}
function bornExtra(b, u, target, info, delay) {
  const key = `flametail:extra:${u.id}:${info.attackId}`, victimSeq = target.deploySeq;
  // A target-bound born buff is independent of the owner's unborn spell window.
  const buff = b.addBuff(target, { key, source: u });
  if (!buff) return;
  b.after(delay, () => {
    if (target.alive && target.deploySeq === victimSeq && target.findBuff(key) === buff)
      b.dealDamage(u, target, { amount: u.s.atk, type: 'phys', isAttack: true,
        isSkill: info.isSkill, applyWay: 'melee', attackId: info.attackId, tags: ['flametail:extra'] });
    b.removeBuff(target, buff);
  });
}
function launch(b, u, p, e, info) {
  if (!live(u) || !canTargetEnemy(u, e, p)) return;
  const plan = p.flametailPlan;
  if (plan?.pending) {
    if (!plan.consumed) {
      plan.consumed = true;
      if (u.mem.flametailPending === plan.pending) u.mem.flametailPending = null;
    }
    // Native active buff attaches before the main modifier; a lethal main still
    // removes the target buff at true death, suppressing the unborn extra tick.
    bornExtra(b, u, e, info, plan.third ? .15 : .2);
  }
  resolveHit(b, u, p, e, info, e.x, e.y);
}
function syncAuras(b) {
  const owners = [...b._arkpediaFlametail.values()], pulses = new Set();
  for (const u of owners) {
    const f = u.mem.flametailField;
    if (present(u) && f && b.time < f.end - 1e-9 && b.time + 1e-9 >= f.nextPulse) {
      pulses.add(u);
      f.nextPulse += .2 * (1 + Math.floor(Math.max(0, b.time - f.nextPulse + 1e-9) / .2));
    }
  }
  for (const a of b.allyUnits) {
    const candidates = owners.filter(u => present(u) && u.def.talents[1]
      && a.kind === 'op' && legalAlly(b, u, a) && a.tags.has('kazimierz'));
    const winner = candidates.sort((x, y) => y.def.talents[1].bb.prob - x.def.talents[1].bb.prob)[0];
    const k = 'flametail:t2', old = a.findBuff(k);
    if (!winner) b.removeBuff(a, k);
    else if (old?.source !== winner || old.mods.dodgePhys !== winner.def.talents[1].bb.prob)
      b.addBuff(a, { key: k, source: winner, mods: { dodgePhys: winner.def.talents[1].bb.prob } });
    for (const u of owners) {
      const field = u.mem.flametailField, key = `flametail:s2:${u.id}`;
      const eligible = present(u) && field && b.time < field.end - 1e-9
        && legalAlly(b, u, a) && bodyInKeys(a, sourceKeys(u, 'x-1'));
      if (!eligible) b.removeBuff(a, key);
      else if (pulses.has(u) && !a.findBuff(key)) b.addBuff(a, { key, source: u, mods: { dodgePhys: field.prob } });
    }
  }
}
function clearCast(b, u, token) {
  if (u.mem.flametailCast !== token) return;
  u.mem.flametailCast = null; b.removeBuff(u, 'flametail:cast'); u.mem.regularFormVisual = null;
}
function secondStart(b, u, s) {
  b.addDp(u.ownerId, s.bb.cost);
  for (const a of b.allyUnits) b.removeBuff(a, `flametail:s2:${u.id}`);
  u.mem.flametailField = { end: b.time + s.bb['flamtl_s_2.duration'], nextPulse: b.time + .2, prob: s.bb['flamtl_s_2.prob'] };
  syncAuras(b);
  u.mem.regularFormVisual = { clip: 'Skill_1', loop: false };
  b.addBuff(u, { key: 'flametail:cast', flags: { disarm: true, noSp: true } });
  const token = { seq: u.deploySeq, activation: u.skill.activations, epoch: u.attackControlEpoch };
  u.mem.flametailCast = token;
  const p = { canHitFly: true, maxTargets: s.bb.max_target };
  const targets = b.enemiesInKeys([...sourceKeys(u, 'x-1')], u, p);
  sortEnemyTargets(b, u, targets, null);
  const inputs = targets.slice(0, s.bb.max_target).map(e => ({ e, seq: e.deploySeq }));
  const attackId = ++b._attackSeq;
  const valid = () => live(u) && u.deploySeq === token.seq && u.skill.activations === token.activation
    && u.attackControlEpoch === token.epoch && u.canAct && u.mem.flametailCast === token;
  for (let i = 0; i < 2; i++) b.after(.5 + i * .2, () => {
    if (!valid()) return;
    const released = [];
    for (const v of inputs) if (v.e.deploySeq === v.seq && canTargetEnemy(u, v.e, p)
      && bodyInKeys(v.e, sourceKeys(u, 'x-1'))) {
      b.applyStatus(v.e, 'stun', { duration: s.bb.stun, source: u });
      b.dealDamage(u, v.e, { amount: u.s.atk * s.bb.atk_scale, type: 'phys',
        isAttack: true, isSkill: true, applyWay: 'melee', attackId });
      released.push(v.e);
    }
    if (!i && released.length) { u.stats.attacks++; b.emit('attack', { attacker: u, targets: released, isSkill: true }); }
  }, { owner: u });
}
function thirdStart(b, u, s) {
  const duration = model(u).durations.Skill_2_Begin;
  u.mem.regularFormVisual = { clip: 'Skill_2_Begin', loop: false };
  b.addBuff(u, { key: 'flametail:begin', duration, flags: { disarm: true } });
  const token = { seq: u.deploySeq, activation: u.skill.activations, epoch: u.attackControlEpoch, end: b.time + s.duration };
  u.mem.flametailThird = token;
  b.after(duration, () => {
    if (live(u) && third(u) && u.deploySeq === token.seq && u.attackControlEpoch === token.epoch)
      u.mem.regularFormVisual = { clip: 'Skill_2_Idle', loop: true };
  }, { owner: u });
  for (let i = 1; i <= s.bb.value; i++) b.after(i, () => {
    if (present(u) && u.deploySeq === token.seq && u.skill.activations === token.activation
      && (third(u) || token.endReason === 'duration') && b.time <= token.end + b.dt + 1e-9)
      b.addDp(u.ownerId, s.bb.cost);
  }, { owner: u });
}
function thirdEnd(b, u, reason) {
  if (u.mem.flametailThird) u.mem.flametailThird.endReason = reason;
  b.removeBuff(u, 'flametail:begin');
  if (!live(u) || ['death', 'retreat', 'interrupted'].includes(reason)) { u.mem.regularFormVisual = null; return; }
  const duration = model(u).durations.Skill_2_End, seq = u.deploySeq;
  u.mem.regularFormVisual = { clip: 'Skill_2_End', loop: false };
  b.after(duration, () => { if (u.deploySeq === seq && !third(u)) u.mem.regularFormVisual = null; }, { owner: u });
}
export function customizeFlametailKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  kit.trait = { install: null, attack: 'melee', projectile: 'none', dmgType: 'phys', canHitFly: false,
    maxTargets: 1, maxTargetsByBlock: false, hits: 1, hitsFn: null, hitAllBlocked: false,
    allInRange: false, rangeAoe: false, splashRadius: 0, chain: null, dmgMul: null, heal: null,
    acquireTargets: choose, retargetOnRelease: true, interruptOnSkillChange: false, launchAttack: launch,
    windup: () => model(u).hits[u.mem.flametailClip][0] / rate(u),
    attackVisual: () => u.mem.flametailClip };
  const s = def.skill;
  if (s.id === 'skchr_flamtl_1') kit.skill = { kind: 'instant', trigger: 'SP_FULL', onStart: () => {
    b.addDp(u.ownerId, s.bb.cost); b.addBuff(u, { key: 'flametail:s1', mods: { dodgePhys: 1 } });
  } };
  else if (s.id === 'skchr_flamtl_2') kit.skill = { kind: 'duration', duration: model(u).durations.Skill_1,
    onStart: () => secondStart(b, u, s), onEnd: () => clearCast(b, u, u.mem.flametailCast) };
  else kit.skill = { kind: 'duration', duration: s.duration, attack: {},
    mods: { atkPct: s.bb.atk, blockCnt: s.bb.block_cnt, batMul: s.bb.base_attack_time,
      dodgePhys: s.bb.prob, dodgeArts: s.bb.prob },
    onStart: () => thirdStart(b, u, s), onEnd: ({ reason }) => thirdEnd(b, u, reason) };
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installFlametail({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  (b._arkpediaFlametail ??= new Map()).set(u.id, u);
  if (!b._arkpediaFlametailTick) b._arkpediaFlametailTick = b.on('tick', () => syncAuras(b));
  b.on('beforeAttack', c => {
    if (c.attacker !== u) return;
    c.profile.flametailPlan = { pending: u.mem.flametailPending, third: third(u), consumed: false };
    u.mem.flametailClip = third(u) ? u.mem.flametailPending ? 'Skill_2_Attack_2' : 'Skill_2_Loop' : 'Attack';
    c.targets = choose(b, u, c.profile);
  }, { owner: u });
  b.on('dodge', c => {
    if (c.target !== u || !present(u)) return;
    if (c.dmg.type === 'phys') b.removeBuff(u, 'flametail:s1');
    if (def.talents[0] && !u.mem.flametailPending) u.mem.flametailPending = {};
  }, { owner: u });
  b.on('deploy', c => {
    if (c.unit !== u) return;
    u.mem.flametailPending = null; u.mem.flametailField = null; syncAuras(b);
  });
  b.on('tick', () => {
    const t = u.mem.flametailCast;
    if (t && (!live(u) || u.deploySeq !== t.seq || !u.canAct || u.attackControlEpoch !== t.epoch)) {
      clearCast(b, u, t); u.skill.end('interrupted');
    }
  }, { owner: u });
}
