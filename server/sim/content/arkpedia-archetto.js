// SPDX-License-Identifier: GPL-3.0-or-later
import { ARCHETTO_OPERATORS } from '../../../shared/arkpedia/archetto-operators.js';
import evidence from '../../../data/arkpedia-archetto-prefabs.json' with { type: 'json' };
import { acquireTargets, effectiveProfile, resolveHit } from '../ai.js';
import { canTargetEnemy } from '../targeting.js';

const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[u.defId][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const rate = u => u.s.aspd / 100;
const windup = clip => (_b, u) => model(u).hits[clip][0] / rate(u);
const plain = p => ({ ...p, hits: 1, hitsFn: null, chain: null, splashRadius: 0, dmgMul: null });
const legal = (u, target, p, seq) => target?.deploySeq === seq && canTargetEnemy(u, target, p);

function flight(b, u, p, target, info, speed, from = u, onHit = null, maxAge = 5) {
  return b.addProjectile({ from, target, source: u, speed, maxAge,
    visual: 'arrow', data: { arkpediaTrackedVisual: true },
    onHit: ({ target: e, x, y }) => {
      if (!e || !canTargetEnemy(u, e, p)) return;
      if (onHit) onHit(e, x, y);
      else resolveHit(b, u, plain(p), e, info, x, y);
    } });
}
function scatter(b, u, p, target, info) {
  const bb = u.skill.bb;
  u.mem.archettoEmittedAttackId = info.attackId;
  flight(b, u, p, target, info, 10, u, (e, x, y) => {
    // Secondary arrows are selected at the primary arrival and have their own
    // native slower flight. They are not a duplicate splash on the trace target.
    const others = b.enemiesInRadius(x, y, 1.5).filter(a => a !== e
      && canTargetEnemy(u, a, p)).slice(0, bb.max_target - 1);
    resolveHit(b, u, plain(p), e, info, x, y);
    for (const a of others) flight(b, u, { ...p, atkScale: bb.atk_scale_2 }, a,
      info, 6, { x, y });
  });
}
function launch(b, u, p, target, info) {
  if (!canTargetEnemy(u, target, p)) return;
  if (info.isSkill && u.skill.id === 'skchr_archet_1') { scatter(b, u, p, target, info); return; }
  flight(b, u, p, target, info, info.isSkill ? 15 : 10);
}
function s3Rounds(b, u, p, info) {
  const count = u.skill.bb['attack@times'], seq = u.deploySeq;
  const activation = u.skill.activations, control = u.attackControlEpoch;
  const valid = () => live(u) && u.deploySeq === seq && u.canAct
    && u.attackControlEpoch === control && u.skill.activations === activation;
  // Only the first target's launch schedules the remaining rounds. The source
  // attack is one multi-target attack, rather than one burst per victim.
  if (u.mem.archettoBurstId === info.attackId) return;
  u.mem.archettoBurstId = info.attackId;
  let canceled = false;
  const watcher = b.every(b.dt, () => { if (!valid()) canceled = true; }, { owner: u });
  for (let round = 1; round < count; round++) b.after(round * .18000000715255737, () => {
    if (!canceled && valid()) {
      // The native timing3 multi-attack selector is distinct from CAST0 and
      // locked-input1. Per-round selection is a bounded runtime interpretation.
      for (const e of acquireTargets(b, u, p)) flight(b, u, p, e, info, 15);
    }
    if (round === count - 1) watcher.cancel();
  }, { owner: u });
}
function s3Launch(b, u, p, target, info) {
  if (!canTargetEnemy(u, target, p)) return;
  flight(b, u, p, target, info, 15);
  s3Rounds(b, u, p, info);
}
function ricochet(b, u, p, input, info) {
  const born = b.time, visited = new Set();
  let remaining = u.skill.bb.times;
  const unexpired = () => b.time < born + 5 - 1e-9;
  const seek = point => {
    if (--remaining <= 0 || !unexpired()) return;
    const next = b.enemiesInRadius(point.x, point.y, 1.5)
      .find(e => !visited.has(e.id) && canTargetEnemy(u, e, p));
    if (next) segment(next, point, 6);
  };
  const segment = (target, from, speed) => {
    if (!unexpired()) return;
    const seq = target.deploySeq;
    flight(b, u, p, target, info, speed, from, (e, x, y) => {
      if (!unexpired()) return;
      visited.add(e.id);
      const count = remaining;
      const hit = index => {
        if (!unexpired() || !legal(u, e, p, seq)) return;
        resolveHit(b, u, plain(p), e, info, e.x, e.y);
        if (index === count - 1 && e.alive && e.deployed) seek({ x: e.x, y: e.y });
      };
      hit(0);
      // These callbacks belong to the already born arrow, not its withdrawn
      // source. A dead/disappeared target terminates this unrecovered mover;
      // it never invents a replacement for the current repeated-hit input.
      for (let i = 1; i < count; i++) b.after(i * .15000000596046448, () => hit(i));
    }, born + 5 - b.time);
  };
  segment(input, u, 10);
}
function castS2(b, u) {
  const p = { ...plain(effectiveProfile(u)), atkScale: u.skill.bb.atk_scale };
  const input = acquireTargets(b, u, p)[0];
  if (!input) return;
  const inputPos = { x: input.x, y: input.y };
  const seq = u.deploySeq, activation = u.skill.activations, inputSeq = input.deploySeq;
  const clip = model(u), playback = rate(u), end = clip.durations.Skill_2 / playback;
  const key = `archetto:cast:${u.id}`;
  b.addBuff(u, { key, source: u, duration: end, flags: { disarm: true } });
  const spKey = `archetto:cast-sp:${u.id}`;
  // Native allowSpRecoveryWhenAffecting0 covers the unborn cast. The exact
  // native post-release cast-end clock is unrecovered; resume at its emission.
  b.addBuff(u, { key: spKey, source: u, flags: { noSp: true } });
  const control = u.attackControlEpoch;
  u.skillAnimUntil = b.time + end;
  u.mem.regularFormVisual = { clip: 'Skill_2', loop: false };
  u.atkCd = Math.max(u.atkCd, end);
  const valid = () => live(u) && u.deploySeq === seq
    && u.attackControlEpoch === control && u.skill.activations === activation
    && u.canAct;
  let canceled = false;
  const watcher = b.every(b.dt, () => { if (!valid()) canceled = true; }, { owner: u });
  b.after(clip.hits.Skill_2[0] / playback, () => {
    watcher.cancel();
    b.removeBuff(u, spKey);
    if (!canceled && valid()) {
      const info = { isSkill: true, attackId: `archetto:s2:${u.id}:${activation}` };
      if (legal(u, input, p, inputSeq)) ricochet(b, u, p, input, info);
      else if (!input.alive || !input.deployed || input.hidden || input.deploySeq !== inputSeq)
        // Explicit emitToInputPosWhenTargetIsInvalid1 is a missed fixed-point
        // arrow, distinct from the born mover's useMapPosIfTargetInvalid0.
        b.addProjectile({ from: u, to: inputPos, source: u, speed: 10, maxAge: 5,
          visual: 'arrow', data: { arkpediaTrackedVisual: true } });
    }
  }, { owner: u });
  b.after(end, () => {
    if (live(u) && u.deploySeq === seq && u.skill.activations === activation)
      u.mem.regularFormVisual = null;
  }, { owner: u });
}

export function customizeArchettoKit({ battle: b, id, def, unit: u, kit }) {
  if (!ARCHETTO_OPERATORS[id]) return;
  kit.install = null;
  kit.trait = { attack: 'ranged', dmgType: 'phys', canHitFly: true,
    projectile: 'none', priority: 'fly', maxTargets: 1, maxTargetsByBlock: false,
    hitAllBlocked: false, allInRange: false, rangeAoe: false, splashRadius: 0,
    hits: 1, hitsFn: null, chain: null, dmgMul: null, install: null,
    retargetOnRelease: true, interruptOnSkillChange: true,
    attackVisual: 'Attack', windup: windup('Attack'), launchAttack: launch };
  const s = def.skill, bb = s.bb;
  if (s.id === 'skchr_archet_1') kit.skill = { kind: 'instant', attack: {
    atkScale: bb.atk_scale, attackVisual: 'Skill_1', windup: windup('Skill_1'),
    afterAttack: (_b, unit, _targets, meta) => {
      if (unit.mem.archettoEmittedAttackId !== meta.attackId && meta.inputTargets.length
        && meta.inputTargets.every(e => !e.alive)) unit.skill.addCharge(1);
    } } };
  else if (s.id === 'skchr_archet_2') kit.skill = { kind: 'instant',
    canActivate: () => !u.findBuff(`archetto:cast:${u.id}`)
      && acquireTargets(b, u, effectiveProfile(u)).length > 0,
    onStart: () => castS2(b, u) };
  else kit.skill = { kind: 'duration', duration: s.duration, mods: { atkPct: bb.atk },
    targeting: { maxTargets: bb['attack@max_target'], rangeExtend: bb.ability_range_forward_extend },
    attack: { launchAttack: s3Launch, attackVisual: 'Skill_3', windup: windup('Skill_3'),
      retargetOnRelease: false } };
  kit.skill.id = s.id; kit.skill.name = s.name;
}

function syncSniperSp(b) {
  const producers = [...b._archettoSpProducers.values()].filter(p => live(p.unit));
  producers.sort((a, z) => a.bb.interval - z.bb.interval);
  const key = 'archetto:sniper-sp';
  for (const a of b.allyUnits) {
    // Source purposeNONE does not prohibit unhealable allies. Its advanced
    // validator explicitly ignores allied isolation, but retains target-free.
    const chosen = live(a) && a.kind !== 'device' && a.def.profession === 'SNIPER'
      && !a.s.flags.untargetable ? producers[0] : null;
    const old = a.findBuff(key);
    if (!chosen) { if (old) b.removeBuff(a, key); continue; }
    if (old?.source === chosen.unit) continue;
    if (old) b.removeBuff(a, key);
    b.addBuff(a, { key, source: chosen.unit, interval: chosen.bb.interval,
      onTick: ({ unit }) => { if (unit.skill.spType === 'attack') unit.skill.gainSp(chosen.bb.sp, 'buff'); } });
  }
}
export function installArchetto({ battle: b, unit: u, def }) {
  if (!ARCHETTO_OPERATORS[def.charId]) return;
  const sp = def.talents.find(t => t.bb.interval != null)?.bb;
  if (sp) {
    b._archettoSpProducers ??= new Map(); b._archettoSpProducers.set(u.id, { unit: u, bb: sp });
    b.on('deploy', () => syncSniperSp(b), { owner: u });
    b.on('tick', () => syncSniperSp(b), { owner: u });
    b.on('death', ({ unit }) => {
      if (unit === u) b._archettoSpProducers.delete(u.id);
      syncSniperSp(b);
    }, { owner: u });
  }
  const shield = def.talents.find(t => t.bb.interval == null && t.bb.sp != null)?.bb;
  if (shield) b.addBuff(u, { key: 'archetto:shield', source: u, persist: true,
    allowDead: true, shieldHits: 1, onRemove: ({ buff }) => {
      if (buff.shieldHits === 0) u.skill.gainSp(shield.sp, 'buff');
    } });
}
