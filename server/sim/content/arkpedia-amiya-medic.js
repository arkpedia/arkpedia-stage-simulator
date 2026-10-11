// SPDX-License-Identifier: GPL-3.0-or-later
// Native graphs and executable ordering limits: arkpedia-amiya-medic-prefabs.json.
import evidence from '../../../data/arkpedia-amiya-medic-prefabs.json' with { type: 'json' };
import { canTargetEnemy, absoluteRangeKeys } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { isHpLoss } from '../damage.js';

const ID = 'char_1037_amiya3';
const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const rate = u => Math.min(1, u.s.aspd / 100);
const mode = u => u.skill.active ? Number(u.skill.id.at(-1)) : 0;
const talent = u => u.def.talents[0]?.bb;
const healable = (b, u, a, ignoreTargetFree = false) => live(a) && a.kind !== 'device'
  && !a.s.flags.healFree && (ignoreTargetFree || !a.s.flags.untargetable && b.allySelectable(a, u))
  && (a === u || !(a.s.flags.noHeal || a.profile?.noHeal));
const attack = { attack: 'ranged', dmgType: 'arts', heal: null, projectile: 'none',
  canHitFly: true, maxTargets: 1, hits: 1, hitsFn: null, allInRange: false,
  splashRadius: 0, chain: null, applyWay: 'ranged' };
function aura(b) {
  const sources = b.allyUnits.filter(u => u.defId === ID && live(u) && talent(u));
  const hp = sources.sort((a, z) => talent(z).max_hp - talent(a).max_hp)[0];
  const regen = sources.filter(u => u.skill.active)
    .sort((a, z) => talent(z).hp_recovery_per_sec_by_max_hp_ratio - talent(a).hp_recovery_per_sec_by_max_hp_ratio)[0];
  for (const a of b.allyUnits) for (const [key, source, mods] of [
    ['amiya3:hp', hp, hp && { hpPct: talent(hp).max_hp }],
    ['amiya3:regen', regen, regen && { hpRegenRatio: talent(regen).hp_recovery_per_sec_by_max_hp_ratio }],
  ]) {
    const old = a.findBuff(key);
    if (!source || !live(a) || a.kind === 'device' || a.s.flags.healFree) {
      if (old) b.removeBuff(a, key);
    } else if (!old || old.source !== source || Object.keys(mods).some(k => old.mods[k] !== mods[k])) {
      b.addBuff(a, { key, source, mods });
    }
  }
}
function recipient(b, u) {
  return b.allyUnits.filter(a => healable(b, u, a) && bodyInKeys(a, u.rangeKeySet))
    .sort((a, z) => a.hpRatio - z.hpRatio || a.deploySeq - z.deploySeq || String(a.id).localeCompare(String(z.id)))[0];
}
function flight(b, u, p, e, info) {
  if (!canTargetEnemy(u, e, p)) return;
  b.addProjectile({ from: u, target: e, source: u, speed: 10, maxAge: 10, visual: 'orb',
    data: { arkpediaTrackedVisual: true }, onHit: ({ target }) => {
      if (canTargetEnemy(u, target, p)) b.dealDamage(u, target, {
        amount: u.s.atk * u.s.atkScaleMul, type: 'arts', isAttack: true,
        isSkill: info.isSkill, isProjectile: true, applyWay: 'ranged', attackId: info.attackId,
      });
    } });
}
function endCast(b, u) {
  const c = u.mem.amiyaMedicCast;
  if (!c) return;
  c.watch?.cancel(); c.release?.cancel(); c.finish?.cancel();
  u.mem.amiyaMedicCast = null;
  b.removeBuff(u, 'amiya3:cast');
  u.mem.regularFormVisual = mode(u) ? { clip: `Skill_${mode(u)}_Loop`, loop: true } : null;
  u.atkCd = 0;
}
function begin(b, u, n) {
  if (n === 2) b.bench[ID].amiyaMedicSecondUsed = true;
  const clock = rate(u), clip = `Skill_${n}_Begin`;
  b.addBuff(u, { key: 'amiya3:cast', flags: { disarm: true } });
  const c = { seq: u.deploySeq, epoch: u.attackControlEpoch, activation: u.skill.activations };
  u.mem.amiyaMedicCast = c;
  u.mem.regularFormVisual = { clip, loop: false, speed: clock };
  const valid = () => live(u) && u.mem.amiyaMedicCast === c && u.deploySeq === c.seq
    && u.attackControlEpoch === c.epoch && u.canAct && u.skill.active && u.skill.activations === c.activation;
  if (n === 2) c.release = b.after(model(u).eventPayloads[clip][0].time / clock, () => {
    if (!valid()) return;
    // Explicit local ordering: select at the original burst event, snapshot
    // its damage before the bonus, then count accepted calculated receipts.
    const victims = b.enemies.filter(e => canTargetEnemy(u, e, attack) && bodyInKeys(e, u.rangeKeySet));
    const amount = u.s.atk * u.s.atkScaleMul * u.skill.bb.atk_scale;
    const accepted = new Set(), burstId = ++b._attackSeq;
    const hook = b.on('calculatedDamage', ctx => {
      if (ctx.source === u && ctx.dmg.attackId === burstId && ctx.amount > 0) accepted.add(ctx.target);
    }, { owner: u });
    for (const e of victims) {
      b.dealDamage(u, e, { amount, type: 'arts', isAttack: false, isSkill: true,
        applyWay: 'ranged', attackId: burstId, tags: ['amiya3:burst'] });
      if (live(e) && accepted.has(e)) b.addBuff(e, { key: 'amiya3:debuff', source: u,
        duration: u.skill.bb['amiya3_s_2[debuff].duration'], mods: {
          aspd: u.skill.bb['amiya3_s_2[debuff].attack_speed'],
          movePct: u.skill.bb['amiya3_s_2[debuff].move_speed'],
        } });
    }
    b.off(hook);
    const stacks = Math.min(accepted.size, u.skill.bb.max_stack_cnt);
    u.mem.amiyaMedicBurstStacks = stacks;
    if (stacks) b.addBuff(u, { key: 'amiya3:atk', source: u, mods: { atkPct: stacks * u.skill.bb.atk } });
  }, { owner: u });
  c.finish = b.after(model(u).durations[clip] / clock, () => { if (valid()) endCast(b, u); }, { owner: u });
  c.watch = b.every(b.dt, () => { if (!valid()) endCast(b, u); }, { owner: u });
}
function end(b, u, reason) {
  endCast(b, u); b.removeBuff(u, 'amiya3:atk'); u.mem.amiyaMedicBurstStacks = 0;
  aura(b);
  if (!live(u) || reason === 'death') { u.mem.regularFormVisual = null; return; }
  const n = Number(u.skill.id.at(-1)), clip = `Skill_${n}_End`, clock = rate(u);
  const generation = u.mem.amiyaMedicEnd = (u.mem.amiyaMedicEnd ?? 0) + 1;
  u.mem.regularFormVisual = { clip, loop: false, speed: clock };
  b.addBuff(u, { key: 'amiya3:end', duration: model(u).durations[clip] / clock, flags: { disarm: true } });
  b.after(model(u).durations[clip] / clock, () => {
    if (live(u) && u.mem.amiyaMedicEnd === generation) u.mem.regularFormVisual = null;
  }, { owner: u });
  u.atkCd = 0;
}
export function customizeAmiyaMedicKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  kit.trait = { ...attack, install: null, interruptOnSkillChange: true, retargetOnRelease: false,
    canAttack: () => !u.mem.amiyaMedicCast,
    windup: () => {
      const clip = mode(u) ? `Skill_${mode(u)}_Attack` : 'Attack';
      u.mem.amiyaMedicAttackClip = clip;
      return model(u).eventPayloads[clip][0].time / rate(u);
    }, attackVisual: () => u.mem.amiyaMedicAttackClip, launchAttack: flight };
  const s = def.skill, n = Number(s.id.at(-1));
  kit.skill = { kind: 'duration', duration: s.duration,
    ...(n === 1 ? { mods: { aspd: s.bb.attack_speed } }
      : { attack: { dmgType: 'true', maxTargets: 2, launchAttack: (battle, a, p, e, info) => {
        if (canTargetEnemy(a, e, p)) battle.dealDamage(a, e, {
          amount: a.s.atk * a.s.atkScaleMul, type: 'true', isAttack: true, isSkill: true,
          applyWay: 'ranged', attackId: info.attackId,
        });
      } }, isExhausted: () => b.bench[ID]?.amiyaMedicSecondUsed === true }),
    canActivate: () => !u.mem.amiyaMedicCast && !u.s.flags.disarm,
    onStart: () => { aura(b); begin(b, u, n); },
    onEnd: ({ reason }) => end(b, u, reason), id: s.id, name: s.name };
}
export function installAmiyaMedic({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  b.on('calculatedDamage', ({ source, target, dmg, amount }) => {
    if (source !== u || !live(u) || target.side !== 'enemy' || isHpLoss(dmg)
      || !['phys', 'arts', 'true'].includes(dmg.type) || !(amount > 0)) return;
    // S1's ATTACK-family heal precedes the separate trait receipt. Eligibility
    // and the active mode are sampled when the projectile damage is calculated.
    if (mode(u) === 1 && dmg.isAttack) {
      const keys = new Set(absoluteRangeKeys(def.skill.rangeGrid, u.tileR, u.tileC, u.dir));
      const heal = u.s.atk * u.skill.bb.heal_scale;
      for (const a of b.allyUnits) if (healable(b, u, a, true) && bodyInKeys(a, keys)) b.heal(u, a, heal);
    }
    const a = recipient(b, u);
    if (a) b.heal(u, a, amount * def.traitBb.scale);
  }, { owner: u });
  for (const event of ['deploy', 'tick']) b.on(event, () => aura(b), { owner: u });
  b.on('death', ({ unit }) => {
    if (unit === u) { endCast(b, u); u.mem.regularFormVisual = null; }
    aura(b);
  }, { owner: u });
  b.on('battleEnd', () => {
    endCast(b, u); b.removeBuff(u, 'amiya3:atk'); u.mem.regularFormVisual = null;
    for (const a of b.allyUnits) for (const key of ['amiya3:hp', 'amiya3:regen']) b.removeBuff(a, key);
  }, { owner: u });
}
