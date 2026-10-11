// SPDX-License-Identifier: GPL-3.0-or-later
import { FIVE_STAR_SUPPORT_OPERATORS } from '../../../shared/arkpedia/five-star-support-operators.js';
import evidence from '../../../data/arkpedia-five-star-support-prefabs.json' with { type: 'json' };
import { absoluteRangeKeys, canTargetEnemy } from '../targeting.js';
import { bodyInKeys } from '../body.js';
const live = u => u?.alive && u.deployed;
const drone = e => e.tags?.has('drone');
const hitFrame = (id, clip = 'Attack') => evidence.models[id].Front.hits[clip][0];
const targets = (b, u, grid, fly = false) => b.enemiesInKeys(
  absoluteRangeKeys(grid, u.tileR, u.tileC, u.dir), u, { canHitFly: fly });
const deployDuration = (skill, extra = {}) => ({ id: skill.id, name: skill.name,
  kind: 'duration', duration: skill.duration, activateOnDeploy: true, trigger: 'NEVER', ...extra });
function areaHit(b, u, list, { scale, type = 'phys', status, seconds, applyWay = 'melee', tags = [] }) {
  for (const target of list) {
    b.dealDamage(u, target, { amount: u.s.atk * scale, type, isAttack: true, isSkill: true, applyWay, tags });
    if (target.alive && status) b.applyStatus(target, status, { source: u, duration: seconds });
  }
}

export function customizeFiveStarSupportKit({ battle, id, def, unit, kit }) {
  if (!FIVE_STAR_SUPPORT_OPERATORS[id]) return;
  kit.install = null;
  const s = def.skill, bb = s.bb, talent = def.talents[0]?.bb;
  const specialist = ['char_144_red', 'char_243_waaifu', 'char_214_kafka'].includes(id);
  kit.trait = { attack: specialist ? 'melee' : 'ranged', dmgType: specialist ? 'phys' : 'arts',
    projectile: specialist ? 'none' : 'orb', canHitFly: !specialist,
    windup: (_b, u) => hitFrame(id) * 100 / u.s.aspd, attackVisual: 'Attack',
    maxTargets: 1, hitAllBlocked: false, allInRange: false, install: null };
  if (id === 'char_144_red') {
    kit.skill = s.id === 'skchr_red_1' ? deployDuration(s, {
      mods: { atkPct: bb.atk, dodgePhys: bb.prob, dodgeArts: bb.prob },
    }) : { id: s.id, name: s.name, kind: 'passive', onStart: ({ battle: b, unit: u }) =>
      areaHit(b, u, targets(b, u, s.rangeGrid), { scale: bb.atk_scale, status: 'stun', seconds: bb.stun }) };
  } else if (id === 'char_243_waaifu') {
    kit.skill = s.id === 'skchr_waaifu_1' ? deployDuration(s, {
      mods: { atkPct: bb['waaifu_s_1[self].atk'] }, attack: {
        onEachHit: ({ battle: b, unit: u, target }) => {
          if (target.alive) b.addBuff(target, { key: 'waaifu:atk-down', source: u,
            duration: bb['attack@waaifu_s_1[debuff].duration'],
            mods: { atkMul: 1 + bb['attack@waaifu_s_1[debuff].atk'] } });
        },
      },
    }) : { id: s.id, name: s.name, kind: 'passive', onStart: ({ battle: b, unit: u }) => {
      const seq = u.deploySeq;
      u.mem.regularFormVisual = { clip: 'Start_2', loop: false };
      b.after(hitFrame(id, 'Start_2'), () => {
        if (live(u) && u.deploySeq === seq) areaHit(b, u, targets(b, u, s.rangeGrid),
          { scale: bb.atk_scale, status: 'silence', seconds: bb.silence, tags: ['waaifu:deployment'] });
      }, { owner: u });
      b.after(evidence.models[id].Front.durations.Start_2, () => {
        if (live(u) && u.deploySeq === seq) u.mem.regularFormVisual = null;
      }, { owner: u });
    } };
  } else if (id === 'char_214_kafka') {
    const first = s.id === 'skchr_kafka_1';
    kit.skill = deployDuration(s, { duration: bb.duration + (first ? .04 : 0),
      mods: { atkPct: talent?.atk ?? 0, blockCntMul: 0 }, flags: { camou: true },
      ...(first ? { attack: { noAttack: true }, onStart: ({ battle: b, unit: u }) => {
        for (const target of targets(b, u, s.rangeGrid)) b.applyStatus(target, 'sleep', {
          key: `kafka:sleep:${u.id}`, source: u, duration: bb.duration });
      }, onEnd: ({ battle: b, unit: u, reason }) => {
        if (reason !== 'duration' || !live(u)) return;
        const seq = u.deploySeq;
        // The original sub-talent retains ATK through the Skill_End strike.
        if (talent?.atk) b.addBuff(u, { key: 'kafka:atk-tail', duration: .7, mods: { atkPct: talent.atk } });
        u.mem.regularFormVisual = { clip: 'Skill_End', loop: false };
        u.atkCd = Math.max(u.atkCd, .3);
        b.after(hitFrame(id, 'Skill_End'), () => {
          if (live(u) && u.deploySeq === seq) areaHit(b, u, targets(b, u, s.rangeGrid),
            { scale: bb.atk_scale, type: 'arts' });
        }, { owner: u });
        b.after(evidence.models[id].Front.durations.Skill_End, () => {
          if (live(u) && u.deploySeq === seq) u.mem.regularFormVisual = null;
        }, { owner: u });
      } } : { targeting: { rangeGrid: s.rangeGrid },
        attack: { dmgType: 'arts', attack: 'melee', projectile: 'none', canHitFly: false,
          windup: (_b, u) => hitFrame(id, 'Skill_2_Loop') * 100 / u.s.aspd + .13,
          attackVisual: 'Skill_2_Loop' },
        onStart: ({ battle: b, unit: u }) => {
          const keys = absoluteRangeKeys(s.rangeGrid, u.tileR, u.tileC, u.dir);
          // Source projectile immediately reaches its fixed target tile, then
          // checks its tile collider once when its .2s lifetime ends.
          b.after(.2, () => {
            const list = b.enemiesInKeys(keys, u, { canHitFly: true });
            areaHit(b, u, list, { scale: bb.atk_scale, type: 'arts', applyWay: 'ranged' });
          });
          u.mem.kafkaTargetTiles = keys;
        } }),
    });
  } else if (id === 'char_174_slbell') {
    kit.trait.projectileSpeed = 6;
    kit.trait.maxTargets = def.talents.find(t => t.bb['attack@max_target'])?.bb['attack@max_target'] ?? 1;
    const first = s.id === 'skchr_slbell_1';
    kit.skill = { id: s.id, name: s.name, kind: 'duration', duration: s.duration,
      attack: { projectile: 'none', windup: .5, attackVisual: 'Skill_Loop',
        ...(first ? { maxTargets: bb['attack@max_target'] } : {}) },
      onStart: ({ battle: b, unit: u }) => syncPramanix(b, u, def),
      onTick: ({ battle: b, unit: u }) => syncPramanix(b, u, def),
      onEnd: ({ battle: b, unit: u }) => syncPramanix(b, u, def) };
  } else {
    kit.trait.projectileSpeed = 10;
    kit.trait.priority = 'drone';
    kit.trait.onHitStatus = { key: 'sluggish', duration: .8 };
    kit.skill = s.id === 'skchr_glacus_1' ? { id: s.id, name: s.name,
      kind: 'duration', duration: s.duration, mods: { atkPct: bb.atk },
      attack: { maxTargets: bb['attack@max_target'] } } : { id: s.id, name: s.name,
      kind: 'instant', onStart: ({ battle: b, unit: u }) => {
        const seq = u.deploySeq;
        u.atkCd = Math.max(u.atkCd, hitFrame(id, 'Skill'));
        b.after(hitFrame(id, 'Skill'), () => {
          if (!live(u) || u.deploySeq !== seq || !u.canAct) return;
          for (const target of targets(b, u, s.rangeGrid, true)) {
            const isDrone = drone(target);
            b.dealDamage(u, target, { amount: u.s.atk * bb[isDrone ? 'atk_scale[drone]' : 'atk_scale[normal]'],
              type: 'arts', isSkill: true, tags: ['glaucus:emp'], applyWay: isDrone ? 'melee' : 'none' });
            if (target.alive) b.applyStatus(target, isDrone ? 'stun' : 'bind', {
              source: u, duration: isDrone ? bb.stun : bb.frozen });
          }
        }, { owner: u });
      } };
  }
}

function syncPramanix(b, u, def) {
  const auraKey = `pramanix:skill:${u.id}`, weakKey = `pramanix:fragile:${u.id}`;
  const talent = def.talents.find(t => t.bb.hp_ratio)?.bb;
  for (const target of b.enemies) {
    const inside = live(u) && target.alive && bodyInKeys(target, u.rangeKeySet)
      && canTargetEnemy(u, target, { canHitFly: true });
    if (inside && u.skill.active) {
      const bb = u.skill.bb, mods = u.skill.id === 'skchr_slbell_1'
        ? { aspd: bb.attack_speed } : { defMul: 1 + bb.def, resMul: 1 + bb.magic_resistance };
      if (!target.findBuff(auraKey)) b.addBuff(target, { key: auraKey, source: u, mods });
    } else b.removeBuff(target, auraKey);
    if (inside && talent && target.hpRatio < talent.hp_ratio) {
      if (!target.findBuff(weakKey)) b.applyStatus(target, 'fragile', {
        key: weakKey, source: u, value: talent.damage_scale - 1 });
    } else b.removeBuff(target, weakKey);
  }
}

export function installFiveStarSupport({ battle: b, unit: u, def }) {
  if (!FIVE_STAR_SUPPORT_OPERATORS[def.charId]) return;
  const id = def.charId, talent = def.talents[0]?.bb;
  if (id === 'char_144_red' && talent) b.on('hit', c => {
    if (c.source === u && c.dmg.isAttack)
      c.dmg.minimumAmount = Math.max(c.dmg.minimumAmount ?? 0, u.s.atk * talent.atk_scale);
  }, { owner: u });
  if (id === 'char_243_waaifu' && talent) b.on('hit', c => {
    // Source S2 attaches a higher-priority empty waaifu_t_1 override, so its
    // deployment area hit cannot roll the ordinary knockback/critical talent.
    if (c.source !== u || !c.dmg.isAttack || c.dmg.tags.includes('waaifu:deployment') || !b.rng.chance(talent.prob)) return;
    c.dmg.amount *= talent.atk_scale;
    b.push(c.target, talent.force, { from: u, dir: { x: u.fwd[1], y: u.fwd[0] } });
  }, { owner: u });
  if (id === 'char_326_glacus' && talent) b.on('hit', c => {
    if (c.source === u && c.dmg.isAttack && drone(c.target)) c.dmg.amount *= talent.atk_scale;
  }, { owner: u });
  if (id === 'char_174_slbell') {
    const sync = () => syncPramanix(b, u, def);
    b.on('tick', sync, { owner: u });
    b.on('hit', sync, { owner: u, priority: 100 });
    b.on('deploy', sync, { owner: u });
    b.on('death', ({ unit }) => { if (unit === u) sync(); }, { owner: u });
  }
}
