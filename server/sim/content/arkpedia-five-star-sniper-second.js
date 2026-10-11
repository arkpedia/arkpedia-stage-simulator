// SPDX-License-Identifier: GPL-3.0-or-later
import { FIVE_STAR_SNIPER_SECOND_OPERATORS } from '../../../shared/arkpedia/five-star-sniper-second-operators.js';
import evidence from '../../../data/arkpedia-five-star-sniper-second-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { canTargetEnemy, canTargetAlly } from '../targeting.js';

const GREY = 'char_367_swllow', APRIL = 'char_365_aprl', KROOS = 'char_1021_kroos2';
const INSIDE = 'char_498_inside', SESA = 'char_379_sesa';
const live = u => u?.alive && u.deployed;
const model = (id, u = null) => evidence.models[id][['UP', 'LEFT'].includes(u?.dir) ? 'Back' : 'Front'];
const animationRate = (u, cap = Infinity) => Math.min(cap, u.s.aspd / 100);
const clip = u => {
  if (u.def.charId === GREY) return u.skill.active ? (u.skill.id.endsWith('_1') ? 'Skill_Loop' : 'Skill_2_Loop') : 'Attack_Loop';
  if (u.def.charId === KROOS) return u.skill.active ? (u.mem.kroosWarmed ? 'Skill_Loop_2' : 'Skill_Loop') : 'Attack';
  if (u.def.charId === INSIDE) return u.skill.active ? (u.skill.id.endsWith('_1') ? 'Skill_1_Loop' : 'Skill_2_Loop') : 'Attack_Loop';
  return u.def.charId === SESA && u.skill.active && u.skill.id.endsWith('_2') ? 'Skill' : 'Attack';
};
const cap = u => u.def.charId === SESA || u.def.charId === GREY && u.skill.active && u.skill.id.endsWith('_2') ? 1 : Infinity;
function windup(_b, u) {
  let time = model(u.def.charId, u).hits[clip(u)][0];
  if ((u.def.charId === GREY || u.def.charId === INSIDE) && !u.skill.active && !u.mem.sniperOpened)
    time += model(u.def.charId, u).durations.Attack_Begin;
  return time / animationRate(u, cap(u));
}
const plain = p => ({ ...p, hits: 1, hitsFn: null, splashRadius: 0, dmgMul: null });
function fly(b, u, target, p, info, speed) {
  return b.addProjectile({ from: u, target, speed, source: u, visual: p.projectile || 'arrow',
    data: { arkpediaTrackedVisual: true }, onHit: ({ target, x, y }) => {
      if (target && canTargetEnemy(u, target, { ...p, canTarget: null })) resolveHit(b, u, plain(p), target, info, x, y);
    } });
}
function burst(b, u, p, target, info) {
  u.mem.sniperOpened = true;
  const name = clip(u), events = model(u.def.charId, u).hits[name];
  const rate = animationRate(u, cap(u)), seq = u.deploySeq, activation = u.skill.activations;
  const epoch = u.mem.kroosWarmed;
  const control = u.attackControlEpoch;
  const speed = u.def.charId === KROOS ? 18 : 15;
  fly(b, u, target, p, info, speed);
  const valid = () => live(u) && u.deploySeq === seq && u.canAct && !u.s.flags.disarm
    && u.attackControlEpoch === control
    && u.skill.activations === activation && u.mem.kroosWarmed === epoch
    && (!p.isSkill || !u.skill.isTimed || u.skill.active);
  let cancelled = false;
  // Interruptions invalidate all still-unfired rounds; launched projectiles persist.
  const monitor = events.length > 1 ? b.every(b.dt, () => { if (!valid()) cancelled = true; }, { owner: u }) : null;
  for (let n = 1; n < events.length; n++) b.after((events[n] - events[0]) / rate, () => {
    if (!cancelled && valid() && target.alive) fly(b, u, target, p, info, speed);
    if (n === events.length - 1) monitor?.cancel();
  }, { owner: u });
}
function begin(b, u, name) {
  const duration = model(u.def.charId, u).durations[name];
  if (!(duration > 0)) return;
  const seq = u.deploySeq, activation = u.skill.activations;
  u.mem.regularFormVisual = { clip: name, loop: false };
  b.addBuff(u, { key: 'sniper:entrance', duration, flags: { disarm: true } });
  b.after(duration, () => {
    if (live(u) && u.deploySeq === seq && u.skill.active && u.skill.activations === activation)
      u.mem.regularFormVisual = null;
  }, { owner: u });
}
function ending(b, u, name) {
  b.removeBuff(u, 'sniper:entrance');
  if (!live(u)) return;
  const duration = model(u.def.charId, u).durations[name];
  const seq = u.deploySeq;
  u.mem.regularFormVisual = { clip: name, loop: false };
  b.addBuff(u, { key: 'sniper:ending', duration, flags: { disarm: true, noSp: true } });
  b.after(duration, () => {
    if (live(u) && u.deploySeq === seq && !u.skill.active) u.mem.regularFormVisual = null;
  }, { owner: u });
}
function insideLaunch(b, u, p, target, info) {
  u.mem.sniperOpened = true;
  const projectile = fly(b, u, target, p, info, 10);
  if (!p.isSkill) return;
  u.mem.insideProjectiles.push(projectile);
}
function insideConsume(ctx) {
  const { battle: b, unit: u, skill, noAmmo } = ctx;
  // Native count-event4 is modelled once per released attack, not per victim.
  // Retain the final round's modifiers through its launched projectile lifecycle.
  ctx.noAmmo = true;
  if (noAmmo || !skill.active) return;
  skill.ammoLeft = Math.max(0, skill.ammoLeft - 1);
  if (skill.ammoLeft > 0) return;
  const seq = u.deploySeq, activation = skill.activations;
  const until = b.time + (model(INSIDE, u).durations[clip(u)] - model(INSIDE, u).hits[clip(u)][0]) / animationRate(u);
  b.addBuff(u, { key: 'insider:last-round', flags: { disarm: true } });
  const timer = b.every(b.dt, () => {
    if (!live(u) || u.deploySeq !== seq || !skill.active || skill.activations !== activation) { timer.cancel(); return; }
    u.mem.insideProjectiles = u.mem.insideProjectiles.filter(p => b.projectiles.list.includes(p));
    if (b.time + 1e-9 >= until && !u.mem.insideProjectiles.length) { timer.cancel(); skill.end('ammo'); }
  }, { owner: u });
}
function sesaLaunch(b, u, p, target, info) {
  const second = p.isSkill && u.skill.id.endsWith('_2');
  const point = { x: target.x, y: target.y };
  const impact = (x, y) => {
    const hit = { ...plain(p), canHitFly: true, ignoreStealth: true };
    for (const e of b.enemiesInRadius(x, y, 1)) if (canTargetEnemy(u, e, hit)) {
      if (second) b.applyStrongest(e, 'sesa:aspd', { source: u, duration: u.skill.bb['attack@duration'],
        value: u.skill.bb['attack@attack_speed'], mods: value => ({ aspd: value }) });
      resolveHit(b, u, hit, e, info, e.x, e.y);
    }
  };
  return b.addProjectile({ from: u, ...(second ? { to: point } : { target }), speed: 8,
    source: u, visual: 'arrow', hitDead: true, data: { arkpediaTrackedVisual: true },
    onHit: ({ x, y }) => {
      if (second) b.after(2, () => impact(x, y)); else impact(x, y);
    } });
}
export function customizeFiveStarSniperSecondKit({ id, def, kit }) {
  if (!FIVE_STAR_SNIPER_SECOND_OPERATORS[id]) return;
  const s = def.skill, bb = s.bb;
  kit.install = null;
  kit.trait = { attack: 'ranged', dmgType: 'phys', projectile: 'arrow', canHitFly: true,
    priority: 'fly', hits: 1, hitsFn: null, maxTargets: 1, allInRange: false,
    splashRadius: 0, dmgMul: null, chain: null, install: null,
    windup, attackVisual: (_b, u) => clip(u), interruptOnSkillChange: true };
  if (id === GREY) {
    kit.trait.launchAttack = burst;
    kit.skill = s.id.endsWith('_1') ? { kind: 'instant', attack: { atkScale: bb.atk_scale } }
      : { kind: 'duration', mods: { atkPct: bb.atk }, onStart: ({ battle, unit }) => begin(battle, unit, 'Skill_2_Begin'),
        onEnd: ({ battle, unit }) => ending(battle, unit, 'Skill_2_End') };
  } else if (id === APRIL) {
    kit.trait.projectileSpeed = 10;
    kit.skill = s.id.endsWith('_1') ? { kind: 'instant', attack: { atkScale: bb.atk_scale } }
      : { kind: 'duration', duration: s.duration, spType: 'none', activateOnDeploy: true,
        trigger: 'NEVER', mods: { atkPct: bb.atk }, flags: { camou: true } };
  } else if (id === KROOS) {
    kit.trait.launchAttack = burst;
    kit.trait.attackEpoch = (_b, u) => u.mem.kroosWarmed;
    kit.skill = { kind: 'duration', mods: s.id.endsWith('_1') ? { atkPct: bb.atk } : { batFlat: bb.base_attack_time },
      ...(s.id.endsWith('_1') ? { flags: { camou: true } } : {}),
      onStart: ({ battle, unit }) => { unit.mem.kroosHits = 0; unit.mem.kroosWarmed = false; begin(battle, unit, 'Skill_Begin'); },
      onEnd: ({ battle, unit }) => { unit.mem.kroosHits = 0; unit.mem.kroosWarmed = false; ending(battle, unit, 'Skill_End'); } };
  } else if (id === INSIDE) {
    Object.assign(kit.trait, { priority: 'first', launchAttack: insideLaunch });
    const second = s.id.endsWith('_2'), n = second ? 2 : 1;
    kit.skill = { kind: 'ammo', ammo: bb['attack@trigger_time'], duration: 0, manualCancel: true,
      mods: second ? { atkPct: bb.atk, batPct: bb.base_attack_time, taunt: -1 } : null,
      attack: second ? {} : { atkScale: bb['attack@atk_scale'] },
      ...(second ? { targeting: { priority: 'ranged' } } : {}),
      onStart: ({ battle, unit }) => { unit.mem.insideProjectiles = []; begin(battle, unit, `Skill_${n}_Begin`); },
      onAttack: insideConsume,
      onEnd: ({ battle, unit }) => { battle.removeBuff(unit, 'insider:last-round'); ending(battle, unit, `Skill_${n}_End`); } };
  } else {
    Object.assign(kit.trait, { priority: 'first', launchAttack: sesaLaunch });
    kit.skill = s.id.endsWith('_1') || s.id.startsWith('skcom') ? { kind: 'duration', mods: { atkPct: bb.atk } }
      : { kind: 'duration', attack: { atkScale: bb['attack@atk_scale'] } };
  }
}
function capacity(b, u, key, amount, source = null) {
  const skill = u.skill;
  if (!skill || skill.kind !== 'ammo' || !(amount > 0)) return;
  skill.ammo += amount;
  const restore = () => {
    skill.ammo = Math.max(0, skill.ammo - amount);
    if (skill.active) skill.ammoMax = Math.max(skill.ammoLeft, skill.ammo);
  };
  b.addBuff(u, { key, source, onRemove: restore, onExpire: restore });
  // modifyMaxCount true, recoverEventCount false: do not top up a current cast.
  if (skill.active) skill.ammoMax += amount;
}
export function installFiveStarSniperSecond({ battle: b, unit: u, def }) {
  if (!FIVE_STAR_SNIPER_SECOND_OPERATORS[def.charId]) return;
  const talent = def.talents[0]?.bb;
  if (def.charId === GREY || def.charId === KROOS) {
    b.on('hit', ({ source, target, dmg }) => {
      if (source !== u || !dmg.isAttack || target.side !== 'enemy') return;
      if (talent && b.rng.chance(talent.prob)) {
        dmg.amount *= talent.atk_scale;
        if (def.charId === KROOS) b.applyStatus(target, 'stun', { source: u, duration: talent.stun });
      }
      if (def.charId === KROOS && u.skill.active && u.skill.id.endsWith('_2') && !u.mem.kroosWarmed) {
        u.mem.kroosHits = (u.mem.kroosHits ?? 0) + 1;
        if (u.mem.kroosHits >= u.skill.bb['attack@max_stack_count']) u.mem.kroosWarmed = true;
      }
    }, { owner: u });
  } else if (def.charId === INSIDE && talent) {
    b.after(talent.duration, () => {
      if (!live(u)) return;
      capacity(b, u, 'insider:self-capacity', talent.self_ammo, u);
      if (!talent.ally_ammo) return;
      const key = `insider:ally-capacity:${u.id}`;
      let recipient = null;
      const eligible = a => live(u) && a !== u && live(a) && a.tags.has('laterano')
        && a.skill?.kind === 'ammo' && b.allySelectable(a, u) && canTargetAlly(u, a, false);
      const sync = () => {
        if (recipient && !eligible(recipient)) { b.removeBuff(recipient, key); recipient = null; }
        if (!live(u) || recipient) return;
        // Infinite AddAmmoWrapper keeps a maxNum1 recipient while eligible.
        // Native tie selection is still pending; no repeated per-tick lottery.
        recipient = b.rng.pick(b.allies().filter(eligible));
        if (recipient) capacity(b, recipient, key, talent.ally_ammo, u);
      };
      b.on('tick', sync, { owner: u });
      b.on('death', ({ unit }) => { if (unit === u) sync(); }, { owner: u });
      sync();
    }, { owner: u });
  } else if (def.charId === SESA && talent) {
    const key = `sesa:blocked:${u.id}`;
    const syncEnemy = e => {
      if (!live(u) || !live(e) || !e.blockedBy) b.removeBuff(e, key);
      else if (!e.findBuff(key)) b.applyStatus(e, 'physFragile', { key, source: u,
        duration: Infinity, value: talent.damage_scale - 1 });
    };
    const sync = () => { for (const e of b.enemies) syncEnemy(e); };
    // Native CheckBlocked executes on incoming damage. Movement/block changes
    // earlier in the same frame must be visible before mitigation reads stats.
    b.on('hit', ({ target }) => { if (target?.side === 'enemy') syncEnemy(target); }, { owner: u });
    b.on('tick', sync, { owner: u });
    b.on('death', ({ unit }) => { if (unit === u) for (const e of b.enemies) b.removeBuff(e, key); }, { owner: u });
    sync();
  }
}
