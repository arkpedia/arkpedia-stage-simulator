// SPDX-License-Identifier: GPL-3.0-or-later
// Original graphs and explicit native dispatcher boundaries are retained in
// data/arkpedia-jieyun-prefabs.json; this is an opt-in regular-stage adapter.
import evidence from '../../../data/arkpedia-jieyun-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { canTargetEnemy, absoluteRangeKeys } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { COLS } from '../constants.js';
const ID = 'char_4078_bdhkgt';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const rate = u => Math.min(1, u.s.aspd / 100);
const attackClip = u => u.dir === 'DOWN' ? 'Attack_Down' : 'Attack';
const formClip = (u, phase) => `Skill_${u.dir === 'DOWN' ? 'Down_' : ''}2_${phase}`;
const plain = p => ({ ...p, hits: 1, hitsFn: null, splashRadius: 0, chain: null });
const damageProfile = { attack: 'ranged', dmgType: 'phys', canHitFly: true,
  maxTargets: 1, allInRange: false, hitAllBlocked: false, hits: 1, splashRadius: 0 };
const projectileTarget = (u, e) => canTargetEnemy(u, e, damageProfile);
function ordinary(b, u, p, target, info) {
  b.addProjectile({ from: u, target, source: u, speed: 12, maxAge: 10, visual: 'arrow',
    data: { arkpediaTrackedVisual: true }, onHit: ({ target: current, x, y }) => {
      if (!current) return;
      for (const e of b.enemiesInRadius(x, y, 1)) if (projectileTarget(u, e))
        resolveHit(b, u, plain(p), e, info, e.x, e.y);
    } });
}
/** Native self card cost is meaningful only on the first successful spawn.
 * This adapter receives the already-computed ordinary cost, preserving the
 * common potential/redeploy law. Native integer composition remains bounded. */
export function adjustJieyunCost(b, id, ordinaryCost) {
  if (id !== ID || !Number.isFinite(ordinaryCost) || b.bench[id]?.deployments > 0) return ordinaryCost;
  const value = b.data.getChess(id)?.talents[0]?.bb.runtime_cost ?? 0;
  return Math.max(0, ordinaryCost + value);
}
function currentTile(b, u) {
  const keys = absoluteRangeKeys(evidence.rangeTable['3-16'].grids.map(x => [x.row, x.col]),
    u.tileR, u.tileC, u.dir);
  const tiles = [...new Set(b.enemies.filter(e => live(e) && !e.fly
    && canTargetEnemy(u, e, { ...damageProfile, canHitFly: false }) && bodyInKeys(e, keys))
    .map(e => Math.round(e.y) * COLS + Math.round(e.x))
    .filter(key => keys.includes(key)))];
  // Original TileSelector18's executable enum is not recovered. The scoped
  // policy selects one seeded eligible ground-enemy tile, fixed at CAST time;
  // it does not pretend to expose a manual tile picker or a native RNG stream.
  const key = tiles.length ? b.rng.pick(tiles) : null;
  return key === null ? null : { x: key % COLS, y: Math.floor(key / COLS) };
}
function clearForm(b, u, state) {
  if (u.mem.jieyunCast !== state) return;
  u.mem.jieyunCast = null; u.mem.regularFormVisual = null;
  b.removeBuff(u, 'jieyun:cast');
}
function startEnd(b, u, state) {
  if (!live(u) || u.mem.jieyunCast !== state || u.deploySeq !== state.seq) return;
  state.ending = true; state.endAt = b.time + model(u).durations[formClip(u, 'End')];
  u.mem.regularFormVisual = { clip: formClip(u, 'End'), loop: false };
  b.after(state.endAt - b.time, () => {
    if (!live(u) || u.mem.jieyunCast !== state || u.deploySeq !== state.seq) return;
    u.skill.end('projectile'); clearForm(b, u, state);
  }, { owner: u });
}
function chakram(b, u, state, destination, bb) {
  let reached = false, done = false, until = Infinity;
  const hits = new Map(), center = { x: u.x, y: u.y };
  const info = { isSkill: true, attackId: `jieyun:${u.id}:${u.skill.activations}` };
  const p = { ...damageProfile, atkScale: bb.atk_scale };
  let observer;
  const finish = () => {
    if (done) return;
    done = true; observer?.cancel(); state.effect = null;
    if (live(u) && u.mem.jieyunCast === state) startEnd(b, u, state);
  };
  const sample = () => {
    if (done || b.time >= until - 1e-9) return;
    for (const e of b.enemiesInRadius(center.x, center.y, bb.projectile_range)) {
      if (!projectileTarget(u, e) || b.time < (hits.get(e) ?? -Infinity) + bb.interval - 1e-9) continue;
      hits.set(e, b.time);
      // The native override key is common across sources: refresh one selected
      // move percentage, without multiplying overlapping identical chakrams.
      b.addBuff(e, { key: 'bdhkgt_s_2', source: u, duration: bb.slow_down_duration,
        mods: { movePct: bb.move_speed } });
      resolveHit(b, u, p, e, info, e.x, e.y);
    }
  };
  const projectile = b.addProjectile({ from: u, to: destination, source: u,
    speed: 11, maxAge: 10, visual: 'arrow', data: { arkpediaTrackedVisual: true },
    onHit: ({ x, y }) => {
      reached = true; center.x = x; center.y = y;
      until = b.time + bb.projectile_delay_time; state.holdUntil = until;
      // Native reached delay uses selected15s; generic lifetime10 is retained
      // for flight only. Hold/first-collision dispatch is explicitly bounded.
      b.after(bb.projectile_delay_time, finish);
    } });
  state.effect = { projectile, center, hits, finish };
  // The collider is active along the moving path and at the fixed endpoint.
  // Every target owns a one-second cache; late entrants need not wait for a
  // global periodic tick. The independent born graph survives source retreat.
  observer = b.every(b.dt, () => {
    if (done) return;
    if (!reached) {
      center.x = projectile.x; center.y = projectile.y;
      if (!b.projectiles.list.includes(projectile) && !b.projectiles.arriving.includes(projectile)) { finish(); return; }
    }
    sample();
  });
  sample();
}
function cast(b, u, def) {
  const state = { seq: u.deploySeq, activation: u.skill.activations, emitted: false,
    interrupted: false, ending: false, endAt: Infinity };
  u.mem.jieyunCast = state;
  u.mem.regularFormVisual = { clip: formClip(u, 'Begin'), loop: false };
  b.addBuff(u, { key: 'jieyun:cast', flags: { disarm: true, noSp: true } });
  const epoch = u.attackControlEpoch;
  const valid = () => live(u) && u.mem.jieyunCast === state && u.deploySeq === state.seq
    && u.skill.activations === state.activation && u.skill.active;
  const monitor = b.every(b.dt, () => {
    if (!valid()) { monitor.cancel(); return; }
    if (!state.emitted && (!u.canAct || u.attackControlEpoch !== epoch)) {
      state.interrupted = true; monitor.cancel(); startEnd(b, u, state);
    }
  }, { owner: u });
  // Actual waitForAttackEvent0 and explicit .3666667 preDelay are retained;
  // no synthetic event is supplied by the loop animation.
  b.after(evidence.releaseDelay, () => {
    if (!valid() || state.interrupted || !u.canAct || u.attackControlEpoch !== epoch) return;
    state.emitted = true; monitor.cancel();
    const destination = currentTile(b, u);
    if (destination) chakram(b, u, state, destination, def.skill.bb);
    else startEnd(b, u, state); // native allowNoTarget1 spends without replacement
  }, { owner: u });
  b.after(model(u).durations[formClip(u, 'Begin')], () => {
    if (valid() && !state.ending) u.mem.regularFormVisual = { clip: formClip(u, 'Loop'), loop: true };
  }, { owner: u });
}
export function customizeJieyunKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null;
  kit.trait = { ...damageProfile, hitsFn: null, chain: null, projectile: 'none',
    attackVisual: (_b, unit) => attackClip(unit), windup: (_b, unit) => model(unit).hits[attackClip(unit)][0] / rate(unit),
    retargetOnRelease: true, interruptOnSkillChange: true, launchAttack: ordinary };
  const s = def.skill;
  kit.skill = s.id.endsWith('_1') ? { kind: 'duration', duration: s.duration,
    mods: { atkPct: s.bb.atk, aspd: s.bb.attack_speed } }
    : { kind: 'toggle', attack: { noAttack: true },
      canActivate: () => !u.mem.jieyunCast && u.canAct && !u.s.flags.disarm,
      onStart: () => cast(b, u, def),
      onTick: ({ skill }) => {
        const state = u.mem.jieyunCast;
        if (state) {
          skill.duration = def.skill.bb.projectile_delay_time + .9;
          skill.timeLeft = Number.isFinite(state.endAt) ? Math.max(0, state.endAt - b.time)
            : Number.isFinite(state.holdUntil) ? Math.max(0, state.holdUntil - b.time) + .9 : Infinity;
        }
      },
      onEnd: () => { const state = u.mem.jieyunCast; if (state) clearForm(b, u, state); } };
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installJieyun({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  b.on('deploy', ({ unit }) => {
    if (unit !== u || (b.bench[ID]?.deployments ?? 0) + 1 > 1) return;
    const t = def.talents[0]?.bb;
    if (t) b.addBuff(u, { key: 'bdhkgt_t_1[atk_scale]', source: u, mods: { atkPct: t.atk } });
  }, { owner: u });
}
