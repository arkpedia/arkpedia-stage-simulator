// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-horn-prefabs.json' with { type: 'json' };
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { applyHpLoss, makeDamageInfo } from '../damage.js';

const ID = 'char_4039_horn', present = u => u?.alive && u.deployed && !u.hidden;
const models = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => Math.min(1, u.s.aspd / 100);
const value = (key, field) => evidence.projectiles[key].flatMap(g => g.components)
  .map(c => c.data).find(c => c[field] != null)[field];
const plain = { attack: 'ranged', dmgType: 'phys', projectile: 'none', canHitFly: false };
const skillNumber = u => u.skill.active ? Number(u.skill.id.at(-1)) : 0;

function select(b, u, p) {
  // Original composite ability order: blocked melee, long range, own-tile melee.
  let targets = u.blocking.filter(e => e.blockedBy === u && canTargetEnemy(u, e, p));
  let melee = !!targets.length;
  if (!targets.length) targets = b.enemiesInKeys(u.rangeKeys, u, p);
  if (!targets.length) {
    targets = b.enemiesInKeys(absoluteRangeKeys(evidence.tables.ranges['0-1'].grids.map(g => [g.row, g.col]),
      u.tileR, u.tileC, u.dir), u, p);
    melee = !!targets.length;
  }
  p._fortressMelee = melee; u.mem.hornMelee = melee;
  sortEnemyTargets(b, u, targets, p.priority);
  return targets.slice(0, 1);
}
function clip(u) {
  const n = skillNumber(u), melee = u.mem.hornMelee;
  if (!n) return melee ? 'Attack_A' : 'Attack_B';
  if (n === 1) return melee ? 'Skill_1_A' : u.dir === 'DOWN' ? 'Skill_Down_1' : 'Skill_1_B';
  return melee ? `Skill_${n}_A_Loop` : u.dir === 'DOWN'
    ? n === 2 ? 'Skill_Down_2_B_Loop' : 'Skill_Down_3_Loop' : `Skill_${n}_B_Loop`;
}
function damage(b, u, at, key, scale, info, melee, arts = 0, cachedAtk = null) {
  const p = { ...plain, ...(key === 'projectile_chr_horn_s1' ? { ignoreStealth: true } : {}) };
  const victims = melee && !arts && key !== 'projectile_chr_horn_s2_melee'
    ? at.target && canTargetEnemy(u, at.target, p) ? [at.target] : []
    : b.enemiesInRadius(at.x, at.y, value(key, 'm_Radius'), false).filter(e => canTargetEnemy(u, e, p));
  // S2's melee projectiles are still RANGED/SPLASH damage. Ordinary melee and
  // S1/S3 melee branches have no projectile and remain single-target MELEE.
  const splash = !melee || key === 'projectile_chr_horn_s2_melee';
  for (const e of victims) {
    b.dealDamage(u, e, { amount: (cachedAtk ?? u.s.atk) * u.s.atkScaleMul * scale,
      type: 'phys', isSkill: info.isSkill, isAttack: true, isSplash: splash,
      isProjectile: splash, applyWay: splash ? 'ranged' : 'melee', attackId: info.attackId,
      tags: ['horn:attack'] });
    if (arts && e.alive) b.dealDamage(u, e, { amount: u.s.atk * u.s.atkScaleMul * arts,
      type: 'arts', isSkill: true, isAttack: true, isSplash: true, isProjectile: true,
      applyWay: 'ranged', attackId: info.attackId, tags: ['horn:overload'] });
  }
}
function illuminate(b, u, at, bb) {
  const key = `horn:flare:${u.id}:${++u.mem.hornFlareSeq}`, start = b.time;
  const update = () => {
    const on = b.time < start + bb.projectile_delay_time - 1e-9;
    const inside = on ? new Set(b.enemiesInRadius(at.x, at.y, bb.projectile_range, true)) : new Set();
    for (const e of b.enemies) {
      if (inside.has(e) && e.alive && e.deployed && !e.hidden) {
        if (!e.findBuff(key)) b.addBuff(e, { key, source: u, flags: { reveal: true } });
      } else b.removeBuff(e, key);
    }
    return on;
  };
  update();
  // Native light projectile survives the shooter's retirement and detaches its
  // reveal immunity on leaving the area or ending; it is not an owner timer.
  const timer = b.every(b.dt, () => { if (!update()) timer.cancel(); });
}
function launch(b, u, p, target, info) {
  if (!canTargetEnemy(u, target, p)) return;
  const n = skillNumber(u), bb = u.skill.bb, melee = !!p._fortressMelee;
  const key = n === 1 ? 'projectile_chr_horn_s1' : n === 2
    ? melee ? 'projectile_chr_horn_s2_melee' : 'projectile_chr_horn_s2'
    : n === 3 ? 'projectile_chr_horn_s3' : 'projectile_chr_horn';
  const scale = n === 1 ? bb.atk_scale : n === 2 ? bb['attack@s2.atk_scale'] : 1;
  const arts = n === 2 && u.skill.ammoLeft <= u.skill.ammoMax / 2 ? bb['attack@s2.magic_atk_scale'] : 0;
  const hit = at => {
    if (n === 1 && !melee) illuminate(b, u, at, bb);
    damage(b, u, at, key, scale, info, melee, arts);
  };
  if (melee) hit({ target, x: target.x, y: target.y });
  else b.addProjectile({ from: u, target, source: u, hitDead: true,
    speed: value(key, '_speed'), maxAge: value(key, '_lifeTime'), visual: 'orb',
    data: { arkpediaTrackedVisual: true }, onHit: hit });
}
function form(b, u, n, end = false) {
  const part = end ? 'End' : 'Begin', seq = u.deploySeq, activation = u.skill.activations;
  const down = n === 3 && u.dir === 'DOWN';
  const name = down ? `Skill_Down_3_${part}` : `Skill_${n}_${part}`;
  const time = models(u).durations[name], token = {};
  u.mem.hornForm = token; u.mem.regularFormVisual = { clip: name, loop: false };
  b.addBuff(u, { key: 'horn:form', source: u, duration: time, flags: { disarm: true } });
  b.after(time, () => {
    if (!present(u) || u.deploySeq !== seq || u.mem.hornForm !== token
      || u.skill.activations !== activation) return;
    u.mem.regularFormVisual = end ? null : { clip: down ? 'Skill_Down_3_Idle' : `Skill_${n}_Idle`, loop: true };
  }, { owner: u });
}
function lose(b, u, amount, tag, noSp) {
  if (amount > 0) applyHpLoss(b, u, u, amount, makeDamageInfo({ amount,
    type: 'true', isAttack: true, applyWay: 'melee', noSp, tags: [tag] }));
}
function dump(b, u) {
  if (u.mem.hornDump) return false;
  const sk = u.skill, bb = sk.bb;
  if (sk.ammoLeft > sk.ammoMax / 2) { sk.end('manual'); return true; }
  const p = { ...plain }, targets = select(b, u, p), count = sk.ammoLeft;
  if (!targets.length) {
    lose(b, u, u.hp * bb.hp_ratio, 'horn:dump-cost', false);
    sk.end('manual'); return true;
  }
  const target = targets[0], melee = !!p._fortressMelee, cachedAtk = u.s.atk;
  const epoch = u.attackControlEpoch, seq = u.deploySeq, act = sk.activations;
  const animation = clip(u), playback = rate(u), hitTime = models(u).hits[animation][0] / playback;
  const duration = models(u).durations[animation] / playback, token = {};
  u.mem.hornDump = token;
  // Explicit FSM event mapping: charge count is captured on the second trigger;
  // the uncoded native event dispatcher remains a documented fidelity bound.
  const valid = () => present(u) && u.deploySeq === seq && sk.active && sk.activations === act
    && u.canAct && u.attackControlEpoch === epoch && u.mem.hornDump === token;
  u.mem.regularFormVisual = { clip: animation, loop: false, attack: 'none', speed: playback };
  u.atkCd = Math.max(u.atkCd, duration);
  const watch = b.every(b.dt, () => {
    if (!valid()) {
      if (u.mem.hornDump === token) {
        u.mem.hornDump = null;
        if (present(u) && u.deploySeq === seq && sk.active && sk.activations === act)
          u.mem.regularFormVisual = { clip: 'Skill_2_Idle', loop: true };
      }
      delayed.cancel(); watch.cancel();
    }
  }, { owner: u });
  const delayed = b.after(hitTime, () => {
    watch.cancel(); if (!valid()) return;
    const info = { isSkill: true, attackId: ++b._attackSeq };
    sk.ammoLeft = Math.max(0, sk.ammoLeft - count);
    b.emit('ammoUsed', { unit: u, left: sk.ammoLeft, skill: sk });
    lose(b, u, u.hp * bb['attack@s2.hp_ratio'], 'horn:dump-cost', false);
    // Remaining missiles are independent after release; physical ATK stays
    // cached across every missile, while the native Arts action reads live ATK.
    for (let i = 0; i < count; i++) {
      const key = melee ? 'projectile_chr_horn_s2_melee'
        : `projectile_chr_horn_s2_full${i ? `_0${i + 1}` : ''}`;
      const hit = at => damage(b, u, at, key, bb['attack@s2.atk_scale'], info,
        melee, bb['attack@s2.magic_atk_scale'], cachedAtk);
      if (melee) { if (canTargetEnemy(u, target, plain)) hit({ target, x: target.x, y: target.y }); }
      else b.addProjectile({ from: u, target, source: u, hitDead: true, speed: value(key, '_speed'),
        maxAge: value(key, '_lifeTime'), visual: 'orb', data: { arkpediaTrackedVisual: true }, onHit: hit });
    }
    u.stats.attacks++; b.emit('attack', { attacker: u, targets, isSkill: true });
    u.mem.hornDump = null;
    if (!sk.ammoLeft) sk.end('ammo');
  }, { owner: u });
  return true;
}
export function customizeHornKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null;
  kit.trait = { ...plain, heal: null, fortress: false, maxTargets: 1, hitAllBlocked: false,
    maxTargetsByBlock: false, allInRange: false, rangeAoe: false, splashRadius: 0, chain: null,
    hits: 1, hitsFn: null, acquireTargets: select, launchAttack: launch,
    interruptOnSkillChange: true, attackEpoch: (_b, a) => a.mem.hornDump,
    canAttack: (_b, a) => !a.mem.hornDump, attackVisual: (_b, a) => clip(a),
    windup: (_b, a) => models(a).hits[clip(a)][0] / rate(a) };
  const s = def.skill, bb = s.bb, n = Number(s.id.at(-1));
  const end = ({ reason }) => {
    u.mem.hornDump = null; u.mem.hornOverloaded = false;
    u.mem.hornBleed?.cancel(); b.removeBuff(u, 'horn:overload-atk');
    b.removeBuff(u, 'horn:form'); u.atkCd = 0;
    if (present(u) && !['death', 'retreat'].includes(reason)) form(b, u, n, true);
    else { u.mem.hornForm = null; u.mem.regularFormVisual = null; }
  };
  if (n === 1) kit.skill = { kind: 'instant', charges: bb.cnt,
    defaultCondition: () => select(b, u, { ...plain }).length > 0, attack: {} };
  else if (n === 2) kit.skill = { kind: 'ammo', ammo: bb['attack@s2.trigger_time'], trigger: 'NEVER',
    overloadState: () => u.mem.hornOverloaded,
    manualCancel: true, canManualCancel: () => !u.mem.hornDump, onManualCancel: () => dump(b, u),
    attack: { retargetOnRelease: true }, onStart: () => { u.mem.hornDump = null;
      u.mem.hornOverloaded = false; u.atkCd = 0; form(b, u, 2); }, onEnd: end };
  else kit.skill = { kind: 'duration', duration: s.duration, trigger: 'NEVER', manualCancel: true,
    overloadState: () => u.mem.hornOverloaded,
    mods: { batFlat: bb.base_attack_time }, onStart: () => {
      u.mem.hornOverloaded = false; u.atkCd = 0; form(b, u, 3);
      b.addBuff(u, { key: 'horn:overload-atk', source: u, mods: { atkPct: bb.atk } });
    }, onTick: () => {
      if (u.mem.hornOverloaded || u.skill.timeLeft > s.duration / 2 + 1e-9) return;
      u.mem.hornOverloaded = true;
      b.addBuff(u, { key: 'horn:overload-atk', source: u,
        mods: { atkPct: bb['horn_s_3[overload_start].atk'] } });
      const start = b.time, seq = u.deploySeq, act = u.skill.activations;
      const interval = bb['horn_s_3[overload_start].interval'];
      u.mem.hornBleed = b.every(interval, (_b, clock) => {
        if (!present(u) || u.deploySeq !== seq || !u.skill.active || u.skill.activations !== act) {
          clock.cancel(); return;
        }
        const progress = Math.min(1, (b.time - start) / bb['horn_s_3[overload_start].damage_duration']);
        lose(b, u, u.s.maxHp * bb['horn_s_3[overload_start].hp_ratio'] * progress * interval,
          'horn:overload-drain', true);
      }, { owner: u });
    }, onEnd: end };
  kit.skill.id = s.id; kit.skill.name = s.name;
}
function aura(b) {
  const horns = b.allyUnits.filter(a => a.defId === ID && present(a));
  const source = horns.filter(a => a.def.talents.some(t => t.bb.atk != null))
    .sort((a, z) => z.def.talents.find(t => t.bb.atk != null).bb.atk
      - a.def.talents.find(t => t.bb.atk != null).bb.atk)[0];
  const value = source?.def.talents.find(t => t.bb.atk != null).bb.atk;
  for (const a of b.allyUnits) {
    const eligible = source && present(a) && a.kind === 'op' && a.def.profession === 'TANK'
      && b.allySelectable(a, source), old = a.findBuff('horn:defenders');
    if (!eligible) b.removeBuff(a, 'horn:defenders');
    else if (old?.source !== source || old.mods.atkPct !== value)
      b.addBuff(a, { key: 'horn:defenders', source, mods: { atkPct: value } });
  }
}
export function installHorn({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  const t = def.talents.find(t => t.bb.max_hp != null)?.bb;
  b.on('deploy', ({ unit }) => {
    if (unit === u) { u.mem.hornReborn = false; u.mem.hornDump = null;
      u.mem.hornFlareSeq = u.mem.hornFlareSeq ?? 0; u.mem.hornForm = null;
      u.mem.regularFormVisual = null; u.mem.hornOverloaded = false; }
    aura(b);
  }, { owner: u });
  b.on('tick', () => aura(b), { owner: u });
  b.on('ammoUsed', ({ unit, skill, left }) => {
    if (unit === u && skill.id === 'skchr_horn_2' && left <= skill.ammoMax / 2)
      u.mem.hornOverloaded = true;
  }, { owner: u });
  for (const event of ['retreat', 'death']) b.on(event, ({ unit }) => {
    if (unit === u) { u.mem.hornBleed?.cancel(); u.mem.hornDump = null;
      u.mem.hornForm = null; u.mem.regularFormVisual = null;
      for (const key of ['horn:reborn', 'horn:form', 'horn:overload-atk']) b.removeBuff(u, key); }
    aura(b);
  }, { owner: u });
  if (t) b.on('fatal', ctx => {
    if (ctx.unit !== u || !present(u) || u.mem.hornReborn || ctx.prevented || u.s.flags.undeadable) return;
    u.mem.hornReborn = true;
    b.addBuff(u, { key: 'horn:reborn', source: u,
      mods: { hpMul: t.max_hp, aspd: t.attack_speed, defPct: t.def } });
    // Native skipModifierEvent heal: no ordinary heal event/healing multiplier.
    // Its explicit ignoreHealFree=false still respects healing prohibition.
    u.hp = u.s.flags.healFree ? Math.min(1, u.s.maxHp) : u.s.maxHp * t.hp_ratio;
    ctx.prevented = true;
  }, { owner: u });
}
