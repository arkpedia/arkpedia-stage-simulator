// SPDX-License-Identifier: GPL-3.0-or-later
// Original prefabs, ranks, selector flags and clips: arkpedia-weedy-prefabs.json.
// Closed token transfer/rupture clocks and the shared instantaneous push are
// bounded local mappings, not certified native controller/frame execution.
import evidence from '../../../data/arkpedia-weedy-prefabs.json' with { type: 'json' };
import { canTargetEnemy, sortEnemyTargets, absoluteRangeKeys } from '../targeting.js';
import { resolveHit } from '../ai.js';
import { applyDistanceRupture } from './arkpedia-rupture.js';
const ID = 'char_400_weedy', TOKEN = 'token_10009_weedy_cannon';
const live = u => u?.alive && u.deployed && !u._removing;
const model = u => evidence.models[u.defId][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const rate = (u, cap = 1) => Math.min(cap, u.s.aspd / 100);
const second = u => u.skill?.active && u.skill.id === 'skchr_weedy_2';
const clip = (u, name) => u.dir === 'DOWN' && model(u).durations[`${name}_Down`] != null ? `${name}_Down` : name;
const forceBonus = t => t.def.talents[1]?.bb.base_force_level ?? 0;
const own = (b, u) => b.allyUnits.filter(t => t.ownerUnit === u && t.defId === TOKEN && live(t));
function push(b, u, e, force) {
  return b.push(e, force, { from: u, dir: { x: u.fwd[1], y: u.fwd[0] } });
}
function splash(b, u, x, y, radius, fly) {
  return b.foesInRadius(x, y, radius, true).filter(e => canTargetEnemy(u, e, { canHitFly: fly }));
}
function launchNormal(b, u, p, e, info) {
  if (!canTargetEnemy(u, e, p)) return;
  if (p.weedyS1) u.mem.weedyS1Emitted = info.attackId;
  if (p.weedyS2) {
    b.addProjectile({ from: u, source: u, target: e, speed: 10, maxAge: 10, hitDead: true,
      visual: 'orb', data: { arkpediaTrackedVisual: true, weedy: 's2' },
      onHit: ({ x, y }) => {
        for (const victim of splash(b, u, x, y, .8999999761581421, false)) {
          resolveHit(b, u, { ...p, splashRadius: 0 }, victim, info, victim.x, victim.y);
          if (live(victim)) push(b, u, victim, u.skill.bb.base_force_level);
        }
      } });
  } else {
    resolveHit(b, u, p, e, info, e.x, e.y);
    if (p.weedyS1 && live(e)) {
      push(b, u, e, u.skill.bb.force);
      b.applyStatus(e, 'stun', { source: u, duration: u.skill.bb.stun });
    }
  }
}
function finishCast(b, u, cast, reason) {
  if (u.mem.weedyCast !== cast) return;
  u.mem.weedyCast = null; cast.watch?.cancel(); cast.release?.cancel();
  if (u.defId === ID) u.skill.end(reason);
  else b.removeBuff(u, 'weedy:cannon-cast');
  u.mem.regularFormVisual = u.defId === TOKEN ? { clip: 'Idle', loop: true, die: 'Idle' } : null;
  u.atkCd = 0;
}
function castThird(b, u, owner, bb, grid) {
  if (!live(u) || u.mem.weedyCast) return;
  const keys = absoluteRangeKeys(grid, u.tileR, u.tileC, u.dir);
  const es = b.enemiesInKeys(keys, u, { canHitFly: true });
  sortEnemyTargets(b, u, es, u.defId === TOKEN ? 'nearest' : undefined);
  const target = es[0] ?? null;
  if (u.defId === TOKEN) b.addBuff(u, { key: 'weedy:cannon-cast', flags: { disarm: true, noSp: true } });
  const cast = { seq: u.deploySeq, epoch: u.attackControlEpoch, emitted: false, projectile: null };
  u.mem.weedyCast = cast;
  const name = clip(u, u.defId === TOKEN ? 'Skill' : 'Skill_3');
  u.mem.regularFormVisual = { clip: name, loop: false, ...(u.defId === TOKEN ? { die: 'Idle' } : {}) };
  const valid = () => live(u) && u.deploySeq === cast.seq && u.canAct
    && u.attackControlEpoch === cast.epoch;
  cast.watch = b.every(b.dt, () => {
    if (u.mem.weedyCast !== cast) { cast.watch.cancel(); return; }
    if (!cast.emitted && !valid()) finishCast(b, u, cast, 'cast-interrupted');
    else if (cast.emitted && !b.projectiles.list.includes(cast.projectile))
      finishCast(b, u, cast, 'projectile-finished');
  }, { owner: u });
  cast.release = b.after(model(u).hits[name][0], () => {
    if (u.mem.weedyCast !== cast || !valid()) { finishCast(b, u, cast, 'cast-interrupted'); return; }
    if (!target || !canTargetEnemy(u, target, { canHitFly: true })) {
      finishCast(b, u, cast, 'empty-cast'); return;
    }
    cast.emitted = true;
    // Original shots are not managed by the source lifetime. Keep this closure
    // independent of its deployment; token damage samples its host's ATK at
    // impact under the explicitly bounded transfer policy.
    const from = { x: u.x, y: u.y, fwd: [...u.fwd] };
    cast.projectile = b.addProjectile({ from, source: u, target, speed: 8, maxAge: 10, hitDead: true,
      visual: 'orb', data: { arkpediaTrackedVisual: true, weedy: 's3' },
      onHit: ({ x, y }) => {
        for (const e of splash(b, u, x, y, 1.2000000476837158, true)) {
          b.dealDamage(u, e, { amount: owner.s.atk * owner.s.atkScaleMul * bb.atk_scale,
            type: 'arts', isAttack: true, isSkill: true, isSplash: true, applyWay: 'ranged', tags: ['weedy:s3'] });
          if (!live(e)) continue;
          // Native movement is continuous after rupture begins. Initialize the
          // distance tracker before our immediate push to retain that distance.
          applyDistanceRupture(b, u, e, bb, { key: `weedy:rupture:${u.id}`, tag: 'weedy:rupture' });
          b.push(e, bb.force + (u.defId === TOKEN ? forceBonus(u) : 0),
            { from, dir: { x: from.fwd[1], y: from.fwd[0] } });
        }
        finishCast(b, u, cast, 'projectile-finished');
      } });
  }, { owner: u });
}
export function customizeWeedyKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null;
  kit.trait = { attack: 'melee', projectile: 'none', dmgType: 'phys', canHitFly: false,
    maxTargetsByBlock: true, hitAllBlocked: false, allInRange: false, hits: 1,
    retargetOnRelease: false, interruptOnSkillChange: true, launchAttack: launchNormal,
    attackVisual: (_b, a) => second(a) ? clip(a, 'Skill_2_Attack') : 'Attack',
    windup: (_b, a) => model(a).hits[second(a) ? clip(a, 'Skill_2_Attack') : 'Attack'][0] / rate(a),
    afterAttack: (_b, a, _targets, { inputTargets, attackId }) => {
      if (a.mem.weedyS1Attack === attackId && a.mem.weedyS1Emitted !== attackId
        && inputTargets.length && inputTargets.every(t => !t.alive)) a.skill.addCharge(1);
    } };
  const s = def.skill, bb = s.bb;
  if (s.id.endsWith('_1')) kit.skill = { id: s.id, name: s.name, kind: 'instant', flags: { noSp: true },
    attack: { weedyS1: true, atkScale: bb.atk_scale, attackVisual: 'Skill',
      windup: () => { u.mem.weedyS1Attack = b._attackSeq; return model(u).hits.Skill[0] / rate(u, Infinity); } } };
  else if (s.id.endsWith('_2')) kit.skill = { id: s.id, name: s.name, kind: 'toggle', trigger: 'SP_FULL',
    mods: { atkPct: bb.atk, batPct: bb.base_attack_time, rangeExtend: bb.ability_range_forward_extend },
    attack: { weedyS2: true, maxTargetsByBlock: false, maxTargets: 1 },
    onStart: () => {
      const seq = u.deploySeq;
      u.mem.regularFormVisual = { clip: 'Skill_2_Begin', loop: false };
      b.addBuff(u, { key: 'weedy:s2-begin', duration: model(u).durations.Skill_2_Begin, flags: { disarm: true } });
      b.after(model(u).durations.Skill_2_Begin, () => {
        if (live(u) && u.deploySeq === seq && second(u))
          u.mem.regularFormVisual = { clip: 'Skill_2_Idle', loop: true, attack: clip(u, 'Skill_2_Attack') };
      }, { owner: u });
    }, onEnd: () => { b.removeBuff(u, 'weedy:s2-begin'); u.mem.regularFormVisual = null; } };
  else kit.skill = { id: s.id, name: s.name, kind: 'instant', flags: { disarm: true, noSp: true },
    pendingText: 'Skill casting',
    attack: { noAttack: true }, targeting: { rangeGrid: s.rangeGrid },
    canActivate: () => live(u) && u.canAct && !u.s.flags.silence && !u.mem.weedyCast && !u.skill.active,
    onStart: () => {
      castThird(b, u, u, bb, s.rangeGrid);
      for (const t of own(b, u)) if (Math.abs(t.tileR - u.tileR) + Math.abs(t.tileC - u.tileC) <= bb.dist)
        castThird(b, t, u, t.def.skill.bb, t.def.skill.rangeGrid);
    }, onEnd: () => {
      const cast = u.mem.weedyCast;
      if (cast) { cast.watch?.cancel(); cast.release?.cancel(); u.mem.weedyCast = null; }
      u.mem.regularFormVisual = null;
    } };
}
export function installWeedy({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  b.on('death', ({ unit }) => { if (unit === u) {
    u.mem.weedyCast?.watch?.cancel(); u.mem.weedyCast?.release?.cancel();
    u.mem.weedyCast = null; u.mem.regularFormVisual = null;
  } }, { owner: u });
}
export function createWeedyCannon(b, state, row, col, dir) {
  const r = state.record, owner = state.owner;
  if (r.id !== TOKEN || r.stats.maxDeployCount !== 1 || r.stats.respawnTime !== 35
    || !r.talents[0]?.bb.duration || r.stats.blockCnt !== 0) throw Error('Unreviewed Weedy cannon record');
  const kit = { skill: null, trait: { attack: 'ranged', projectile: 'none', dmgType: 'phys',
    canHitFly: false, maxTargets: 1, hitAllBlocked: false, priority: 'nearest',
    canAttack: (_b, t) => t.mem.weedyBorn && !t.mem.weedyCast,
    retargetOnRelease: false, attackVisual: (_b, t) => {
      const prefix = t.dir === 'DOWN' ? 'Attack_Down' : 'Attack';
      return t.mem.weedyAttackBegin
        ? { begin: `${prefix}_Begin`, loop: `${prefix}_Loop`, beginDuration: .167 / rate(t) }
        : `${prefix}_Loop`;
    },
    windup: (_b, t) => {
      t.mem.weedyAttackBegin = !t.mem.weedyEngaged;
      const extra = t.mem.weedyAttackBegin ? .167 : 0; t.mem.weedyEngaged = true;
      return (extra + .033) / rate(t);
    }, launchAttack: (_b, t, p, e, info) => {
      if (!canTargetEnemy(t, e, p)) return;
      b.addProjectile({ from: t, source: t, target: e, speed: 10, maxAge: 10,
        visual: 'orb', data: { arkpediaTrackedVisual: true, weedy: 'cannon' },
        onHit: ({ target }) => { if (!target || !canTargetEnemy(t, target, p)) return;
          resolveHit(b, t, p, target, info, target.x, target.y);
          if (live(target)) push(b, t, target, forceBonus(t));
        } });
    } }, install: (battle, t) => {
      battle.addBuff(t, { key: 'weedy:cannon-invincible', persist: true, allowDead: true,
        flags: { invulnerable: true, untargetable: true } });
      battle.on('deploy', ({ unit }) => { if (unit !== t) return;
        t.mem.weedyBorn = false; t.mem.weedyEngaged = false;
        t.mem.regularFormVisual = { clip: 'Start', loop: false, die: 'Idle' };
        battle.after(model(t).durations.Start, () => { if (!live(t)) return;
          t.mem.weedyBorn = true;
          if (!t.mem.weedyCast) t.mem.regularFormVisual = { clip: 'Idle', loop: true, die: 'Idle' };
        }, { owner: t });
        battle.after(r.talents[0].bb.duration, () => { if (live(t))
          battle.retreat(t, { permanent: true, reason: 'weedy-cannon-expired' });
        }, { owner: t });
      }, { owner: t });
      let elapsed = 0;
      battle.on('tick', ({ dt }) => {
        if (!live(t)) return;
        if (!battle.enemiesInKeys(t.rangeKeys, t, { canHitFly: false }).length) t.mem.weedyEngaged = false;
        const talent = r.talents[1];
        if (!talent || !live(owner) || !absoluteRangeKeys(talent.rangeGrid, t.tileR, t.tileC, t.dir)
          .includes(owner.tileR * 21 + owner.tileC)) { elapsed = 0; return; }
        elapsed += dt;
        if (elapsed + 1e-9 >= talent.bb.interval) {
          elapsed = Math.max(0, elapsed - talent.bb.interval); owner.skill.gainSp(talent.bb.sp, 'weedy-cannon');
        }
      }, { owner: t });
      battle.on('death', ({ unit }) => { if (unit !== t) return;
        t.mem.weedyCast?.watch?.cancel(); t.mem.weedyCast?.release?.cancel(); t.mem.weedyCast = null;
        state.stock = Math.min(1, state.stock + 1); state.readyAt = battle.time + r.stats.respawnTime;
      }, { owner: t });
    } };
  return b.spawnToken(owner, TOKEN, row, col, { dir, def: r, kit });
}
