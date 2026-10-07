// SPDX-License-Identifier: GPL-3.0-or-later
import { FIVE_STAR_DEFENDER_OPERATORS } from '../../../shared/arkpedia/five-star-defender-operators.js';
import evidence from '../../../data/arkpedia-five-star-defender-prefabs.json' with { type: 'json' };
import { absoluteRangeKeys, canTargetEnemy } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { resolveHit } from '../ai.js';

const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[u.defId][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const rate = (u, cap = 1) => Math.min(cap, u.s.aspd / 100);
const timing = (clip, cap = 1) => (_b, u) => model(u).hits[clip][0] / rate(u, cap);
const grid = key => evidence.rangeTable[key].grids.map(p => [p.row, p.col]);
const keys = (u, key) => new Set(absoluteRangeKeys(grid(key), u.tileR, u.tileC, u.dir));
const ally = (b, a, u) => live(a) && a.kind !== 'device' && b.allySelectable(a, u);
function mods(b, a, key, value, source) {
  const old = a.findBuff(key);
  if (!value) b.removeBuff(a, key);
  else if (!old || old.source !== source || JSON.stringify(old.mods) !== JSON.stringify(value))
    b.addBuff(a, { key, source, mods: value });
}
function form(b, u, begin, loop, end) {
  const seq = u.deploySeq, activation = u.skill.activations;
  u.mem.regularFormVisual = { clip: begin, loop: false };
  b.addBuff(u, { key: 'defender:begin', source: u, duration: model(u).durations[begin], flags: { disarm: true } });
  b.after(model(u).durations[begin], () => {
    if (live(u) && u.deploySeq === seq && u.skill.active && u.skill.activations === activation)
      u.mem.regularFormVisual = { clip: loop, loop: true };
  }, { owner: u });
  return ({ reason } = {}) => {
    b.removeBuff(u, 'defender:begin');
    if (reason === 'death' || !live(u)) { u.mem.regularFormVisual = null; return; }
    u.mem.regularFormVisual = { clip: end, loop: false };
    b.addBuff(u, { key: 'defender:end', source: u, duration: model(u).durations[end], flags: { disarm: true } });
    b.after(model(u).durations[end], () => { if (u.deploySeq === seq) u.mem.regularFormVisual = null; }, { owner: u });
  };
}

// Native interruptible casts remember even brief control before OnAttack.
function cast(b, u, delay, duration, clip, release) {
  const seq = u.deploySeq, activation = u.skill.activations;
  let interrupted = false;
  let control;
  const valid = () => !interrupted && live(u) && u.deploySeq === seq
    && u.skill.activations === activation && u.canAct && u.attackControlEpoch === control;
  u.mem.regularFormVisual = clip ? { clip, loop: false } : null;
  b.addBuff(u, { key: 'defender:cast', duration, flags: { disarm: true, noSp: true } });
  control = u.attackControlEpoch;
  const watch = b.every(b.dt, () => {
    if (valid()) return;
    interrupted = true; watch.cancel();
    if (u.deploySeq === seq) { b.removeBuff(u, 'defender:cast'); u.mem.regularFormVisual = null; }
  }, { owner: u });
  b.after(delay, () => { watch.cancel(); if (valid()) release(); }, { owner: u });
  b.after(duration, () => { if (u.deploySeq === seq && u.skill.activations === activation) u.mem.regularFormVisual = null; }, { owner: u });
}
function syncCroissant(b, u, def) {
  const talent = def.talents[0]?.bb, area = keys(u, 'x-5');
  const scale = u.skill.active && u.skill.id === 'skchr_moeshd_1' ? def.skill.bb.talent_scale : 1;
  for (const a of b.allyUnits) {
    const eligible = talent && live(u) && ally(b, a, u) && bodyInKeys(a, area);
    const chance = talent?.[a === u ? 'moeshd_t_1[self].prob' : 'moeshd_t_1[aura].prob'] * scale;
    mods(b, a, `croissant:field:${u.id}`, eligible ? { dodgePhys: chance, dodgeArts: chance } : null, u);
  }
}
function syncBison(b, u, def) {
  const talent = def.talents[0]?.bb, behind = keys(u, 'b-1'), adjacent = keys(u, 'x-5');
  const active = live(u) && u.skill.active && u.skill.id === 'skchr_bison_2';
  for (const a of b.allyUnits) {
    const eligible = talent && live(u) && ally(b, a, u) && (a === u
      || ['PIONEER', 'WARRIOR'].includes(a.def.profession) && bodyInKeys(a, behind));
    mods(b, a, `bison:interlocked:${u.id}`, eligible ? { defFlat: talent.def } : null, u);
    mods(b, a, `bison:defense:${u.id}`, active && a !== u && ally(b, a, u) && bodyInKeys(a, adjacent)
      ? { defPct: def.skill.bb['bison_s_2[ally].def'] } : null, u);
  }
}
function camo(b, a, u, key, enabled) {
  if (!enabled || a.blocking.length) b.removeBuff(a, key);
  else if (!a.findBuff(key)) b.applyStatus(a, 'camou', { key, source: u });
}
function syncHeavyrain(b, u, def) {
  const talent = def.talents[0]?.bb, adjacent = keys(u, 'x-4'), skill = keys(u, 'x-5');
  for (const a of b.allyUnits) {
    // Original Heavyrain aura validators ignore ally target-free (isolation).
    // This exception is local to her talent/S2; S1 healing keeps its own selector.
    const eligible = live(u) && live(a) && a.kind !== 'device';
    const highGround = b.grid.tile(a.tileR, a.tileC).build === 'RANGED';
    mods(b, a, `heavyrain:stripes:${u.id}`, talent && eligible && (a === u || highGround && bodyInKeys(a, adjacent))
      ? { dodgePhys: talent.prob } : null, u);
    camo(b, a, u, `heavyrain:group:${u.id}`, eligible && u.skill.active
      && u.skill.id === 'skchr_zebra_2' && bodyInKeys(a, skill));
  }
}
function emergencyTargets(b, u) {
  return b.injuredAlliesInKeys([...keys(u, 'x-4')], u).filter(a => ally(b, a, u)
    && !a.s.flags.untargetable && !a.s.flags.healFree && !a.s.flags.noHeal && !a.profile?.noHeal
    && a.hpRatio <= .5 + 1e-9 && !a.findBuff('zebra_s_1')).slice(0, 1);
}
function emergencyCast(b, u, s) {
  const target = emergencyTargets(b, u)[0];
  if (!target) { u.skill.setSpTotal(u.skill.spTotal + u.skill.spCost); return; }
  cast(b, u, model(u).hits.Skill[0], model(u).durations.Skill, 'Skill', () => {
    if (!live(target)) {
      b.removeBuff(u, 'defender:cast'); u.skill.setSpTotal(u.skill.spTotal + u.skill.spCost); return;
    }
    const key = `heavyrain:emergency:${u.id}`;
    b.addBuff(target, { key: 'zebra_s_1', source: u, duration: s.duration, mods: { hpRegen: s.bb.hp_recovery_per_sec },
      interval: .2, onTick: () => camo(b, target, u, key, live(target)),
      onExpire: () => b.removeBuff(target, key), onRemove: () => b.removeBuff(target, key) });
  });
}
function asbestosShell(b, u, target, info) {
  b.addProjectile({ from: u, target, source: u, speed: 20, hitDead: true, visual: 'orb',
    data: { arkpediaTrackedVisual: true }, onHit: ({ x, y }) => {
      for (const e of b.foesInRadius(x, y, 1)) if (canTargetEnemy(u, e, { canHitFly: true, ignoreStealth: true }))
        b.dealDamage(u, e, { amount: u.s.atk, type: 'arts', isAttack: true, isSkill: true,
          isProjectile: true, applyWay: 'ranged', attackId: info.attackId });
    } });
}
function shalemVolley(b, u, p, info, s) {
  const seq = u.deploySeq, activation = u.skill.activations, control = u.attackControlEpoch;
  let interrupted = false;
  const valid = () => !interrupted && live(u) && u.canAct && !u.s.flags.disarm
    && u.attackControlEpoch === control
    && u.deploySeq === seq && u.skill.active && u.skill.activations === activation;
  const fire = () => {
    if (!valid()) return;
    const target = b.rng.pick(b.enemiesInKeys(u.rangeKeys, u, p));
    if (!target) return;
    b.addProjectile({ from: u, target, source: u, flightTime: .15, visual: 'orb',
      data: { arkpediaTrackedVisual: true }, onHit: c => resolveHit(b, u,
        { ...p, hits: 1, hitsFn: null, splashRadius: 0, atkScale: s.bb['attack@atk_scale'] }, c.target, info, c.x, c.y) });
  };
  // The basic AI has already waited the native .833 predelay. Each follow-up
  // selects afresh rather than copying the first target or multiplying hits.
  fire();
  const count = Math.floor(s.bb['attack@times']), delta = .1 / rate(u);
  const watch = b.every(b.dt, () => { if (!valid()) interrupted = true; }, { owner: u });
  for (let n = 1; n < count; n++) b.after(n * delta, fire, { owner: u });
  b.after(Math.max(0, count - 1) * delta + b.dt, () => watch.cancel(), { owner: u });
}

export function customizeFiveStarDefenderKit({ battle: b, id, def, unit: u, kit }) {
  if (!FIVE_STAR_DEFENDER_OPERATORS[id]) return;
  kit.install = null;
  const s = def.skill, bb = s.bb, first = s.id === FIVE_STAR_DEFENDER_OPERATORS[id].skillIds[0];
  kit.trait = { attack: 'melee', dmgType: 'phys', projectile: 'none', canHitFly: false, maxTargets: 1,
    attackVisual: 'Attack', windup: timing('Attack', ['char_201_moeshd', 'char_325_bison'].includes(id) ? 1.1 : 1),
    interruptOnSkillChange: true };
  if (id === 'char_201_moeshd') {
    kit.skill = first ? { kind: 'duration', trigger: 'SP_FULL', duration: s.duration, mods: { defPct: bb.def },
      onStart: () => syncCroissant(b, u, def), onEnd: () => syncCroissant(b, u, def) }
      : { kind: 'instant', onStart: () => {
        const delay = model(u).hits.Skill?.[0] ?? 1, duration = model(u).durations.Skill ?? delay;
        cast(b, u, delay, duration, model(u).hits.Skill ? 'Skill' : null, () => {
          for (const e of b.enemiesInKeys([...keys(u, 'x-5')], u, { canHitFly: false })) {
            b.push(e, bb.force, { from: u }); b.applyStatus(e, 'stun', { source: u, duration: bb.stun });
            b.dealDamage(u, e, { amount: u.s.atk * bb.atk_scale, type: 'phys', isAttack: true, isSkill: true, applyWay: 'melee' });
          }
        });
      } };
  } else if (id === 'char_325_bison') {
    kit.skill = first ? { kind: 'duration', duration: s.duration, mods: { defPct: bb.def } }
      : { kind: 'duration', duration: s.duration, flags: { disarm: true }, attack: { noAttack: true },
        mods: { defPct: bb['bison_s_2[self].def'], taunt: bb['bison_s_2[self].taunt_level'] },
        onStart: () => { u.mem.endDefenderForm = form(b, u, 'Skill_Begin', 'Skill', 'Skill_End'); syncBison(b, u, def); },
        onEnd: ctx => { syncBison(b, u, def); u.mem.endDefenderForm?.(ctx); } };
  } else if (id === 'char_304_zebra') {
    kit.skill = first ? { kind: 'charges', charges: bb.cnt, trigger: 'SP_FULL',
      canActivate: () => !u.findBuff('defender:cast') && emergencyTargets(b, u).length > 0,
      onStart: () => emergencyCast(b, u, s) }
      : { kind: 'duration', duration: s.duration, flags: { disarm: true }, attack: { noAttack: true },
        mods: { hpPct: bb.max_hp, defPct: bb.def },
        onStart: () => { u.mem.endDefenderForm = form(b, u, 'Skill_1_Begin', 'Skill_1_Loop', 'Skill_1_End'); syncHeavyrain(b, u, def); },
        onEnd: ctx => { syncHeavyrain(b, u, def); u.mem.endDefenderForm?.(ctx); } };
  } else if (id === 'char_378_asbest') {
    kit.skill = first ? { kind: 'duration', duration: s.duration, mods: { artsTakenMul: bb.damage_scale },
      attack: { dmgType: 'arts' }, onStart: () => { u.mem.asbestosBlock = true; }, onEnd: () => { u.mem.asbestosBlock = false; } }
      : { kind: 'duration', duration: s.duration, mods: { atkPct: bb.atk, defPct: bb.def, batPct: bb.base_attack_time },
        targeting: { rangeGrid: s.rangeGrid },
        attack: { dmgType: 'arts', canHitFly: true, attackVisual: 'Skill_Loop', windup: timing('Skill_Loop'),
          launchAttack: (_b, _u, _p, target, info) => asbestosShell(b, u, target, info) },
        onStart: () => { u.mem.endDefenderForm = form(b, u, 'Skill_Begin', 'Skill_Idle', 'Skill_End'); },
        onEnd: ctx => u.mem.endDefenderForm?.(ctx) };
  } else {
    kit.skill = first ? { kind: 'duration', duration: s.duration, mods: { hpPct: bb.max_hp, batPct: bb.base_attack_time },
      attack: { dmgType: 'arts', windup: timing('Skill_Loop'), attackVisual: 'Skill_Loop',
        maxTargetsByBlock: true, allowZeroBlockTargetLimit: false },
      onStart: () => { u.mem.endDefenderForm = form(b, u, 'Skill_Begin', 'Skill_Idle', 'Skill_End'); },
      onEnd: ctx => u.mem.endDefenderForm?.(ctx) }
      : { kind: 'duration', duration: s.duration, targeting: { rangeGrid: s.rangeGrid },
        attack: { dmgType: 'arts', canHitFly: true, attackVisual: 'none', windup: (_b, unit) => .833 / rate(unit),
          launchAttack: (_b, _u, p, _target, info) => shalemVolley(b, u, p, info, s) },
        onStart: () => {
          u.mem.endDefenderForm = form(b, u, 'Skill_2_Begin', 'Skill_2_Loop', 'Skill_2_End');
          const seq = u.deploySeq, activation = u.skill.activations;
          u.mem.shalemBleeding = b.after(.949999988079071, () => {
            const bleed = () => {
              if (live(u) && u.skill.active && u.deploySeq === seq && u.skill.activations === activation)
                b.loseHp(u, u.s.maxHp * bb.hp_ratio, { source: u, tags: ['shalem:bleeding'] });
            };
            bleed(); u.mem.shalemBleeding = b.every(1, bleed, { owner: u });
          }, { owner: u });
        }, onEnd: ctx => { u.mem.shalemBleeding?.cancel(); u.mem.endDefenderForm?.(ctx); } };
  }
  kit.skill.id = s.id; kit.skill.name = s.name;
}

export function installFiveStarDefender({ battle: b, unit: u, def }) {
  const id = def.charId;
  if (!FIVE_STAR_DEFENDER_OPERATORS[id]) return;
  const talent = def.talents[0]?.bb;
  if (id === 'char_201_moeshd' || id === 'char_325_bison' || id === 'char_304_zebra') {
    const sync = () => ({ char_201_moeshd: syncCroissant, char_325_bison: syncBison, char_304_zebra: syncHeavyrain }[id])(b, u, def);
    for (const event of ['deploy', 'death']) b.on(event, sync, { owner: u });
    if (id === 'char_304_zebra') b.every(.2, sync, { owner: u });
    else b.on('tick', sync, { owner: u });
  } else if (id === 'char_378_asbest') {
    b.on('deploy', ({ unit }) => { if (unit === u && talent) b.addBuff(u, {
      key: 'asbestos:resistance', source: u, mods: { resFlat: talent.magic_resistance } }); }, { owner: u });
    b.on('hit', ({ target, dmg }) => {
      if (target !== u || dmg.type !== 'arts' || dmg.tags?.includes('hpLoss')) return;
      if (u.skill.active && u.skill.id === 'skchr_asbest_1' && u.mem.asbestosBlock) {
        u.mem.asbestosBlock = false; dmg.mul = 0;
      }
      if (talent && !dmg.isSkill) u.skill.gainSp(talent.sp, 'asbestos:normal-arts');
    }, { owner: u });
  } else {
    b.on('deploy', ({ unit }) => {
      if (unit === u && talent && b.mapTags.includes('rogue_phantom'))
        b.addBuff(u, { key: 'shalem:phantom', source: u, mods: { atkPct: talent.atk, aspd: talent.attack_speed } });
    }, { owner: u });
    const curse = def.talents.find(t => t.bb.prob !== undefined)?.bb;
    if (curse) b.on('hit', ({ source, target, dmg }) => {
      if (source !== u || target.side !== 'enemy' || !dmg.isAttack || !['phys', 'arts'].includes(dmg.type)) return;
      if (b.rng.chance(curse.prob)) b.addBuff(target, { key: `shalem:curse:${u.id}`, source: u,
        duration: curse.duration, mods: { resMul: 1 + curse.magic_resistance } });
    }, { owner: u });
  }
}
