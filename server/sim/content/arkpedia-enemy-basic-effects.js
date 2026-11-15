// SPDX-License-Identifier: GPL-3.0-or-later
// Reusable selected-stage effects; shared with the legacy public factory map.
import {areaAlliesInTiles} from './arkpedia-enemy-effects.js';
import {watchDeaths} from './arkpedia-enemy-ability-runtime.js';
export const basicEnemyAbilities=Object.freeze({
  buildingAttack: ({ scale }) => [
    { spawn(_b, e) { e.profile.deferHit = true; e.profile.shot = 'none'; e.profile.targetPriority = 'tag'; e.profile.priorityTag = 'building'; },
      attack(c, b, e) { for (const target of c.targets) b.dealDamage(e, target, { amount: e.s.atk,
        type: 'phys', isAttack: true, attackId: b._attackSeq, applyWay: 'melee', tags: ['buildingAttack'] }); } },
    { sil: true, hitOut(c) { if (c.dmg.isAttack && c.target?.tags.has('building')) c.dmg.amount *= scale; } },
  ],
  secondaryAreaAttack: ({ scale, shape, radius, type, tag }) => ({
    hitOut(c, b, e) {
      if (!c.dmg.isAttack || !c.target) return;
      const target = c.target;
      b.fx('explode', { x: target.x, y: target.y, r: radius, kind: tag, tiles: shape });
      for (const unit of areaAlliesInTiles(b, e, target.tileR, target.tileC, shape, radius)) {
        if (unit === target || unit.isFlying) continue;
        b.dealDamage(e, unit, { amount: e.s.atk * scale, type, isSkill: true, canDodge: false,
          applyWay: 'melee', tags: [tag] });
      }
    },
  }),
  blockReductionOnHit: ({ amount, duration }) => ({
    sil: true,
    dealt(c, b, e) {
      if (!c.target?.alive) return;
      b.addBuff(c.target, { key: 'ab:agentBlock', source: e, duration, refresh: 'extend',
        mods: { blockCnt: amount }, visible: true });
    },
  }),
  // Punisher: every Nth attack stuns every ally in the 3×3 area around each target for the reviewed duration.
  stunAttack: ({ every, duration }) => ({
    sil: true,
    spawn(b, e, a) { a.n = 0; },
    attack(c, b, e, a) {
      a.n++;
      if (a.n % every) return;
      for (const t of c.targets ?? [c.target]) for (const u of areaAlliesInTiles(b, e, t.tileR, t.tileC, 'box', 1))
        b.applyStatus(u, 'stun', { duration, source: e });
    },
  }),
  // Acid: every attack hit adds one more permanent stack of DEF +def on the target (no cap).
  // Skullshatterer: a grenade (only while unblocked) applies a refreshing 5 s DEF ×pct to the target and its four
  // cardinal neighbours; the supported shape is the retained `skulsr_attack` native component.
  defDownOnHit: ({ def, pct, duration = 5, area = false }) => ({ dealt(c, b, e) {
    if (pct == null) { b.addBuff(c.target, { key: 'ab:defdown', refresh: 'stack', stacks: 1, maxStacks: 1e6, mods: { defFlat: def }, visible: true }); return; }
    if (area && e.blockedBy) return;
    const targets = area ? areaAlliesInTiles(b, e, c.target.tileR, c.target.tileC, 'plus', 1) : [c.target];
    for (const u of targets) if (u.alive) b.addBuff(u, { key: 'ab:defdownGrenade', duration, refresh: 'replace', mods: { defPct: pct }, visible: true });
  } }),
  // Every other enemy-side unit killed anywhere: one more permanent stack of ATK +atk (×) and ASPD +aspd, up to max.
  allyDeathStacks: ({ atk, aspd, max }) => ({
    spawn(b, e) { watchDeaths(b, e); },
    otherDeath(c, b, e) {
      const u = c.unit;
      if (!u || u === e || u.side !== 'enemy' || c.reason !== 'killed') return;
      b.addBuff(e, { key: 'ab:enhance', refresh: 'stack', stacks: 1, maxStacks: max, persist: true, visible: true, mods: { atkPct: atk, aspd } });
    },
  }),
  moveSpeedBonus: ({ mul }) => ({ spawn(b, e) { b.addBuff(e, { key: 'ab:moveSpeed', persist: true, visible: true, mods: { moveMul: mul } }); } }),
  // Ursus patrol: prioritize allies whose record name matches the reviewed names.
  namedPriority: ({ names }) => ({ spawn(b, e) { e.profile.targetPriority = 'named'; e.profile.priorityNames = names; } }),
  // Rhine Defense: the engine's hitShield consumes one Physical/Arts hit.
  hitShield: ({ count }) => ({ spawn(b, e, a, ab) { ab.hitShield = count; } }),
  // Timed flat DEF/RES buff (Roar Knightclub); the engine removes it when the duration ends.
  timedStatBuff: ({ def, res, duration }) => ({
    spawn(b, e) { b.addBuff(e, { key: 'ab:timedStat', duration, refresh: 'replace', mods: { defFlat: def, resFlat: res }, visible: true }); },
  }),
  // Tiacauh: flat DEF while the enemy is blocked, and the reviewed melee multiplier.
  blockedDef: ({ def }) => ({
    spawn(b, e, a) { a.on = false; },
    tick(b, e, a) {
      const on = !!e.blockedBy;
      if (on === a.on) return;
      a.on = on;
      if (on) b.addBuff(e, { key: 'ab:blockedDef', persist: true, visible: true, mods: { defFlat: def } });
      else b.removeBuff(e, 'ab:blockedDef');
    },
  }),
  blockedRes: ({ res }) => {
    const sync = (b, e) => {
      const active = !!e.blockedBy?.alive && e.blockedBy.deployed && !e.s.flags.silence;
      const buff = e.findBuff('ab:blockedRes');
      if (active && !buff) b.addBuff(e, { key: 'ab:blockedRes', persist: true, visible: true, mods: { resFlat: res } });
      else if (!active && buff) b.removeBuff(e, buff);
    };
    const changed = (_c, b, e) => sync(b, e);
    return { spawn: sync, tick: sync, blocked: changed, unblocked: changed, hitIn: changed };
  },
  meleeAttackScale: ({ scale }) => ({
    hitOut(c, b, e) { if (c.dmg.isAttack && e.blockedBy && scale > 0) c.dmg.amount *= scale; },
  }),
  // Technical Scout: its ranged selection may target camouflaged/stealthed allies inside the reviewed radius.
  revealCamouflage: ({ range }) => ({ spawn(b, e) { e.profile.revealRange = range; } }),
  // Vampire: up to maxTargets ordinary targets; every accepted ordinary hit heals the enemy for healScale × its
  // post-mitigation damage.
  vampireOnHit: ({ maxTargets, healScale }) => ({
    spawn(b, e, a) {
      if (maxTargets > 1) e.profile.maxTargets = Math.max(e.profile.maxTargets ?? 1, maxTargets);
      b.on('damaged', c => {
        if (c.source !== e || c.target?.side !== 'ally' || !c.dmg?.isAttack || !(c.hpLoss > 0)) return;
        b.heal(e, e, c.hpLoss * healScale);
      }, { owner: e });
    },
  }),
  // Reborn Creation: the reviewed damage_resistance template is a Physical/Arts multiplier; the bloodsucker mark is a
  // persistent identity buff (it has no attributes of its own).
  rebornDamageRes: ({ pct }) => ({
    spawn(b, e) {
      b.addBuff(e, { key: 'ab:rebornDmgRes', persist: true, visible: true, mods: { physTakenMul: 1 - pct, artsTakenMul: 1 - pct } });
      b.addBuff(e, { key: 'ab:bloodsuckerMark', persist: true });
    },
  }),
  // Reborn Creation: its current blocker gains +n Block while this creation blocks it; each source owns its buff.
  blockerBlockUp: ({ n, max }) => ({
    spawn(b, e, a) { a.target = null; },
    tick(b, e, a) {
      const target = e.blockedBy ?? null;
      if (target === a.target) return;
      if (a.target) b.removeBuff(a.target, `ab:blockUp:${e.id}`);
      a.target = target;
      if (target && n > 0) b.addBuff(target, { key: `ab:blockUp:${e.id}`, persist: true, visible: true, mods: { blockCnt: Math.min(n, max) } });
    },
    death(c, b, e, a) { if (a.target) b.removeBuff(a.target, `ab:blockUp:${e.id}`); },
  }),
});
