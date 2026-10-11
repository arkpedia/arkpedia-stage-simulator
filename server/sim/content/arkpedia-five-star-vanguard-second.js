// SPDX-License-Identifier: GPL-3.0-or-later
import { FIVE_STAR_VANGUARD_SECOND_OPERATORS } from '../../../shared/arkpedia/five-star-vanguard-second-operators.js';
import evidence from '../../../data/arkpedia-five-star-vanguard-second-prefabs.json' with { type: 'json' };
import { absoluteRangeKeys, canTargetEnemy } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { enforceBlockCapacity } from '../ai.js';

const G = 'char_220_grani', E = 'char_401_elysm', W = 'char_496_wildmn', K = 'char_4023_rfalcn';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[u.defId][['LEFT', 'UP'].includes(u.dir) ? 'Back' : 'Front'];
const attackClip = u => u.defId === G && ['LEFT', 'UP'].includes(u.dir) ? 'Attack_Up' : 'Attack';
const windup = (clip, cap = Infinity) => (_b, u) => model(u).hits[clip === 'Attack' ? attackClip(u) : clip][0] / Math.min(cap, u.s.aspd / 100);
const auraEligible = (b, u, ally) => live(ally) && ally.kind !== 'device' && b.allySelectable(ally, u);
function ownedBuff(b, u, ally, key, mods, active) {
  if (!active) b.removeBuff(ally, key);
  else if (JSON.stringify(ally.findBuff(key)?.mods) !== JSON.stringify(mods))
    b.addBuff(ally, { key, source: u, mods });
}
function form(b, u, begin, loop, end) {
  const seq = u.deploySeq, activation = u.skill.activations;
  u.mem.regularFormVisual = { clip: begin, loop: false };
  b.after(model(u).durations[begin], () => {
    if (live(u) && u.deploySeq === seq && u.skill.active && u.skill.activations === activation)
      u.mem.regularFormVisual = { clip: loop, loop: true };
  }, { owner: u });
  return reason => {
    if (reason === 'death' || !end) { u.mem.regularFormVisual = null; return; }
    u.mem.regularFormVisual = { clip: end, loop: false };
    b.after(model(u).durations[end], () => {
      if (u.deploySeq === seq && u.skill.activations === activation) u.mem.regularFormVisual = null;
    }, { owner: u });
  };
}

/** Original card additions apply to the already computed ordinary redeploy cost.
 * Native C# rounding/order is explicitly unrecovered in the source record. */
export function adjustFiveStarVanguardSecondCost(b, id, ordinaryCost) {
  if (!Number.isFinite(ordinaryCost)) return ordinaryCost;
  let value = b._wildManeCardDiscounts?.get(id) ?? 0;
  const elysium = b.bench?.[E]?.unit;
  if (elysium?.alive && elysium.deployed && b.data.getChess(id)?.profession === 'SNIPER')
    value += elysium.def.talents[0]?.bb.value ?? 0;
  return Math.max(0, ordinaryCost + value);
}
/** Called only after a successful ordinary spawn; failed/cancelled placement
 * and other cards never consume an UNTIL_NEXT_SPAWN guard-card discount. */
export function consumeFiveStarVanguardSecondCard(b, id) {
  b._wildManeCardDiscounts?.delete(id);
}
function wildManeCards(b, u, talent) {
  const count = (b.bench[u.defId]?.deployments ?? 0) + 1;
  if (!talent.flag && count > 1) return;
  const discounts = b._wildManeCardDiscounts ??= new Map();
  for (const [id, entry] of Object.entries(b.bench)) {
    // The native card filter explicitly checks in-hand, not every squad card.
    if (b.data.getChess(id).profession !== 'WARRIOR' || entry.unit?.alive || entry.readyAt > b.time) continue;
    discounts.set(id, Math.max(talent.value * talent.max_stack_cnt, (discounts.get(id) ?? 0) + talent.value));
  }
}
function periodicDp(spec, bb, interval = bb.interval, cost = bb.cost) {
  let elapsed = 0, granted = 0;
  const onStart = spec.onStart;
  spec.onStart = ctx => { elapsed = granted = 0; onStart?.(ctx); };
  spec.onTick = ({ battle, unit, skill, dt }) => {
    elapsed += Math.min(dt, Math.max(0, skill.timeLeft));
    while (granted < bb.value && elapsed + 1e-9 >= (granted + 1) * interval) {
      granted++; battle.addDp(unit.ownerId, cost);
    }
  };
}
function elysiumAspd(b, u, def) {
  const key = `elysium:ASPD:${u.id}`, talent = def.talents[0]?.bb;
  for (const ally of b.allyUnits) ownedBuff(b, u, ally, key, { aspd: talent?.attack_speed ?? 0 },
    talent && live(u) && u.skill.active && auraEligible(b, u, ally) && ally.def.profession === 'SNIPER');
}
function elysiumLocks(b, u, def) {
  const bb = def.skill.bb, keys = new Set(absoluteRangeKeys(def.skill.rangeGrid, u.tileR, u.tileC, u.dir));
  // Native ALL motion / ignoreTargetFree1; postFilter24 nearest interpretation
  // and physically disappeared exclusion are recorded, not enum parity claims.
  const selected = b.enemies.filter(e => live(e) && bodyInKeys(e, keys))
    .sort((a, c) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(c.x - u.x, c.y - u.y) || a.spawnSeq - c.spawnSeq)
    .slice(0, bb.max_target);
  const key = `elysium:lock:${u.id}`;
  for (const enemy of selected) b.addBuff(enemy, { key, source: u, duration: def.skill.duration,
    interval: .25, flags: { reveal: true }, mods: { defMul: 1 + bb.def, moveMul: 1 + bb.move_speed },
    onTick: () => { if (!u.alive || !u.deployed) b.removeBuff(enemy, key); } });
  u.mem.elysiumLocks = selected;
}

export function customizeFiveStarVanguardSecondKit({ battle: b, id, def, unit: u, kit }) {
  if (!FIVE_STAR_VANGUARD_SECOND_OPERATORS[id]) return;
  const s = def.skill, bb = s.bb;
  kit.install = null;
  kit.trait = { attack: 'melee', dmgType: 'phys', projectile: 'none', canHitFly: false,
    maxTargets: 1, hitAllBlocked: false, interruptOnSkillChange: true,
    windup: windup('Attack', id === G ? 2 : id === K ? 1 : Infinity), attackVisual: (_b, unit) => attackClip(unit) };
  let endForm;
  const mode = (begin, loop, end) => ({ onStart: () => { endForm = form(b, u, begin, loop, end); },
    onEnd: ({ reason }) => endForm?.(reason) });
  if (id === G) {
    kit.skill = s.id === 'skcom_def_up[3]' ? { kind: 'duration', mods: { defPct: bb.def } }
      : { kind: 'duration', mods: { atkPct: bb.atk, defPct: bb.def, blockCnt: bb.block_cnt },
        targeting: { rangeGrid: s.rangeGrid }, ...mode('Skill_Begin', 'Skill_Loop', 'Skill_End'),
        attack: { hitAllBlocked: true, maxTargetsByBlock: true, windup: windup('Skill_Loop'), attackVisual: 'Skill_Loop',
          acquireTargets: (_battle, unit, profile) => unit.blocking.filter(e => e.blockedBy === unit && canTargetEnemy(unit, e, profile)) } };
  } else if (id === E) {
    const first = s.id === 'skcom_assist_cost[3]', n = first ? 1 : 2;
    kit.skill = { kind: 'duration', mods: { blockCntMul: 0 }, flags: { disarm: true },
      attack: { noAttack: true }, ...mode(`Skill_${n}_Start`, `Skill_${n}_Loop`, `Skill_${n}_End`) };
    const start = kit.skill.onStart, end = kit.skill.onEnd;
    kit.skill.onStart = ctx => {
      start(ctx); enforceBlockCapacity(b, u); elysiumAspd(b, u, def);
      if (!first) elysiumLocks(b, u, def);
    };
    kit.skill.onEnd = ctx => {
      end(ctx); elysiumAspd(b, u, def);
      // Source enemy buffs poll caster validity after departure; retain their
      // .25s checker on death, but ordinary skill finish ends them immediately.
      if (ctx.reason !== 'death') for (const e of u.mem.elysiumLocks ?? []) b.removeBuff(e, `elysium:lock:${u.id}`);
    };
    periodicDp(kit.skill, bb);
  } else if (id === W) {
    const first = s.id === 'skchr_wildmn_1';
    kit.skill = first ? { kind: 'duration', duration: s.duration, activateOnDeploy: true, spType: 'none', trigger: 'NEVER',
      isExhausted: () => u.skill?.activations >= 1,
      mods: { aspd: bb.attack_speed }, ...mode('Skill_1_Begin', 'Skill_1_Idle', 'Skill_1_End'),
      attack: { windup: windup('Skill_1_Loop'), attackVisual: 'Skill_1_Loop' } }
      : { kind: 'duration', mods: { atkPct: bb.atk }, targeting: { rangeGrid: s.rangeGrid },
        attack: { windup: windup('Skill_2'), attackVisual: 'Skill_2',
          onEachHit: ({ target }) => {
            if (!target?.alive) return;
            // The shared directional primitive already applies the native
            // knockback[dir] two-level off-axis/near-distance penalty.
            b.push(target, bb['attack@force'], { from: u,
              dir: { x: u.fwd[1], y: u.fwd[0] } });
          } } };
  } else {
    kit.skill = s.id === 'skcom_charge_cost[3]' ? { kind: 'instant', onStart: () => b.addDp(u.ownerId, bb.cost) }
      : { kind: 'duration', mods: { atkPct: bb.atk, aspd: bb.attack_speed }, targeting: { rangeGrid: s.rangeGrid },
        ...mode('Skill_2_Begin', 'Skill_2_Idle', 'Skill_2_End'),
        attack: { windup: windup('Skill_2_Loop', 1), attackVisual: 'Skill_2_Loop' } };
    if (s.id === 'skchr_rfalcn_2') periodicDp(kit.skill, bb, bb['rfalcn_s_2[cost].interval'], bb['rfalcn_s_2[cost].cost']);
  }
  kit.skill.id = s.id; kit.skill.name = s.name;
}

export function installFiveStarVanguardSecond({ battle: b, unit: u, def }) {
  const id = def.charId, talent = def.talents[0]?.bb;
  if (!FIVE_STAR_VANGUARD_SECOND_OPERATORS[id] || !talent) return;
  if (id === G) {
    const key = `grani:dodge:${u.id}`;
    const sync = () => {
      for (const ally of b.allyUnits) ownedBuff(b, u, ally, key, { dodgePhys: talent.prob },
        live(u) && auraEligible(b, u, ally) && ally.def.profession === 'PIONEER');
    };
    for (const ev of ['deploy', 'death', 'tick']) b.on(ev, sync, { owner: u });
  } else if (id === E) {
    for (const ev of ['deploy', 'death', 'tick']) b.on(ev, () => elysiumAspd(b, u, def), { owner: u });
  } else if (id === W) {
    b.on('deploy', ({ unit }) => { if (unit === u) wildManeCards(b, u, talent); }, { owner: u });
  } else if (id === K) {
    b.on('hit', ({ source, dmg }) => {
      if (source !== u || !dmg.isAttack || dmg.type !== 'phys') return;
      const scale = u.skill.active && def.skill.id === 'skchr_rfalcn_2' ? def.skill.bb['talent@prob_scaler'] : 1;
      if (b.rng.chance(talent.prob * scale)) dmg.amount *= talent.atk_scale;
    }, { owner: u });
  }
}
