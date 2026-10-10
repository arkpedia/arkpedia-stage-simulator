// SPDX-License-Identifier: GPL-3.0-or-later
// Original graphs, event payloads and bounded native dispatch mappings are in
// arkpedia-ines-prefabs.json. Shadow Sentry is a managed projectile, not a token.
import evidence from '../../../data/arkpedia-ines-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { absoluteRangeKeys, canTargetEnemy } from '../targeting.js';
import { bodyInKeys, bodyDist } from '../body.js';
const ID = 'char_4087_ines', DOT = 'ines_s_1[damage]';
const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const second = u => u.skill.active && u.skill.id === 'skchr_ines_2';
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const key = (u, name) => `ines:${name}:${u.id}`;
const fixedRange = evidence.tables.ranges['2-2'].grids.map(p => [p.row, p.col]);
function stateFor(b) {
  if (!b.inesState) {
    const state = b.inesState = { sentry: null, firstUsed: false, affected: new Set() };
    // This controller belongs to the battle, so removing the original owner
    // does not cancel the persistent sentry's reveal/slow or its exit cleanup.
    b.on('tick', () => syncRange(b));
    b.on('battleEnd', () => { state.sentry = null; syncRange(b); });
  }
  return b.inesState;
}
export function adjustInesCost(b, id, cost) {
  return id === ID && b.bench[id]?.build.skillId === 'skchr_ines_3'
    && !b.inesState?.firstUsed ? 0 : cost;
}
function syncRange(b) {
  const state = b.inesState;
  if (!state) return;
  const u = b.bench[ID]?.unit, owner = live(u) && !u.mem.inesFirst
    && u.def.talents.some(t => t.bb.move_speed != null) ? u : null;
  const k = 'ines:sentry-aura';
  for (const e of new Set([...b.enemies, ...state.affected])) {
    const inOwner = owner && bodyInKeys(e, owner.rangeKeySet);
    const inSentry = state.sentry && bodyInKeys(e, state.sentry.range);
    // The native aura ignores target-free and camouflage for both motions.
    // The two areas are one source: overlap must not multiply the slow twice.
    const allowed = !b.finished && live(e) && (inOwner || inSentry);
    if (!allowed) { b.removeBuff(e, k); state.affected.delete(e); }
    else {
      state.affected.add(e);
      if (!e.findBuff(k)) b.addBuff(e, { key: k, source: owner ?? state.sentry.source,
        flags: { reveal: true }, mods: { moveMul: .7 } });
    }
  }
}
function sentry(b, u) {
  const state = stateFor(b);
  state.sentry = { x: u.x, y: u.y, dir: u.dir, source: u,
    range: new Set(absoluteRangeKeys(fixedRange, u.tileR, u.tileC, u.dir, 0)) };
  syncRange(b);
}
function syncAtk(b, u) {
  const sum = [...u.mem.inesAtk.values()].reduce((n, v) => n + v, 0);
  if (!sum) b.removeBuff(u, 'ines:atk-owner');
  else b.addBuff(u, { key: 'ines:atk-owner', source: u, mods: { atkFlat: sum } });
}
function clearSpeed(b, u) {
  for (const e of u.mem.inesSpeed.keys()) b.removeBuff(e, key(u, 'speed'));
  u.mem.inesSpeed.clear(); u.mem.inesSpeedTotal = 0; b.removeBuff(u, 'ines:speed-owner');
}
function clearAtk(b, u) {
  for (const e of u.mem.inesMarks) {
    b.removeBuff(e, key(u, 'atk')); b.removeBuff(e, key(u, 'mark'));
  }
  // The independent Bind is not derived from the owner talent: it lasts its
  // selected duration even when the owner retreats and its mark is removed.
  u.mem.inesMarks.clear(); u.mem.inesAtk.clear(); syncAtk(b, u);
}
function firstHit(b, u, e) {
  const t = u.def.talents.find(t => t.bb.steal_atk != null)?.bb;
  if (!t || u.mem.inesMarks.has(e)) return;
  u.mem.inesMarks.add(e);
  b.addBuff(e, { key: key(u, 'mark'), source: u });
  if (!e.def.immune?.has('bind'))
    b.applyStatus(e, 'bind', { duration: t.duration, source: u, key: key(u, 'bind') });
  const total = [...u.mem.inesAtk.values()].reduce((n, v) => n + v, 0);
  const amount = Math.min(t.steal_atk, Math.max(0, t.steal_atk_max - total));
  if (amount > 0) {
    u.mem.inesAtk.set(e, amount);
    b.addBuff(e, { key: key(u, 'atk'), source: u, mods: { atkFlat: -amount } });
    syncAtk(b, u);
  }
}
function speedHit(b, u, e) {
  const bb = u.skill.bb;
  const amount = Math.min(bb['attack@steal_atk_speed'],
    Math.max(0, bb['attack@steal_atk_speed_max'] - u.mem.inesSpeedTotal));
  if (!(amount > 0)) return;
  const targetTotal = (u.mem.inesSpeed.get(e) ?? 0) + amount;
  u.mem.inesSpeed.set(e, targetTotal); u.mem.inesSpeedTotal += amount;
  b.addBuff(e, { key: key(u, 'speed'), source: u, mods: { aspd: -targetTotal } });
  b.addBuff(u, { key: 'ines:speed-owner', source: u, mods: { aspd: u.mem.inesSpeedTotal } });
}
function bleed(b, u, e) {
  const bb = u.skill.bb, value = u.s.atk * bb.bleed_atk_scale;
  const old = e.findBuff(DOT);
  if (old) {
    // Native EXTEND/takeSnapshotWhenExtend1 retains its cadence and replaces
    // the selected ATK snapshot. One shared key never creates stacked ticks.
    old.timeLeft = Math.max(old.timeLeft, bb.bleed_duration);
    old.data.expires = b.time + old.timeLeft;
    old.data.source = u; old.data.value = value; old.source = u;
    return;
  }
  const clock = { source: u, value, next: b.time + .9, expires: b.time + bb.bleed_duration };
  b.addBuff(e, { key: DOT, source: u, duration: bb.bleed_duration, data: clock,
    onTick: () => {
      while (live(e) && b.time + 1e-9 >= clock.next && clock.next < clock.expires - 1e-9) {
        clock.next += 1;
        b.dealDamage(clock.source, e, { amount: clock.value, type: 'arts', noSp: true,
          canDodge: false, ignoreSelect: true, tags: ['dot', 'ines:bleed'] });
      }
    } });
  b.addDp(u.ownerId, bb.cost);
}
function clip(u, targets) {
  return `${second(u) ? 'Skill_2_' : ''}${targets.some(e => e.blockedBy === u) ? 'Combat' : 'Attack'}`;
}
function launch(b, u, p, e, info) {
  if (!canTargetEnemy(u, e, p)) return;
  const melee = u.mem.inesAttackClip?.endsWith('Combat');
  const one = info.isSkill && u.skill.id === 'skchr_ines_1';
  const hit = { ...p, hits: 1, hitsFn: null, splashRadius: 0, chain: null,
    attack: melee ? 'melee' : 'ranged', applyWay: melee ? 'melee' : 'ranged', tags: ['ines:normal'] };
  const impact = (e, x, y) => {
    if (!e || !canTargetEnemy(u, e, p)) return;
    if (one) bleed(b, u, e);
    resolveHit(b, u, hit, e, info, x, y);
  };
  if (melee) impact(e, e.x, e.y);
  else b.addProjectile({ from: u, target: e, source: u, speed: 10, maxAge: 10,
    visual: 'arrow', data: { arkpediaTrackedVisual: true },
    onHit: ({ target, x, y }) => impact(target, x, y) });
}
function contact(e, a, z, radius) {
  const dx = z.x - a.x, dy = z.y - a.y, n = dx * dx + dy * dy;
  const t = n ? Math.max(0, Math.min(1, ((e.x - a.x) * dx + (e.y - a.y) * dy) / n)) : 0;
  return bodyDist(e, a.x + t * dx, a.y + t * dy) <= radius + 1e-9;
}
function retrieve(b, u) {
  const state = stateFor(b), from = state.sentry;
  if (!from || !live(u)) return;
  state.sentry = null; syncRange(b);
  const hit = new Set(), bb = u.skill.bb;
  b.addProjectile({ from, target: u, source: u, speed: 10, maxAge: 10,
    visual: 'arrow', data: { arkpediaTrackedVisual: true, inesRetrieval: true },
    onMove: ({ previous, projectile }) => {
      if (!live(u)) return;
      // Swept circle per tick, not an explosion centred on the operator. The
      // original selector ignores target-free but has an invisibility filter.
      const p = { canHitFly: true, ignoreTargetFree: () => true };
      const victims = b.enemies.filter(e => !hit.has(e) && canTargetEnemy(u, e, p)
        && contact(e, previous, projectile, bb.projectile_range))
        .sort((a, z) => Math.hypot(a.x - previous.x, a.y - previous.y)
          - Math.hypot(z.x - previous.x, z.y - previous.y) || a.spawnSeq - z.spawnSeq);
      for (const e of victims) {
        if (hit.size >= bb.max_target) break;
        hit.add(e);
        b.dealDamage(u, e, { amount: u.s.atk * u.s.atkScaleMul * bb.atk_scale,
          type: 'phys', isSkill: true, applyWay: 'ranged', ignoreSelect: true, tags: ['ines:normal', 'ines:retrieval'] });
      }
    } });
}
function transition(b, u, begin, idle) {
  const generation = u.mem.inesForm = (u.mem.inesForm ?? 0) + 1;
  u.mem.regularFormVisual = { clip: begin, loop: false };
  const duration = model(u).durations[begin];
  b.addBuff(u, { key: 'ines:transition', duration, flags: { disarm: true } });
  b.after(duration, () => { if (live(u) && u.mem.inesForm === generation)
    u.mem.regularFormVisual = idle ? { clip: idle, loop: true } : null; }, { owner: u });
}
export function customizeInesKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  kit.trait = { install: null, attack: 'ranged', projectile: 'none', dmgType: 'phys',
    canHitFly: true, hits: 1, hitsFn: null, maxTargets: 1, allInRange: false,
    maxTargetsByBlock: false, hitAllBlocked: false, splashRadius: 0, chain: null, dmgMul: null,
    retargetOnRelease: false, interruptOnSkillChange: true, launchAttack: launch,
    windup: (_b, a, targets) => { a.mem.inesAttackClip = clip(a, targets);
      return model(a).hits[a.mem.inesAttackClip][0] / (a.s.aspd / 100); },
    attackVisual: (_b, a) => a.mem.inesAttackClip };
  const s = def.skill, n = Number(s.id.at(-1));
  if (n === 1) kit.skill = { kind: 'instant', flags: { noSp: true }, attack: {} };
  else if (n === 2) kit.skill = { kind: 'duration', duration: s.duration,
    mods: { atkPct: s.bb.atk }, flags: { stealth: true }, targeting: { rangeGrid: s.rangeGrid },
    onStart: () => { clearSpeed(b, u); transition(b, u, 'Skill_2_Begin', 'Skill_2_Idle'); },
    onEnd: ({ reason }) => { clearSpeed(b, u); u.mem.inesForm++;
      b.removeBuff(u, 'ines:transition');
      if (live(u) && ['duration', 'manual'].includes(reason)) transition(b, u, 'Skill_2_End', null);
      else u.mem.regularFormVisual = null; } };
  else kit.skill = { kind: 'duration', duration: s.duration, spType: 'none', trigger: 'NEVER',
    activateOnDeploy: true, isExhausted: () => u.skill.activations >= 1,
    onStart: () => {
      const state = stateFor(b);
      u.mem.inesFirst = !state.firstUsed;
      if (u.mem.inesFirst) {
        state.firstUsed = true; u.deploymentSlotCost = 0;
        u.mem.regularFormVisual = { clip: 'Start_Skill', loop: false };
        b.addBuff(u, { key: 'ines:first', flags: { disarm: true, noBlock: true, untargetable: true, invulnerable: true } });
        b.after(model(u).hits.Start_Skill[0], () => {
          if (!live(u)) return;
          sentry(b, u); b.retreat(u, { permanent: true, reason: 'ines-first-sentry' });
        }, { owner: u });
      } else {
        // The normal deployment ability waits for Start's original OnAttack.
        // Start_Skill's separate event is only the first replacement branch.
        const delay = model(u).hits.Start[0];
        b.addBuff(u, { key: 'ines:startup', duration: delay, flags: { disarm: true } });
        b.after(delay, () => {
          if (!live(u) || !u.skill.active) return;
          u.skill.timeLeft = s.duration;
          b.addBuff(u, { key: 'ines:s3-atk', mods: { atkPct: s.bb.atk } });
          b.after(.03, () => { if (live(u) && u.skill.active) retrieve(b, u); }, { owner: u });
        }, { owner: u });
      }
    }, onEnd: () => b.removeBuff(u, 'ines:s3-atk') };
  Object.assign(kit.skill, { id: s.id, name: s.name });
}
export function installInes({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  stateFor(b);
  u.mem.inesMarks = new Set(); u.mem.inesAtk = new Map();
  u.mem.inesSpeed = new Map(); u.mem.inesSpeedTotal = 0;
  b.on('hit', ({ source, target, dmg }) => {
    // Native IsDamage has no IsAttack/type restriction. Retrieval and S1 DOT
    // are not fabricated additional attacks. Local hit is a pre-mitigation
    // bridge; exact Unity evade/buff-priority ordering remains unverified.
    if (source !== u || !live(u) || !live(target) || target.side !== 'enemy' || dmg.cancel) return;
    firstHit(b, u, target); if (second(u)) speedHit(b, u, target);
  }, { owner: u });
  b.on('damaged', ({ source, target, dmg }) => {
    if (source === u && live(u) && u.skill.active && !u.mem.inesFirst
      && target.side === 'enemy' && dmg.tags.includes('ines:normal')
      && ['skchr_ines_2', 'skchr_ines_3'].includes(u.skill.id)) b.addDp(u.ownerId, u.skill.bb.cost);
  }, { owner: u });
  const invalid = e => !live(e) || e.s.flags.untargetable;
  const cleanup = () => {
    for (const e of u.mem.inesAtk.keys()) if (invalid(e)) {
      b.removeBuff(e, key(u, 'atk')); u.mem.inesAtk.delete(e); syncAtk(b, u);
    }
    for (const e of u.mem.inesSpeed.keys()) if (invalid(e)) b.removeBuff(e, key(u, 'speed'));
  };
  b.on('tick', cleanup, { owner: u });
  b.on('deploy', ({ unit }) => { if (unit === u) {
    // StandardBattle fills the bench after _deploy emits, so pass this owner
    // directly for its initial reveal instead of waiting one battle tick.
    b.bench[ID].unit = u; syncRange(b);
  } }, { owner: u });
  b.on('death', ({ unit }) => {
    if (unit !== u) { cleanup(); return; }
    clearAtk(b, u); clearSpeed(b, u); u.mem.regularFormVisual = null;
    if (u.mem.inesFirst) {
      // One zero-cost placement; its forced return has no refund, increased
      // deployment count, or redeployment cooldown. It does not emit T2 again.
      b.bench[ID].deployments = Math.max(0, b.bench[ID].deployments - 1);
      b.bench[ID].readyAt = b.time;
    } else if (def.talents.some(t => t.bb.move_speed != null)) sentry(b, u);
    syncRange(b);
  }, { owner: u });
}
