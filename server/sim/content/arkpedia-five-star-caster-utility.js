// SPDX-License-Identifier: GPL-3.0-or-later
import { FIVE_STAR_CASTER_UTILITY_OPERATORS } from '../../../shared/arkpedia/five-star-caster-utility-operators.js';
import evidence from '../../../data/arkpedia-five-star-caster-utility-prefabs.json' with { type: 'json' };
import { acquireTargets, effectiveProfile, resolveHit } from '../ai.js';
import { absoluteRangeKeys, canTargetAlly, canTargetEnemy, tileKeyOf } from '../targeting.js';
import { COLS } from '../constants.js';

const ABS = 'char_405_absin', NIG = 'char_164_nightm', QAN = 'char_466_qanik';
const SAN = 'char_341_sntlla', DEL = 'char_4110_delphn';
const live = u => u?.alive && u.deployed;
const plain = p => ({ ...p, hits: 1, hitsFn: null, splashRadius: 0, chain: null, dmgMul: null });
const model = u => evidence.models[u.def.charId].Front;
const timed = (clip, cap = Infinity) => (_b, u) => model(u).hits[clip][0] / Math.min(cap, u.s.aspd / 100);
const form = (u, clip, loop = false) => { u.mem.regularFormVisual = { clip, loop }; };
function entrance(b, u, clip, loop) {
  const seq = u.deploySeq, activation = u.skill.activations, duration = model(u).durations[clip];
  form(u, clip); b.addBuff(u, { key: 'utility:entrance', duration, flags: { disarm: true } });
  b.after(duration, () => {
    if (live(u) && u.deploySeq === seq && u.skill.active && u.skill.activations === activation) form(u, loop, true);
  }, { owner: u });
}
function endForm(b, u, clip) {
  if (!live(u)) return;
  form(u, clip); const seq = u.deploySeq;
  b.after(model(u).durations[clip], () => {
    if (live(u) && u.deploySeq === seq && !u.skill.active) u.mem.regularFormVisual = null;
  }, { owner: u });
}
function fly(b, u, target, p, info, speed, extra = null) {
  return b.addProjectile({ from: u, target, source: u, speed,
    visual: p.projectile || 'bolt', data: { arkpediaTrackedVisual: true },
    onHit: ({ target, x, y }) => {
      if (!target || !canTargetEnemy(u, target, p)) return;
      resolveHit(b, u, p, target, info, x, y); extra?.(target);
    } });
}
function absintheLaunch(b, u, p, target, info) {
  const hit = { ...plain(p), canTarget: null };
  if (!p.isSkill || u.skill.id.endsWith('_1')) { fly(b, u, target, hit, info, 15); return; }
  const seq = u.deploySeq, activation = u.skill.activations;
  const count = u.skill.bb['attack@times'];
  const valid = () => live(u) && u.deploySeq === seq && u.canAct && !u.s.flags.disarm
    && u.skill.active && u.skill.activations === activation;
  let cancelled = false;
  const watch = b.every(b.dt, () => { if (!valid()) cancelled = true; }, { owner: u });
  for (let n = 0; n < count; n++) {
    const shot = () => {
      if (!valid()) cancelled = true;
      if (!cancelled) fly(b, u, target, hit, info, 15);
      if (n === count - 1) watch.cancel();
    };
    if (n === 0) shot(); else b.after(n * .05, shot, { owner: u });
  }
}
function nightmareLaunch(b, u, p, target, info) {
  let dealt = 0;
  resolveHit(b, u, { ...plain(p), afterHit: (_b, _u, _t, ctx) => { dealt = ctx.dealt; } }, target, info, target.x, target.y);
  if (!p.isSkill || !u.skill.id.endsWith('_1') || !(dealt > 0)) return;
  const allies = b.injuredAlliesInKeys(u.rangeKeys, u).filter(a => b.allySelectable(a, u)
    && canTargetAlly(u, a, false) && !a.s.flags.healFree);
  for (const ally of allies.slice(0, u.skill.bb['attack@max_target'])) {
    const amount = dealt * u.skill.bb['attack@heal_scale'];
    b.addProjectile({ from: u, target: ally, source: u, speed: 5, visual: 'heal',
      data: { arkpediaTrackedVisual: true }, onHit: ({ target }) => {
        if (target && b.allySelectable(target, u) && canTargetAlly(u, target, false)) b.heal(u, target, amount);
      } });
  }
}
function nightmareRupture(b, u, target, bb) {
  const key = `nightmare:rupture:${u.id}`, old = target.findBuff(key);
  // Reapplying the same Nightmare updates its duration without treating the
  // pre-existing path segment as a second copy of damage.
  if (old) { old.timeLeft = Math.max(old.timeLeft, bb.duration); return; }
  let x = target.x, y = target.y, acc = 0, stopped = false;
  const flush = () => {
    const distance = Math.hypot(target.x - x, target.y - y); x = target.x; y = target.y;
    if (live(target) && distance > 0) b.dealDamage(u, target, { amount: bb.value * distance,
      type: 'true', isSkill: true, tags: ['dot', 'nightmare:rupture'], applyWay: 'none', ignoreSelect: true });
  };
  const stop = () => { if (stopped) return; stopped = true; flush(); b.off(timer); };
  const buff = b.addBuff(target, { key, source: u, duration: bb.duration, mods: { moveMul: 1 + bb.move_speed },
    onExpire: stop, onRemove: stop });
  if (!buff) return;
  const timer = b.on('tick', ({ dt }) => {
    if (!target.findBuff(key)) { stop(); return; }
    acc += dt; if (acc + 1e-9 >= bb.interval) { acc %= bb.interval; flush(); }
  }, { owner: target });
}
function nightmareCast(b, u, s) {
  const seq = u.deploySeq, delay = model(u).hits.Attack[0] / Math.min(1, u.s.aspd / 100);
  const total = model(u).durations.Attack / Math.min(1, u.s.aspd / 100);
  u.mem.utilityCastUntil = b.time + total;
  b.addBuff(u, { key: 'nightmare:cast', duration: total, flags: { disarm: true, noSp: true } });
  form(u, 'Attack');
  const targets = acquireTargets(b, u, { ...u.profile, maxTargets: s.bb.max_target });
  const valid = () => live(u) && u.deploySeq === seq && u.canAct;
  let cancelled = false;
  const watch = b.every(b.dt, () => { if (!valid()) cancelled = true; }, { owner: u });
  b.after(delay, () => {
    watch.cancel();
    if (cancelled || !valid()) return;
    for (const t of targets) if (canTargetEnemy(u, t, { canHitFly: true })) nightmareRupture(b, u, t, s.bb);
  }, { owner: u });
  b.after(total, () => { if (live(u) && u.deploySeq === seq) u.mem.regularFormVisual = null; }, { owner: u });
  u.skill.end('instant');
}
function syncQanipalaat(b, u) {
  const key = `qanipalaat:fragile:${u.id}`, talent = u.def.talents[0]?.bb;
  const eligible = new Set(live(u) && talent
    ? b.enemiesInKeys(u.rangeKeys, u, { canHitFly: true }).filter(e => e.isFlying) : []);
  for (const e of b.enemies) {
    if (!eligible.has(e)) b.removeBuff(e, key);
    else if (!e.findBuff(key)) b.applyStatus(e, 'artsFragile', {
      key, source: u, duration: Infinity, value: talent.damage_scale - 1 });
  }
}
function qanikLink(b, u, target, bb, state) {
  const key = `qanipalaat:link:${u.id}`, levKey = `qanipalaat:levitate:${u.id}`;
  let stopped = false, exploded = false, deathHook = null;
  const explode = () => {
    if (exploded) return; exploded = true;
    // Original finish action explicitly does not require the host to be alive.
    for (const e of b.enemiesInRadius(target.x, target.y, .8))
      if (canTargetEnemy(u, e, { canHitFly: true })) b.dealDamage(u, e, {
        amount: u.s.atk * bb.critical_damage_scale, type: 'arts', isAttack: true,
        isSkill: true, applyWay: 'ranged', tags: ['qanipalaat:finish'] });
  };
  const stop = () => {
    if (stopped) return; stopped = true; if (deathHook) b.off(deathHook); state.links.delete(buff);
    b.removeBuff(target, levKey);
  };
  const buff = b.addBuff(target, { key, source: u, duration: 7, interval: bb.interval,
    onTick: () => {
      if (live(target)) b.dealDamage(u, target, { amount: u.s.atk * bb.trigger_atk_scale,
        type: 'arts', isAttack: true, isSkill: true, applyWay: 'ranged', tags: ['qanipalaat:periodic'] });
    }, onExpire: stop, onRemove: stop });
  if (!buff) return;
  state.links.add(buff);
  deathHook = b.on('death', ({ unit }) => { if (unit === target) b.removeBuff(target, key); }, { owner: target });
  if (!target.s.flags.levitate && b.applyStatus(target, 'levitate', { key: levKey,
    source: u, duration: bb.levitate_duration })) {
    const lev = target.findBuff(levKey); lev.onExpire = explode; lev.onRemove = explode;
  }
}
function qanikCast(b, u, s) {
  const targets = acquireTargets(b, u, { ...u.profile, canHitFly: false, maxTargets: s.bb.max_target });
  const state = u.mem.qanikCast = { flying: [], links: new Set(), finishAt: null };
  entrance(b, u, 'Skill_Begin', 'Skill_Loop');
  for (const target of targets) {
    const projectile = b.addProjectile({ from: u, target, source: u, speed: 100, visual: 'orb',
      data: { arkpediaTrackedVisual: true }, onHit: ({ target }) => {
        if (target && canTargetEnemy(u, target, { canHitFly: true })) qanikLink(b, u, target, s.bb, state);
      } });
    state.flying.push(projectile);
  }
}
function qanikTick(b, u, dt) {
  const state = u.mem.qanikCast; if (!state) return;
  state.flying = state.flying.filter(p => b.projectiles.list.includes(p));
  if (state.flying.length || state.links.size) {
    // The original cast ends on projectile invalidation, rather than after a
    // guessed source-to-target travel distance.
    u.skill.timeLeft = Math.max(u.skill.timeLeft, .933 + dt); return;
  }
  if (state.finishAt === null) { state.finishAt = b.time + .933; form(u, 'Skill_End'); }
  u.skill.timeLeft = Math.max(0, state.finishAt - b.time + dt);
}
function santallaArea(b, u, p, target, info) {
  for (const e of b.enemiesInRadius(target.x, target.y, 1.1))
    if (canTargetEnemy(u, e, p)) resolveHit(b, u, plain(p), e, info, e.x, e.y);
}
function santallaIcicle(b, u, p, _target, info) {
  const column = [0, -1, 1][b.rng.int(3)];
  const keys = absoluteRangeKeys(Array.from({ length: 4 }, (_, col) => [column, col]), u.tileR, u.tileC, u.dir)
    .filter(key => b.grid.inRect(Math.floor(key / COLS), key % COLS));
  const key = b.rng.pick(keys); if (key == null) return;
  const point = { x: key % COLS, y: Math.floor(key / COLS) };
  b.addProjectile({ from: point, to: point, flightTime: .6, source: u,
    visual: 'orb', data: { arkpediaTrackedVisual: true }, onHit: () => {
      const hit = { ...plain(p), canHitFly: true };
      for (const e of b.enemiesInRadius(point.x, point.y, 1.5)) if (canTargetEnemy(u, e, hit)) {
        resolveHit(b, u, hit, e, info, e.x, e.y);
        if (e.alive) b.applyStatus(e, 'cold', { source: u, duration: u.skill.bb['attack@cold'] });
      }
    } });
}
function delphineDot(b, u, target) {
  if (!u.skill.active || !u.skill.id.endsWith('_2') || !live(target)) return;
  const bb = u.skill.bb, key = `delphine:dot:${u.id}`;
  const existing = target.findBuff(key);
  if (existing) { existing.data.scale = Math.min(bb.max_cnt, existing.data.scale + bb.damage_addition); return; }
  let countdown = .15, stopped = false;
  const stop = () => { if (stopped) return; stopped = true; b.off(timer); };
  const buff = b.addBuff(target, { key, source: u, data: { scale: bb.damage_addition },
    onRemove: stop });
  const seq = u.deploySeq, activation = u.skill.activations;
  const timer = b.on('tick', ({ dt }) => {
    if (!live(u) || u.deploySeq !== seq || !u.skill.active || u.skill.activations !== activation) {
      b.removeBuff(target, key); return;
    }
    countdown -= dt;
    if (countdown <= 1e-9 && live(target)) {
      countdown += 1;
      b.dealDamage(u, target, { amount: u.s.atk * buff.data.scale, type: 'arts', isSkill: true,
        tags: ['dot', 'delphine:dot'], applyWay: 'none', ignoreSelect: true });
    }
  }, { owner: target });
}
function delphineLaunch(b, u, p, target, info) {
  const hit = { ...plain(p), canTarget: null }, stored = u.trait.stored;
  u.trait.stored = 0; u.trait.storeAcc = 0;
  const extra = target.tags?.has('sarkaz') ? u.trait.extraStored : 0;
  if (extra) u.trait.extraStored = 0;
  // Unlike Iris, Delphine explicitly detaches/attaches the shared Charge
  // ability and refreshes its blackboard in the active mode.
  for (let n = 0; n < 1 + stored + extra; n++) fly(b, u, target, hit, info, 10,
    p.isSkill && u.skill.id.endsWith('_2') ? t => delphineDot(b, u, t) : null);
}

export function customizeFiveStarCasterUtilityKit({ battle: b, unit: u, id, def, kit }) {
  if (!FIVE_STAR_CASTER_UTILITY_OPERATORS[id] || !def.skill) return;
  kit.install = null; const s = def.skill, bb = s.bb, first = s.id.endsWith('_1') || s.id === 'skcom_quickattack[3]';
  const duration = mods => ({ id: s.id, name: s.name, kind: 'duration', duration: s.duration, mods });
  kit.trait = { attack: 'ranged', dmgType: 'arts', projectile: 'bolt', canHitFly: true,
    hits: 1, hitsFn: null, dmgMul: null, splashRadius: 0, chain: null, maxTargets: 1,
    allInRange: false, install: null, attackVisual: 'Attack', interruptOnSkillChange: true };
  if (id === ABS) {
    Object.assign(kit.trait, { launchAttack: absintheLaunch,
      attackVisual: 'Attack_Loop', windup: (_b, u) => (.6 + (u.mem.absintheStarted ? 0 : .167)) / (u.s.aspd / 100) });
    kit.skill = first ? { id: s.id, name: s.name, kind: 'toggle', trigger: 'SP_FULL', mods: { atkPct: bb.atk },
      targeting: { priority: 'lowestHpRatio' } }
      : { ...duration({}), attack: { atkScale: bb['attack@atk_scale'], canTarget: (_u, e) => e.hpRatio <= .5,
        attackVisual: 'Skill_Loop', windup: timed('Skill_Loop', 1) },
      onStart: ({ battle, unit }) => entrance(battle, unit, 'Skill_Begin', 'Skill_Idle'),
      onEnd: ({ battle, unit }) => endForm(battle, unit, 'Skill_End') };
  } else if (id === NIG) {
    Object.assign(kit.trait, { projectile: 'none', launchAttack: nightmareLaunch, windup: timed('Attack', 1) });
    kit.skill = first ? { ...duration({}), attack: {} }
      : { id: s.id, name: s.name, kind: 'instant', onStart: ({ battle, unit }) => nightmareCast(battle, unit, s) };
  } else if (id === QAN) {
    Object.assign(kit.trait, { launchAttack: (b, u, p, t, info) => fly(b, u, t, plain(p), info, 10), windup: timed('Attack') });
    kit.skill = first ? { ...duration({ aspd: bb.attack_speed }), targeting: { priority: 'fly' } }
      : { ...duration({}), attack: { noAttack: true },
        onStart: ({ battle, unit }) => qanikCast(battle, unit, s),
        onTick: ({ battle, unit, dt }) => qanikTick(battle, unit, dt),
        onEnd: ({ unit }) => { unit.mem.qanikCast = null; unit.mem.regularFormVisual = null; } };
  } else if (id === SAN) {
    Object.assign(kit.trait, { projectile: 'none', splashRadius: 1.1, launchAttack: santallaArea,
      retargetOnRelease: true, windup: timed('Attack', 1) });
    kit.skill = first ? duration({ atkPct: bb.atk, aspd: bb.attack_speed })
      : { ...duration({ batFlat: bb.base_attack_time }), targeting: { rangeGrid: s.rangeGrid, canHitFly: false },
        attack: { launchAttack: santallaIcicle, splashRadius: 0, atkScale: bb['attack@atk_scale'],
          retargetOnRelease: false, windup: 0, attackVisual: 'none' },
        onStart: ({ battle, unit }) => entrance(battle, unit, 'Skill_Begin', 'Skill_Loop'),
        onEnd: ({ battle, unit }) => endForm(battle, unit, 'Skill_End') };
  } else {
    Object.assign(kit.trait, { launchAttack: delphineLaunch,
      windup: timed('Attack', 1), attackVisual: (_b, u) => u.trait.stored ? 'Charge' : 'Attack' });
    kit.skill = first ? { ...duration({ batMul: bb.base_attack_time }), targeting: { rangeGrid: s.rangeGrid },
      attack: { atkScale: bb['attack@atk_scale'], windup: (_b, u) => .533 / Math.max(u.s.aspd / 100, 1.667 / u.s.interval) },
      onStart: ({ unit }) => form(unit, 'Skill_1_Loop', true),
      onEnd: ({ battle, unit }) => endForm(battle, unit, 'Skill_1_End') }
      : { ...duration({ atkPct: bb.atk }), attack: { canTarget: (_u, e) => e.hpRatio >= .5,
        attackVisual: (_b, u) => u.trait.stored ? 'Skill_2_Charge' : 'Skill_2_Loop', windup: timed('Skill_2_Loop', 1) },
      onStart: ({ battle, unit }) => entrance(battle, unit, 'Skill_2_Begin', 'Skill_2_Idle'),
      onEnd: ({ battle, unit }) => {
        for (const e of battle.enemies) battle.removeBuff(e, `delphine:dot:${unit.id}`);
        endForm(battle, unit, 'Skill_2_End');
      } };
  }
  kit.skill.canActivate = () => u.canAct && !u.s.flags.silence && !(u.mem.utilityCastUntil > b.time + 1e-9);
}
export function installFiveStarCasterUtility({ battle: b, unit: u, def }) {
  if (!FIVE_STAR_CASTER_UTILITY_OPERATORS[def.charId]) return;
  const id = def.charId, talent = def.talents[0]?.bb;
  if (id === ABS) {
    u.mem.absintheStarted = false;
    b.on('attack', ({ attacker }) => { if (attacker === u) u.mem.absintheStarted = true; }, { owner: u });
    b.on('tick', () => { if (!acquireTargets(b, u, effectiveProfile(u)).length) u.mem.absintheStarted = false; }, { owner: u });
    if (talent) b.on('hit', ({ source, target, dmg }) => {
      if (source === u && target.hpRatio < talent.hp_ratio) dmg.mul *= talent.damage_scale;
    }, { owner: u });
  } else if (id === NIG && talent) b.on('deploy', ({ unit }) => {
    if (unit === u) b.addBuff(u, { key: 'nightmare:talent', source: u,
      mods: def.skill.id.endsWith('_1') ? { dodgePhys: talent.prob, dodgeArts: talent.prob } : { atkPct: talent.atk } });
  }, { owner: u });
  else if (id === QAN) {
    b.every(.1, () => syncQanipalaat(b, u), { owner: u, immediate: true });
    b.on('death', ({ unit }) => { if (unit === u) {
      for (const e of b.enemies) b.removeBuff(e, `qanipalaat:fragile:${u.id}`);
    } }, { owner: u });
  } else if (id === SAN && talent) b.on('deploy', ({ unit }) => {
    if (unit !== u) return;
    const seq = u.deploySeq;
    b.after(talent.interval, () => {
      if (!live(u) || u.deploySeq !== seq) return;
      b.addBuff(u, { key: 'santalla:talent', source: u, mods: { atkPct: talent.atk } });
      b.applyStatus(u, 'resist', { key: `santalla:resist:${u.id}`, source: u, duration: Infinity,
        value: -talent.one_minus_status_resistance });
    }, { owner: u });
  }, { owner: u });
  else if (id === DEL) {
    u.trait.stored = 0; u.trait.extraStored = 0; u.trait.storeAcc = 0;
    const chapter = def.talents[1]?.bb && b.mapTags.includes('main_13');
    b.on('tick', ({ dt }) => {
      if (!u.canAct || u.s.flags.disarm) return;
      if (acquireTargets(b, u, effectiveProfile(u)).length) { u.trait.storeAcc = 0; return; }
      const max = def.traitBb.times + (chapter ? def.talents[1].bb.times_2 : 0);
      if (u.trait.stored + u.trait.extraStored >= max) return;
      u.trait.storeAcc += dt;
      if (u.trait.storeAcc + 1e-9 >= u.s.interval) {
        u.trait.storeAcc -= u.s.interval;
        if (u.trait.stored < def.traitBb.times) u.trait.stored++; else u.trait.extraStored++;
      }
    }, { owner: u });
    b.on('hit', ({ source, target, dmg }) => {
      if (source !== u) return;
      if (talent && dmg.isAttack && target.hpRatio > talent.hp_ratio) dmg.mul *= talent.damage_scale;
      if (chapter && target.tags?.has('sarkaz')) dmg.amount *= def.talents[1].bb.atk_scale;
    }, { owner: u });
  }
}
