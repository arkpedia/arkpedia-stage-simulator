// SPDX-License-Identifier: GPL-3.0-or-later
import { HOOK_EXPANSION_OPERATORS } from '../../../shared/arkpedia/hook-expansion-operators.js';
import source from '../../../data/arkpedia-hook-expansion-prefabs.json' with { type: 'json' };
import { resolveHit, effectiveProfile } from '../ai.js';
import { canTargetEnemy, sortEnemyTargets } from '../targeting.js';

const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => source.models[u.defId][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const isSnowsant = u => u.defId === 'char_383_snsant';
const second = u => u.skill.id.endsWith('_2');
const clips = u => isSnowsant(u) ? second(u)
  ? ['Skill_2_Begin', 'Skill_2_Loop', 'Skill_2_End', 1]
  : ['Skill_Begin', 'Skill_Loop', 'Skill_End', 2]
  : second(u) ? ['Skill_2_Begin', 'Skill_2_Loop', 'Skill_2_End', 1]
    : ['Skill_1_Begin', 'Skill_1_Loop', 'Skill_1_End', 1];
const windup = skill => (_b, u) => model(u).hits[skill ? clips(u)[0] : 'Attack'][0]
  / ((skill ? clips(u)[3] : 1) * Math.min(skill && !isSnowsant(u) && !second(u) ? Infinity : 1, u.s.aspd / 100));

function recipients(b, u, p) {
  const targets = b.enemiesInKeys(u.rangeKeys, u, p);
  sortEnemyTargets(b, u, targets, p.priority);
  if (p.hookNetRadius && targets[0]) {
    const center = targets[0];
    return b.enemiesInRadius(center.x, center.y, p.hookNetRadius)
      .filter(target => canTargetEnemy(u, target, p));
  }
  return p.allInRange ? targets : targets.slice(0, 1);
}

function finishCast(b, u, cast, interrupted = false) {
  if (u.mem.hookCast !== cast || cast.finishing && !interrupted) return;
  cast.finishing = true;
  cast.monitor?.cancel();
  for (const entry of cast.entries) {
    if (entry.bound) b.removeBuff(entry.target, entry.bound);
  }
  if (interrupted || !live(u)) {
    cast.endJob?.cancel();
    b.removeProjectiles(p => p.data?.hookCast === cast);
    b.removeBuff(u, 'hook:cast'); u.mem.hookCast = null; u.mem.regularFormVisual = null;
    if (u.skill.active) u.skill.end('interrupted');
    return;
  }
  const [,,end,rate] = clips(u);
  u.mem.regularFormVisual = { clip: end, loop: false, speed: rate };
  // The source wait-for-projectile finish is followed by the original end
  // animation and minimum postdelay, rather than allowing another hook at hit.
  const delay = Math.max(isSnowsant(u) || !second(u) ? 1 : .666,
    model(u).durations[end] / rate);
  cast.endJob = b.after(delay, () => {
    if (u.mem.hookCast !== cast || !live(u)) return;
    const talent = u.def.talents[0]?.bb;
    if (isSnowsant(u) && talent) for (const entry of cast.entries)
      if (entry.linked && live(entry.target) && entry.target.tags?.has('infection'))
        b.applyStatus(entry.target, 'silence', { duration: talent['skill@silence'], source: u });
    b.removeBuff(u, 'hook:cast'); u.mem.hookCast = null; u.mem.regularFormVisual = null;
    if (u.skill.active) u.skill.end('hook-finished');
    if (cast.refund) u.skill.setSpTotal(u.skill.spTotal + cast.refund);
    if (!isSnowsant(u)) {
      const bench = b.bench[u.defId];
      if (cast.firstActivation && talent && bench) {
        // Original ModifySp forceFlag1 bypasses no-SP and may complete stored
        // charges. The first-activation claim is battle-wide across redeploys.
        u.skill.setSpTotal(u.skill.spTotal + talent.sp);
      }
    }
  }, { owner: u });
}

function createCast(b, u, info) {
  const previous = u.mem.hookCast;
  if (previous?.attackId === info.attackId) return previous;
  const cast = { attackId: info.attackId, entries: new Set(), deadline: b.time,
    deployment: u.deploySeq, control: u.attackControlEpoch, firstActivation: u.mem.hookFirstActivation };
  u.mem.hookFirstActivation = false; u.mem.hookCast = cast;
  b.removeBuff(u, 'hook:windup');
  b.addBuff(u, { key: 'hook:cast', flags: { disarm: true, noSp: true } });
  // The intentional self-disarm increments the engine's interruption epoch.
  // It is the cast's baseline, not an external interruption of its own hook.
  cast.control = u.attackControlEpoch;
  u.mem.regularFormVisual = { clip: clips(u)[1], loop: true };
  cast.monitor = b.every(b.dt, () => {
    if (!live(u) || u.deploySeq !== cast.deployment || u.attackControlEpoch !== cast.control)
      return finishCast(b, u, cast, true);
    for (const entry of cast.entries) {
      if (entry.pending && !entry.linked && !b.projectiles.list.includes(entry.projectile))
        settle(entry, false);
      else if (entry.pending && entry.linked && !live(entry.target)) settle(entry, false);
    }
    if (![...cast.entries].some(e => e.pending))
      finishCast(b, u, cast);
  }, { owner: u });
  function settle(entry, linked) {
    if (!entry.pending) return;
    entry.pending = false; entry.linked ||= linked;
    if (entry.bound) b.removeBuff(entry.target, entry.bound);
  }
  cast.settle = settle;
  return cast;
}

function launch(b, u, p, target, info) {
  if (!canTargetEnemy(u, target, p)) return;
  const bb = u.def.skill.bb, cast = info.isSkill ? createCast(b, u, info) : null;
  const entry = { target, pending: true, linked: false };
  if (cast) cast.entries.add(entry);
  entry.projectile = b.addProjectile({ from: u, source: u, target, speed: 10,
    maxAge: info.isSkill || isSnowsant(u) ? isSnowsant(u) && second(u) ? 1.3 : !isSnowsant(u) && second(u) ? 10 : 5 : 10,
    visual: 'orb', data: { arkpediaTrackedVisual: true, hookCast: cast },
    onHit: ({ target: hit }) => {
      if (!hit || !canTargetEnemy(u, hit, p) || cast?.finishing) {
        cast?.settle(entry, false); return;
      }
      if (!info.isSkill) { resolveHit(b, u, p, hit, info, hit.x, hit.y); return; }
      entry.linked = true;
      if (!isSnowsant(u) && second(u)) {
        const bound = `almond:hook:${u.id}:${info.attackId}`;
        entry.bound = bound;
        b.addBuff(hit, { key: bound, source: u, duration: bb.hit_duration,
          interval: bb.hit_interval, flags: hit.def?.immune?.has('bind') ? {} : { bind: true, noMove: true },
          onTick: () => {
            if (!live(u) || u.mem.hookCast !== cast || cast.finishing || !live(hit)) return;
            resolveHit(b, u, p, hit, info, hit.x, hit.y);
            if (live(hit)) b.pullToFront(hit, u, bb.force);
          } });
        cast.deadline = Math.max(cast.deadline, b.time + bb.hit_duration);
        b.after(bb.hit_duration, () => cast.settle(entry, true), { owner: u });
      } else {
        resolveHit(b, u, p, hit, info, hit.x, hit.y);
        if (live(hit)) {
          const extra = isSnowsant(u) && hit.tags?.has('infection')
            ? u.def.talents[0]?.bb['skill@delta_force'] ?? 0 : 0;
          b.pullToFront(hit, u, bb.force + extra);
        }
        const link = isSnowsant(u) && second(u) ? 1.3 : 1;
        cast.deadline = Math.max(cast.deadline, b.time + link);
        b.after(link, () => {
          if (u.mem.hookCast !== cast || cast.finishing) return;
          if (isSnowsant(u) && live(hit)) b.applyStatus(hit, 'sluggish', { duration: bb.sluggish, source: u });
          cast.settle(entry, true);
        }, { owner: u });
      }
    } });
}

export function customizeHookExpansionKit({ battle: b, id, def, unit: u, kit }) {
  if (!HOOK_EXPANSION_OPERATORS[id]) return;
  kit.install = null;
  const s = def.skill, bb = s.bb, snowsant = id === 'char_383_snsant', s2 = s.id.endsWith('_2');
  kit.trait = { attack: 'ranged', dmgType: 'phys', projectile: 'none', maxTargets: 1,
    canHitFly: true, hits: 1, allInRange: false, hitAllBlocked: false,
    attackVisual: 'Attack', windup: windup(false), launchAttack: launch,
    acquireTargets: recipients, retargetOnRelease: true, interruptOnSkillChange: true };
  const begin = () => {
    u.mem.hookWindupControl = u.attackControlEpoch;
    b.addBuff(u, { key: 'hook:windup', flags: { noSp: true } });
    if (!snowsant) {
      const bench = b.bench[id];
      u.mem.hookFirstActivation = !bench.almondActivated;
      bench.almondActivated = true;
    }
    if (s2 && !b.forceAttack(u)) {
      b.removeBuff(u, 'hook:windup'); u.skill.end('no-target');
    }
  };
  kit.skill = { id: s.id, name: s.name, kind: !snowsant && s2 ? 'toggle' : 'charges',
    charges: s.spData?.maxChargeTime ?? bb.cnt ?? 1,
    canActivate: () => !u.skill?.active && !u.mem.hookCast && (!s2 || recipients(b, u,
      { ...effectiveProfile(u), canHitFly: !snowsant }).length > 0),
    attack: { dmgType: snowsant && s2 ? 'arts' : 'phys', atkScale: bb.atk_scale,
      canHitFly: snowsant ? !s2 : s2, allInRange: snowsant && s2,
      ...(snowsant && s2 ? { hookNetRadius: .7 } : {}),
      priority: snowsant || s2 ? 'farthest' : null,
      retargetOnRelease: snowsant && s2, windup: windup(true),
      // These Begin clips contain the OnAttack event. They are the strike
      // animation itself, rather than a separate preparatory clip to skip.
      attackVisual: (_battle, unit) => clips(unit)[0],
      afterAttack: (_battle, unit, _targets, info) => {
        if (unit.mem.hookCast?.attackId === info.attackId) return;
        // An INPUT target can disappear before the release. Finish the empty
        // cast rather than leaving Almond's timed stance active indefinitely.
        const cast = createCast(b, unit, info);
        if (!s2 && info.inputTargets.every(target => !target.alive))
          cast.refund = unit.skill.spCost;
        finishCast(b, unit, cast);
      } },
    ...(snowsant && s2 ? { targeting: { rangeGrid: s.rangeGrid } } : {}),
    onStart: begin,
  };
}

export function installHookExpansion({ battle: b, unit: u, def }) {
  if (!HOOK_EXPANSION_OPERATORS[def.charId]) return;
  b.on('tick', () => {
    if (u.mem.hookCast && u.mem.hookCast.control !== u.attackControlEpoch)
      finishCast(b, u, u.mem.hookCast, true);
    if (u.skill.active && !u.mem.hookCast && u.mem.hookWindupControl !== u.attackControlEpoch) {
      b.removeBuff(u, 'hook:windup');
      u.skill.end('interrupted');
    }
  }, { owner: u });
  b.on('death', ({ unit }) => { if (unit === u && u.mem.hookCast) finishCast(b, u, u.mem.hookCast, true); }, { owner: u });
}
