// SPDX-License-Identifier: GPL-3.0-or-later
// Original selectors, templates, animation aliases and native-dispatch bounds:
// data/arkpedia-defender-fourth-prefabs.json.
import { DEFENDER_FOURTH_OPERATORS } from '../../../shared/arkpedia/defender-fourth-operators.js';
import evidence from '../../../data/arkpedia-defender-fourth-prefabs.json' with { type: 'json' };
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { resolveHit } from '../ai.js';
import { bodyInKeys } from '../body.js';

const BLITZ = 'char_457_blitz', UNDER = 'char_4137_udflow', ASH = 'char_431_ashlok', FIRE = 'char_493_firwhl', CEMENT = 'char_464_cement';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.originalModels[u.defId][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const speed = (u, cap = Infinity) => Math.min(cap, u.s.aspd / 100);
const range = (u, id) => new Set(absoluteRangeKeys(evidence.ranges[id], u.tileR, u.tileC, u.dir));
const hasBlocks = u => u.blocking.some(e => e.alive && e.blockedBy === u);
function mods(b, u, key, value, flags = null) {
  const old = u.findBuff(key);
  if (!value && !flags) b.removeBuff(u, key);
  else if (!old || JSON.stringify(old.mods) !== JSON.stringify(value) || JSON.stringify(old.flags) !== JSON.stringify(flags))
    b.addBuff(u, { key, source: u, mods: value, flags });
}
function selected(b, u, keys, prof, count = Infinity, priority) {
  const out = b.enemiesInKeys([...keys], u, prof);
  sortEnemyTargets(b, u, out, priority);
  return out.slice(0, count);
}
function attackReceipt(b, u, targets, clip, attackId) {
  if (!targets.length) return;
  u.stats.attacks++;
  for (const e of targets) b._ev(['atk', u.id, e.id, 'none', { animation: clip, projectile: 'none' }]);
  b.emit('attack', { attacker: u, targets, isSkill: true, attackId });
}
// Only the source instant cast owns this lock. An interruption remains latched
// even if control clears before the original OnAttack deadline.
function instantCast(b, u, clip, cap, release) {
  const seq = u.deploySeq, activation = u.skill.activations, rate = speed(u, cap);
  const deadline = model(u).hits[clip][0] / rate, duration = model(u).durations[clip] / rate;
  const state = { interrupted: false }; u.mem.defenderFourthCast = state;
  u.mem.regularFormVisual = { clip, loop: false };
  b.addBuff(u, { key: 'defender-fourth:cast', source: u, duration, flags: { disarm: true, noSp: true } });
  const control = u.attackControlEpoch;
  const same = () => live(u) && u.deploySeq === seq && u.skill.activations === activation && u.attackControlEpoch === control;
  const watch = b.on('tick', () => { if (!u.canAct || !same()) state.interrupted = true; }, { owner: u });
  b.after(deadline, () => { b.off(watch); if (same() && u.canAct && !state.interrupted) release(); }, { owner: u });
  b.after(duration, () => {
    if (u.deploySeq !== seq || u.mem.defenderFourthCast !== state) return;
    u.mem.defenderFourthCast = null; u.mem.regularFormVisual = null;
    b.removeBuff(u, 'defender-fourth:cast');
  }, { owner: u });
}
function startForm(b, u, begin, idle) {
  const seq = u.deploySeq, activation = u.skill.activations, duration = model(u).durations[begin];
  u.mem.regularFormVisual = { clip: begin, loop: false };
  b.addBuff(u, { key: 'defender-fourth:begin', source: u, duration, flags: { disarm: true } });
  b.after(duration, () => { if (live(u) && u.deploySeq === seq && u.skill.active && u.skill.activations === activation)
    u.mem.regularFormVisual = { clip: idle, loop: true }; }, { owner: u });
}
function endForm(b, u, clip, reason) {
  b.removeBuff(u, 'defender-fourth:begin');
  if (!live(u) || ['death', 'retreat'].includes(reason)) { u.mem.regularFormVisual = null; return; }
  const seq = u.deploySeq, duration = model(u).durations[clip];
  u.mem.regularFormVisual = { clip, loop: false };
  b.addBuff(u, { key: 'defender-fourth:end', source: u, duration, flags: { disarm: true } });
  b.after(duration, () => { if (u.deploySeq === seq) u.mem.regularFormVisual = null; }, { owner: u });
}
function blitzOpening(b, u) {
  u.mem.blitzFirst = !u.mem.blitzOpened; u.mem.blitzOpened = true;
  return (model(u).hits.Attack_Loop[0] + (u.mem.blitzFirst ? model(u).durations.Attack_Begin : 0)) / speed(u);
}
function directShot(b, u, p, target, info, projectileSpeed) {
  b.addProjectile({ source: u, from: { x: u.x, y: u.y }, target, speed: projectileSpeed,
    data: { visual: true }, onHit: c => { if (c.target && canTargetEnemy(u, c.target, p)) resolveHit(b, u, p, c.target, info, c.x, c.y); } });
}
function underPoison(b, u, e, def) {
  const t = def.talents[0]?.bb;
  if (!t || !e.alive) return;
  b.addBuff(e, { key: 'underflow:poison', source: u, duration: t.duration,
    interval: t.interval, refresh: 'extend', onTick: () => {
      if (e.alive) b.dealDamage(u, e, { amount: e.tags.has('seamonster') ? t.damage_seamonster : t.damage,
        type: 'arts', isAttack: true, applyWay: 'none', tags: ['underflow:poison'] });
    } });
}
function fortressSelect(b, u, p, onlyRanged) {
  let targets = !onlyRanged ? u.blocking.filter(e => e.blockedBy === u && canTargetEnemy(u, e, p)) : [];
  let melee = !!targets.length;
  if (!targets.length) targets = selected(b, u, u.rangeKeys, p, 1);
  if (!targets.length && !onlyRanged) { targets = selected(b, u, range(u, '0-1'), p, 1); melee = !!targets.length; }
  p._fortressMelee = melee; u.mem.fortressMelee = melee;
  sortEnemyTargets(b, u, targets, p.priority);
  return targets.slice(0, 1);
}
function fortressClip(u, id, skill) {
  if (id === ASH) {
    if (skill) return u.dir === 'UP' ? 'Skill_Loop_Up' : u.dir === 'DOWN' ? 'Skill_Loop_Down' : 'Skill_Loop';
    return u.mem.fortressMelee ? 'Attack02' : u.dir === 'DOWN' ? 'Attack01_Down' : 'Attack01';
  }
  if (skill === 2) return 'Skill_2_Loop';
  return u.mem.fortressMelee ? 'Combat_A' : skill === 1 ? 'Skill_1' : u.dir === 'DOWN' ? 'Attack_Down' : 'Attack';
}
function fireS1Burn(b, u, e, bb) {
  if (!e.alive) return;
  const cachedAtk = u.s.atk;
  b.addBuff(e, { key: 'firewhistle:S1', source: u, duration: bb.burn_duration,
    interval: 1, onTick: () => { if (e.alive) b.dealDamage(u, e, {
      amount: (u.alive ? u.s.atk : cachedAtk) * bb['burn.atk_scale'], type: 'arts',
      isAttack: false, applyWay: 'none', tags: ['firewhistle:burn'] }); } });
}
function fireField(b, u, target, bb) {
  // Original projectileDestination ROOT_TILE, immediate TILE mount, no follow,
  // not managed by source; keep the field after source/trace target removal.
  const r = Math.round(target.y), c = Math.round(target.x);
  const pool = b._arkpediaFireFields ??= { fields: [] };
  pool.fields.push({ source: u, keys: new Set(absoluteRangeKeys(evidence.ranges['x-5'], r, c, 'RIGHT')),
    expires: b.time + bb.projectile_life_time, cachedAtk: u.s.atk, scale: bb['burn.atk_scale'] });
  syncFireFields(b);
}
function syncFireFields(b) {
  const pool = b._arkpediaFireFields;
  if (!pool) return;
  pool.fields = pool.fields.filter(f => f.expires > b.time + 1e-9);
  for (const e of b.enemies) {
    const covering = pool.fields.find(f => canTargetEnemy(f.source, e, { canHitFly: false }) && bodyInKeys(e, f.keys));
    const listener = 'firewhistle:field-listener', damage = 'firewhistle:field-damage';
    if (covering) {
      if (!e.findBuff(listener)) b.addBuff(e, { key: listener, source: covering.source });
      if (!e.findBuff(damage)) {
        const { cachedAtk, scale, source } = covering;
        const tick = () => { if (!e.findBuff(listener)) { b.removeBuff(e, damage); return; }
          if (e.alive) b.dealDamage(source, e, { amount: (source.alive ? source.s.atk : cachedAtk) * scale,
            type: 'arts', isAttack: false, applyWay: 'none', tags: ['firewhistle:field'] }); };
        b.addBuff(e, { key: damage, source, interval: 1, onTick: tick });
        // Source waitFirstTriggerInterval=false. Overlapping listeners do not
        // create another damage controller or reset its existing cadence.
        tick();
      }
    } else b.removeBuff(e, listener);
  }
}
function fortressLaunch(id, skill, bb) {
  return (b, u, p, target, info) => {
    const melee = !!p._fortressMelee;
    const impact = (center, x, y) => {
      if (id === FIRE && skill === 2 && center) fireField(b, u, center, bb);
      const targets = melee ? center && canTargetEnemy(u, center, p) ? [center] : []
        : b.enemiesInRadius(x, y, 1).filter(e => canTargetEnemy(u, e, p));
      for (const e of targets) {
        if (id === FIRE && skill === 1) fireS1Burn(b, u, e, bb);
        resolveHit(b, u, { ...p, _fortressMelee: melee, splashRadius: 0, splashScale: 0 }, e, info, x, y);
      }
    };
    if (melee) impact(target, target.x, target.y);
    else b.addProjectile({ source: u, from: { x: u.x, y: u.y }, target, speed: 5,
      hitDead: id === ASH, data: { visual: true }, onHit: c => impact(c.target, c.x, c.y) });
  };
}
export function customizeDefenderFourthKit({ battle: b, id, def, unit: u, kit }) {
  if (!DEFENDER_FOURTH_OPERATORS[id]) return;
  const s = def.skill, bb = s.bb, n = DEFENDER_FOURTH_OPERATORS[id].skillIds.indexOf(s.id);
  kit.install = null;
  kit.trait = { attack: [BLITZ, UNDER, ASH, FIRE].includes(id) ? 'ranged' : 'melee',
    dmgType: 'phys', projectile: 'none', canHitFly: [BLITZ, UNDER].includes(id), maxTargets: 1,
    hitAllBlocked: false, fortress: false, rangeAoe: false, allInRange: false, hits: 1, splashRadius: 0, chain: null,
    interruptOnSkillChange: true, attackVisual: 'Attack',
    windup: (_battle, unit) => model(unit).hits.Attack[0] / speed(unit) };
  if (id === BLITZ) {
    const talent = def.talents[0]?.bb;
    if (talent) kit.trait.acquireTargets = (_battle, unit, p) => {
      const candidates = selected(b, unit, unit.rangeKeys, p);
      for (const e of b.blockedTargets(unit, p)) if (!candidates.includes(e)) candidates.push(e);
      sortEnemyTargets(b, unit, candidates);
      // Source talent filter/selector prefers STUNNED before ordinary priority.
      candidates.sort((a, z) => Number(!a.s.flags.stun) - Number(!z.s.flags.stun));
      return candidates.slice(0, 1);
    };
    kit.trait.windup = blitzOpening;
    kit.trait.attackVisual = (_battle, unit) => unit.mem.blitzFirst
      ? { begin: 'Attack_Begin', loop: 'Attack_Loop', beginDuration: model(unit).durations.Attack_Begin / speed(unit) } : 'Attack_Loop';
    kit.trait.launchAttack = (battle, unit, p, target, info) => directShot(battle, unit, p, target, info, 10);
    if (n === 0) kit.skill = { kind: 'instant', isExhausted: () => (u.mem.blitzUses ?? 0) >= 4,
      remainingUses: () => Math.max(0, 4 - (u.mem.blitzUses ?? 0)),
      canActivate: () => !u.mem.defenderFourthCast, onStart: () => {
        u.mem.blitzUses = (u.mem.blitzUses ?? 0) + 1; u.mem.blitzOpened = false;
        instantCast(b, u, 'Skill_01', 1, () => {
          for (const e of selected(b, u, u.rangeKeys, { canHitFly: true })) {
            b.applyStatus(e, 'stun', { duration: bb.stun, source: u });
            b.applyStatus(e, 'silence', { duration: bb.silence, source: u });
          }
        });
      } };
    else kit.skill = { kind: 'duration', duration: s.duration, mods: { aspd: bb.attack_speed },
      onStart: () => { u.mem.blitzOpened = false;
        instantCast(b, u, 'Skill_02', 1, () => {
          const targets = u.blocking.filter(e => e.blockedBy === u && canTargetEnemy(u, e, { canHitFly: true }));
          const attackId = ++b._attackSeq;
          for (const e of targets) { b.applyStatus(e, 'stun', { duration: bb.stun, source: u });
            b.dealDamage(u, e, { amount: u.s.atk * bb.atk_scale, type: 'phys', isAttack: true,
              isSkill: true, attackId, applyWay: 'melee' }); }
          attackReceipt(b, u, targets, 'Skill_02', attackId);
        });
      }, onEnd: () => { u.mem.blitzOpened = false; } };
  } else if (id === UNDER) {
    kit.trait.windup = (_battle, unit) => model(unit).hits[unit.dir === 'DOWN' ? 'Attack_Down' : 'Attack'][0] / speed(unit, 1);
    kit.trait.attackVisual = (_battle, unit) => unit.dir === 'DOWN' ? 'Attack_Down' : 'Attack';
    kit.trait.launchAttack = (battle, unit, p, target, info) => directShot(battle, unit, p, target, info, 10);
    kit.trait.onEachHit = (_battle, _unit, target) => underPoison(b, u, target, def);
    if (n === 0) kit.skill = { kind: 'duration', duration: s.duration, mods: { atkPct: bb.atk, defPct: bb.def } };
    else { const prefix = u.dir === 'DOWN' ? 'Skill_Down_2_' : 'Skill_2_';
      kit.skill = { kind: 'duration', duration: s.duration, mods: { atkPct: bb.atk, aspd: bb.attack_speed },
        targeting: { rangeGrid: s.rangeGrid, maxTargets: bb['attack@max_target'] },
        attack: { attack: 'melee', launchAttack: null, projectile: 'none',
          attackVisual: `${prefix}Loop`, windup: (_battle, unit) => model(unit).hits[`${prefix}Loop`][0] / speed(unit, 1),
          acquireTargets: (_battle, unit, p) => selected(b, unit, unit.rangeKeys, p, bb['attack@max_target'], 'nearest'),
          onEachHit: ({ target }) => {
            if (target.alive) b.applyStatus(target, 'sluggish', { duration: bb['attack@sluggish'], source: u }); } },
        onStart: () => startForm(b, u, `${prefix}Begin`, `${prefix}Idle`),
        onEnd: ({ reason }) => endForm(b, u, `${prefix}End`, reason) };
    }
  } else if (id === ASH || id === FIRE) {
    const profile = (skill = 0) => ({ acquireTargets: (battle, unit, p) => fortressSelect(battle, unit, p, id === ASH && !!skill),
      attackVisual: (_battle, unit) => fortressClip(unit, id, skill),
      windup: (_battle, unit) => (id === ASH && skill && unit.dir === 'LEFT'
        ? evidence.originalModels[ASH].Front : model(unit)).hits[fortressClip(unit, id, skill)][0] / speed(unit, 1),
      launchAttack: fortressLaunch(id, skill, bb) });
    Object.assign(kit.trait, profile());
    if (id === ASH) kit.skill = { kind: 'duration', duration: s.duration, mods: {
      atkPct: bb.atk, ...(n === 1 ? { batPct: bb.base_attack_time, blockCntMul: 0 } : {}) },
      ...(n === 1 ? { attack: profile(1), onStart: () => {
        u.mem.regularAttackFacing = u.dir === 'LEFT' ? 'Front' : null;
        u.mem.regularFormVisual = { clip: u.dir === 'UP' ? 'Skill_Idle_Up' : u.dir === 'DOWN' ? 'Skill_Idle_Down' : 'Skill_Idle',
          loop: true, forceFront: u.dir === 'LEFT' }; },
        onEnd: () => { u.mem.regularFormVisual = null; u.mem.regularAttackFacing = null; } } : {}) };
    else if (n === 0) kit.skill = { kind: 'instant', attack: { ...profile(1), atkScale: bb.atk_scale } };
    else kit.skill = { kind: 'duration', duration: s.duration, attack: profile(2),
      onStart: () => startForm(b, u, 'Skill_2_Begin', 'Skill_2_Idle'),
      onEnd: ({ reason }) => endForm(b, u, 'Skill_2_End', reason) };
  } else if (n === 0) kit.skill = { kind: 'instant', charges: bb.cnt,
    canActivate: () => !u.mem.defenderFourthCast && selected(b, u, u.rangeKeys, { canHitFly: false }).length > 0,
    onStart: () => instantCast(b, u, 'Skill_1', Infinity, () => {
      const targets = selected(b, u, u.rangeKeys, { canHitFly: false });
      if (!targets.length) { u.skill.setSpTotal(u.skill.spTotal + u.skill.spCost); return; }
      const attackId = ++b._attackSeq;
      for (const e of targets) b.dealDamage(u, e, { amount: u.s.atk * bb.atk_scale, type: 'phys',
        isAttack: true, isSkill: true, attackId, applyWay: 'melee' });
      attackReceipt(b, u, targets, 'Skill_1', attackId);
    }) };
  else kit.skill = { kind: 'duration', duration: s.duration, manualCancel: true,
    attack: { attackVisual: 'Skill_2_Loop', windup: (_battle, unit) => model(unit).hits.Skill_2_Loop[0] / speed(unit, 1) },
    onStart: () => { u.mem.cementStacks = bb.cnt; mods(b, u, 'cement:stack-defense', { defPct: bb.def * bb.cnt });
      startForm(b, u, 'Skill_2_Begin', 'Skill_2_Idle'); },
    onEnd: ({ reason }) => { u.mem.cementStacks = 0; b.removeBuff(u, 'cement:stack-defense'); endForm(b, u, 'Skill_2_End', reason); } };
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installDefenderFourth({ battle: b, unit: u, def }) {
  const id = def.charId;
  if (!DEFENDER_FOURTH_OPERATORS[id]) return;
  if (id === BLITZ) {
    b.on('deploy', ({ unit }) => { if (unit === u) { u.mem.blitzUses = 0; u.mem.blitzOpened = false; } }, { owner: u });
    b.on('tick', () => { if (!live(u) || !u.canAct || !b.enemiesInKeys(u.rangeKeys, u, u.profile).length) u.mem.blitzOpened = false; }, { owner: u });
    b.on('hit', ({ source, target, dmg }) => {
      if (source === u && def.talents[0] && target.s.flags.stun && dmg.isAttack)
        dmg.amount *= def.talents[0].bb.atk_scale * (u.skill.active && u.skill.id === 'skchr_blitz_2' ? def.skill.bb.talent_scale : 1);
      const t = def.talents[1]?.bb;
      if (target !== u || !live(u) || !t || dmg.type !== 'phys' || dmg.tags?.includes('hpLoss')) return;
      const cells = absoluteRangeKeys([[0, -1], [1, 0], [-1, 0]], u.tileR, u.tileC, u.dir);
      if (cells.filter(k => b.grid.tile(Math.floor(k / b.grid.cols), k % b.grid.cols).height === 'HIGH').length >= t.cnt && b.rng() < t.prob)
        dmg.mul = 0;
    }, { owner: u });
  } else if (id === ASH) {
    const sync = () => { if (!live(u)) return; const t = def.talents[0]?.bb; if (!t) return;
      const cells = absoluteRangeKeys([[1, 0], [-1, 0], [0, 1], [0, -1]], u.tileR, u.tileC, u.dir);
      const allGround = cells.length === t.cnt && cells.every(k => b.grid.tile(Math.floor(k / b.grid.cols), k % b.grid.cols).height === 'LOW');
      mods(b, u, 'ashlock:tile-attack', { atkPct: allGround ? t['ashlok_t_1.atk'] : t.atk }); };
    b.on('deploy', sync, { owner: u }); b.on('tick', sync, { owner: u });
  } else if (id === FIRE) {
    const sync = () => { if (!live(u)) return; const t = def.talents[0]?.bb; if (!t) return;
      mods(b, u, 'firewhistle:block-talent', hasBlocks(u) ? { defPct: t.def } : { atkPct: t.atk }); };
    b.on('deploy', sync, { owner: u }); b.on('tick', sync, { owner: u });
    // Projectiles/fields are explicitly unmanaged by source. Do not attach the
    // field tick observer to owner cleanup, which would erase fired terrain.
    const pool = b._arkpediaFireFields ??= { fields: [] };
    if (!pool.observer) pool.observer = b.on('tick', () => syncFireFields(b));
  } else if (id === CEMENT) {
    const sync = () => { if (live(u)) mods(b, u, 'cement:unblocked-sp', null, hasBlocks(u) ? null : { noSp: true }); };
    b.on('deploy', sync, { owner: u }); b.on('tick', sync, { owner: u });
    b.on('spGain', ctx => { if (ctx.unit === u && ctx.reason !== 'init' && !hasBlocks(u)) ctx.amount = 0; }, { owner: u });
    const t = def.talents[0]?.bb;
    b.on('deploy', ({ unit }) => { if (unit !== u || !t) return;
      mods(b, u, 'cement:physical-resistance', { physTakenMul: 1 - t.damage_resistance });
      b.after(t.interval, () => { if (live(u)) mods(b, u, 'cement:physical-resistance',
        { physTakenMul: 1 - t.damage_resistance - t.damage_resistance_addtion }); }, { owner: u });
    }, { owner: u });
    b.on('damaged', ({ target, hpLoss }) => { if (target !== u || !(hpLoss > 0) || !u.skill.active || u.skill.id !== 'skchr_cement_2') return;
      u.mem.cementStacks = Math.max(0, (u.mem.cementStacks ?? 0) - 1);
      mods(b, u, 'cement:stack-defense', { defPct: def.skill.bb.def * u.mem.cementStacks });
    }, { owner: u });
  }
}
