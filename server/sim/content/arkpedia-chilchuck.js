// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-chilchuck-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { bodyInKeys } from '../body.js';
import { canTargetEnemy } from '../targeting.js';

const ID = 'char_4144_chilc';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const second = u => u.skill.active && u.skill.id === 'skchr_chilc_2';
const clip = (u, targets) => second(u) ? 'Skill_2_Loop'
  : targets?.some(e => e.blockedBy === u) ? 'Combat' : 'Attack';

// Literal source conditional-node walk: the second Dice exists only on failure
// of the first. prob_stay is not read by this original template. Reset-per-cast
// and independent RNG calls are bounded bridges, not executable Dice parity.
export function chilchuckCost(bb, rng) {
  let value = bb.mid_cost;
  for (let i = 0; i < bb.step; i++) {
    if (rng() < bb.prob_add) value++;
    else if (rng() < bb.prob_minus) value--;
  }
  return value;
}

function syncAura(b, u) {
  const key = `chilchuck:environment:${u.id}`;
  const enabled = live(u) && u.mem.chilcExpiresAt != null && b.time < u.mem.chilcExpiresAt - 1e-9;
  // Source targetSide ALLY, motion ALL, category3 and purposeNONE explicitly
  // ignore target-free/ally-target-free. This is not a HEAL selector: noHeal,
  // HealFree, friendly stealth or isolation do not disable this nonheal aura.
  for (const a of b.allyUnits) {
    const inside = enabled && live(a) && a.side === 'ally' && bodyInKeys(a, u.rangeKeys);
    if (inside && !a.findBuff(key)) b.addBuff(a, { key, source: u });
    else if (!inside) b.removeBuff(a, key);
  }
}

function beginSecond(b, u) {
  const seq = u.deploySeq, activation = u.skill.activations;
  const duration = model(u).durations.Skill_2_Begin;
  u.mem.regularFormVisual = { clip: 'Skill_2_Begin', loop: false };
  b.addBuff(u, { key: 'chilchuck:begin', duration, flags: { disarm: true } });
  b.after(duration, () => {
    if (live(u) && u.deploySeq === seq && second(u) && u.skill.activations === activation)
      u.mem.regularFormVisual = { clip: 'Skill_2_Idle', loop: true };
  }, { owner: u });
}

function endSecond(b, u, reason) {
  b.removeBuff(u, 'chilchuck:begin');
  if (!live(u) || ['death', 'retreat'].includes(reason)) { u.mem.regularFormVisual = null; return; }
  const seq = u.deploySeq, duration = model(u).durations.Skill_2_End;
  u.mem.regularFormVisual = { clip: 'Skill_2_End', loop: false };
  b.addBuff(u, { key: 'chilchuck:end', duration, flags: { disarm: true } });
  b.after(duration, () => {
    if (u.deploySeq === seq && !u.skill.active) u.mem.regularFormVisual = null;
  }, { owner: u });
}

function launch(b, u, p, target, info) {
  if (!canTargetEnemy(u, target, p)) return;
  // Normal native Combat is a direct melee ability. Selected S2 has no Combat
  // ability and remains a ranged projectile even against the unit it blocks.
  const melee = !p.chilcSecond && target.blockedBy === u;
  const hit = { ...p, attack: melee ? 'melee' : 'ranged', applyWay: melee ? 'melee' : 'ranged' };
  const impact = (e, x, y) => {
    if (e && canTargetEnemy(u, e, p)) resolveHit(b, u, hit, e, info, x, y);
  };
  if (melee) impact(target, target.x, target.y);
  else b.addProjectile({ from: u, target, source: u, speed: 10, maxAge: 10,
    visual: 'arrow', data: { arkpediaTrackedVisual: true },
    onHit: ({ target: e, x, y }) => impact(e, x, y) });
}

export function customizeChilchuckKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  kit.trait = { install: null, attack: 'ranged', projectile: 'none', dmgType: 'phys',
    canHitFly: true, hits: 1, hitsFn: null, maxTargets: 1, hitAllBlocked: false,
    maxTargetsByBlock: false, allInRange: false, rangeAoe: false, splashRadius: 0,
    chain: null, dmgMul: null, launchAttack: launch, retargetOnRelease: false,
    interruptOnSkillChange: true,
    windup: (_b, unit, targets) => {
      const c = clip(unit, targets); unit.mem.chilcClip = c;
      return model(unit).hits[c][0] / (second(unit) ? Math.min(1, unit.s.aspd / 100) : unit.s.aspd / 100);
    }, attackVisual: (_b, unit) => unit.mem.chilcClip };
  const s = def.skill;
  if (s.id === 'skchr_chilc_1') kit.skill = { kind: 'duration', duration: s.duration, trigger: 'SP_FULL',
    flags: { disarm: true }, onStart: () => {
      u.mem.chilcCost = chilchuckCost(s.bb, b.rng);
      u.mem.regularFormVisual = { clip: 'Skill_1', loop: false };
    }, onEnd: ({ reason }) => {
      // Original runActionOnEvent4 and recursive late-enable phase are not
      // executable here. Primary selected duration/end description explicitly
      // binds the completed grant; native clip event2 remains separate evidence.
      if (reason === 'duration' && live(u)) b.addDp(u.ownerId, u.mem.chilcCost);
      u.mem.chilcCost = null; u.mem.regularFormVisual = null;
    } };
  else kit.skill = { kind: 'duration', duration: s.duration,
    mods: { aspd: s.bb.attack_speed, dodgePhys: s.bb.prob }, attack: { chilcSecond: true },
    onStart: () => beginSecond(b, u), onEnd: ({ reason }) => endSecond(b, u, reason) };
  kit.skill.id = s.id; kit.skill.name = s.name;
}

export function installChilchuck({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  u.mem.chilcExpiresAt = null; u.mem.chilcCost = null;
  b.on('deploy', ({ unit }) => {
    if (unit === u) {
      const t = def.talents.find(t => t.bb.immune_duration != null)?.bb;
      u.mem.chilcExpiresAt = t ? b.time + t.immune_duration : null;
    }
    syncAura(b, u);
  }, { owner: u });
  for (const event of ['tick', 'death']) b.on(event, () => syncAura(b, u), { owner: u });
  for (const event of ['hit', 'elementHit']) b.on(event, ({ target, dmg }) => {
    // Exact named source flags only; sourceless/periodic/elemental classification
    // does not substitute for IS_ENVIRONMENT_DAMAGE or its element counterpart.
    syncAura(b, u);
    if (target.findBuff(`chilchuck:environment:${u.id}`)
      && (dmg.isEnvironment || dmg.isEnvironmentElement)) dmg.cancel = true;
  }, { owner: u });
  b.on('damaged', ({ source, dmg, type }) => {
    // Native ON_OUTPUT_DAMAGE has no IsAttack or type filter. This accepted HP
    // output bridge includes absorbed0 and each victim independently; gauge fill
    // and modifier-bypassing HPLOSS are not HP damage output. Native cancellation,
    // skipSourceEvent and active-at-impact phase remain explicit limitations.
    if (source === u && live(u) && second(u) && type !== 'element' && !dmg?.tags?.includes('hpLoss'))
      b.addDp(u.ownerId, def.skill.bb.cost);
  }, { owner: u });
}
