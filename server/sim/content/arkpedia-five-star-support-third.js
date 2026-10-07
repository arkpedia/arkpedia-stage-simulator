// SPDX-License-Identifier: GPL-3.0-or-later
import { FIVE_STAR_SUPPORT_THIRD_OPERATORS } from '../../../shared/arkpedia/five-star-support-third-operators.js';
import evidence from '../../../data/arkpedia-five-star-support-third-prefabs.json' with { type: 'json' };
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys, bodyDist } from '../body.js';
import { resolveHit } from '../ai.js';
import { aggregateMods } from '../buffs.js';
import { summonCardId } from '../../../shared/arkpedia/summons.js';

const live = u => u?.alive && u.deployed;
const model = (id, u) => evidence.models[id][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const hit = (id, u, clip) => model(id, u).hits[clip][0];
const timed = (id, clip, cap = 1) => (_b, u) => hit(id, u, clip) / Math.min(cap, u.s.aspd / 100);
const gridTargets = (b, u, grid, fly = false) => b.enemiesInKeys(
  absoluteRangeKeys(grid, u.tileR, u.tileC, u.dir), u, { canHitFly: fly });
const form = (u, clip, loop = false) => { u.mem.regularFormVisual = { clip, loop }; };

/** A manual one-shot retains the source clip's complete cast lock. Damage is
 * released independently at its original event (or explicit native predelay). */
function areaCast(b, u, { clip, release, total, perform }) {
  const seq = u.deploySeq, generation = (u.mem.supportCastGeneration ?? 0) + 1;
  u.mem.supportCastGeneration = generation;
  form(u, clip);
  b.addBuff(u, { key: 'support-third:cast', duration: total, flags: { disarm: true, noSp: true } });
  const valid = () => live(u) && u.deploySeq === seq && u.mem.supportCastGeneration === generation;
  b.after(release, () => { if (valid() && u.canAct) perform(); }, { owner: u });
  b.after(total, () => { if (valid()) u.mem.regularFormVisual = null; }, { owner: u });
}

export function customizeFiveStarSupportThirdKit({ battle, id, def, unit: u, kit }) {
  if (!FIVE_STAR_SUPPORT_THIRD_OPERATORS[id]) return;
  kit.install = null;
  const s = def.skill, bb = s.bb, first = s.id.endsWith('_1');
  const ranged = id === 'char_254_vodfox' || id === 'char_173_slchan';
  kit.trait = { attack: ranged ? 'ranged' : 'melee', dmgType: id === 'char_254_vodfox' ? 'arts' : 'phys',
    projectile: ranged ? 'orb' : 'none', projectileSpeed: id === 'char_254_vodfox' ? 6 : 10,
    canHitFly: ranged, maxTargets: 1, allInRange: false, hitAllBlocked: false,
    hits: 1, hitsFn: null, install: null, interruptOnSkillChange: true,
    ...(id === 'char_101_sora' ? { canAttack: () => false }
      : id === 'char_4036_forcer' ? {
        maxTargetsByBlock: true,
        windup: (_b, unit) => {
          unit.mem.forcerOpening = !unit.mem.forcerEngaged;
          const m = model(id, unit); return (m.hits.Attack_Loop[0] +
            (unit.mem.forcerOpening ? m.durations.Attack_Begin : 0)) * 100 / unit.s.aspd;
        },
        attackVisual: (_b, unit) => unit.mem.forcerOpening ? { begin: 'Attack_Begin',
          loop: 'Attack_Loop', beginDuration: model(id, unit).durations.Attack_Begin * 100 / unit.s.aspd } : 'Attack_Loop',
      } : { windup: timed(id, 'Attack', id === 'char_241_panda' ? 1.1 : 1), attackVisual: 'Attack',
        ...(id === 'char_241_panda' ? { maxTargetsByBlock: true } : {}) }),
  };
  if (id === 'char_101_sora') {
    kit.skill = { id: s.id, name: s.name, kind: 'duration', duration: s.duration,
      ...(first ? { targeting: { rangeGrid: s.rangeGrid } } : {}),
      onStart: ({ battle: b }) => {
        // S1 switches to a separate source Heal ability; its aura waits zero
        // seconds for the first trigger instead of inheriting the old clock.
        if (first) for (const ally of b.allyUnits) b.removeBuff(ally, `sora:heal:${u.id}`);
        syncSora(b, u, def);
      },
      onTick: ({ battle: b }) => syncSora(b, u, def),
      onEnd: ({ battle: b, reason }) => {
        if (first) {
          for (const ally of b.allyUnits) b.removeBuff(ally, `sora:heal:${u.id}`);
          for (const enemy of b.enemies) b.removeBuff(enemy, `sora:sleep:${u.id}`);
          // Skill range is restored immediately after onEnd. Reattach the
          // default heal aura from the ordinary tick, using that default grid.
        } else syncSora(b, u, def);
        const talent = def.talents[0]?.bb;
        if (reason === 'duration' && live(u) && talent && b.rng.chance(talent.prob))
          u.skill.gainSp(u.skill.spCost * talent.sp, 'sora:encore');
      },
    };
  } else if (id === 'char_254_vodfox') {
    kit.skill = first ? { id: s.id, name: s.name, kind: 'toggle', trigger: 'SP_FULL',
      mods: { atkPct: bb.atk }, onStart: ({ battle: b }) => syncShamare(b, u, def) }
      : { id: s.id, name: s.name, kind: 'instant', trigger: 'SP_FULL',
        canActivate: () => (u.mem.shamareState?.stock ?? 1) < 1,
        onStart: ({ battle: b }) => {
          const state = u.mem.shamareState;
          if (state) { state.stock = Math.min(1, state.stock + 1); b.addBuff(u, {
            key: 'shamare:stock-full', flags: { noSp: true } }); }
        } };
  } else if (id === 'char_173_slchan') {
    kit.trait.launchAttack = launchCliffheart;
    kit.skill = { id: s.id, name: s.name, kind: 'instant',
      attack: { dmgType: first ? 'arts' : 'true', atkScale: bb.atk_scale,
        priority: 'farthest', maxTargets: first ? 1 : bb.max_target,
        windup: timed(id, 'Skill_Start'),
        attackVisual: (_b, unit) => ({ begin: 'Skill_Start', loop: 'Skill_Loop',
          beginDuration: model(id, unit).durations.Skill_Start / Math.min(1, unit.s.aspd / 100) }),
        onEachHit: ({ battle: b, unit, target }) => {
          if (target?.alive) b.pullToFront(target, unit, bb.force);
        } },
      ...(!first ? { targeting: { rangeGrid: s.rangeGrid },
        onStart: ({ battle: b, skill }) => { if (!b.forceAttack(u)) skill.end('no-target'); } } : {}),
    };
  } else if (id === 'char_4036_forcer') {
    kit.skill = first ? { id: s.id, name: s.name, kind: 'instant',
      attack: { windup: timed(id, 'Skill', Infinity), attackVisual: 'Skill',
        onEachHit: ({ battle: b, target }) => pushEnforcer(b, u, target, bb, false) } }
      : { id: s.id, name: s.name, kind: 'instant',
        canActivate: () => gridTargets(battle, u, s.rangeGrid).length > 0,
        onStart: ({ battle: b }) => {
          areaCast(b, u, { clip: 'Skill', release: hit(id, u, 'Skill'),
            total: model(id, u).durations.Skill, perform: () => {
              const targets = gridTargets(b, u, s.rangeGrid);
              const direct = new Set(targets);
              for (const target of targets) pushEnforcer(b, u, target, bb, true, direct);
            } });
        } };
  } else {
    kit.skill = first ? { id: s.id, name: s.name, kind: 'instant',
      attack: { windup: timed(id, 'Attack', Infinity), onEachHit: ({ battle: b, target }) =>
        pushFEater(b, u, target, bb) } }
      : { id: s.id, name: s.name, kind: 'instant',
        canActivate: () => gridTargets(battle, u, s.rangeGrid).length > 0,
        onStart: ({ battle: b }) => areaCast(b, u, { clip: 'Skill_Start', release: .8,
          total: evidence.models[id].Front.durations.Skill_Start + evidence.models[id].Front.durations.Skill_End,
          perform: () => {
            const targets = gridTargets(b, u, s.rangeGrid);
            sortEnemyTargets(b, u, targets, 'nearest'); const main = targets[0];
            if (!main) return;
            // Original cast selector is a CircleCollider2D radius .9 centred
            // on the trigger's selected enemy, not the entire four-tile line.
            const victims = b.foesInRadius(main.x, main.y, .9).filter(e => canTargetEnemy(u, e, { canHitFly: false }));
            for (const target of victims) {
              b.dealDamage(u, target, { amount: u.s.atk * bb.atk_scale, type: 'phys',
                isAttack: true, isSkill: true, applyWay: 'melee' });
              pushFEater(b, u, target, bb);
            }
            form(u, 'Skill_End');
          } }) };
  }
}

function soraRecovery(b, u, ally, ratio) {
  // The native AtkToHpRecovery aura bypasses heal-free targeting, but its
  // HP_RECOVERY_PER_SEC output still receives the recipient's final scaler.
  // Ordinary regeneration already applies this scaler when computing stats;
  // this raw ATK conversion has to apply it before entering the heal path.
  const multiplier = aggregateMods(ally.buffs).mul.hpRegenMul ?? 1;
  return b.heal(u, ally, u.s.atk * ratio * multiplier, { self: true, regen: true });
}

function syncSora(b, u, def) {
  const first = u.skill.id === 'skchr_sora_1', active = live(u) && u.skill.active;
  const healKey = `sora:heal:${u.id}`, inspireKey = `sora:inspiration:${u.id}`, sleepKey = `sora:sleep:${u.id}`;
  const ratio = active && first ? def.skill.bb['attack@atk_to_hp_recovery_ratio'] : def.traitBb['attack@atk_to_hp_recovery_ratio'];
  for (const ally of b.allyUnits) {
    const inside = live(u) && live(ally) && !ally.hidden && u.rangeKeySet.has(ally.tileR * 21 + ally.tileC);
    // Original ally healer aura explicitly ignores healFree and targetFree.
    if (inside && !ally.s.flags.isolated) {
      if (!ally.findBuff(healKey)) {
        b.addBuff(ally, { key: healKey, source: u, interval: 1,
          onTick: () => soraRecovery(b, u, ally, live(u) && u.skill.active && first
            ? def.skill.bb['attack@atk_to_hp_recovery_ratio'] : def.traitBb['attack@atk_to_hp_recovery_ratio']) });
        soraRecovery(b, u, ally, ratio);
      }
    } else b.removeBuff(ally, healKey);
    const eligible = inside && active && !first && ally !== u
      && ally.def.subProf !== 'bard' && !ally.mem.noInspire && !ally.findBuff('immune_to_encourage');
    if (!eligible) b.removeBuff(ally, inspireKey);
    else if (ally.findBuff(inspireKey)?.mods.atkFinalFlat !== u.s.atk * def.skill.bb.atk)
      b.addBuff(ally, { key: inspireKey, source: u, tags: ['inspire'],
        mods: { atkFinalFlat: u.s.atk * def.skill.bb.atk } });
  }
  for (const enemy of b.enemies) {
    const inside = active && first && bodyInKeys(enemy, u.rangeKeySet)
      && canTargetEnemy(u, enemy, { canHitFly: true, hitSleep: true });
    if (!inside) b.removeBuff(enemy, sleepKey);
    else if (!enemy.findBuff(sleepKey)) b.applyStatus(enemy, 'sleep', { key: sleepKey, source: u });
  }
}

function syncShamare(b, u, def) {
  const talent = def.talents[0]?.bb, key = `shamare:fragile:${u.id}`;
  for (const enemy of b.enemies) {
    const inside = talent && live(u) && bodyInKeys(enemy, u.rangeKeySet) &&
      canTargetEnemy(u, enemy, { canHitFly: true }) && enemy.hpRatio < talent.hp_ratio;
    const value = (talent?.damage_scale - 1) * (u.skill.active && u.skill.id === 'skchr_vodfox_1' ? def.skill.bb.scale_delta_to_one : 1);
    if (!inside) b.removeBuff(enemy, key);
    else if (enemy.findBuff(key)?.data.value !== value) b.applyStatus(enemy, 'fragile', { key, source: u, value });
  }
}

/** Original doll uses its owner's selected S2 rank, lasts 15s, has an infinite
 * untargetable self buff, and removes its enemy aura when withdrawn. */
export function installShamareDoll(b, token, state) {
  const s = state.owner.def.skill, bb = s.bb;
  const source = evidence.tokens[token.defId].levels[state.owner.def.raw.arkpedia.skillRank - 1];
  const key = `shamare:doll:${token.id}`;
  b.addBuff(token, { key: 'shamare:untargetable', flags: { untargetable: true }, persist: true });
  const sync = () => {
    for (const enemy of b.enemies) {
      const inside = live(token) && bodyInKeys(enemy, token.rangeKeySet) && canTargetEnemy(token, enemy, { canHitFly: true });
      if (!inside) b.removeBuff(enemy, key);
      else if (!enemy.findBuff(key)) b.addBuff(enemy, { key, source: token, mods: { atkMul: 1 + bb.atk, defMul: 1 + bb.def } });
    }
  };
  sync(); b.on('tick', sync, { owner: token });
  b.on('death', ({ unit }) => { if (unit === token) sync(); }, { owner: token });
  b.after(source.duration, () => { if (live(token)) b.retreat(token, { reason: 'doll-expired', permanent: true }); }, { owner: token });
}

function launchCliffheart(b, u, profile, target, info) {
  let cast;
  if (info.isSkill) {
    cast = u.mem.cliffheartCast;
    if (!cast || cast.attackId !== info.attackId) {
      cast = { attackId: info.attackId, pending: new Set(), deadline: b.time };
      u.mem.cliffheartCast = cast;
      b.addBuff(u, { key: 'cliffheart:cast', flags: { disarm: true, noSp: true } });
      cast.monitor = b.every(b.dt, () => {
        for (const entry of [...cast.pending]) if (!b.projectiles.list.includes(entry.projectile)) finish(entry, false);
      }, { owner: u });
    }
  }
  const finish = (entry, linked) => {
    if (!cast?.pending.delete(entry)) return;
    const link = linked ? 1 : 0;
    if (info.skillId === 'skchr_slchan_2' || u.def.skill.id === 'skchr_slchan_2')
      b.after(link, () => { if (entry.target?.alive) b.applyStatus(entry.target, 'stun', { source: u, duration: u.def.skill.bb.stun }); });
    cast.deadline = Math.max(cast.deadline, b.time + link);
    if (cast.pending.size) return;
    cast.monitor.cancel();
    b.after(Math.max(0, cast.deadline - b.time), () => {
      if (u.mem.cliffheartCast !== cast || !live(u)) return;
      form(u, 'Skill_End');
      b.after(Math.max(1, model(u.defId, u).durations.Skill_End), () => {
        if (u.mem.cliffheartCast !== cast) return;
        b.removeBuff(u, 'cliffheart:cast'); u.mem.cliffheartCast = null; u.mem.regularFormVisual = null;
      }, { owner: u });
    }, { owner: u });
  };
  const entry = { target };
  entry.projectile = b.addProjectile({ from: u, target, speed: 10, source: u, visual: 'orb',
    data: { arkpediaTrackedVisual: true },
    onHit: c => { resolveHit(b, u, profile, c.target, info, c.x, c.y); finish(entry, !!c.target); } });
  if (cast) cast.pending.add(entry);
}

function pushFEater(b, u, target, bb) {
  if (!target?.alive) return;
  b.addBuff(target, { key: 'feater:slow', source: u, duration: bb.duration, mods: { moveMul: 1 + bb.move_speed } });
  b.push(target, bb.force, { from: u, dir: { x: u.fwd[1], y: u.fwd[0] } });
}

// Native displacement is instantaneous in this engine. Check the complete
// travelled segment for the source .33 collider, excluding direct victims.
function segmentDist(e, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, length = dx * dx + dy * dy;
  const t = length > 0 ? Math.max(0, Math.min(1, ((e.x - x0) * dx + (e.y - y0) * dy) / length)) : 0;
  return bodyDist(e, x0 + dx * t, y0 + dy * t);
}
function pushEnforcer(b, u, target, bb, second, direct = new Set([target])) {
  if (!target?.alive) return;
  const x0 = target.x, y0 = target.y, expected = b.pushDistance(target, bb.force);
  const moved = b.push(target, bb.force, { from: u, dir: { x: u.fwd[1], y: u.fwd[0] }, fixedAngle: second });
  if (second) {
    b.applyStatus(target, 'stun', { source: u, duration: bb['forcer_s_2[hit_directly].stun'] });
    if (moved > 0) for (const enemy of b.enemies) {
      if (direct.has(enemy) || !canTargetEnemy(u, enemy, { canHitFly: false }) ||
        segmentDist(enemy, x0, y0, target.x, target.y) > bb.projectile_range + 1e-9) continue;
      b.applyStatus(enemy, 'stun', { key: 'enforcer:brush', source: u, duration: bb['forcer_s_2[brush].stun'] });
    }
  }
  if (expected > moved + .05 && expected > 0) {
    const dx = target.x - x0, dy = target.y - y0;
    const length = Math.hypot(dx, dy), fx = length > 0 ? dx / length : u.fwd[1], fy = length > 0 ? dy / length : u.fwd[0];
    const row = Math.round(target.y + fy * .15), col = Math.round(target.x + fx * .15);
    if (b.grid.inRect(row, col) && b.grid.tile(row, col).height === 'HIGH')
      b.applyStatus(target, 'stun', { source: u, duration: bb.stun });
  }
}

export function installFiveStarSupportThird({ battle: b, unit: u, def }) {
  if (!FIVE_STAR_SUPPORT_THIRD_OPERATORS[def.charId]) return;
  const id = def.charId, talent = def.talents[0]?.bb;
  if (id === 'char_101_sora') {
    b.addBuff(u, { key: 'immune_to_encourage', persist: true, allowDead: true });
    const sync = () => syncSora(b, u, def);
    b.on('deploy', sync, { owner: u }); b.on('death', sync, { owner: u }); b.on('tick', sync, { owner: u });
  } else if (id === 'char_254_vodfox') {
    const sync = () => syncShamare(b, u, def);
    b.on('deploy', sync, { owner: u }); b.on('death', sync, { owner: u }); b.on('tick', sync, { owner: u });
  } else if (id === 'char_173_slchan' && talent) {
    const key = 'cliffheart:not-blocking';
    const sync = () => {
      if (!live(u) || u.blocking.length) b.removeBuff(u, key);
      else if (!u.findBuff(key)) b.addBuff(u, { key, mods: { atkPct: talent.atk, defPct: talent.def } });
    };
    b.on('tick', sync, { owner: u }); b.on('deploy', sync, { owner: u }); b.on('death', sync, { owner: u });
  } else if (id === 'char_4036_forcer') {
    b.on('attack', ({ attacker }) => { if (attacker === u) u.mem.forcerEngaged = true; }, { owner: u });
    b.on('tick', () => { if (!u.canAct || !b.enemiesInKeys(u.rangeKeys, u, u.profile).length) u.mem.forcerEngaged = false; }, { owner: u });
    if (talent) b.on('hit', c => {
      if (c.source === u && c.dmg.isAttack && c.dmg.amount > 0 && c.target.weight >= talent.value)
        c.dmg.defIgnoreFlat = (c.dmg.defIgnoreFlat ?? 0) + talent.def_penetrate_fixed;
    }, { owner: u });
  } else if (id === 'char_241_panda' && talent) b.addBuff(u, {
    key: 'feater:physical-dodge', persist: true, allowDead: true, mods: { dodgePhys: talent.prob } });
}
