// SPDX-License-Identifier: GPL-3.0-or-later
// Original graphs and bounded controller sequencing: data/arkpedia-aak-prefabs.json.
import evidence from '../../../data/arkpedia-aak-prefabs.json' with { type: 'json' };
import { canTargetEnemy } from '../targeting.js';
import { toLocal } from '../dir.js';
const ID = 'char_225_haak';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => u.s.aspd / 100;
const mods = u => u.skill.id === 'skchr_haak_2'
  ? { hpPct: u.def.skill.bb.max_hp, defPct: u.def.skill.bb.def }
  : { atkPct: u.def.skill.bb.atk, aspd: u.def.skill.bb.attack_speed };

function recipient(b, u) {
  // Selector21's native comparator is unavailable. The documented local order
  // is the forward centre line, distance, then deployment order; no retarget.
  const local = a => toLocal(a.y - u.y, a.x - u.x, u.dir);
  const direct = a => { const [cross, forward] = local(a); return forward > 0 && Math.abs(cross) < 1e-6; };
  return b.alliesInGrid(u).filter(a => a !== u && a.kind === 'op' && !a.s.flags.untargetable)
    .sort((a, z) => Number(direct(z)) - Number(direct(a))
      || Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(z.x - u.x, z.y - u.y)
      || a.deploySeq - z.deploySeq)[0];
}
function windup(b, u) {
  const down = u.dir === 'DOWN', clip = down ? 'Attack_Down_Loop' : 'Attack_Loop';
  u.mem.aakAttackClip = clip;
  const opening = !u.mem.aakOpened;
  u.mem.aakOpened = true;
  const delay = opening ? model(u).durations[down ? 'Attack_Down_Begin' : 'Attack_Begin'] / rate(u) : 0;
  if (opening) {
    const seq = u.deploySeq, epoch = u.attackControlEpoch;
    u.mem.regularFormVisual = { clip: down ? 'Attack_Down_Begin' : 'Attack_Begin', loop: false, speed: rate(u) };
    b.after(delay, () => {
      if (live(u) && u.deploySeq === seq && u.attackControlEpoch === epoch && !u.mem.aakBurst)
        u.mem.regularFormVisual = null;
    }, { owner: u });
  }
  return delay + model(u).hits[clip][0] / rate(u);
}
function launch(b, u, p, target, info) {
  if (!canTargetEnemy(u, target, p)) return;
  b.addProjectile({ from: u, target, source: u, speed: 15, maxAge: 5,
    visual: 'orb', data: { arkpediaTrackedVisual: true }, onHit: ({ target: e }) => {
      if (!e || !canTargetEnemy(u, e, p)) return;
      const bb = u.def.talents.find(t => t.bb.sluggish != null)?.bb;
      const branch = bb ? b.rng.int(4) : -1;
      if (branch === 1) b.applyStatus(e, 'sluggish', { duration: bb.sluggish, source: u });
      if (branch === 2) b.applyStatus(e, 'stun', { duration: bb.stun, source: u });
      if (branch === 3 && live(u)) b.heal(u, u, u.s.maxHp * bb.hp_ratio, { self: true });
      b.dealDamage(u, e, { amount: u.s.atk * u.s.atkScaleMul * (branch === 0 ? bb.atk_scale : 1),
        type: 'phys',
        isAttack: true, isSkill: info.isSkill, attackId: info.attackId,
        applyWay: 'ranged', tags: ['aak:normal'] });
    } });
}
function clearBurst(b, u) {
  u.mem.aakBurst = null;
  u.mem.aakOpened = false;
  u.mem.regularFormVisual = null;
  b.removeBuff(u, 'aak:casting');
}
function stimpack(b, u) {
  const target = recipient(b, u);
  if (!target) return;
  const clock = rate(u), seq = u.deploySeq,
    activation = u.skill.activations, targetSeq = target.deploySeq,
    clip = u.dir === 'DOWN' ? 'Skill_Down' : 'Skill', m = model(u);
  const state = { target, targetSeq, seq, activation, epoch: u.attackControlEpoch };
  u.mem.aakBurst = state;
  u.mem.regularFormVisual = { clip, loop: false, speed: clock };
  b.addBuff(u, { key: 'aak:casting', flags: { disarm: true } });
  state.epoch = u.attackControlEpoch;
  const valid = () => live(u) && u.canAct && u.deploySeq === seq
    && u.attackControlEpoch === state.epoch && u.skill.active
    && u.skill.activations === activation && u.mem.aakBurst === state;
  const deadline = b.time + u.def.skill.duration, buffMods = mods(u);
  // Native MultiRanged uses one OnAttack then14 triggerDelta=.03 births.
  // Damage and fake-buff projectiles are parallel; only the last fake carries
  // the target buff. Source-owned unborn shots cancel; born shots persist.
  for (let i = 0; i < 15; i++) b.after(m.hits[clip][0] / clock + .03 * i / clock, () => {
    if (!valid() || !live(target) || target.deploySeq !== targetSeq) return;
    b.addProjectile({ from: u, target, source: u, speed: 20, maxAge: 5,
      visual: 'orb', data: { arkpediaTrackedVisual: true }, onHit: ({ target: a }) => {
        if (!live(a) || a.deploySeq !== targetSeq) return;
        b.dealDamage(u, a, { amount: u.def.skill.bb.damage, type: 'phys',
          isAttack: true, isSkill: true, applyWay: 'ranged', tags: ['aak:stimpack'] });
      } });
    if (i === 14) b.addProjectile({ from: u, target, source: u, speed: 20, maxAge: 5,
      visual: 'none', data: { arkpediaTrackedVisual: true }, onHit: ({ target: a }) => {
        if (live(a) && a.deploySeq === targetSeq && deadline > b.time)
          b.addBuff(a, { key: `aak:stimpack:${u.id}`, source: u,
            duration: deadline - b.time, mods: buffMods });
      } });
  }, { owner: u });
  // Executable SequentialAbility completion is unavailable: the selected
  // original clip end is the bounded local transition to the self buff.
  b.after(m.durations[clip] / clock, () => {
    if (!valid()) return;
    clearBurst(b, u);
    if (deadline > b.time) b.addBuff(u, { key: 'aak:self', source: u,
      duration: deadline - b.time, mods: buffMods });
    u.atkCd = 0;
  }, { owner: u });
}
export function customizeAakKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  u.mem.aakDecayRatio = def.raw.trait.bb.hp_ratio;
  kit.install = null; kit.talents = [];
  kit.trait = { attack: 'ranged', projectile: 'orb', dmgType: 'phys',
    applyWay: 'ranged', canHitFly: true, groundOnly: false, hits: 1, hitsFn: null,
    maxTargets: 1, splashRadius: 0, chain: null, dmgMul: null,
    maxTargetsByBlock: false, hitAllBlocked: false, hpDrain: 0, windup, launchAttack: launch,
    attackVisual: () => u.mem.aakAttackClip, interruptOnSkillChange: true,
    canAttack: () => !u.mem.aakBurst };
  const s = def.skill;
  kit.skill = s.id === 'skchr_haak_1'
    ? { kind: 'duration', mods: { aspd: s.bb.attack_speed } }
    : { kind: 'duration', canActivate: () => !!recipient(b, u),
      onStart: () => stimpack(b, u), onEnd: () => {
        clearBurst(b, u); b.removeBuff(u, 'aak:self');
      } };
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installAak({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  b.on('deploy', ({ unit }) => {
    if (unit !== u) return;
    u.mem.aakOpened = false; u.mem.aakBurst = null;
    const heal = def.talents.find(t => t.bb.heal_scale != null)?.bb.heal_scale;
    if (heal) b.addBuff(u, { key: 'aak:healing', mods: { healingTakenMul: heal } });
    b.addBuff(u, { key: 'aak:decay', interval: 1, onTick: () => {
      if (live(u)) b.loseHp(u, Math.min(Math.max(0, u.hp - 1),
        u.s.maxHp * u.mem.aakDecayRatio), { source: u, tags: ['aak:decay'] });
    } });
  }, { owner: u });
  b.on('tick', () => {
    if (u.mem.aakBurst && (!live(u) || !u.canAct
      || u.attackControlEpoch !== u.mem.aakBurst.epoch)) clearBurst(b, u);
  }, { owner: u });
  b.on('retreat', ({ unit }) => { if (unit === u) clearBurst(b, u); }, { owner: u });
}
