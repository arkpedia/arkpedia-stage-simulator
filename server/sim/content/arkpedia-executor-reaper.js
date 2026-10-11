// SPDX-License-Identifier: GPL-3.0-or-later
// Source + primary-calculator bounded ammo-family law, independently reviewed.
// Native event4
// dispatcher, last-bullet tail and callback phase are not claimed recovered.
import evidence from '../../../data/arkpedia-executor-reaper-prefabs.json' with { type: 'json' };
import { effectiveProfile, resolveHit } from '../ai.js';
import { canTargetEnemy } from '../targeting.js';
import { isHpLoss } from '../damage.js';
const ID = 'char_1032_excu2', live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const rate = (u, cap = 1) => Math.min(cap, u.base.bat / u.s.interval);
function setAtk(b, u) {
  const bb = u.skill.bb;
  b.addBuff(u, { key: 'excu2:s3-atk', source: u,
    mods: { atkPct: bb.atk + bb['attack@atk'] * u.mem.excu2Stacks } });
}
function cleanupThird(b, u) {
  b.removeBuff(u, 'excu2:s3-atk'); b.removeBuff(u, 'excu2:s3-phase');
  b.removeBuff(u, 'excu2:finish'); u.mem.excu2Marks.clear();
  u.mem.excu2Phase = null; u.mem.regularFormVisual = null;
}
function finishThird(b, u, reason) {
  if (!live(u) || !['ammo', 'manual'].includes(reason)) { cleanupThird(b, u); return; }
  const seq = u.deploySeq, finish = {};
  u.mem.excu2Phase = finish;
  u.mem.regularFormVisual = { clip: 'Skill_3_End', loop: false };
  b.addBuff(u, { key: 'excu2:finish', source: u, flags: { disarm: true, noSp: true } });
  const epoch = u.attackControlEpoch;
  b.after(model(u).hits.Skill_3_End[0], () => {
    if (!live(u) || u.deploySeq !== seq || u.mem.excu2Phase !== finish
      || !u.canAct || u.attackControlEpoch !== epoch) return;
    const targets = [...u.mem.excu2Marks].filter(([e, born]) => live(e) && e.deploySeq === born);
    u.mem.excu2Marks.clear();
    const attackId = ++b._attackSeq;
    for (const [e] of targets) b.dealDamage(u, e, { amount: u.s.atk * u.s.atkScaleMul * u.skill.bb['attack@final_atk_scale'],
      type: 'phys', isAttack: true, isSkill: true, attackId, applyWay: 'melee', tags: ['excu2:finisher'] });
  }, { owner: u });
  b.after(1.1, () => { if (u.deploySeq === seq && u.mem.excu2Phase === finish) cleanupThird(b, u); }, { owner: u });
}
function familyStart(b, u, targets) {
  const mode = u.skill?.active ? Number(u.skill.id.slice(-1)) : 0;
  const talent = u.def.talents.find(t => t.bb.prob != null)?.bb;
  const double = talent ? b.rng() < u.mem.excu2Prob : false;
  const suffix = double ? 'B' : 'A';
  const down = u.dir === 'DOWN' && !['UP', 'LEFT'].includes(u.dir);
  const clip = mode >= 2 ? `${down ? 'Skill_Down' : 'Skill'}_${mode}_Attack_${suffix}`
    : `Attack_${down ? 'Down_' : ''}${suffix}`;
  const fallback = mode >= 2 ? `Skill_${mode}_Attack_${suffix}` : `Attack_${suffix}`;
  const literal = model(u).hits[clip] ? clip : fallback;
  const cap = double && mode === 3 ? 1.2 : 1, speed = rate(u, cap);
  const times = model(u).hits[literal];
  u.mem.excu2Family = { id: b._attackSeq, double, mode, clip: literal, speed,
    targets: targets.map(e => ({ unit: e, seq: e.deploySeq })),
    delta: double ? (times[1] - times[0]) / speed : 0,
    deployment: u.deploySeq, activation: u.skill?.activations, control: u.attackControlEpoch };
  return times[0] / speed;
}
function afterFamily(b, u, targets, meta) {
  const prof = effectiveProfile(u);
  const family = u.mem.excu2Family;
  if (!family || family.id !== meta.attackId) return;
  // Exactly one spend per family is a documented text/calculator bridge;
  // the shared native countEvent4 binding is not executable-proven.
  if (family.mode && u.skill.active) {
    u.skill.ammoLeft = Math.max(0, u.skill.ammoLeft - 1);
    const t = u.def.talents.find(t => t.bb.prob != null)?.bb;
    if (t) u.mem.excu2Prob = Math.min(1, u.mem.excu2Prob + t.prob_add);
    if (family.mode === 3) { u.mem.excu2Stacks = Math.min(u.skill.bb['attack@max_stack_cnt'], u.mem.excu2Stacks + 1); setAtk(b, u); }
    if (b._hooks.ammoUsed) b.emit('ammoUsed', { unit: u, left: u.skill.ammoLeft, skill: u.skill });
  }
  const endIfEmpty = () => {
    if (live(u) && u.deploySeq === family.deployment && u.skill.activations === family.activation
      && u.skill.active && u.skill.ammoLeft <= 0) u.skill.end('ammo');
  };
  if (!family.double) { endIfEmpty(); return; }
  u.atkCd = Math.max(u.atkCd, family.delta);
  b.after(family.delta, () => {
    const valid = live(u) && u.deploySeq === family.deployment && u.canAct && !u.s.flags.disarm
      && u.attackControlEpoch === family.control && u.skill.activations === family.activation
      && (!family.mode || u.skill.active);
    if (valid) {
      for (const { unit: e, seq } of family.targets)
        if (e.deploySeq === seq && canTargetEnemy(u, e, prof)) resolveHit(b, u, { ...prof, hits: 1 }, e,
          { isSkill: family.mode > 0, index: 1, attackId: meta.attackId }, e.x, e.y);
      // Normal double child alone has ModifySp1 / INCREASE_WHEN_ATTACK.
      // One tail-family grant is corroborated by the pinned primary calculator;
      // native event5 dispatch remains a bounded interpretation, not recovered.
      if (!family.mode && !u.skill.active && u.skill.spType === 'attack') u.skill.gainSp(1, 'attack');
    }
    // Keep the final consumed-ammo family active until its born-independent
    // second direct wave completes/cancels; no extra attack may start at0 ammo.
    endIfEmpty();
  }, { owner: u });
}
function start(b, u) {
  const s = u.skill, n = Number(s.id.slice(-1)), t = u.def.talents.find(t => t.bb.add_count != null)?.bb;
  const count = t ? Math.min(t.add_count_max_stack,
    b.allyUnits.filter(a => live(a) && a.kind === 'op' && a.tags?.has('laterano')).length) * t.add_count : 0;
  s.addAmmo(count); u.mem.excu2Prob = u.def.talents.find(t => t.bb.prob != null)?.bb.prob ?? 0;
  u.mem.excu2Stacks = 0; u.mem.excu2Marks.clear();
  if (n === 3) {
    u.mem.excu2Phase = 'active'; setAtk(b, u);
    b.addBuff(u, { key: 'excu2:s3-phase', source: u, flags: { noSp: true } });
  }
  if (n >= 2) {
    const seq = u.deploySeq, activation = s.activations;
    u.mem.regularFormVisual = { clip: `Skill_${n}_Begin`, loop: false, attack: `Skill_${n}_Attack_A` };
    b.addBuff(u, { key: 'excu2:begin', source: u, duration: .333, flags: { disarm: true } });
    b.after(.333, () => {
      if (live(u) && u.deploySeq === seq && s.active && s.activations === activation)
        u.mem.regularFormVisual = { clip: `Skill_${n}_Idle`, loop: true, attack: `Skill_${n}_Attack_A` };
    }, { owner: u });
  }
}
export function customizeExecutorReaperKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null;
  kit.trait = { attack: 'melee', dmgType: 'phys', projectile: 'none', canHitFly: false,
    allInRange: true, rangeAoe: false, maxTargets: 1, maxTargetsByBlock: false, hits: 1, hitsFn: null,
    splashRadius: 0, chain: null, dmgMul: null, hitAllBlocked: false, install: null,
    retargetOnRelease: false, interruptOnSkillChange: true,
    canAttack: (_b, a) => !a.skill?.active || a.skill.ammoLeft > 0,
    windup: familyStart, attackVisual: (_b, a) => a.mem.excu2Family.clip,
    launchAttack: (battle, a, p, e, info) => {
      if (canTargetEnemy(a, e, p)) resolveHit(battle, a, p, e, info, e.x, e.y);
    }, afterAttack: afterFamily };
  const s = def.skill, n = Number(s.id.slice(-1));
  kit.skill = { id: s.id, name: s.name, kind: 'ammo', ammo: s.bb['attack@trigger_time'],
    manualCancel: true, canActivate: () => !u.mem.excu2Phase,
    targeting: n !== 2 ? { rangeGrid: s.rangeGrid } : {},
    mods: n === 3 ? { batFlat: s.bb.base_attack_time } : { atkPct: s.bb.atk,
      ...(n === 2 ? { defPct: s.bb.def, blockCnt: s.bb.block_cnt } : {}) },
    onStart: () => start(b, u), onAttack: ctx => { ctx.noAmmo = true; },
    onEnd: ({ reason }) => {
      u.mem.excu2Prob = def.talents.find(t => t.bb.prob != null)?.bb.prob ?? 0;
      b.removeBuff(u, 'excu2:begin');
      if (n === 3) finishThird(b, u, reason);
      else if (n === 2 && live(u) && ['ammo', 'manual'].includes(reason)) {
        const seq = u.deploySeq; u.mem.regularFormVisual = { clip: 'Skill_2_End', loop: false };
        b.addBuff(u, { key: 'excu2:end', duration: .333, flags: { disarm: true } });
        b.after(.333, () => { if (u.deploySeq === seq) u.mem.regularFormVisual = null; }, { owner: u });
      } else u.mem.regularFormVisual = null;
    } };
}
export function installExecutorReaper({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  u.mem.excu2Prob = def.talents.find(t => t.bb.prob != null)?.bb.prob ?? 0;
  u.mem.excu2Stacks = 0; u.mem.excu2Marks = new Map(); u.mem.excu2Phase = null;
  b.addBuff(u, { key: 'excu2:healfree', flags: { healFree: true }, persist: true, allowDead: true });
  b.on('hit', ctx => {
    if (ctx.source === u && u.skill?.active && u.skill.id.endsWith('_1')) ctx.dmg.defIgnoreFlat += u.skill.bb.def_penetrate_fixed;
    if (ctx.target === u && u.skill?.active && u.skill.id.endsWith('_2')
      && ctx.source?.side === 'enemy' && ctx.dmg.applyWay === 'melee'
      && !ctx.dmg.cancel && b.rng() < u.skill.bb.prob) {
      ctx.dmg.cancel = true;
      u.skill.ammoLeft = Math.min(u.skill.ammoMax, u.skill.ammoLeft + u.skill.bb.recover_cnt);
    }
  }, { owner: u });
  const heal = { at: -Infinity, count: 0, queue: [], timer: null };
  const consume = () => {
    if (!live(u)) { heal.queue = []; heal.timer = null; return; }
    const amount = heal.queue.shift(); b.heal(u, u, amount, { self: true, ignoreHealFree: true });
    heal.timer = b.after(.12, () => { heal.timer = null; if (heal.queue.length) consume(); }, { owner: u });
  };
  b.on('damaged', ({ source, target, dmg }) => {
    if (source !== u || !live(u) || target?.side !== 'enemy' || !dmg || isHpLoss(dmg)
      || dmg.type === 'element' || dmg.type === 'elemental') return;
    if (u.mem.excu2Phase === 'active') u.mem.excu2Marks.set(target, target.deploySeq);
    if (b.time - heal.at >= .05 - 1e-9) { heal.at = b.time; heal.count = 0; }
    if (heal.count >= Math.max(0, u.s.blockCnt)) return;
    heal.count++; heal.queue.push(def.traitBb.value * (u.mem.excu2Phase ? u.skill.bb.trait_ratio : 1));
    if (!heal.timer) consume();
  }, { owner: u });
  b.on('death', ({ unit }) => {
    if (unit !== u) return; heal.timer?.cancel(); heal.queue = []; cleanupThird(b, u);
  }, { owner: u });
}
