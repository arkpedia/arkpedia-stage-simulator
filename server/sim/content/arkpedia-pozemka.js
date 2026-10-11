// SPDX-License-Identifier: GPL-3.0-or-later
// Complete original graphs: arkpedia-pozemka-prefabs.json. Begin/reset,
// S2 receipt dispatch and token attachment are bounded runtime mappings.
import evidence from '../../../data/arkpedia-pozemka-prefabs.json' with { type: 'json' };
import { canTargetEnemy, sortEnemyTargets, absoluteRangeKeys } from '../targeting.js';
import { bodyInKeys } from '../body.js';
const ID = 'char_4055_bgsnow', TOKEN = 'token_10026_bgsnow_subbow';
const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const model = u => evidence.models[u.defId][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const event = (u, name) => model(u).eventPayloads[name].find(e => e.name === 'OnAttack').time;
const rate = (u, cap = 1) => Math.min(cap, u.s.aspd / 100);
const own = (b, u) => b.allyUnits.filter(t => t.ownerUnit === u && t.defId === TOKEN && live(t));
const mode = u => u.defId === TOKEN ? u.mem.pozemkaMode ?? 0
  : u.skill.active ? Number(u.skill.id.at(-1)) : 0;
const down = (u, name) => u.dir === 'DOWN' && model(u).durations[`${name}_Down`] != null ? `${name}_Down` : name;
const grid = id => evidence.tables.ranges[id].grids.map(p => [p.row, p.col]);
function candidates(b, u, keys = u.rangeKeySet) {
  return sortEnemyTargets(b, u, b.enemies.filter(e => canTargetEnemy(u, e, { canHitFly: true })
    && bodyInKeys(e, keys)), 'nearest');
}
function flight(b, u, target, { attackId = 0, triple = false, scale = 1, skill = mode(u) !== 0 } = {}) {
  if (!canTargetEnemy(u, target, { canHitFly: true })) return;
  const token = u.defId === TOKEN;
  b.addProjectile({ from: u, source: u, target, speed: 10, maxAge: 10, visual: 'arrow',
    data: { arkpediaTrackedVisual: true, pozemka: triple ? 's2' : 'attack' },
    onHit: ({ target: e }) => {
      if (!canTargetEnemy(u, e, { canHitFly: true })) return;
      // One native projectile/event. Default attack and two referenced BUFF
      // executions each receive mitigation; extras are not another basic attack.
      for (let i = 0; i < (triple ? 3 : 1) && live(e); i++)
        b.dealDamage(u, e, { amount: u.s.atk * u.s.atkScaleMul * scale,
          type: 'phys', isAttack: i === 0, isSkill: skill, isProjectile: true,
          applyWay: 'ranged', attackId, tags: ['pozemka:shot',
            ...(triple ? ['pozemka:s2', ...(i ? ['pozemka:extra'] : [])] : []),
            ...(token ? ['pozemka:token'] : [])] });
    } });
}
function transition(b, u, clip, next) {
  const generation = u.mem.pozemkaForm = (u.mem.pozemkaForm ?? 0) + 1;
  const duration = model(u).durations[clip] / rate(u);
  u.mem.pozemkaTransition = true;
  u.mem.regularFormVisual = { clip, loop: false, speed: rate(u) };
  b.after(duration, () => {
    if (!live(u) || generation !== u.mem.pozemkaForm) return;
    u.mem.pozemkaTransition = false;
    u.mem.regularFormVisual = next ? { clip: next, loop: true } : null;
  }, { owner: u });
}
function synchronize(b, u) {
  const m = mode(u);
  for (const t of own(b, u)) {
    const wanted = m === 1 || m === 3 ? m : 0;
    if (t.mem.pozemkaMode === wanted) continue;
    t.mem.pozemkaMode = wanted; t.mem.pozemkaForm = (t.mem.pozemkaForm ?? 0) + 1;
    b.removeBuff(t, 'pozemka:token-skill');
    if (wanted === 1) b.addBuff(t, { key: 'pozemka:token-skill', source: t,
      mods: { atkPct: t.def.skill.bb.atk } });
    if (wanted === 3) b.addBuff(t, { key: 'pozemka:token-skill', source: t,
      mods: { batFlat: t.def.skill.bb.base_attack_time } });
    t.rangeGrid = wanted === 3 ? t.def.skill.rangeGrid : t.def.rangeGrid;
    b.refreshRange(t); t.atkCd = 0;
  }
}
function finishCast(b, u, cast, reason) {
  if (u.mem.pozemkaCast !== cast) return;
  u.mem.pozemkaCast = null; cast.watch?.cancel(); cast.release?.cancel();
  b.removeBuff(u, 'pozemka:cast');
  u.mem.regularFormVisual = u.defId === TOKEN ? { clip: down(u, 'Idle'), loop: true, die: 'Idle' } : null;
  if (u.defId === ID) u.skill.end(reason);
  u.atkCd = 0; u.mem.pozemkaEngaged = false;
}
function castSecond(b, u, target) {
  if (!live(u) || !target || !u.canAct || u.s.flags.disarm || u.mem.pozemkaCast) return;
  const token = u.defId === TOKEN, clip = down(u, token ? 'Attack' : 'Skill_2');
  if (!token) u.skill.pending = true;
  b.addBuff(u, { key: 'pozemka:cast', flags: { disarm: true, noSp: true } });
  const cast = { seq: u.deploySeq, epoch: u.attackControlEpoch, emitted: false };
  u.mem.pozemkaCast = cast;
  u.mem.regularFormVisual = { clip, loop: false, speed: rate(u), ...(token ? { die: 'Idle' } : {}) };
  const valid = () => live(u) && u.deploySeq === cast.seq && u.canAct
    && u.attackControlEpoch === cast.epoch;
  cast.watch = b.every(b.dt, () => {
    if (u.mem.pozemkaCast !== cast) { cast.watch.cancel(); return; }
    if (!valid()) finishCast(b, u, cast, 'cast-interrupted');
  }, { owner: u });
  cast.release = b.after(event(u, clip) / rate(u), () => {
    if (u.mem.pozemkaCast !== cast || !valid()) return;
    cast.emitted = true;
    flight(b, u, target, { triple: true, scale: u.def.skill.bb.atk_scale,
      skill: true, attackId: ++b._attackSeq });
  }, { owner: u });
  b.after(model(u).durations[clip] / rate(u), () => finishCast(b, u, cast, 'cast-finished'), { owner: u });
}
function profile() {
  return { attack: 'ranged', dmgType: 'phys', projectile: 'none', canHitFly: true,
    maxTargets: 1, hits: 1, allInRange: false, retargetOnRelease: false,
    interruptOnSkillChange: true, attackEpoch: (_b, u) => u.mem.pozemkaForm ?? 0,
    canAttack: (_b, u) => !u.mem.pozemkaTransition && !u.mem.pozemkaCast
      && (u.defId !== TOKEN || u.mem.pozemkaBorn),
    windup: (_b, u) => {
      const m = mode(u), token = u.defId === TOKEN;
      const name = token ? down(u, 'Attack') : m ? `Skill_${m}_Loop` : 'Attack_Loop';
      const speed = rate(u, token || m ? 1 : Infinity);
      u.mem.pozemkaAttackBegin = !token && !m && !u.mem.pozemkaEngaged;
      u.mem.pozemkaEngaged = true;
      return ((u.mem.pozemkaAttackBegin ? model(u).durations.Attack_Begin : 0) + event(u, name)) / speed;
    },
    attackVisual: (_b, u) => {
      if (u.defId === TOKEN) return down(u, 'Attack');
      const m = mode(u);
      return m ? `Skill_${m}_Loop` : u.mem.pozemkaAttackBegin
        ? { begin: 'Attack_Begin', loop: 'Attack_Loop', beginDuration: model(u).durations.Attack_Begin / rate(u, Infinity) }
        : 'Attack_Loop';
    },
    acquireTargets: (b, u) => candidates(b, u).slice(0, 1),
    launchAttack: (b, u, _p, e, info) => flight(b, u, e, info),
  };
}
export function customizePozemkaKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.trait = profile();
  const s = def.skill, m = Number(s.id.at(-1));
  if (m === 1) kit.skill = { kind: 'toggle', mods: { atkPct: s.bb.atk },
    onStart: () => { transition(b, u, 'Skill_1_Begin', 'Skill_1_Idle'); synchronize(b, u); },
    onEnd: () => { synchronize(b, u); u.mem.pozemkaForm++; u.mem.pozemkaTransition = false; u.mem.regularFormVisual = null; } };
  else if (m === 2) kit.skill = { kind: 'instant', flags: { noSp: true }, attack: { noAttack: true },
    canActivate: () => live(u) && !u.mem.pozemkaCast && !u.skill.active
      && !u.mem.pozemkaTransition && u.canAct && !u.s.flags.disarm
      && candidates(b, u, new Set(absoluteRangeKeys(s.rangeGrid, u.tileR, u.tileC, u.dir))).length > 0,
    onStart: () => {
      castSecond(b, u, candidates(b, u, new Set(absoluteRangeKeys(s.rangeGrid, u.tileR, u.tileC, u.dir)))[0]);
      for (const t of own(b, u)) castSecond(b, t, candidates(b, t)[0]);
    }, onEnd: () => { const c = u.mem.pozemkaCast; if (c) finishCast(b, u, c, 'skill-ended'); } };
  else kit.skill = { kind: 'duration', duration: s.duration, mods: { batFlat: s.bb.base_attack_time },
    targeting: { rangeGrid: s.rangeGrid },
    onStart: () => { transition(b, u, 'Skill_3_Begin', 'Skill_3_Idle'); synchronize(b, u); },
    onEnd: ({ reason }) => { synchronize(b, u); u.mem.pozemkaEngaged = false;
      if (live(u) && reason !== 'death') transition(b, u, 'Skill_3_End', null);
      else { u.mem.pozemkaForm++; u.mem.pozemkaTransition = false; u.mem.regularFormVisual = null; } } };
  Object.assign(kit.skill, { id: s.id, name: s.name });
}
function installDamage(b, u) {
  b.on('outputDamage', ({ source, target: e, dmg }) => {
    if (source !== u || !dmg.tags.includes('pozemka:shot') || dmg.type !== 'phys') return;
    const token = u.defId === TOKEN, m = mode(u), bb = u.def.skill.bb;
    if (!dmg.tags.includes('pozemka:s2')) {
      if (m === 1 && b.rng() < bb.prob) dmg.amount *= bb.atk_scale;
      if (m === 3) {
        const focus = token || bodyInKeys(e, new Set(absoluteRangeKeys(grid('5-1'), u.tileR, u.tileC, u.dir)));
        dmg.amount *= token ? bb['attack@atk_scale'] : focus ? bb['bgsnow_s_3[atk_up].atk_scale'] : bb.atk_scale;
      }
    }
    const talent = token && u.def.talents[1]?.bb;
    // Extra token BUFF receipts explicitly disable source calculation events.
    if (talent && !dmg.tags.includes('pozemka:extra')) {
      const host = u.ownerUnit, adjacent = live(host)
        && Math.abs(host.tileR - u.tileR) + Math.abs(host.tileC - u.tileC) <= 1;
      const k = `bgsnow_token[def_down]_${adjacent ? 2 : 1}`;
      const value = 1 + talent[`${k}.def`], old = e.findBuff(k);
      if (old && old.mods.defMul < value) old.timeLeft = Math.max(old.timeLeft, talent.duration);
      else b.addBuff(e, { key: k, source: u, duration: talent.duration,
        mods: { defMul: value }, tags: ['pozemka:def-priority'] });
    }
  }, { owner: u });
}
export function installPozemka({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  installDamage(b, u);
  b.on('tick', () => {
    if (!live(u)) return;
    if (!candidates(b, u).length) u.mem.pozemkaEngaged = false;
    synchronize(b, u);
  }, { owner: u });
  b.on('death', ({ unit }) => { if (unit === u) {
    const c = u.mem.pozemkaCast; if (c) finishCast(b, u, c, 'death');
    u.mem.pozemkaForm++; u.mem.pozemkaTransition = false; u.mem.regularFormVisual = null;
  } }, { owner: u });
}
export function createTypewriter(b, state, row, col, dir) {
  const owner = state.owner, r = state.record;
  if (r.id !== TOKEN || Number(r.skill?.skillId.at(-1)) !== Number(owner.def.skill.id.at(-1)))
    throw Error('Typewriter does not match the selected owner skill');
  const kit = { trait: profile(), skill: null, install: (battle, t) => {
    t.kind = 'device'; t.deploymentSlotCost = 0;
    // Native category2/cardPolicy1 maps to an independent untargetable device.
    // No visible SP/control is inferred from the hidden token wrappers.
    battle.addBuff(t, { key: 'pozemka:typewriter', persist: true, allowDead: true,
      flags: { invulnerable: true, untargetable: true, noSp: true, healFree: true } });
    t.mem.noInspire = true; installDamage(battle, t);
    battle.on('deploy', ({ unit }) => { if (unit !== t) return;
      t.mem.pozemkaBorn = false;
      t.mem.regularFormVisual = { clip: down(t, 'Start'), loop: false, die: 'Idle' };
      synchronize(battle, owner);
      battle.after(model(t).durations[down(t, 'Start')], () => { if (!live(t)) return;
        t.mem.pozemkaBorn = true;
        t.mem.regularFormVisual = { clip: down(t, 'Idle'), loop: true, die: 'Idle' };
      }, { owner: t });
      battle.after(r.talents[0].bb.interval, () => { if (live(t))
        battle.retreat(t, { permanent: true, reason: 'typewriter-expired' });
      }, { owner: t });
    }, { owner: t });
    battle.on('death', ({ unit }) => { if (unit !== t) return;
      const c = t.mem.pozemkaCast; if (c) finishCast(battle, t, c, 'death');
      state.stock = Math.min(1, state.stock + 1);
      const ratio = owner.def.skill.id === 'skchr_bgsnow_2' ? r.skill.bb.respawn_time : 1;
      state.readyAt = battle.time + r.stats.respawnTime * ratio;
    }, { owner: t });
  } };
  return b.spawnToken(owner, TOKEN, row, col, { dir, def: r, kit });
}
