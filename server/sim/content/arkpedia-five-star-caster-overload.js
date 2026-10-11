// SPDX-License-Identifier: GPL-3.0-or-later
import { FIVE_STAR_CASTER_OVERLOAD_OPERATORS } from '../../../shared/arkpedia/five-star-caster-overload-operators.js';
import evidence from '../../../data/arkpedia-five-star-caster-overload-prefabs.json' with { type: 'json' };
import { effectiveProfile, resolveHit } from '../ai.js';
import { absoluteRangeKeys, canTargetEnemy, canTargetAlly, tileKeyOf } from '../targeting.js';
import { COLS } from '../constants.js';

const live = u => u?.alive && u.deployed;
const noExtras = p => ({ ...p, hits: 1, hitsFn: null, chain: null, splashRadius: 0, dmgMul: null });
const hitTime = (id, clip, cap = Infinity) => (_b, u) => evidence.models[id].Front.hits[clip][0] / Math.min(cap, u.s.aspd / 100);
const modelDuration = (id, clip) => evidence.models[id].Front.durations[clip];
const form = (u, clip, loop = false) => { u.mem.regularFormVisual = { clip, loop }; };
function formEnd(b, u, clip, after = null) {
  if (!live(u)) return;
  const seq = u.deploySeq, duration = modelDuration(u.def.charId, clip);
  form(u, clip);
  b.after(duration, () => {
    if (!live(u) || u.deploySeq !== seq) return;
    u.mem.regularFormVisual = null; after?.();
  }, { owner: u });
}
function entrance(b, u, clip, after) {
  const seq = u.deploySeq, activation = u.skill.activations, duration = modelDuration(u.def.charId, clip);
  form(u, clip); b.addBuff(u, { key: 'caster:entrance', duration, flags: { disarm: true } });
  b.after(duration, () => {
    if (live(u) && u.deploySeq === seq && u.skill.active && u.skill.activations === activation) after?.();
  }, { owner: u });
}
function fly(b, u, target, p, info) {
  b.addProjectile({ from: u, target, source: u, speed: 10,
    visual: p.projectile || 'bolt', data: { arkpediaTrackedVisual: true },
    onHit: ({ target, x, y }) => { if (target && canTargetEnemy(u, target, p)) resolveHit(b, u, p, target, info, x, y); } });
}
function tomimiLaunch(b, u, p, target, info) {
  const hit = noExtras(p);
  if (!p.isSkill) { fly(b, u, target, hit, info); return; }
  if (u.skill.id !== 'skchr_tomimi_2' || !b.rng.chance(u.skill.bb['attack@tomimi_s_2.prob'])) {
    resolveHit(b, u, hit, target, info, target.x, target.y); return;
  }
  const choice = b.rng.int(3);
  if (choice === 0) {
    // Original AoE action replaces the main output; it never adds another copy.
    for (const e of b.enemiesInRadius(target.x, target.y, 1))
      if (canTargetEnemy(u, e, hit)) resolveHit(b, u, hit, e, info, e.x, e.y);
  } else resolveHit(b, u, { ...hit,
    ...(choice === 1 ? { atkScale: u.skill.bb['attack@tomimi_s_2.atk_scale'] }
      : { onHitStatus: { key: 'stun', duration: u.skill.bb['attack@tomimi_s_2.stun'] } }),
  }, target, info, target.x, target.y);
}
function phalanxIdle(b, u, def) {
  if (!live(u)) return;
  const active = u.skill?.active || u.mem.phalanxEnding;
  if (active) b.removeBuff(u, 'phalanx:idle');
  else if (!u.findBuff('phalanx:idle')) b.addBuff(u, { key: 'phalanx:idle', mods: {
    defPct: def.traitBb.def, resFlat: def.traitBb.magic_resistance,
    ...(def.charId === 'char_344_beewax' ? { hpRegenRatio: def.talents[0]?.bb.hp_recovery_per_sec_by_max_hp_ratio ?? 0 } : {}),
  } });
}
function syncMint(b, u, def) {
  const talent = def.talents[0]; if (!talent) return;
  const key = `mint:ally:${u.id}`, idle = live(u) && !u.skill.active && !u.mem.phalanxEnding;
  const keys = new Set(absoluteRangeKeys(talent.rangeGrid, u.tileR, u.tileC, u.dir));
  for (const a of b.allyUnits) {
    const eligible = idle && a !== u && live(a) && canTargetAlly(u, a, false) && keys.has(tileKeyOf(a));
    if (!eligible) b.removeBuff(a, key);
    else if (!a.findBuff(key)) b.addBuff(a, { key, source: u, mods: { defPct: talent.bb.def } });
  }
}
function tokenRecord(b, u) {
  const id = 'token_10011_beewax_oblisk', source = b.data.raw.tokens[id];
  if (!source) throw Error('Missing reviewed Beeswax token source');
  const build = u.def.raw.arkpedia, phase = source.phases[build.elite];
  const low = phase.attributesKeyFrames[0], high = phase.attributesKeyFrames.at(-1);
  const ratio = (build.level - low.level) / (high.level - low.level || 1);
  const stats = Object.fromEntries(Object.entries(low.data).filter(([, value]) => typeof value === 'number')
    .map(([k, v]) => [k, v + ((high.data[k] ?? v) - v) * ratio]));
  for (const k of ['maxHp', 'atk', 'def']) stats[k] = Math.round(stats[k]);
  return { id, name: source.name, profession: source.profession, subProfessionId: source.subProfessionId,
    position: source.position, stats, rangeGrid: phase.rangeGrid, abnormal: ['healFree'],
    talents: [], skill: null, avatar: source.avatar, arkpedia: { ...build } };
}
function createObelisk(b, u) {
  const tiles = u.rangeKeys.filter(key => {
    const row = Math.floor(key / COLS), col = key % COLS;
    return b.grid.inRect(row, col) && ['MELEE', 'ALL'].includes(b.grid.tile(row, col).build)
      && !b.allyUnits.some(a => live(a) && a.tileR === row && a.tileC === col) && !b.downOn(row, col);
  });
  const occupiedByEnemy = tiles.filter(key => b.enemies.some(e => canTargetEnemy(u, e, { canHitFly: false }) && tileKeyOf(e) === key));
  const key = b.rng.pick(occupiedByEnemy.length ? occupiedByEnemy : tiles);
  if (key == null) return;
  const token = b.spawnToken(u, 'token_10011_beewax_oblisk', Math.floor(key / COLS), key % COLS, {
    def: tokenRecord(b, u), duration: 20, dir: 'RIGHT',
    kit: { skill: null, trait: { noAttack: true }, install: (battle, t) => {
      battle.addBuff(t, { key: 'beeswax:heal-free', persist: true, allowDead: true,
        flags: { healFree: true }, mods: { hpRegenMul: 0 } });
    } },
  });
  if (!token) return;
  token.deploymentSlotCost = 0; u.mem.obelisk = token;
  // The original token uses its real one-second Start animation as birth time.
  b.after(evidence.tokenModels.token_10011_beewax_oblisk.durations.Start, () => {
    if (!live(token) || !live(u)) return;
    const keys = absoluteRangeKeys(evidence.ranges['x-4'], token.tileR, token.tileC, 'RIGHT');
    for (const e of b.enemiesInKeys(keys, u, { canHitFly: false })) {
      b.dealDamage(u, e, { amount: u.s.atk * u.skill.bb.atk_scale, type: 'arts', isSkill: true,
        isAttack: true, applyWay: 'melee', tags: ['beeswax:birth'] });
      if (e.alive) b.applyStatus(e, 'stun', { source: u, duration: u.skill.bb.stun });
    }
  }, { owner: token });
}
function mintFinish(b, u, s) {
  if (!live(u)) return;
  u.mem.phalanxEnding = true;
  b.addBuff(u, { key: 'mint:finishing', duration: modelDuration(u.def.charId, 'Skill_2_End'), flags: { disarm: true } });
  formEnd(b, u, 'Skill_2_End', () => { u.mem.phalanxEnding = false; phalanxIdle(b, u, u.def); syncMint(b, u, u.def); });
  const seq = u.deploySeq;
  b.after(evidence.models[u.def.charId].Front.hits.Skill_2_End[0], () => {
    if (!live(u) || u.deploySeq !== seq || !u.canAct) return;
    const keys = absoluteRangeKeys(evidence.ranges['x-1'], u.tileR, u.tileC, u.dir);
    for (const e of b.enemiesInKeys(keys, u, { canHitFly: true })) {
      b.dealDamage(u, e, { amount: u.s.atk * s.bb.atk_scale, type: 'arts', isSkill: true, isAttack: true, applyWay: 'melee' });
      if (e.alive) b.pull(e, s.bb['attack@force'], { to: u, center: u });
    }
  }, { owner: u });
}
function lavaArea(b, u, p, target, info) {
  const hit = noExtras(p);
  // Each original S1 projectile reaches immediately and carries its own AoE.
  for (const e of b.enemiesInRadius(target.x, target.y, 1.1))
    if (canTargetEnemy(u, e, hit)) resolveHit(b, u, hit, e, info, e.x, e.y);
}
function lavaRingHost(b, u, host) {
  return live(host) && host !== u && canTargetAlly(u, host, false) && u.rangeKeySet.has(tileKeyOf(host));
}
function lavaRings(b, u, s) {
  const ally = b.allyUnits.filter(a => lavaRingHost(b, u, a)).sort((a, z) => z.hp - a.hp || a.id - z.id)[0];
  const rings = [{ host: u, acc: 0 }, ...(ally ? [{ host: ally, acc: 0 }] : [])];
  u.mem.lavaRings = rings;
  for (const ring of rings) b.addBuff(ring.host, { key: `lava2:ring:${u.id}`, source: u });
  const stop = () => {
    b.off(timer); for (const ring of rings) b.removeBuff(ring.host, `lava2:ring:${u.id}`);
    if (u.mem.lavaRingStop === stop) u.mem.lavaRingStop = null;
  };
  const timer = b.on('tick', ({ dt }) => {
    if (!live(u) || !u.skill.active) { stop(); return; }
    for (const ring of rings) {
      if (ring.done) continue;
      if (!live(ring.host) || ring.host !== u && !lavaRingHost(b, u, ring.host)) {
        ring.done = true; b.removeBuff(ring.host, `lava2:ring:${u.id}`); continue;
      }
      ring.acc += dt;
      while (ring.acc + 1e-9 >= s.bb.interval) {
        ring.acc -= s.bb.interval;
        const keys = absoluteRangeKeys(evidence.ranges['x-4'], ring.host.tileR, ring.host.tileC, 'RIGHT');
        for (const e of b.enemiesInKeys(keys, u, { canHitFly: true }))
          b.dealDamage(u, e, { amount: u.s.atk * s.bb.atk_scale, type: 'arts', isSkill: true,
            applyWay: 'none', tags: ['dot', 'lava2:ring'] });
      }
    }
  }, { owner: u });
  u.mem.lavaRingStop = stop;
}
function droneRamp(u, state, target) {
  const bb = u.def.traitBb, max = bb.max_atk_scale * (u.mem.rockOverload ? u.skill.bb.scale : 1);
  if (state.targetId !== target.id) { state.targetId = target.id; state.scale = bb.init_atk_scale; }
  else state.scale += bb.delta_atk_scale;
  state.scale = Math.min(max, state.scale); return state.scale;
}
function rockLaunch(b, u, p, target, info) {
  const hit = noExtras(p); fly(b, u, target, hit, info);
  if (!p.isSkill || u.skill.id !== 'skchr_rockr_2') {
    fly(b, u, target, { ...hit, projectile: 'drone', atkScale: droneRamp(u, u.mem.rockNormalRamp, target) }, info); return;
  }
  if (u.mem.rockDrone) return;
  const seq = u.deploySeq, activation = u.skill.activations;
  const state = { target, targetId: null, scale: 0, cooldown: .6 * 100 / u.s.aspd };
  const stop = () => { b.off(timer); if (u.mem.rockDrone === state) u.mem.rockDrone = null; };
  const timer = b.on('tick', ({ dt }) => {
    if (!live(u) || u.deploySeq !== seq || !u.skill.active || u.skill.activations !== activation || !live(target)) { stop(); return; }
    state.cooldown = Math.max(0, state.cooldown - dt);
    if (state.cooldown > 1e-9 || !canTargetEnemy(u, target, hit)) return;
    b._ev(['atk', u.id, target.id, 'drone']);
    resolveHit(b, u, { ...hit, projectile: 'drone', atkScale: droneRamp(u, state, target) }, target, info, target.x, target.y);
    state.cooldown = u.s.interval;
  }, { owner: u });
  state.stop = stop; u.mem.rockDrone = state;
}

export function customizeFiveStarCasterOverloadKit({ battle: b, id, def, unit: u, kit }) {
  if (!FIVE_STAR_CASTER_OVERLOAD_OPERATORS[id] || !def.skill) return;
  kit.install = null; const s = def.skill, bb = s.bb;
  const duration = extras => ({ id: s.id, name: s.name, kind: 'duration', duration: s.duration, ...extras });
  kit.trait = { attack: 'ranged', dmgType: 'arts', projectile: 'bolt', projectileSpeed: 10,
    hits: 1, hitsFn: null, dmgMul: null, splashRadius: 0, chain: null, maxTargets: 1,
    allInRange: false, hitAllBlocked: false, canHitFly: true, install: null,
    interruptOnSkillChange: true, attackVisual: 'Attack' };
  if (id === 'char_411_tomimi') {
    kit.trait.windup = hitTime(id, 'Attack'); kit.trait.launchAttack = tomimiLaunch;
    const first = s.id === 'skchr_tomimi_1';
    kit.skill = duration({ mods: { atkPct: def.talents[0].bb.atk, ...(first ? { aspd: bb.attack_speed } : {}) },
      targeting: { rangeGrid: def.talents[0].rangeGrid },
      attack: { dmgType: 'phys', projectile: 'none', canHitFly: false,
        windup: hitTime(id, first ? 'Skill_Loop' : 'Skill_2_Loop'), attackVisual: first ? 'Skill_Loop' : 'Skill_2_Loop' } });
  } else if (id === 'char_344_beewax' || id === 'char_388_mint') {
    const beeswax = id === 'char_344_beewax', first = s.id.endsWith('_1');
    Object.assign(kit.trait, { noAttack: true, projectile: 'none', allInRange: true });
    kit.skill = duration({ mods: beeswax
      ? (first ? { atkPct: bb.atk } : {})
      : { taunt: def.talents[0]?.bb.taunt_level ?? 0 },
      ...(first ? { targeting: { rangeGrid: s.rangeGrid } } : {}),
      attack: { noAttack: false, projectile: 'none', allInRange: true,
        ...(beeswax ? { windup: hitTime(id, 'Skill_Loop', 1), attackVisual: 'Skill_Loop' }
          : first ? { atkScale: bb['attack@atk_scale'], windup: hitTime(id, 'Skill_1_Loop', 1), attackVisual: 'Skill_1_Loop' }
            : { atkScale: bb['attack@atk_scale'], windup: 0, attackVisual: 'none',
              onEachHit: ({ battle, target }) => { if (target.alive) battle.pull(target, bb['attack@force'], { to: u, center: u }); } }),
      }, onStart: () => {
        phalanxIdle(b, u, def); if (!beeswax) syncMint(b, u, def);
        const begin = beeswax ? 'Skill_Begin' : first ? 'Skill_1_Begin' : 'Skill_2_Begin';
        entrance(b, u, begin, () => {
          form(u, beeswax ? 'Skill_Idle' : first ? 'Skill_1_Idle' : 'Skill_2_Loop', true);
          if (beeswax && !first) createObelisk(b, u);
        });
      }, onEnd: ({ reason }) => {
        b.removeBuff(u, 'caster:entrance');
        if (!beeswax && !first && reason === 'duration') mintFinish(b, u, s);
        else { phalanxIdle(b, u, def); if (!beeswax) syncMint(b, u, def);
          formEnd(b, u, beeswax ? 'Skill_End' : 'Skill_1_End'); }
      } });
  } else if (id === 'char_1011_lava2') {
    Object.assign(kit.trait, { projectile: 'none', windup: hitTime(id, 'Attack', 1),
      retargetOnRelease: true, launchAttack: lavaArea });
    kit.skill = s.id === 'skchr_lava2_1'
      ? duration({ mods: { atkPct: bb.atk, rangeExtend: bb.ability_range_forward_extend },
        attack: { maxTargets: bb['attack@max_target'], windup: hitTime(id, 'Skill_1', 1), attackVisual: 'Skill_1' } })
      : duration({ attack: { noAttack: true }, onStart: () => {
        form(u, 'Skill_2_Begin'); lavaRings(b, u, s); const seq = u.deploySeq;
        b.after(modelDuration(id, 'Skill_2_Begin'), () => {
          if (live(u) && u.deploySeq === seq && u.skill.active) form(u, 'Skill_2_Loop', true);
        }, { owner: u });
      }, onEnd: () => { u.mem.lavaRingStop?.(); formEnd(b, u, 'Skill_2_End'); } });
  } else {
    Object.assign(kit.trait, { windup: hitTime(id, 'Attack'), launchAttack: rockLaunch });
    kit.skill = s.id === 'skcom_magic_rage[3]'
      ? duration({ mods: { aspd: bb.attack_speed }, attack: {} })
      : duration({ mods: { aspd: bb.attack_speed }, manualCancel: true,
        attack: { windup: hitTime(id, 'Skill_Loop'), attackVisual: 'Skill_Loop' },
        onStart: () => { u.mem.rockOverload = false; u.mem.rockOverloadAt = null;
          entrance(b, u, 'Skill_Begin', () => form(u, 'Skill_Idle', true));
        }, onTick: ({ skill }) => {
          if (!u.mem.rockOverload && s.duration - skill.timeLeft + 1e-9 >= s.duration / 2) {
            u.mem.rockOverload = true; u.mem.rockOverloadAt = b.time;
            b.addBuff(u, { key: 'rockrock:overload', mods: { atkPct: bb.atk } });
          }
        }, onEnd: () => {
          const stun = u.mem.rockOverloadAt == null ? 0 : b.time - u.mem.rockOverloadAt;
          u.mem.rockDrone?.stop(); u.mem.rockOverload = false; u.mem.rockOverloadAt = null;
          b.removeBuff(u, 'rockrock:overload'); b.removeBuff(u, 'caster:entrance');
          if (live(u) && stun > 1e-9) b.applyStatus(u, 'stun', { duration: stun, source: u });
          formEnd(b, u, 'Skill_End');
        } });
  }
  kit.skill.canActivate = () => u.canAct && !u.s.flags.silence && !u.mem.phalanxEnding;
}

export function installFiveStarCasterOverload({ battle: b, unit: u, def }) {
  if (!FIVE_STAR_CASTER_OVERLOAD_OPERATORS[def.charId]) return;
  if (def.charId === 'char_344_beewax' || def.charId === 'char_388_mint') {
    const sync = () => { phalanxIdle(b, u, def); if (def.charId === 'char_388_mint') syncMint(b, u, def); };
    for (const event of ['deploy', 'death', 'tick']) b.on(event, sync, { owner: u });
    if (def.charId === 'char_344_beewax') b.on('death', ({ unit }) => {
      if (unit === u && live(u.mem.obelisk)) b.retreat(u.mem.obelisk, { reason: 'owner-removed', permanent: true });
    }, { owner: u });
  }
  if (def.charId === 'char_1011_lava2' && def.talents[0]) {
    const talent = def.talents[0].bb, granted = new Set();
    const caster = a => a !== u && live(a) && a.kind === 'op' && a.def.profession === 'CASTER' && canTargetAlly(u, a, false);
    b.on('deploy', ({ unit: deployed }) => {
      if (deployed === u) {
        if ((b.bench[def.charId]?.deployments ?? 0) === 0) u.skill.gainSp(talent['lava2_t_1[self].sp'], 'talent');
        for (const a of b.allyUnits.filter(caster)) {
          a.skill.gainSp(talent['lava2_t_1[ally].sp'], 'talent'); granted.add(a);
        }
      } else if (live(u) && caster(deployed) && !granted.has(deployed)) {
        deployed.skill.gainSp(talent['lava2_t_1[ally].sp'], 'talent'); granted.add(deployed);
      }
    }, { owner: u });
  }
  if (def.charId === 'char_4040_rockr') {
    u.mem.rockNormalRamp = { targetId: null, scale: 0 };
    const talent = def.talents[0]?.bb;
    if (talent) {
      let born = null, stacks = 0;
      b.on('deploy', ({ unit }) => { if (unit === u) born = b.time; }, { owner: u });
      b.on('tick', () => {
        if (!live(u) || born == null) return;
        const count = Math.min(talent.max_stack_cnt, Math.floor((b.time - born + 1e-9) / talent.interval));
        if (count !== stacks) { stacks = count; b.addBuff(u, { key: 'rockrock:foundation', mods: { atkPct: talent.atk * count } }); }
      }, { owner: u });
    }
    b.on('death', ({ unit }) => { if (unit === u) u.mem.rockDrone?.stop(); }, { owner: u });
  }
}
