// SPDX-License-Identifier: GPL-3.0-or-later
// Original graphs and bounded callback/event mappings: arkpedia-amiya-guard-prefabs.json.
import evidence from '../../../data/arkpedia-amiya-guard-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { absoluteRangeKeys, canTargetEnemy } from '../targeting.js';
import { bodyInKeys } from '../body.js';
const ID = 'char_1001_amiya2';
const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const events = (u, clip) => model(u).eventPayloads[clip].filter(e => e.name === 'OnAttack').map(e => e.time);
const speed = (u, cap = Infinity) => Math.min(cap, u.s.aspd / 100);
const mode = u => u.skill.active ? Number(u.skill.id.at(-1)) : 0;
const plain = { attack: 'melee', projectile: 'none', dmgType: 'arts', canHitFly: false,
  hits: 1, hitsFn: null, maxTargets: 1, splashRadius: 0, chain: null,
  allInRange: false, hitAllBlocked: false, maxTargetsByBlock: false, applyWay: 'melee' };
function aura(b) {
  const sources = b.allyUnits.filter(u => u.defId === ID && live(u) && u.def.talents.length);
  const strongest = sources.sort((a, z) => auraValue(z) - auraValue(a))[0];
  for (const a of b.allyUnits) {
    const old = a.findBuff('amiya2:aura');
    if (!strongest || !live(a) || a.kind === 'device') {
      if (old) b.removeBuff(a, 'amiya2:aura');
      continue;
    }
    const bb = strongest.def.talents[0].bb, scale = strongest.skill.active ? strongest.def.skill.bb.talent_scale : 1;
    if (old?.source === strongest && old.mods.atkPct === bb.atk * scale && old.mods.defPct === bb.def * scale) continue;
    b.addBuff(a, { key: 'amiya2:aura', source: strongest, mods: { atkPct: bb.atk * scale, defPct: bb.def * scale } });
  }
}
function auraValue(u) { return u.def.talents[0].bb.atk * (u.skill.active ? u.def.skill.bb.talent_scale : 1); }
function candidates(b, u) {
  const keys = new Set(absoluteRangeKeys(u.def.skill.rangeGrid, u.tileR, u.tileC, u.dir));
  return b.enemies.filter(e => canTargetEnemy(u, e, plain) && bodyInKeys(e, keys))
    .sort((a, z) => a.hp - z.hp || a.deploySeq - z.deploySeq || String(a.id).localeCompare(String(z.id)));
}
function normalStrike(b, u, p, e, info) {
  if (!canTargetEnemy(u, e, p)) return false;
  resolveHit(b, u, { ...p, hits: 1, hitsFn: null, chain: null, splashRadius: 0 }, e, info, e.x, e.y);
  return true;
}
function launch(b, u, p, e, info) {
  if (!normalStrike(b, u, p, e, info) || mode(u) !== 1) return;
  const seq = u.deploySeq, victimSeq = e.deploySeq, epoch = u.attackControlEpoch,
    activation = u.skill.activations, rate = u.mem.amiyaAttackSpeed, began = u.mem.amiyaAttackStarted;
  const times = events(u, 'Skill_1');
  b.after(Math.max(0, began + times[1] / rate - b.time), () => {
    if (live(u) && u.deploySeq === seq && u.attackControlEpoch === epoch && u.canAct
      && !u.s.flags.disarm && mode(u) === 1 && u.skill.activations === activation
      && e.deploySeq === victimSeq) normalStrike(b, u, p, e, info);
  }, { owner: u });
}
function valid(u, c) {
  return live(u) && u.mem.amiyaCast === c && u.deploySeq === c.seq
    && u.attackControlEpoch === c.epoch && u.canAct && u.skill.active && u.skill.activations === c.activation;
}
function clearCast(b, u) {
  const c = u.mem.amiyaCast;
  if (!c) return;
  c.watch?.cancel();
  for (const timer of c.timers) timer.cancel();
  u.mem.amiyaCast = null;
  b.removeBuff(u, 'amiya2:cast');
  u.mem.regularFormVisual = mode(u) === 2 ? { clip: 'Skill_2_Idle', loop: true } : null;
  u.atkCd = 0;
}
function beginSecond(b, u) {
  b.bench[ID].amiyaSecondUsed = true;
  const rate = speed(u, 1), m = model(u);
  b.addBuff(u, { key: 'amiya2:cast', flags: { disarm: true, noBlock: true,
    invulnerable: true, untargetable: true, noSp: true } });
  const c = { seq: u.deploySeq, epoch: u.attackControlEpoch, activation: u.skill.activations,
    timers: [], phase: 'slashes', kills: 0 };
  u.mem.amiyaCast = c;
  u.mem.regularFormVisual = { clip: 'Skill_2', loop: false, speed: rate };
  const after = (delay, callback) => c.timers.push(b.after(delay, () => {
    if (valid(u, c)) callback();
  }, { owner: u }));
  // Explicit local cursor: consume the first selected-times original payloads;
  // keep the eleventh event in evidence without making an eleventh strike.
  const times = events(u, 'Skill_2').slice(0, u.def.skill.bb.times);
  for (const [i, time] of times.entries()) after(time / rate, () => {
    const e = candidates(b, u)[0];
    if (!e) return; // Empty payloads are discarded, not deferred or refunded.
    if (i !== times.length - 1) {
      b.dealDamage(u, e, { amount: u.s.atk * u.s.atkScaleMul * u.def.skill.bb.atk_scale,
        type: 'arts', isAttack: true, isSkill: true, applyWay: 'melee',
        attackId: ++b._attackSeq, tags: ['amiya2:slash'] });
    } else {
      const victimSeq = e.deploySeq;
      // The final cancellation branch emits no immediate Arts receipt. Its
      // native buff clock is fixed .4s, independently of animation playback.
      after(.4, () => {
        if (e.deploySeq !== victimSeq || !canTargetEnemy(u, e, plain)) return;
        b.dealDamage(u, e, { amount: u.s.atk * u.s.atkScaleMul * u.def.skill.bb.atk_scale_2,
          type: 'true', isAttack: false, isSkill: true, applyWay: 'melee',
          attackId: ++b._attackSeq, tags: ['amiya2:slash', 'amiya2:final'] });
      });
    }
  });
  const lastReceipt = times.at(-1) / rate + .4;
  const endingAt = Math.max(m.durations.Skill_2 / rate, lastReceipt + .2);
  after(endingAt, () => {
    c.phase = 'end';
    u.mem.regularFormVisual = { clip: 'Skill_2_End', loop: false, speed: rate };
  });
  after(endingAt + m.durations.Skill_2_End / rate, () => clearCast(b, u));
  c.watch = b.every(b.dt, () => { if (!valid(u, c)) clearCast(b, u); }, { owner: u });
}
export function customizeAmiyaGuardKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  kit.trait = { ...plain, interruptOnSkillChange: true, retargetOnRelease: false,
    canAttack: () => !u.mem.amiyaCast,
    windup: () => {
      const clip = mode(u) === 1 ? 'Skill_1' : mode(u) === 2 ? 'Skill_2_Loop' : 'Attack';
      u.mem.amiyaAttackClip = clip; u.mem.amiyaAttackSpeed = speed(u);
      u.mem.amiyaAttackStarted = b.time;
      return events(u, clip)[0] / u.mem.amiyaAttackSpeed;
    }, attackVisual: () => u.mem.amiyaAttackClip, launchAttack: launch };
  const s = def.skill, n = Number(s.id.at(-1));
  kit.skill = n === 1 ? { kind: 'duration', duration: s.duration,
    mods: { atkPct: s.bb.atk, dodgeArts: s.bb.prob },
    onStart: () => aura(b), onEnd: () => { u.atkCd = 0; aura(b); } }
    : { kind: 'duration', duration: s.duration, attack: { dmgType: 'true' },
      isExhausted: () => b.bench[ID]?.amiyaSecondUsed === true,
      canActivate: () => !u.mem.amiyaCast && candidates(b, u).length > 0,
      onStart: () => { aura(b); beginSecond(b, u); },
      onEnd: () => { clearCast(b, u); b.removeBuff(u, 'amiya2:kill'); u.mem.regularFormVisual = null; aura(b); } };
  Object.assign(kit.skill, { id: s.id, name: s.name });
}
export function installAmiyaGuard({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  for (const event of ['deploy', 'death', 'tick']) b.on(event, () => aura(b), { owner: u });
  b.on('beforeStatus', c => {
    if (c.target === u && u.mem.amiyaCast && ['stun', 'freeze', 'silence'].includes(c.status)) c.cancel = true;
  }, { owner: u });
  b.on('death', ({ unit, killer }) => {
    if (unit === u) { clearCast(b, u); aura(b); return; }
    const c = u.mem.amiyaCast;
    if (killer !== u || !c || c.phase !== 'slashes' || !valid(u, c)) return;
    c.kills = Math.min(c.kills + 1, def.skill.bb['amiya2_s_2[kill].max_stack_cnt']);
    b.addBuff(u, { key: 'amiya2:kill', mods: {
      atkPct: def.skill.bb['amiya2_s_2[kill].atk'] * c.kills,
      resFlat: def.skill.bb['amiya2_s_2[kill].magic_resistance'] * c.kills } });
  }, { owner: u });
  b.on('battleEnd', () => {
    clearCast(b, u); b.removeBuff(u, 'amiya2:kill');
    for (const a of b.allyUnits) b.removeBuff(a, 'amiya2:aura');
  }, { owner: u });
}
