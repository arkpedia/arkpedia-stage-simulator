// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-fiammetta-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { applyHpLoss, makeDamageInfo } from '../damage.js';
import { toLocal } from '../dir.js';
import { COLS } from '../constants.js';

const ID = 'char_300_phenxi';
const present = u => u?.alive && u.deployed;
const third = u => u.skill.active && u.skill.id === 'skchr_phenxi_3';
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => Math.min(1, u.s.aspd / 100);
const components = key => evidence.projectiles[key].flatMap(g => g.components).map(c => c.data);
const value = (key, field) => components(key).find(c => c[field] != null)[field];
const plain = { attack: 'ranged', applyWay: 'ranged', dmgType: 'phys', projectile: 'none',
  canHitFly: true, hits: 1, splashRadius: 0, chain: null, dmgMul: null };

function centre(b, u) {
  // Native filter 12 + authored mechanics: farthest tile on the facing axis.
  // Use actual stage tiles; external range extension cannot move S3's centre.
  const cells = absoluteRangeKeys(u.rangeGrid, u.tileR, u.tileC, u.dir).map(k => [Math.floor(k / COLS), k % COLS])
    .filter(([r, c]) => b.grid.inRect(r, c) && toLocal(r - u.tileR, c - u.tileC, u.dir)[0] === 0)
    .sort((a, z) => toLocal(z[0] - u.tileR, z[1] - u.tileC, u.dir)[1]
      - toLocal(a[0] - u.tileR, a[1] - u.tileC, u.dir)[1]);
  if (!cells.length) return null;
  const [r, c] = cells[0];
  return { id: `tile:${r},${c}`, kind: 'tile', side: 'tile', alive: true, deployed: true,
    tileR: r, tileC: c, x: c, y: r };
}
function select(b, u, p) {
  if (third(u)) { const tile = centre(b, u); return tile ? [tile] : []; }
  const targets = b.enemiesInKeys(u.rangeKeys, u, p);
  for (const e of b.blockedTargets(u, p)) if (!targets.includes(e)) targets.push(e);
  sortEnemyTargets(b, u, targets);
  const input = u.mem.phenxiInput?.[0];
  if (targets.includes(input)) { targets.splice(targets.indexOf(input), 1); targets.unshift(input); }
  return targets.slice(0, 1);
}
function burst(b, u, at, radius, scale, info) {
  const p = { ...plain, ignoreCamouflage: true, atkScale: scale };
  for (const e of b.foesInRadius(at.x, at.y, radius, true).filter(e => canTargetEnemy(u, e, p)))
    resolveHit(b, u, p, e, info, e.x, e.y);
}
function launch(b, u, p, target, info) {
  if (p.tileTargets) {
    const key = 'projectile_chr_phenxi_s3', bb = u.skill.bb;
    const flight = value(key, '_delayToStart'), radius = value(key, 'm_Radius');
    // The source ability waits for this projectile plus its .567 escape.
    u.atkCd = Math.max(u.atkCd, flight + .567);
    b.addProjectile({ from: u, to: target, source: u, flightTime: flight,
      maxAge: value(key, '_lifeTime'), visual: 'orb', data: { arkpediaTrackedVisual: true },
      onHit: at => {
        const victims = b.foesInRadius(at.x, at.y, radius, true)
          .filter(e => canTargetEnemy(u, e, { ...plain, ignoreCamouflage: true }));
        for (const e of victims) {
          const scale = Math.hypot(e.x - at.x, e.y - at.y) <= bb['attack@dist'] + 1e-9
            ? bb['attack@atk_scale'] : bb['attack@atk_scale_2'];
          resolveHit(b, u, { ...plain, ignoreCamouflage: true, atkScale: scale }, e, info, e.x, e.y);
        }
      } });
    return;
  }
  if (!canTargetEnemy(u, target, p)) return;
  const key = u.skill.active && u.skill.id === 'skchr_phenxi_1'
    ? 'projectile_chr_phenxi_s1' : 'projectile_chr_phenxi';
  b.addProjectile({ from: u, target, hitDead: true, source: u, speed: value(key, '_speed'),
    maxAge: value(key, '_lifeTime'), visual: 'orb', data: { arkpediaTrackedVisual: true },
    onHit: at => burst(b, u, at, value(key, 'm_Radius'), 1, info) });
}
function herald(b, u) {
  const value = u.def.talents.find(t => t.bb.attack_speed != null)?.bb.attack_speed;
  const old = u.findBuff('phenxi:herald');
  if (!present(u) || u.skill.active || !value) b.removeBuff(u, 'phenxi:herald');
  else if (!old) b.addBuff(u, { key: 'phenxi:herald', source: u, mods: { aspd: value } });
}
function endForm(b, u) {
  const seq = u.deploySeq, token = {}, duration = model(u).durations.Skill_2_End;
  u.mem.phenxiVisual = token;
  u.mem.regularFormVisual = { clip: 'Skill_2_End', loop: false };
  b.after(duration, () => {
    if (present(u) && u.deploySeq === seq && u.mem.phenxiVisual === token)
      u.mem.regularFormVisual = null;
  }, { owner: u });
}
function castSecond(b, u) {
  const target = centre(b, u), seq = u.deploySeq, act = u.skill.activations,
    epoch = u.attackControlEpoch, playback = u.s.aspd / 100;
  const valid = () => present(u) && u.deploySeq === seq && u.skill.active
    && u.skill.activations === act && u.canAct && u.attackControlEpoch === epoch;
  const start = model(u).durations.Skill_Begin / playback;
  const hit = model(u).hits.Skill_Loop[0] / playback;
  const total = (model(u).durations.Skill_Begin + model(u).durations.Skill_Loop
    + model(u).durations.Skill_End) / playback;
  // Skill FSM/mount timing is a documented Begin/Loop/End mapping. The native
  // empty animKey dispatcher has not been recovered as executable code.
  u.skill.timeLeft = total; u.skill.duration = total;
  u.mem.regularFormVisual = { clip: 'Skill_Begin', loop: false, attack: 'none', speed: playback };
  let cancelled = false;
  const watch = b.every(b.dt, () => { if (!valid()) cancelled = true; }, { owner: u });
  b.after(start, () => {
    if (!cancelled && valid()) u.mem.regularFormVisual = { clip: 'Skill_Loop', loop: false,
      attack: 'none', speed: playback };
  }, { owner: u });
  b.after(start + hit, () => {
    watch.cancel(); if (cancelled || !valid() || !target) return;
    const bb = u.skill.bb, origin = { x: u.x, y: u.y }, dx = target.x - origin.x, dy = target.y - origin.y;
    const distance = Math.hypot(dx, dy), key = 'projectile_chr_phenxi_s2';
    const info = { isSkill: true, attackId: `phenxi:s2:${u.id}:${act}:${seq}` };
    let mark = 1;
    b.addProjectile({ from: origin, to: target, source: u, speed: value(key, '_speed'),
      maxAge: value(key, '_lifeTime'), visual: 'orb', data: { arkpediaTrackedVisual: true },
      onMove: ({ x, y }) => {
        const travelled = Math.hypot(x - origin.x, y - origin.y);
        while (distance > 0 && mark * bb.dist <= travelled + 1e-9) {
          const at = { x: origin.x + dx * mark * bb.dist / distance,
            y: origin.y + dy * mark * bb.dist / distance }; mark++;
          const child = 'projectile_chr_phenxi_s2_2';
          b.addProjectile({ from: at, to: at, source: u, flightTime: value(child, '_lifeTime'),
            visual: 'orb', data: { arkpediaTrackedVisual: true },
            onHit: point => burst(b, u, point, value(child, 'm_Radius'), bb.atk_scale_2, info) });
        }
      }, onHit: at => burst(b, u, at, value(key, 'm_Radius'), bb.atk_scale, info) });
  }, { owner: u });
  b.after(start + model(u).durations.Skill_Loop / playback, () => {
    if (valid()) u.mem.regularFormVisual = { clip: 'Skill_End', loop: false, attack: 'none', speed: playback };
  }, { owner: u });
}
export function customizeFiammettaKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null;
  kit.trait = { ...plain, heal: null, maxTargets: 1, maxTargetsByBlock: false,
    hitAllBlocked: false, allInRange: false, rangeAoe: false, hitsFn: null, install: null,
    acquireTargets: select, retargetOnRelease: true, interruptOnSkillChange: true,
    windup: (_b, a, targets) => { a.mem.phenxiInput = targets;
      return model(a).hits[third(a) ? 'Skill_2_Loop' : 'Attack'][0] / rate(a); },
    attackVisual: (_b, a) => third(a) ? 'Skill_2_Loop' : 'Attack', launchAttack: launch,
    afterAttack: (_b, a) => { a.mem.phenxiInput = null; } };
  const s = def.skill, bb = s.bb;
  if (s.id.endsWith('_1')) kit.skill = { kind: 'duration', trigger: 'NEVER', duration: s.duration,
    mods: { atkPct: bb.atk, rangeExtend: bb.ability_range_forward_extend },
    onStart: () => { u.atkCd = 0; herald(b, u); }, onEnd: () => herald(b, u) };
  else if (s.id.endsWith('_2')) kit.skill = { kind: 'duration', trigger: 'NEVER', duration: 1,
    attack: { noAttack: true, animation: 'none' },
    onStart: () => { herald(b, u); castSecond(b, u); },
    onEnd: () => { u.mem.regularFormVisual = null; u.atkCd = 0; herald(b, u); } };
  else kit.skill = { kind: 'toggle', trigger: 'NEVER', manualCancel: true,
    canActivate: () => !!centre(b, u), mods: { batPct: bb.base_attack_time },
    targeting: { rangeGrid: def.rangeGrid, noRangeExtend: true }, attack: { tileTargets: true },
    onStart: () => {
      herald(b, u); u.atkCd = 0;
      const seq = u.deploySeq, act = u.skill.activations, token = {};
      u.mem.phenxiVisual = token;
      const duration = model(u).durations.Skill_2_Begin;
      b.addBuff(u, { key: 'phenxi:begin', source: u, duration, flags: { disarm: true } });
      u.mem.regularFormVisual = { clip: 'Skill_2_Begin', loop: false };
      b.after(duration, () => {
        if (present(u) && u.deploySeq === seq && u.skill.activations === act && third(u)
          && u.mem.phenxiVisual === token) u.mem.regularFormVisual = { clip: 'Skill_2_Idle', loop: true };
      }, { owner: u });
    }, onEnd: () => { b.removeBuff(u, 'phenxi:begin'); u.atkCd = 0; herald(b, u);
      if (present(u)) endForm(b, u); } };
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installFiammetta({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  const bb = def.talents.find(t => t.bb.interval != null)?.bb;
  const vigor = () => {
    if (!present(u)) { b.removeBuff(u, 'phenxi:vigor'); return; }
    const tier = [2, 1].find(t => u.hpRatio > bb[`phenxi_t_1[peak_${t}].peak_performance.hp_ratio`]);
    const value = tier ? bb[`phenxi_t_1[peak_${tier}].peak_performance.atk`] : 0;
    const old = u.findBuff('phenxi:vigor');
    if (!value) b.removeBuff(u, 'phenxi:vigor');
    else if (old?.data.value !== value) b.addBuff(u, { key: 'phenxi:vigor', source: u,
      status: 'vigor', data: { value }, mods: { atkPct: value } });
  };
  b.on('deploy', ({ unit }) => {
    if (unit !== u) return;
    u.mem.phenxiInput = null; u.mem.phenxiVisual = null; u.mem.regularFormVisual = null;
    const seq = u.deploySeq;
    vigor(); herald(b, u);
    b.every(bb.interval, (_battle, clock) => {
      if (!present(u) || u.deploySeq !== seq) { clock.cancel(); return; }
      const amount = Math.min(Math.ceil(u.hp * bb.hp_ratio), Math.max(0, u.hp - 1));
      if (amount > 0) applyHpLoss(b, u, u, amount, makeDamageInfo({ amount,
        type: 'true', applyWay: 'none', isAttack: true, noSp: true, tags: ['phenxi:drain'] }));
      vigor();
    }, { owner: u });
  }, { owner: u });
  for (const event of ['death', 'retreat']) b.on(event, ({ unit }) => {
    if (unit !== u) return;
    u.mem.phenxiVisual = null; u.mem.phenxiInput = null; u.mem.regularFormVisual = null;
    for (const key of ['phenxi:vigor', 'phenxi:herald', 'phenxi:begin']) b.removeBuff(u, key);
  }, { owner: u });
}
