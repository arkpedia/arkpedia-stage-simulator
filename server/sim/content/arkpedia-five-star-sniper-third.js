// SPDX-License-Identifier: GPL-3.0-or-later
import { FIVE_STAR_SNIPER_THIRD_OPERATORS } from '../../../shared/arkpedia/five-star-sniper-third-operators.js';
import evidence from '../../../data/arkpedia-five-star-sniper-third-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { canTargetEnemy, sortEnemyTargets } from '../targeting.js';

const TODDI = 'char_363_toddi', LUNA = 'char_4014_lunacu', GREYY = 'char_1027_greyy2';
const live = u => u?.alive && u.deployed;
const model = u => evidence.models[u.def.charId][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const rate = u => Math.min(1, u.s.aspd / 100);
const clip = u => u.skill.active && u.skill.id.endsWith('_2')
  ? (u.def.charId === TODDI ? 'Skill_2_Loop' : u.def.charId === LUNA ? 'Skill_2_Loop' : 'Attack')
  : u.def.charId === TODDI && u.skill.active ? 'Skill_1' : 'Attack';
const plain = p => ({ ...p, hits: 1, hitsFn: null, splashRadius: 0, chain: null });
const candidates = (b, u, p) => b.enemiesInKeys(u.baseRangeKeys || u.rangeKeys, u, p);
function arc(b, u, target, p, info, speed) {
  return b.addProjectile({ from: u, target, speed, source: u, visual: 'arrow',
    data: { arkpediaTrackedVisual: true }, onHit: ({ target, x, y }) => {
      if (target && canTargetEnemy(u, target, p)) resolveHit(b, u, plain(p), target, info, x, y);
    } });
}
function form(b, u, name, key, noSp = false) {
  const duration = model(u).durations[name];
  if (!(duration > 0) || !live(u)) return;
  const seq = u.deploySeq;
  u.mem.regularFormVisual = { clip: name, loop: false };
  b.addBuff(u, { key, duration, flags: { disarm: true, ...(noSp ? { noSp: true } : {}) } });
  b.after(duration, () => { if (live(u) && u.deploySeq === seq) u.mem.regularFormVisual = null; }, { owner: u });
}
function toddiLaunch(b, u, p, target, info) {
  if (!p.isSkill || !u.skill.id.endsWith('_2')) return arc(b, u, target, p, info, 30);
  const bb = u.skill.bb, seq = target.deploySeq;
  const validTarget = () => live(target) && !target.hidden && target.deploySeq === seq;
  const primary = b.after(.22, () => {
    if (validTarget() && canTargetEnemy(u, target, p)) resolveHit(b, u, plain(p), target, info, target.x, target.y);
  });
  // These are two source subabilities; the delayed AoE follows the original
  // victim and stops on its death/disappearance rather than bursting a corpse.
  const splash = b.after(.22 + bb['attack@splash_projectile_delay_time'], () => {
    watcher.cancel();
    if (!validTarget()) return;
    const hit = { ...plain(p), atkScale: bb['attack@splash_atk_scale'], canHitFly: true };
    for (const e of b.enemiesInRadius(target.x, target.y, 1.2)) if (canTargetEnemy(u, e, hit))
      resolveHit(b, u, hit, e, { ...info, isSkill: true }, e.x, e.y);
  });
  const watcher = b.every(b.dt, () => { if (!validTarget()) { splash.cancel(); primary.cancel(); watcher.cancel(); } });
}
function wave(b, u, p, info, x, y, scale, slow) {
  const hit = { ...plain(p), atkScale: scale, groundOnly: true, canHitFly: false };
  for (const e of b.enemiesInRadius(x, y, .9)) if (canTargetEnemy(u, e, hit)) {
    // Native active-buff ON_BUFF_START executes its Dice before output damage.
    if (slow && b.rng.chance(slow.prob)) b.applyStatus(e, 'sluggish', { source: u, duration: slow.duration });
    resolveHit(b, u, hit, e, info, e.x, e.y);
  }
}
function greyyLaunch(b, u, p, target, info) {
  const t = u.def.talents[0]?.bb;
  const slow = t ? { prob: t['attack@prob'], duration: t['attack@sluggish'] } : null;
  const append = u.def.trait?.bb?.['attack@append_atk_scale'] ?? .5;
  return b.addProjectile({ from: u, target, hitDead: true, speed: 10, source: u, visual: 'arrow',
    data: { arkpediaTrackedVisual: true }, onHit: ({ x, y }) => {
      wave(b, u, p, info, x, y, p.atkScale ?? 1, slow);
      b.after(.15, () => wave(b, u, p, info, x, y, (p.atkScale ?? 1) * append, slow));
    } });
}
function greyyBall(b, u, bb, target) {
  let reached = false, finished = false, center = { x: u.x, y: u.y }, until = Infinity;
  const info = { isSkill: true, attackId: ++u.mem.greyyBallId };
  const hit = { attack: 'ranged', dmgType: 'arts', atkScale: bb.atk_scale, canHitFly: false,
    groundOnly: true, hits: 1, splashRadius: 0 };
  const pulse = () => {
    if (finished || b.time >= until - 1e-9) return;
    for (const e of b.enemiesInRadius(center.x, center.y, 1)) if (canTargetEnemy(u, e, hit)) {
      if (b.rng.chance(bb.prob)) b.applyStatus(e, 'sluggish', { source: u, duration: bb.sluggish });
      resolveHit(b, u, hit, e, info, e.x, e.y);
    }
  };
  const projectile = b.addProjectile({ from: u, target, hitDead: true, speed: 8, source: u, visual: 'arts',
    data: { arkpediaTrackedVisual: true }, onHit: ({ x, y }) => {
      center = { x, y }; reached = true; until = b.time + bb.projectile_delay_time;
      b.after(bb.projectile_delay_time, () => { finished = true; timer.cancel(); observer.cancel(); });
    } });
  const observer = b.every(b.dt, () => {
    if (!reached) {
      center = { x: projectile.x, y: projectile.y };
      if (!b.projectiles.list.includes(projectile)) { finished = true; timer.cancel(); observer.cancel(); }
    }
  });
  // waitFirstPeriod0: the source moving collider starts its period immediately.
  pulse();
  const timer = b.every(bb.interval, pulse);
}
function greyyCast(b, u, bb) {
  const p = { ...u.profile, canHitFly: false, groundOnly: true };
  const target = sortEnemyTargets(b, u, candidates(b, u, p), 'first')[0];
  if (!target) return;
  const seq = u.deploySeq, activation = u.skill.activations, length = model(u).durations.Skill / rate(u);
  const release = model(u).hits.Skill[0] / rate(u);
  const key = 'greyy:cast';
  let cancelled = false;
  u.mem.regularFormVisual = { clip: 'Skill', loop: false };
  b.addBuff(u, { key, duration: length, flags: { disarm: true, noSp: true } });
  const valid = () => live(u) && u.deploySeq === seq && u.skill.activations === activation && u.canAct;
  const monitor = b.every(b.dt, () => { if (!valid()) cancelled = true; }, { owner: u });
  b.after(release, () => { if (!cancelled && valid()) greyyBall(b, u, bb, target); }, { owner: u });
  b.after(length, () => { monitor.cancel(); if (live(u) && u.deploySeq === seq) u.mem.regularFormVisual = null; }, { owner: u });
}
function toddiConsume(ctx) {
  const { battle: b, unit: u, skill } = ctx;
  if (ctx.noAmmo) return;
  ctx.noAmmo = true;
  skill.ammoLeft = Math.max(0, skill.ammoLeft - 1);
  if (skill.ammoLeft) return;
  const seq = u.deploySeq, activation = skill.activations;
  const post = (model(u).durations.Skill_2_Loop - model(u).hits.Skill_2_Loop[0]) / rate(u);
  b.addBuff(u, { key: 'toddi:last-round', duration: post, flags: { disarm: true } });
  b.after(post, () => { if (live(u) && u.deploySeq === seq && skill.activations === activation && skill.active) skill.end('ammo'); }, { owner: u });
}
export function customizeFiveStarSniperThirdKit({ battle: b, id, def, unit: u, kit }) {
  if (!FIVE_STAR_SNIPER_THIRD_OPERATORS[id]) return;
  const s = def.skill, bb = s.bb;
  kit.install = null;
  kit.trait = { attack: 'ranged', dmgType: 'phys', projectile: 'arrow', canHitFly: id !== GREYY,
    groundOnly: id === GREYY, priority: id === LUNA ? 'lowDef' : id === TODDI ? 'heaviest' : 'first',
    hits: 1, hitsFn: null, maxTargets: 1, allInRange: false, splashRadius: 0, chain: null,
    dmgMul: id === TODDI ? (_b, _u, e) => e.tags.has('sarkaz') ? (def.talents[0]?.bb.atk_scale ?? 1) : 1 : null,
    windup: (_b, unit) => model(unit).hits[clip(unit)][0] / rate(unit),
    attackVisual: (_b, unit) => clip(unit), interruptOnSkillChange: true };
  if (id === TODDI) {
    kit.trait.launchAttack = toddiLaunch;
    kit.skill = s.id.endsWith('_1') ? { kind: 'duration', attack: { atkScale: bb['attack@atk_scale'] },
      onStart: ({ battle, unit }) => {
        const p = unit.profile;
        const es = sortEnemyTargets(battle, unit, candidates(battle, unit, p), 'heaviest')
          .sort((a, c) => Number(c.tags.has('sarkaz')) - Number(a.tags.has('sarkaz')));
        const target = es[0];
        if (target) battle.addBuff(target, { key: `toddi:mark:${unit.id}`, source: unit, duration: s.duration,
          mods: { defMul: 1 + bb.def, taunt: bb.taunt_level } });
      } }
      : { kind: 'ammo', ammo: bb['attack@trigger_time'], manualCancel: true,
        mods: { batPct: bb.base_attack_time }, attack: { atkScale: bb['attack@atk_scale'] },
        onStart: ({ battle, unit }) => form(battle, unit, 'Skill_2_Begin', 'toddi:begin'),
        onAttack: toddiConsume,
        onEnd: ({ battle, unit }) => { battle.removeBuff(unit, 'toddi:begin'); battle.removeBuff(unit, 'toddi:last-round');
          form(battle, unit, 'Skill_2_End', 'toddi:end', true); } };
  } else if (id === LUNA) {
    kit.trait.projectileSpeed = s.id.endsWith('_2') ? 20 : 25;
    kit.trait.launchAttack = (battle, unit, p, target, info) => arc(battle, unit, target, p, info,
      p.isSkill && unit.skill.id.endsWith('_2') ? 20 : 25);
    kit.skill = s.id.endsWith('_1') ? { kind: 'duration', mods: { atkPct: bb.atk } }
      : { kind: 'duration', mods: { aspd: bb.attack_speed },
        onStart: ({ battle, unit }) => {
          battle.addBuff(unit, { key: 'lunacu:start-cam', duration: bb['lunacu_s_2[start_cam].start_cam_duration'], flags: { camou: true } });
          form(battle, unit, 'Skill_2_Begin', 'lunacu:begin');
        }, onEnd: ({ battle, unit }) => { battle.removeBuff(unit, 'lunacu:begin'); form(battle, unit, 'Skill_2_End', 'lunacu:end', true); } };
  } else {
    kit.trait.launchAttack = greyyLaunch;
    kit.skill = s.id.startsWith('skcom') ? { kind: 'duration', mods: { atkPct: bb.atk, aspd: bb.attack_speed } }
      : { kind: 'instant', duration: 0, charges: bb.ct,
        canActivate: () => !u.findBuff('greyy:cast') && candidates(b, u, { ...u.profile, canHitFly: false, groundOnly: true }).length > 0,
        onStart: ({ battle, unit }) => greyyCast(battle, unit, bb) };
  }
}
export function installFiveStarSniperThird({ battle: b, unit: u, def }) {
  if (!FIVE_STAR_SNIPER_THIRD_OPERATORS[def.charId]) return;
  if (def.charId === LUNA && def.talents[0]) {
    const t = def.talents[0].bb;
    b.every(.1, () => {
      if (!live(u)) return;
      if (u.skill.active) {
        b.removeBuff(u, 'lunacu:idle-cam');
        if (!u.findBuff('lunacu:interval')) b.addBuff(u, { key: 'lunacu:interval', source: u, mods: { batPct: t.base_attack_time } });
      } else {
        b.removeBuff(u, 'lunacu:interval');
        if (!u.findBuff('lunacu:idle-cam')) b.addBuff(u, { key: 'lunacu:idle-cam', source: u, flags: { camou: true } });
      }
    }, { owner: u });
    b.on('kill', ({ killer }) => {
      if (killer !== u || !u.skill.active || !u.skill.id.endsWith('_2')) return;
      b.addBuff(u, { key: 'lunacu:kill-cam', source: u, duration: u.skill.bb['lunacu_s_2[cam].cam_duration'],
        refresh: 'extend', flags: { camou: true } });
      b.removeBuff(u, 'lunacu:start-cam');
    }, { owner: u });
  }
  if (def.charId === GREYY) u.mem.greyyBallId = 0;
}
