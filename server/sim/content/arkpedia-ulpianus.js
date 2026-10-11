// SPDX-License-Identifier: GPL-3.0-or-later
// Native graphs/ranks/clips are retained in arkpedia-ulpianus-prefabs.json.
// Selector28, rebirth resident state and closed-controller clocks are explicit
// local mappings; original particles and native frame parity are not certified.
import evidence from '../../../data/arkpedia-ulpianus-prefabs.json' with { type: 'json' };
import { sourceMoveRespawn } from './arkpedia-source-move.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { resolveHit } from '../ai.js';
import { COLS } from '../constants.js';
const ID = 'char_4145_ulpia', TOKEN = 'token_10039_ulpia_block';
const ground = { canHitFly: false };
const live = u => u?.alive && u.deployed && !u._removing;
const mode = u => u.skill.active ? Number(u.skill.id.at(-1)) : 0;
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const rate = u => Math.min(1, u.s.aspd / 100);
const t2 = u => u.def.talents.find(t => t.bb.max_stack_cnt != null)?.bb;
const selfKey = 'ulpia:kill-stacks';
const allyKey = u => `ulpia:abyssal:${u.id}`;
const form = (u, clip, loop = false) => { u.mem.regularFormVisual = clip ? { clip, loop } : null; };
const idle = u => mode(u) === 2 ? 'Skill_2_Idle' : mode(u) === 3 ? 'Skill_3_Idle' : 'Idle';
function targets(b, u, grid, count) {
  const keys = grid ? absoluteRangeKeys(grid, u.tileR, u.tileC, u.dir) : u.rangeKeys;
  const es = b.enemiesInKeys(keys, u, ground);
  sortEnemyTargets(b, u, es);
  return es.slice(0, count);
}
function transition(b, u, clip, done) {
  const state = {}, seq = u.deploySeq;
  u.mem.ulpiaTransition = state; form(u, clip);
  b.addBuff(u, { key: 'ulpia:transition', flags: { disarm: true, noSp: true } });
  b.after(model(u).durations[clip], () => {
    if (!live(u) || u.deploySeq !== seq || u.mem.ulpiaTransition !== state) return;
    u.mem.ulpiaTransition = null; b.removeBuff(u, 'ulpia:transition'); u.atkCd = 0;
    form(u, idle(u), true); done?.();
  }, { owner: u });
}
function clearOwned(b, u) {
  u.mem.ulpiaS1?.watch?.cancel(); u.mem.ulpiaS1 = null;
  u.mem.ulpiaS3 = null; u.mem.ulpiaTransition = null; form(u, null);
  b.releaseTileReservations(u, TOKEN);
  for (const a of b.allyUnits) b.removeBuff(a, allyKey(u));
}
function selfStack(b, u) {
  const bb = t2(u); if (!bb || !live(u)) return;
  b.addBuff(u, { key: selfKey, source: u, refresh: 'stack', maxStacks: bb.max_stack_cnt,
    mods: { hpFlat: bb.max_hp, atkFlat: bb.atk } });
  // Force the ordinary MAX_HP ratio aggregation before a same-tick hit/kill.
  void u.s;
}
function syncHunters(b, u) {
  const bb = t2(u); if (!bb || !live(u)) return;
  const stacks = u.findBuff(selfKey)?.stacks ?? 0;
  for (const a of b.allyUnits) {
    if (a === u || !live(a) || !a.tags.has('abyssal') || a.kind !== 'op') continue;
    // Native first trigger .04, then 1s; recipient stacks persist through
    // source rebirth and are removed only on true ability detach.
    const old = a.findBuff(allyKey(u));
    if ((old?.stacks ?? 0) >= stacks || !stacks) continue;
    b.addBuff(a, { key: allyKey(u), source: u, stacks,
      maxStacks: bb['ulpia_t_1[abyssal].max_stack_cnt'],
      mods: { hpFlat: bb['ulpia_t_1[abyssal].max_hp'], atkFlat: bb['ulpia_t_1[abyssal].atk'] } });
    void a.s;
  }
}
function s1Names(u) {
  const prefix = u.dir === 'DOWN' ? 'Skill_1_Down' : 'Skill_1';
  return ['Begin', 'Loop', 'End'].map(n => `${prefix}_${n}`);
}
function finishS1(b, u, cast, refund = false) {
  if (u.mem.ulpiaS1 !== cast || cast.finishing || !live(u)) return;
  cast.finishing = true; cast.watch.cancel();
  const end = s1Names(u)[2]; form(u, end);
  b.after(model(u).durations[end] / cast.rate, () => {
    if (u.mem.ulpiaS1 !== cast || !live(u) || u.deploySeq !== cast.seq) return;
    u.mem.ulpiaS1 = null; form(u, null); b.removeBuff(u, 'ulpia:s1-lock');
    u.skill.end('anchor-finished');
    if (refund) u.skill.setSpTotal(u.skill.spCost);
    u.atkCd = 0;
  }, { owner: u });
}
function captureLink(b, u, e, cast, from, f, force, done) {
  const to = { x: from.x + f[1] * .5, y: from.y + f[0] * .5 };
  const plan = e && b.planPull(e, force, { to, center: from });
  // Native LinkProjectile's closed mover is bounded by a linear second-part
  // clock1.3; shared passability/weight/stop laws determine travelled distance.
  // It is an emitted lifetime, not an operator-owned scheduled spell.
  if (!plan) { b.after(1, done); return; }
  const key = `ulpia:capture:${u.id}:${cast.attackId}:${e.id}`, seq = e.deploySeq;
  const duration = 1.2999999523162842, started = b.time;
  let moved = 0, finished = false;
  b.addBuff(e, { key, source: u, flags: { noMove: true, disarm: true } });
  const end = () => {
    if (finished) return;
    finished = true; timer.cancel(); b.removeBuff(e, key);
    // The source link's minimum one-second attach remains independent of an
    // early collision/short shift; it never leaks a resident control buff.
    b.after(Math.max(0, 1 - (b.time - started)), done);
  };
  const timer = b.every(b.dt, () => {
    if (!live(e) || e.deploySeq !== seq || !e.findBuff(key)) { end(); return; }
    const remaining = b.planPull(e, force, { to, center: from });
    if (!remaining) { end(); return; }
    const requested = Math.min(plan.distance - moved, plan.distance * b.dt / duration, remaining.distance);
    const actual = b.displace(e, remaining.direction, requested); moved += actual;
    b.fx('beam', { x: e.x, y: e.y, from: u.id, to: e.id, kind: 'ulpia:capture', dur: b.dt });
    if (moved >= plan.distance - 1e-9 || actual < requested - 1e-9
      || b.time >= started + duration - 1e-9) end();
  });
}
function contact(b, u) {
  const es = targets(b, u, u.skill.def.rangeGrid, u.skill.bb.max_target), bb = { ...u.skill.bb };
  const [begin, loop] = s1Names(u), cast = { seq: u.deploySeq, rate: rate(u), emitted: false,
    activation: u.skill.activations, attackId: ++b._attackSeq, pending: 0, invalidAt: b.time };
  u.mem.ulpiaS1 = cast; form(u, begin);
  b.addBuff(u, { key: 'ulpia:s1-lock', flags: { disarm: true, noSp: true } });
  cast.epoch = u.attackControlEpoch;
  const valid = () => live(u) && u.skill.active && u.skill.activations === cast.activation
    && u.deploySeq === cast.seq && u.mem.ulpiaS1 === cast
    && u.canAct && u.attackControlEpoch === cast.epoch;
  cast.watch = b.every(b.dt, () => {
    if (!valid() && !cast.finishing) {
      cast.watch.cancel(); u.mem.ulpiaS1 = null; b.removeBuff(u, 'ulpia:s1-lock');
      form(u, null); if (u.skill.active) u.skill.end('interrupted'); return;
    }
    if (cast.emitted && !cast.pending && b.time >= cast.invalidAt + 1
      && b.time >= cast.beginEnds) finishS1(b, u, cast, !cast.launched);
  }, { owner: u });
  cast.beginEnds = b.time + model(u).durations[begin] / cast.rate;
  b.after(model(u).hits[begin][0] / cast.rate, () => {
    if (!valid()) return;
    cast.emitted = true;
    // INPUT is retained; dead targets are not replaced at release.
    for (const e of es) if (canTargetEnemy(u, e, ground)) {
      cast.pending++; cast.launched = true;
      const from = { x: u.x, y: u.y }, f = [...u.fwd];
      const p = b.addProjectile({ from, source: u, target: e, speed: 10,
        maxAge: 1.2999999523162842, visual: 'bolt', data: { arkpediaTrackedVisual: true, ulpiaS1: cast },
        onHit: ({ target }) => {
          const eligible = target && canTargetEnemy(u, target, ground);
          if (eligible) {
            // Current source ATK is the bounded useCachedAtkOnly=0 policy.
            b.dealDamage(u, target, { amount: u.s.atk * u.s.atkScaleMul * bb.atk_scale,
              type: 'phys', isAttack: true, isSkill: true, isProjectile: true,
              attackId: cast.attackId, applyWay: 'ranged', tags: ['ulpia:s1'] });
          }
          // Capture link remains owned by its emitted projectile, even if the
          // operator is interrupted/withdrawn. Shift physics remain shared.
          captureLink(b, u, eligible ? target : null, cast, from, f, bb.force,
            () => { cast.pending--; cast.invalidAt = b.time; });
        } });
      // A dead INPUT fizzles without onHit. The fixed source lifetime bounds
      // cleanup; an impact link has its own one-second attach interval.
      b.after(1.2999999523162842, () => {
        if (b.projectiles.list.includes(p)) return;
        if (!p.ulpiaReached) { cast.pending--; cast.invalidAt = b.time; }
      });
      const onHit = p.onHit;
      p.onHit = ctx => { p.ulpiaReached = true; onHit(ctx); };
    }
    if (!cast.pending) cast.invalidAt = b.time;
  }, { owner: u });
  b.after(model(u).durations[begin] / cast.rate, () => {
    if (valid() && !cast.finishing) form(u, loop, true);
  }, { owner: u });
}
function thirdEndpoint(b, u) {
  const grid = u.skill.def.rangeGrid;
  const keys = absoluteRangeKeys(grid, u.tileR, u.tileC, u.dir);
  // Native selector28 is closed code. Map its documented first-hit/max-range
  // rule to integer root tiles: ground enemies nearest along the facing line,
  // then the farthest in-map range tile. No walkability/obstacle shortcut.
  const es = b.enemiesInKeys(keys, u, ground).map(e => ({ e, r: Math.round(e.y), c: Math.round(e.x) }))
    .filter(p => keys.includes(p.r * COLS + p.c));
  const dist = p => (p.r - u.tileR) * u.fwd[0] + (p.c - u.tileC) * u.fwd[1];
  es.sort((a, z) => dist(a) - dist(z) || a.e.spawnSeq - z.e.spawnSeq);
  if (es.length) return { row: es[0].r, col: es[0].c };
  const ks = keys.map(k => ({ r: Math.floor(k / COLS), c: k % COLS })).filter(p => b.grid.inRect(p.r, p.c));
  ks.sort((a, z) => dist(z) - dist(a));
  return ks.length ? { row: ks[0].r, col: ks[0].c } : { row: u.tileR, col: u.tileC };
}
function thirdStats(u) { return { key: 'ulpia:s3-stats', source: u,
  mods: { hpPct: u.skill.bb.max_hp, atkPct: u.skill.bb.atk }, flags: { noSp: true } }; }
function movePolicy(u, active) {
  // Explicit graph-based resident policy: carry selected kill stacks, the
  // source rebirth-exempt Abyssal grants and deck effects; temporary resident
  // buffs are detached and may be rediscovered by their source aura later.
  return { allowInPlace: true, checkBuild: active, clearSp: true,
    carryBuffKeys: u.buffs.filter(x => x.key === selfKey || x.key.startsWith('ulpia:abyssal:')
      || ['skadi:deck', 'silverash:deck'].includes(x.key)).map(x => x.key),
    rebuildBuffs: active ? [thirdStats(u)] : [] };
}
function openPaths(b, u) {
  const state = { home: [u.tileR, u.tileC], seq: u.deploySeq,
    activation: u.skill.activations, returning: false, moved: false, attackId: ++b._attackSeq };
  u.mem.ulpiaS3 = state; b.addBuff(u, thirdStats(u));
  const clip = u.dir === 'DOWN' ? 'Skill_3_Begin_Down' : 'Skill_3_Begin';
  transition(b, u, clip);
  const target = thirdEndpoint(b, u), valid = () => live(u) && u.skill.active
    && u.mem.ulpiaS3 === state && !state.returning && u.deploySeq === state.seq;
  b.after(model(u).hits[clip][0], () => {
    if (!valid()) return;
    const bb = { ...u.skill.bb };
    b.addProjectile({ from: { x: u.x, y: u.y }, to: { x: target.col, y: target.row }, source: u,
      speed: 15, maxAge: 5, visual: 'bolt', data: { arkpediaTrackedVisual: true, ulpiaS3: state },
      onMove: ({ projectile: p }) => { if (!valid()) p.removed = true; },
      onHit: () => {
        if (!valid()) return;
        const es = b.enemiesInRadius(target.col, target.row, bb.projectile_range)
          .filter(e => canTargetEnemy(u, e, ground));
        for (const e of es) b.applyStatus(e, 'stun', { source: u, duration: bb.stun });
        for (const e of es) if (canTargetEnemy(u, e, ground)) b.dealDamage(u, e, {
          amount: u.s.atk * u.s.atkScaleMul * bb.atk_scale, type: 'phys', applyWay: 'ranged',
          isAttack: true, isSkill: true, isProjectile: true, attackId: state.attackId, tags: ['ulpia:s3-anchor'] });
        if (!valid()) return;
        const inPlace = target.row === u.tileR && target.col === u.tileC;
        if (sourceMoveRespawn(b, u, target.row, target.col, { ...movePolicy(u, true),
          reserveOrigin: !inPlace, reservationKey: TOKEN })) {
          if (!live(u) || !u.skill.active || u.mem.ulpiaS3 !== state) return;
          state.moved = !inPlace; state.seq = u.deploySeq;
          transition(b, u, inPlace ? 'Skill_3_ReStart_B' : 'Skill_3_ReStart_A');
        }
      } });
  }, { owner: u });
}
function returnHome(b, u) {
  const state = u.mem.ulpiaS3;
  if (!state || !live(u)) return;
  state.returning = true;
  b.removeProjectiles(p => p.data?.ulpiaS3 === state);
  transition(b, u, 'Skill_3_End', () => {
    if (!live(u) || u.mem.ulpiaS3 !== state) return;
    b.releaseTileReservations(u, TOKEN);
    const inPlace = state.home[0] === u.tileR && state.home[1] === u.tileC;
    if (!sourceMoveRespawn(b, u, ...state.home, movePolicy(u, false))) { b.kill(u); return; }
    if (!live(u) || u.mem.ulpiaS3 !== state) return;
    u.mem.ulpiaS3 = null;
    // Native forceRespawnInPlace=false accepts a return already on the home
    // tile; this bridge still emits one opt-in lifetime, never a new cast.
    transition(b, u, 'Skill_3_Back');
    b.fx('pulse', { x: u.x, y: u.y, kind: inPlace ? 'ulpia:restore-in-place' : 'ulpia:restore' });
  });
}
export function customizeUlpianusKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  kit.trait = { install: null, attack: 'melee', dmgType: 'phys', projectile: 'none',
    ...ground, hits: 1, hitsFn: null, dmgMul: null, maxTargets: 1, maxTargetsByBlock: true,
    hitAllBlocked: false, allInRange: false, splashRadius: 0, chain: null,
    interruptOnSkillChange: true, retargetOnRelease: false,
    canAttack: () => !u.mem.ulpiaTransition && !u.mem.ulpiaS1,
    attackVisual: () => mode(u) === 2 ? 'Skill_2_Loop' : mode(u) === 3 ? 'Skill_3_Loop' : 'Attack',
    windup: () => model(u).hits[mode(u) === 2 ? 'Skill_2_Loop' : mode(u) === 3 ? 'Skill_3_Loop' : 'Attack'][0] / rate(u),
    launchAttack: (b, u, p, e, info) => resolveHit(b, u, p, e, info, e.x, e.y) };
  const s = def.skill, n = Number(s.id.at(-1));
  const available = () => !u.mem.ulpiaTransition && !u.mem.ulpiaS1 && !u.mem.ulpiaS3;
  if (n === 1) kit.skill = { kind: 'toggle', trigger: 'SEARCH',
    canActivate: () => available() && targets(b, u, s.rangeGrid, s.bb.max_target).length > 0,
    defaultCondition: () => targets(b, u, s.rangeGrid, s.bb.max_target).length > 0,
    onStart: () => contact(b, u) };
  else if (n === 2) kit.skill = { kind: 'toggle', trigger: 'SP_FULL', canActivate: available,
    mods: { hpPct: s.bb.max_hp, atkPct: s.bb.atk, blockCnt: s.bb.block_cnt },
    onStart: () => transition(b, u, 'Skill_2_Begin') };
  else kit.skill = { kind: 'duration', duration: s.duration, manualCancel: true,
    canActivate: available, canManualCancel: () => !u.mem.ulpiaS3?.returning,
    onStart: () => openPaths(b, u), onEnd: () => returnHome(b, u) };
}
export function installUlpianus({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  b.on('deploy', ({ unit }) => {
    if (unit !== u) return;
    clearOwned(b, u); u.mem.ulpiaNextHunters = b.time + .03999999910593033;
  }, { owner: u });
  for (const ev of ['death', 'retreat']) b.on(ev, ({ unit }) => { if (unit === u) clearOwned(b, u); }, { owner: u });
  b.on('kill', ({ killer, victim }) => {
    if (killer === u && victim.side === 'enemy') selfStack(b, u);
  }, { owner: u });
  b.on('tick', () => {
    if (live(u) && b.time + 1e-9 >= u.mem.ulpiaNextHunters) {
      syncHunters(b, u); u.mem.ulpiaNextHunters = b.time + 1;
    }
  }, { owner: u });
  b.on('damaged', ({ target, dmg }) => {
    const bb = def.talents.find(t => t.bb.value1 != null)?.bb;
    if (target !== u || !live(u) || !bb || !dmg || dmg.type === 'element'
      || dmg.tags.includes('hpLoss') || dmg.cancel) return;
    // Accepted receipt after mitigation/shields is the bounded native take-
    // damage bridge. HP threshold is sampled here, not at cast/deploy time.
    const heal = u.hpRatio > bb.hp_ratio ? bb.value1 : bb.value2;
    b.heal(u, u, heal * (mode(u) === 2 ? u.skill.bb.talent_scale : 1), { self: true });
  }, { owner: u });
}
