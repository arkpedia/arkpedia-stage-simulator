// SPDX-License-Identifier: GPL-3.0-or-later
// Original components, ranks and exact delivered facings: arkpedia-goldenglow-prefabs.json.
import evidence from '../../../data/arkpedia-goldenglow-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { ROWS, COLS } from '../constants.js';
const ID = 'char_377_gdglow';
const live = u => u?.alive && u.deployed && !u.hidden;
const number = u => Number(u.skill.id.at(-1));
const active = u => u.skill.active;
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => u.s.aspd / 100; // original maxAnimScale=-1
const air = { canHitFly: true };
const newSlot = () => ({ targetId: null, scale: 0, stack: 1, lock: null, cooldown: 0 });
const clip = u => !active(u) ? 'Attack' : number(u) === 2 ? 'Skill2_Loop' : 'Skill_Attack';
function ramp(u, slot, target) {
  const bb = u.def.traitBb;
  if (slot.targetId !== target.id) { slot.targetId = target.id; slot.scale = bb.init_atk_scale; }
  else slot.scale = Math.min(bb.max_atk_scale, slot.scale + bb.delta_atk_scale);
  return slot.scale;
}
function choices(b, u) {
  const es = number(u) === 3 && active(u)
    ? b.enemies.filter(e => canTargetEnemy(u, e, air)) : b.enemiesInKeys(u.rangeKeys, u, air);
  sortEnemyTargets(b, u, es); return es;
}
function projectile(b, u, e, p, info) {
  b.addProjectile({ from: u, target: e, source: u, speed: 10, maxAge: 10,
    visual: p.projectile, data: { arkpediaTrackedVisual: true },
    onHit: ({ target }) => { if (target && canTargetEnemy(u, target, air))
      resolveHit(b, u, p, target, info, target.x, target.y); } });
}
function clearLocks(u) {
  for (const slot of u.mem.gdglowSlots ?? []) { slot.lock = null; slot.cooldown = 0; }
}
function explode(b, u, slot, target, talent) {
  const point = { x: target.x, y: target.y }, scale = talent['attack@atk_scale_2'];
  const slow = number(u) === 3 ? u.skill.bb['attack@sluggish'] : 0;
  slot.stack = 1; slot.targetId = null; slot.scale = 0; slot.lock = null;
  // One damaging AoE, not four copies: the four referenced projectiles cycle
  // cosmetic mounts. The native .32s stop-time collider is independent of ASPD.
  b.addProjectile({ from: point, to: point, source: u, flightTime: .3199999928474426,
    maxAge: 10, visual: 'orb', data: { arkpediaTrackedVisual: true }, onHit: () => {
      for (const e of b.enemiesInRadius(point.x, point.y, 1.100000023841858)) {
        if (!canTargetEnemy(u, e, air)) continue;
        b.dealDamage(u, e, { amount: u.s.atk * u.s.atkScaleMul * scale, type: 'arts',
          isSkill: true, isAttack: true, applyWay: 'none', tags: ['gdglow:explosion'] });
        if (slow && live(e)) b.applyStatus(e, 'sluggish', { duration: slow, source: u });
      }
    } });
}
function droneHit(b, u, slot) {
  const target = slot.lock, talent = u.def.talents.find(t => t.bb['attack@prob'] != null)?.bb;
  if (talent && (slot.stack >= talent['attack@max_stack_cnt'] || b.rng() < slot.stack * talent['attack@prob'])) {
    explode(b, u, slot, target, talent); return;
  }
  if (talent) slot.stack++;
  const scale = ramp(u, slot, target);
  b._ev(['atk', u.id, target.id, 'drone']);
  // The native released Funnel is a persistent projectile whose AdvancedApplyDamage
  // reads live ATK. It continues through disarm and beyond the owner's range.
  b.dealDamage(u, target, { amount: u.s.atk * u.s.atkScaleMul * scale, type: 'arts',
    isSkill: true, isAttack: true, applyWay: 'none', tags: ['gdglow:released-drone'] });
  if (number(u) === 3 && live(target))
    b.applyStatus(target, 'sluggish', { duration: u.skill.bb['attack@sluggish'], source: u });
}
function release(b, u) {
  const target = choices(b, u)[0];
  if (!target) return;
  const count = 1 + u.skill.bb['attack@cnt'];
  for (const slot of u.mem.gdglowSlots.slice(0, count)) if (!slot.lock) {
    slot.lock = target; slot.cooldown = .6000000238418579 / rate(u);
  }
}
function launch(b, u, profile, target, info) {
  const p = { ...profile, hits: 1, hitsFn: null, splashRadius: 0, chain: null, dmgMul: null };
  projectile(b, u, target, { ...p, projectile: 'bolt', tags: ['gdglow:caster'] }, info);
  if (!active(u)) projectile(b, u, target, { ...p, projectile: 'drone',
    atkScale: ramp(u, u.mem.gdglowSlots[0], target), tags: ['gdglow:normal-drone'] }, info);
  else release(b, u);
}
function begin(b, u) {
  clearLocks(u); const state = {}, seq = u.deploySeq;
  u.mem.gdglowAcquireCd = 0;
  u.mem.gdglowBegin = state;
  const name = number(u) === 3 ? 'Skill3_Start' : number(u) === 2 ? 'Skill2_Start' : 'Skill_Start';
  const duration = model(u).durations[name] ?? 0;
  u.mem.regularFormVisual = duration ? { clip: name, loop: false } : { clip: 'Idle', loop: true };
  b.after(duration, () => {
    if (!live(u) || u.deploySeq !== seq || !active(u) || u.mem.gdglowBegin !== state) return;
    u.mem.gdglowBegin = null; u.atkCd = 0;
    const idle = number(u) === 3 ? 'Skill3_Loop' : number(u) === 2 ? 'Skill2_Idle' : 'Skill_Idle';
    // Original Back omits all S3 clips. Keep its delivered Idle, never invent a clip.
    u.mem.regularFormVisual = { clip: model(u).durations[idle] ? idle : 'Idle', loop: true };
  }, { owner: u });
}
function end(b, u) {
  clearLocks(u); u.mem.gdglowBegin = null; u.mem.regularFormVisual = null;
  if (live(u) && number(u) === 3 && model(u).durations.Skill3_End) {
    const seq = u.deploySeq, activation = u.skill.activations;
    u.mem.regularFormVisual = { clip: 'Skill3_End', loop: false };
    b.after(model(u).durations.Skill3_End, () => {
      if (u.deploySeq === seq && u.skill.activations === activation && !active(u)) u.mem.regularFormVisual = null;
    }, { owner: u });
  }
}
export function customizeGoldenglowKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  kit.trait = { install: null, attack: 'ranged', dmgType: 'arts', applyWay: 'ranged',
    ...air, maxTargets: 1, hits: 1, hitsFn: null, dmgMul: null, splashRadius: 0,
    chain: null, allInRange: false, hitAllBlocked: false, launchAttack: launch,
    canAttack: () => !u.mem.gdglowBegin, interruptOnSkillChange: true,
    attackVisual: () => clip(u), windup: () => model(u).hits[clip(u)][0] / rate(u) };
  const n = Number(def.skill.id.at(-1)), bb = def.skill.bb;
  const globalGrid = [];
  if (n === 3) for (let r = -Math.max(ROWS, COLS); r <= Math.max(ROWS, COLS); r++)
    for (let c = -Math.max(ROWS, COLS); c <= Math.max(ROWS, COLS); c++) globalGrid.push([r, c]);
  kit.skill = { kind: n === 2 ? 'toggle' : 'duration', duration: def.skill.duration,
    ...(n === 2 ? { trigger: 'SP_FULL' } : {}), mods: { atkPct: bb.atk, aspd: bb.attack_speed ?? 0 },
    ...(n === 2 || n === 3 ? { targeting: { rangeGrid: n === 3 ? globalGrid : def.skill.rangeGrid } } : {}),
    ...(n === 3 ? { attack: { noAttack: true } } : {}),
    onStart: () => begin(b, u), onEnd: () => end(b, u) };
}
export function installGoldenglow({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  u.mem.gdglowSlots = Array.from({ length: 3 }, newSlot);
  const res = def.talents.find(t => t.bb.magic_resist_penetrate_fixed != null)?.bb;
  if (res) b.addBuff(u, { key: 'gdglow:res-ignore', persist: true, allowDead: true,
    mods: { resIgnoreFlat: res.magic_resist_penetrate_fixed } });
  b.on('deploy', ({ unit }) => { if (unit === u) {
    u.mem.gdglowSlots = Array.from({ length: 3 }, newSlot); u.mem.gdglowAcquireCd = 0;
    u.mem.gdglowBegin = null; u.mem.regularFormVisual = null;
  } }, { owner: u });
  b.on('tick', ({ dt }) => {
    if (!live(u) || !active(u)) return;
    if (number(u) === 3 && !u.mem.gdglowBegin && u.canAct && !u.s.flags.disarm) {
      u.mem.gdglowAcquireCd = Math.max(0, u.mem.gdglowAcquireCd - dt);
      if (!u.mem.gdglowAcquireCd) { release(b, u); u.mem.gdglowAcquireCd = u.s.interval; }
    }
    for (const slot of u.mem.gdglowSlots) {
      if (!slot.lock) continue;
      if (!slot.lock.alive || !slot.lock.deployed) { slot.lock = null; continue; }
      slot.cooldown = Math.max(0, slot.cooldown - dt);
      if (slot.cooldown <= 1e-9 && canTargetEnemy(u, slot.lock, air)) {
        droneHit(b, u, slot); slot.cooldown = u.s.interval;
      }
    }
  }, { owner: u });
  b.on('death', ({ unit }) => { if (unit === u) {
    clearLocks(u); u.mem.gdglowBegin = null; u.mem.regularFormVisual = null;
  } }, { owner: u });
}
