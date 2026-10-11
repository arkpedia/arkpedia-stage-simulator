// SPDX-License-Identifier: GPL-3.0-or-later
// Native prefabs/ranks/facing bytes: arkpedia-hoolheyak-prefabs.json.
// The compiled mover and original particles are not reproduced; see evidence limits.
import evidence from '../../../data/arkpedia-hoolheyak-prefabs.json' with { type: 'json' };
import { canTargetEnemy } from '../targeting.js';
import { bodyDist, hitRect } from '../body.js';
import { DIR_VEC } from '../dir.js';
const ID = 'char_4027_heyak', air = { canHitFly: true };
const live = u => u?.alive && u.deployed && !u.hidden;
const n = u => Number(u.skill.id.at(-1));
const is = (u, i) => n(u) === i && u.skill.active;
const model = u => evidence.models[ID][u.dir === 'UP' && !is(u, 2) ? 'Back' : 'Front'];
const rate = (u, capped = true) => Math.min(capped ? 1.2000000476837158 : Infinity, u.s.aspd / 100);
const shots = (b, u) => b.enemiesInKeys(u.rangeKeys, u, air);
function hit(b, u, e, scale, levitate, info, tag) {
  if (!canTargetEnemy(u, e, air)) return;
  // Active hit buffs precede passive ON_CALCULATE_DAMAGE and aerial silence.
  if (levitate) b.applyStatus(e, 'levitate', { duration: levitate, source: u });
  const t = live(u) && u.def.talents.find(t => t.bb.silence != null)?.bb;
  if (t && e.isFlying) scale *= t.atk_scale;
  b.dealDamage(u, e, { amount: u.s.atk * u.s.atkScaleMul * scale, type: 'arts',
    applyWay: 'ranged', isAttack: true, isProjectile: true, ...info, tags: [tag] });
}
function bolt(b, u, e, speed, onHit, delay = 0) {
  // Emitted bolts survive owner/skill cleanup; delay belongs to the projectile.
  const from = { x: u.x, y: u.y };
  const emit = () => b.addProjectile({ from, target: e, source: u, speed, maxAge: 10,
    visual: 'bolt', data: { arkpediaTrackedVisual: true }, onHit: ({ target }) => {
      if (target) onHit(target);
    } });
  if (delay) b.after(delay, emit); else emit();
}
function volley(b, u, info) {
  const activation = u.skill.activations, seq = u.deploySeq, control = u.attackControlEpoch;
  const bb = { ...u.skill.bb }, spacing = .05000000074505806 / rate(u, false);
  const release = () => {
    if (!live(u) || !is(u, 2) || activation !== u.skill.activations || seq !== u.deploySeq
      || !u.canAct || u.s.flags.disarm || control !== u.attackControlEpoch) return;
    const pool = shots(b, u); if (!pool.length) return;
    const e = pool[Math.min(pool.length - 1, Math.floor(b.rng() * pool.length))];
    bolt(b, u, e, 11, target => hit(b, u, target, bb['attack@atk_scale'],
      b.rng() < bb['attack@prob'] ? bb['attack@levitate'] : 0, info, 'heyak:s2'), .05000000074505806);
  };
  release(); for (let i = 1; i < 9; i++) b.after(i * spacing, release, { owner: u });
}
function launch(b, u, profile, e, info) {
  if (is(u, 2)) { volley(b, u, info); return; }
  if (!canTargetEnemy(u, e, air)) return;
  const enhanced = info.isSkill && n(u) === 1;
  // Shared per-attack count measures emitted projectiles, not surviving targets
  // at impact. An invalid second input cannot leave a stale two-target mark.
  let plan = u.mem.heyakPlan;
  if (!plan || plan.attackId !== info.attackId) u.mem.heyakPlan = plan = { attackId: info.attackId, count: 0 };
  plan.count++;
  const scale = enhanced ? u.skill.bb.atk_scale : 1, lift = enhanced ? u.skill.bb.levitate : 0;
  bolt(b, u, e, 12, target => hit(b, u, target, scale, plan.count === 1 ? lift : 0,
    info, enhanced ? 'heyak:s1' : 'heyak:normal'));
}
function overlaps(e, p) {
  const r = hitRect(e);
  return r ? r.x1 >= p.x - .5 && r.x0 <= p.x + .5 && r.y1 >= p.y - .5 && r.y0 <= p.y + .5
    : Math.abs(e.x - p.x) <= .5 && Math.abs(e.y - p.y) <= .5;
}
function whirlwind(b, u, origin, dx, dy, bb, info) {
  b.addProjectile({ from: origin, to: { x: origin.x + dx * 6, y: origin.y + dy * 6 },
    source: u, speed: 1, maxAge: 4, expireInPlace: true, visual: 'orb',
    data: { arkpediaTrackedVisual: true, heyakWind: true, consumed: false, query: 0 },
    onMove: ({ projectile: p }) => {
      if (p.data.consumed) return;
      p.data.query -= b.dt; if (p.data.query > 1e-9) return;
      p.data.query += .029999999329447746;
      const pool = b.enemies.filter(e => canTargetEnemy(u, e, air) && overlaps(e, p));
      pool.sort((a, z) => bodyDist(a, p.x, p.y) - bodyDist(z, p.x, p.y));
      const e = pool[0]; if (!e) return;
      p.data.consumed = true;
      const progress = Math.min(1, p.age / (4 * .44280850887298584));
      const scale = bb['attack@min_atk_scale'] + progress * (bb['attack@max_atk_scale'] - bb['attack@min_atk_scale']);
      hit(b, u, e, scale, bb['attack@levitate'], info, 'heyak:s3');
      p.maxAge = Math.min(p.maxAge, p.age + .12999999523162842);
    } });
}
function windAttack(b, u) {
  const state = {}, activation = u.skill.activations, seq = u.deploySeq, control = u.attackControlEpoch;
  u.mem.heyakAttack = state; u.mem.heyakCd = u.s.interval;
  u.mem.regularFormVisual = { clip: 'Skill_3_Loop', loop: false, speed: rate(u) };
  u.lastAttackAt = b.time; u.stats.attacks++;
  const info = { isSkill: true, attackId: ++b._attackSeq };
  b._ev(['atk', u.id, u.id, 'tracked', { animation: 'Skill_3_Loop', windup: .5 / rate(u), projectile: 'tracked' }]);
  const valid = () => live(u) && is(u, 3) && seq === u.deploySeq && activation === u.skill.activations
    && u.canAct && !u.s.flags.disarm && control === u.attackControlEpoch && u.mem.heyakAttack === state;
  b.after(.5 / rate(u), () => {
    if (!valid()) return;
    const [dy, dx] = DIR_VEC[u.dir], bb = { ...u.skill.bb }, from = { x: u.x, y: u.y };
    for (const lane of [-1, 0, 1]) {
      const origin = { x: from.x - dy * lane, y: from.y + dx * lane };
      // All three have been emitted. Their independent birth delays persist
      // through a later retreat, unlike the not-yet-released windup.
      b.after(b.rng() * .30000001192092896, () => whirlwind(b, u, origin, dx, dy, bb, info));
    }
  }, { owner: u });
  b.after(model(u).durations.Skill_3_Loop / rate(u), () => {
    if (u.mem.heyakAttack === state && is(u, 3))
      u.mem.regularFormVisual = { clip: 'Skill_3_Idle', loop: true };
  }, { owner: u });
}
function begin(b, u) {
  const state = {}, seq = u.deploySeq, k = n(u), name = `Skill_${k}_Begin`;
  u.mem.heyakBegin = state; u.mem.heyakAttack = null; u.mem.heyakCd = 0;
  u.mem.regularFormVisual = { clip: name, loop: false, forceFront: k === 2 };
  b.after(model(u).durations[name], () => {
    if (!live(u) || seq !== u.deploySeq || !u.skill.active || u.mem.heyakBegin !== state) return;
    u.mem.heyakBegin = null; u.atkCd = 0;
    u.mem.regularFormVisual = { clip: k === 2 ? 'Skill_2_Loop' : 'Skill_3_Idle', loop: true, forceFront: k === 2 };
  }, { owner: u });
}
function end(b, u) {
  u.mem.heyakBegin = null; u.mem.heyakAttack = null;
  const seq = u.deploySeq, activation = u.skill.activations, name = `Skill_${n(u)}_End`;
  if (!live(u)) { u.mem.regularFormVisual = null; return; }
  u.mem.regularFormVisual = { clip: name, loop: false, forceFront: n(u) === 2 };
  b.after(model(u).durations[name], () => {
    if (seq === u.deploySeq && activation === u.skill.activations && !u.skill.active) u.mem.regularFormVisual = null;
  }, { owner: u });
}
export function customizeHoolheyakKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  kit.trait = { install: null, attack: 'ranged', dmgType: 'arts', applyWay: 'ranged', ...air,
    maxTargets: 1, hits: 1, hitsFn: null, dmgMul: null, splashRadius: 0, chain: null,
    allInRange: false, hitAllBlocked: false, launchAttack: launch, interruptOnSkillChange: true,
    canAttack: () => !u.mem.heyakBegin, attackVisual: () => is(u, 1) ? 'Skill_1' : is(u, 2) ? 'Skill_2_Loop' : 'Attack',
    windup: () => is(u, 2) ? .5 / rate(u, false) : .4 / rate(u) };
  if (Number(def.skill.id.at(-1)) === 1) kit.skill = { kind: 'charges', charges: def.skill.bb.cnt,
    attack: { maxTargets: 2 }, onEnd: () => { u.mem.heyakPlan = null; } };
  else kit.skill = { kind: 'duration', duration: def.skill.duration,
    ...(Number(def.skill.id.at(-1)) === 3 ? { mods: { batFlat: def.skill.bb.base_attack_time },
      targeting: { rangeGrid: def.skill.rangeGrid }, attack: { noAttack: true } } : { attack: { maxTargets: 1 } }),
    onStart: () => begin(b, u), onEnd: () => end(b, u) };
}
export function installHoolheyak({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  const threshold = def.talents.find(t => t.bb.hp_ratio != null)?.bb.hp_ratio;
  const aerial = def.talents.find(t => t.bb.silence != null)?.bb;
  // The DB silence is damage-missable: a dodged/failed attack cannot silence.
  // Successful zero-HP-loss shield receipts still do, unlike a >0 damage check.
  if (aerial) b.on('damaged', ({ source, target, dmg }) => {
    if (source === u && live(u) && target.isFlying && dmg?.tags.some(t => t.startsWith('heyak:')))
      b.applyStatus(target, 'silence', { duration: aerial.silence, source: u });
  }, { owner: u });
  const aura = new Map(), key = `heyak:weightless:${u.id}`;
  function clean() { for (const e of aura.keys()) b.removeBuff(e, key); aura.clear(); }
  b.on('tick', ({ dt }) => {
    if (!live(u)) { clean(); return; }
    if (threshold != null) {
      const pool = new Set(shots(b, u));
      for (const e of aura.keys()) if (!pool.has(e)) { b.removeBuff(e, key); aura.delete(e); }
      for (const e of pool) {
        const cd = (aura.get(e) ?? 0) - dt;
        if (cd <= 1e-9) {
          // Native GT and the CN wording both specify strictly above 80%.
          if (e.hpRatio > threshold) b.applyStatus(e, 'weightless', { key, source: u, duration: Infinity });
          else b.removeBuff(e, key);
          aura.set(e, cd + .4000000059604645);
        } else aura.set(e, cd);
      }
    }
    if (!is(u, 3) || u.mem.heyakBegin || !u.canAct || u.s.flags.disarm) return;
    u.mem.heyakCd = Math.max(0, (u.mem.heyakCd ?? 0) - dt);
    if (u.mem.heyakCd <= 1e-9) windAttack(b, u);
  }, { owner: u });
  b.on('deploy', ({ unit }) => { if (unit === u) {
    clean(); u.mem.heyakBegin = null; u.mem.heyakAttack = null; u.mem.heyakPlan = null;
    u.mem.regularFormVisual = null; u.mem.heyakCd = 0;
  } }, { owner: u });
  b.on('death', ({ unit }) => { if (unit === u) { clean(); u.mem.heyakAttack = null;
    u.mem.heyakBegin = null; u.mem.regularFormVisual = null; } }, { owner: u });
}
