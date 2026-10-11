// SPDX-License-Identifier: GPL-3.0-or-later
// The original graph and deliberately bounded secondary/Sequence clocks are
// retained in data/arkpedia-blemishine-prefabs.json; no native frame parity.
import evidence from '../../../data/arkpedia-blemishine-prefabs.json' with { type: 'json' };
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { aggregateMods } from '../buffs.js';
import { resolveHit } from '../ai.js';

const ID = 'char_423_blemsh', DELAY = .533, SECOND_RELEASE = .5;
const present = u => u?.alive && u.deployed;
const live = u => present(u) && !u.hidden;
const model = u => evidence.models[ID][u.mem.regularAttackFacing
  ?? (['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front')];
const rate = u => Math.min(2, u.base.bat / u.s.interval);
const keys = (u, range) => new Set(absoluteRangeKeys(evidence.ranges[range].grids.map(p => [p.row, p.col]),
  u.tileR, u.tileC, u.dir));
const auraAlly = (b, u, a) => live(a) && a.kind !== 'device' && b.allySelectable(a, u)
  && !a.s.flags.untargetable;
// Mode2's purposeNONE validator explicitly ignores target-free while keeping
// ally isolation. It is not the ordinary Heal or global talent validator.
const regenAlly = (b, u, a) => live(a) && a.kind !== 'device' && b.allySelectable(a, u);
const healable = (b, u, a) => auraAlly(b, u, a) && !a.s.flags.healFree
  && !a.s.flags.noHeal && !a.profile?.noHeal;
const candidates = (b, u, range, excludeSelf) => b.allyUnits.filter(a => healable(b, u, a)
  && (!excludeSelf || a !== u) && a.hp < a.s.maxHp - .01 && bodyInKeys(a, keys(u, range)))
  .sort((a, z) => a.hpRatio - z.hpRatio || a.deploySeq - z.deploySeq);

function talentSp(b, a) {
  if (!present(a) || a.skill?.spType !== 'hurt') return;
  const owners = [...(b._arkpediaBlemishine ?? new Map()).values()];
  // Native same-key aura is not independently sourced. Disappearance alone
  // does not clear it (_clearBuffsWhenDisappear0), and heal-free is not a
  // restriction on this purposeNONE SP aura.
  const valid = owners.filter(u => present(u) && u.def.talents[0]?.bb.sp
    && auraAlly(b, u, a));
  if (valid.length) a.skill.gainSp(Math.max(...valid.map(u => u.def.talents[0].bb.sp)), 'blemsh_t_1');
}

function choose(b, u, p) {
  const out = b.enemiesInKeys(u.rangeKeys, u, p);
  for (const e of b.blockedTargets(u, p)) if (!out.includes(e)) out.push(e);
  sortEnemyTargets(b, u, out, p.priority);
  if (u.def.talents[1]) out.sort((a, z) => Number(!!z.s.flags.sleep) - Number(!!a.s.flags.sleep));
  return out.slice(0, 1);
}

function secondary(b, u, first, scale) {
  const seq = u.deploySeq, epoch = u.attackControlEpoch;
  // CAST selection happens at this secondary release, not at parent attack
  // startup. Parent mode detach alone does not cancel the extra Heal ability;
  // source retirement/disappearance or accepted control cancels unborn work.
  b.after(DELAY, () => {
    if (!live(u) || u.deploySeq !== seq || u.attackControlEpoch !== epoch
      || !u.canAct || u.s.flags.disarm) return;
    const a = candidates(b, u, first ? 'x-4' : 'x-1', !first)[0];
    if (!a) return;
    let output = null;
    const watch = b.on('heal', c => { if (c.source === u && c.target === a) output = c; });
    try { b.heal(u, a, u.s.atk * scale); } finally { b.off(watch); }
    if (output?.amount > 0) talentSp(b, u);
  }, { owner: u });
}

function clearCharge(b, u, token) {
  if (u.mem.blemshCharge !== token) return;
  u.mem.blemshCharge = null; b.removeBuff(u, 'blemsh:s1-cast');
}
function windup(b, u) {
  const first = u.skill.active && u.skill.id === 'skchr_blemsh_1';
  const third = u.skill.active && u.skill.id === 'skchr_blemsh_3';
  const clip = first ? 'Skill_1' : third ? 'Skill_3'
    : u.dir === 'DOWN' && model(u).durations.Attack_Down ? 'Attack_Down' : 'Attack';
  const speed = rate(u);
  u.mem.blemshClip = clip;
  if (first) {
    b.addBuff(u, { key: 'blemsh:s1-cast', flags: { noSp: true } });
    const token = { seq: u.deploySeq, epoch: u.attackControlEpoch, activation: u.skill.activations };
    u.mem.blemshCharge = token;
    b.after(model(u).durations[clip] / speed, () => clearCharge(b, u, token), { owner: u });
  }
  return model(u).hits[clip][0] / speed;
}

function launch(b, u, p, target, info) {
  if (!live(u) || !canTargetEnemy(u, target, p)) return;
  const first = !!p.blemshFirst, third = !!p.blemshThird;
  u.mem.blemshEmitted = info.attackId;
  let accepted = false;
  const watch = third ? b.on('damaged', c => {
    if (c.source === u && c.target === target && c.dmg?.attackId === info.attackId
      && c.dmg.isAttack && ['phys', 'arts'].includes(c.type)) accepted = true;
  }) : null;
  try {
    if (third) {
      // Active buff ON_BUFF_START produces a separate native Arts/NORMAL/NONE
      // modifier. Its source calculate suppression is represented narrowly:
      // the parent's sleeping coefficient is carried once to this child.
      const sleep = target.s.flags.sleep ? (u.def.talents[1]?.bb.atk_scale ?? 1) : 1;
      b.dealDamage(u, target, { amount: u.s.atk * p.blemshArts * sleep, type: 'arts',
        isAttack: true, isSkill: true, applyWay: 'none', attackId: info.attackId,
        tags: ['blemsh:extra'], ignoreSleep: !!u.def.talents[1] });
    }
    resolveHit(b, u, p, target, info, target.x, target.y);
  } finally { if (watch) b.off(watch); }
  // S1 is ON_ABILITY_SPELL_ON, independent of accepted modifier output.
  // S3 coalesces accepted physical/Arts outputs by originating attack ID;
  // the source listener does not contain a physical-only filter.
  if (first || third && accepted) secondary(b, u, first, p.blemshHeal);
}

function syncRecovery(b, u, scale) {
  const active = live(u) && u.skill.active && u.mem.blemshSecondAttached;
  const k = `blemsh:s2-regen:${u.id}`, range = keys(u, 'x-1');
  for (const a of b.allyUnits) {
    const eligible = active && regenAlly(b, u, a) && bodyInKeys(a, range);
    if (!eligible) { b.removeBuff(a, k); continue; }
    if (!a.findBuff(k)) {
      const pulse = () => {
        if (!live(u) || !u.skill.active || !u.mem.blemshSecondAttached
          || !regenAlly(b, u, a) || !bodyInKeys(a, keys(u, 'x-1'))) return;
        const mul = aggregateMods(a.buffs).mul.hpRegenMul ?? 1;
        b.heal(u, a, u.s.atk * scale * mul, { self: true, regen: true });
      };
      b.addBuff(a, { key: k, source: u, interval: 1, onTick: pulse });
      // Native waitFirstTriggerInterval0; a new aura attachment pulses now.
      pulse();
    }
  }
}
function clearSecondCast(b, u, token) {
  if (u.mem.blemshSecondCast !== token) return;
  u.mem.blemshSecondCast = null; b.removeBuff(u, 'blemsh:s2-cast');
  u.mem.regularFormVisual = null;
}
function secondStart(b, u, s) {
  u.mem.blemshSecondAttached = false;
  u.mem.regularAttackFacing = 'Front';
  u.mem.regularFormVisual = { clip: 'Skill_2', loop: false, forceFront: true };
  b.addBuff(u, { key: 'blemsh:s2-cast', flags: { disarm: true, noSp: true } });
  const p = { canHitFly: false, hitSleep: !!u.def.talents[1] };
  const input = b.enemies.filter(e => canTargetEnemy(u, e, p) && bodyInKeys(e, keys(u, '0-1')));
  const token = { seq: u.deploySeq, activation: u.skill.activations, epoch: u.attackControlEpoch, released: false };
  u.mem.blemshSecondCast = token;
  const valid = () => live(u) && u.mem.blemshSecondCast === token
    && u.deploySeq === token.seq && u.skill.activations === token.activation
    && u.attackControlEpoch === token.epoch && u.canAct;
  b.after(SECOND_RELEASE, () => {
    if (!valid()) return;
    token.released = true; u.mem.blemshSecondAttached = true;
    // INPUT/startup own-tile WALK selector; the special default-free relaxation
    // is Sleep-specific, never a generic invisible/untargetable override.
    for (const e of input) if (canTargetEnemy(u, e, p) && bodyInKeys(e, keys(u, '0-1')))
      b.applyStatus(e, 'sleep', { duration: s.duration, source: u });
    b.addBuff(u, { key: 'blemsh:s2-mode', mods: { atkPct: s.bb.atk } });
    syncRecovery(b, u, s.bb['attack@atk_to_hp_recovery_ratio']);
  }, { owner: u });
  b.after(evidence.models[ID].Front.durations.Skill_2, () => clearSecondCast(b, u, token), { owner: u });
}

export function customizeBlemishineKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  kit.trait = { install: null, attack: 'melee', projectile: 'none', dmgType: 'phys', canHitFly: false,
    hitSleep: !!def.talents[1], maxTargets: 1, hits: 1, hitAllBlocked: false, heal: null,
    allInRange: false, splashRadius: 0, chain: null, dmgMul: null,
    acquireTargets: choose, windup, attackVisual: (_b, a) => a.mem.blemshClip,
    launchAttack: launch, retargetOnRelease: true, interruptOnSkillChange: false };
  const s = def.skill;
  if (s.id === 'skchr_blemsh_1') kit.skill = { kind: 'instant', charges: s.bb.ct,
    canActivate: () => !u.mem.blemshCharge,
    attack: { atkScale: s.bb.atk_scale, blemshFirst: true, blemshHeal: s.bb.heal_scale,
      afterAttack: (_b, a, targets, meta) => {
        if (a.mem.blemshEmitted !== meta.attackId && !targets.length && meta.inputTargets.length
          && meta.inputTargets.every(t => !t.alive)) a.skill.addCharge(1);
      } } };
  else if (s.id === 'skchr_blemsh_2') kit.skill = { kind: 'duration', duration: SECOND_RELEASE + s.duration,
    onStart: () => secondStart(b, u, s),
    onTick: () => syncRecovery(b, u, s.bb['attack@atk_to_hp_recovery_ratio']),
    onEnd: () => {
      u.mem.blemshSecondAttached = false; b.removeBuff(u, 'blemsh:s2-mode');
      if (u.mem.blemshSecondCast) clearSecondCast(b, u, u.mem.blemshSecondCast);
      u.mem.regularAttackFacing = null; u.mem.regularFormVisual = null;
      syncRecovery(b, u, s.bb['attack@atk_to_hp_recovery_ratio']);
      // Nonderived emitted Sleep retains its own ten-second limited lifetime.
    } };
  else kit.skill = { kind: 'duration', duration: s.duration, mods: { atkPct: s.bb.atk, defPct: s.bb.def },
    attack: { blemshThird: true, blemshHeal: s.bb.heal_scale,
      blemshArts: s.bb['attack@blemsh_s_3_extra_dmg[magic].atk_scale'] } };
  kit.skill.id = s.id; kit.skill.name = s.name;
}

export function installBlemishine({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  (b._arkpediaBlemishine ??= new Map()).set(u.id, u);
  if (!b._arkpediaBlemishineAttack) {
    b._arkpediaBlemishineAttack = b.on('attack', ({ attacker, targets }) => {
      if (targets.length && attacker.side === 'ally') talentSp(b, attacker);
    });
  }
  b.on('hit', ({ source, target, dmg }) => {
    if (source === u && present(u) && def.talents[1] && target.s.flags.sleep
      && !dmg.tags.includes('blemsh:extra')) dmg.amount *= def.talents[1].bb.atk_scale;
  }, { owner: u });
  b.on('tick', () => {
    const charge = u.mem.blemshCharge;
    if (charge && (!live(u) || u.deploySeq !== charge.seq || !u.canAct
      || u.attackControlEpoch !== charge.epoch)) clearCharge(b, u, charge);
    const cast = u.mem.blemshSecondCast;
    if (cast && (!live(u) || u.deploySeq !== cast.seq || !u.canAct || u.attackControlEpoch !== cast.epoch)) {
      clearSecondCast(b, u, cast);
      if (!cast.released) u.skill.end('interrupted');
    }
  }, { owner: u });
}
