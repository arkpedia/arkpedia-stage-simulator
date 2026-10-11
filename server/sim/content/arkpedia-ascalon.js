// SPDX-License-Identifier: GPL-3.0-or-later
// Literal selectors, buffs and original facing/animation events are recorded in
// data/arkpedia-ascalon-prefabs.json. Unity FSM and particles are not certified.
import evidence from '../../../data/arkpedia-ascalon-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { canTargetEnemy } from '../targeting.js';
const ID = 'char_4132_ascln';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => Math.min(1, u.base.bat / u.s.interval);
const plain = { attack: 'melee', projectile: 'none', dmgType: 'phys', applyWay: 'melee',
  canHitFly: false, allInRange: true, maxTargets: 1, hits: 1, splashRadius: 0,
  hitAllBlocked: false, maxTargetsByBlock: false, chain: null };
const number = u => Number(u.skill.id.at(-1));
const poisonKey = u => `ascalon:poison:${u.id}`;
const auraKey = u => `ascalon:aura:${u.id}`;
const mode = u => u.skill.active && !u.mem.ascalonTransition ? number(u) : 0;
const visual = (u, clip, loop = true) => { u.mem.regularFormVisual = clip ? { clip, loop } : null; };
function poison(b, u, e) {
  const bb = u.def.talents.find(t => t.bb.atk_ratio != null)?.bb;
  if (!bb || !live(u) || !live(e) || e.side !== 'enemy') return;
  const key = poisonKey(u), old = e.findBuff(key);
  if (old) {
    old.ascalonStacks = Math.min(bb.max_stack_cnt, old.ascalonStacks + 1);
    old.timeLeft = bb.debuff_duration;
    old.mods.moveMul = Math.max(0, 1 + bb.move_speed * old.ascalonStacks);
    e.markDirty(); return;
  }
  b.addBuff(e, { key, source: u, duration: bb.debuff_duration,
    mods: { moveMul: 1 + bb.move_speed }, interval: bb.interval,
    onTick: ({ buff }) => {
      if (!live(u)) { b.removeBuff(e, key); return; }
      b.dealDamage(u, e, { amount: u.s.atk * buff.ascalonStacks * bb.atk_ratio,
        type: 'arts', canDodge: false, ignoreSelect: true, applyWay: 'melee',
        tags: ['dot','periodic','ascalon:poison'] });
    } });
  e.findBuff(key).ascalonStacks = 1;
}
function syncAura(b, u) {
  const n = live(u) ? mode(u) : 0, bb = u.skill.bb;
  const inRange = new Set(n >= 2 ? b.enemiesInKeys(u.rangeKeys, u, { ...plain, canHitFly: n === 2 }) : []);
  for (const e of b.enemies) {
    const key = auraKey(u);
    if (!inRange.has(e)) { b.removeBuff(e, key); continue; }
    if (!e.findBuff(key)) b.addBuff(e, { key, source: u, mods: n === 2
      ? { moveMul: 1 + bb.move_speed }
      : { hitRatePhys: bb['attack@damage_hitrate_physical'], hitRateArts: bb['attack@damage_hitrate_magical'] } });
  }
}
function abortS1(b, u) {
  const c = u.mem.ascalonS1; if (!c) return;
  u.mem.ascalonS1 = null; c.watch?.cancel(); for (const job of c.jobs) job.cancel();
  b.removeBuff(u, 'ascalon:s1-lock');
  if (u.skill.active && number(u) === 1) u.skill.end('interrupted');
}
function s1Start(b, u) {
  const c = { seq: u.deploySeq, epoch: u.attackControlEpoch, jobs: [], fired: false };
  u.mem.ascalonS1 = c;
  b.addBuff(u, { key: 'ascalon:s1-lock', flags: { noSp: true } });
  c.watch = b.every(b.dt, () => {
    if (!live(u) || u.deploySeq !== c.seq || u.attackControlEpoch !== c.epoch) abortS1(b, u);
  }, { owner: u });
}
function secondHit(b, u, p, info) {
  const c = u.mem.ascalonS1; if (!c || c.fired) return;
  c.fired = true;
  const stamps = info.inputTargets.map(e => [e, e.deploySeq]);
  const valid = () => live(u) && u.mem.ascalonS1 === c && u.deploySeq === c.seq
    && u.attackControlEpoch === c.epoch && u.canAct && !u.s.flags.disarm;
  const hits = model(u).hits.Skill_1, speed = rate(u);
  c.jobs.push(b.after((hits[1] - hits[0]) / speed, () => {
    if (!valid()) return;
    for (const [e, seq] of stamps) if (e.deploySeq === seq && canTargetEnemy(u, e, plain))
      resolveHit(b, u, p, e, { isSkill: true, attackId: info.attackId }, e.x, e.y);
  }, { owner: u }));
  c.jobs.push(b.after((model(u).durations.Skill_1 - hits[0]) / speed, () => {
    if (u.mem.ascalonS1 !== c) return;
    c.watch.cancel(); u.mem.ascalonS1 = null; b.removeBuff(u, 'ascalon:s1-lock');
    if (c.refund && live(u)) u.skill.setSpTotal(u.skill.spTotal + u.skill.spCost);
  }, { owner: u }));
}
export function customizeAscalonKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  const s = def.skill, n = Number(s.id.at(-1)), bb = s.bb;
  kit.trait = { ...plain, install: null, hitsFn: null, retargetOnRelease: false,
    interruptOnSkillChange: true, canAttack: () => !u.mem.ascalonTransition && !u.mem.ascalonS1?.fired,
    windup: () => {
      const active = mode(u);
      const clip = active === 1 ? 'Skill_1' : active === 2 ? 'Skill_2'
        : active === 3 ? 'Skill_3_Loop' : b.rng() < .5 ? 'Attack_A' : 'Attack_B';
      u.mem.ascalonAttack = clip;
      return model(u).hits[clip][0] / rate(u);
    }, attackVisual: () => u.mem.ascalonAttack,
    launchAttack: (_b, _u, p, e, info) => {
      if (!canTargetEnemy(u, e, p)) return;
      if (info.isSkill && number(u) === 1 && u.mem.ascalonS1) u.mem.ascalonS1.attempted = true;
      resolveHit(b, u, p, e, info, e.x, e.y);
    } };
  kit.skill = { id: s.id, name: s.name, kind: n === 1 ? 'charges' : 'duration',
    charges: s.maxChargeTime, duration: s.duration,
    canActivate: () => !u.mem.ascalonS1 && !u.mem.ascalonTransition,
    ...(n === 2 ? { mods: { atkPct: bb.atk } } : {}),
    ...(n === 3 ? { targeting: { rangeGrid: s.rangeGrid },
      durationRemaining: () => Math.min(s.duration, u.skill.timeLeft) } : {}),
    attack: n === 1 ? { atkScale: bb.atk_scale,
      afterAttack: (_b, _u, _es, info) => {
        const c = u.mem.ascalonS1; if (c) c.refund = !c.attempted;
        secondHit(b, u, { ...plain, atkScale: bb.atk_scale }, info);
      } } : {},
    onStart: () => {
      if (n === 1) { s1Start(b, u); return; }
      if (n === 2) { u.atkCd = 0; syncAura(b, u); return; }
      const token = {}, seq = u.deploySeq;
      u.mem.ascalonTransition = token; visual(u, 'Skill_3_Begin', false);
      const delay = model(u).durations.Skill_3_Begin; u.skill.timeLeft += delay;
      b.after(delay, () => {
        if (!live(u) || u.deploySeq !== seq || !u.skill.active || u.mem.ascalonTransition !== token) return;
        u.mem.ascalonTransition = null; u.atkCd = 0;
        b.addBuff(u, { key: 'ascalon:s3-mode', mods: { atkPct: bb.atk, batFlat: bb.base_attack_time, taunt: bb.taunt_level } });
        visual(u, 'Skill_3_Idle'); syncAura(b, u);
      }, { owner: u });
    }, onEnd: ({ reason }) => {
      if (n === 1) { if (reason !== 'instant') abortS1(b, u); return; }
      u.mem.ascalonTransition = null; b.removeBuff(u, 'ascalon:s3-mode'); syncAura(b, u);
      // The original animator explicitly mixes Skill_3_Loop/Idle -> Idle through
      // Skill_3_End. This visual mix does not add a disarm or SP lock.
      if (n === 3 && live(u)) {
        const token = {}; u.mem.ascalonEnd = token; visual(u, 'Skill_3_End', false);
        b.after(model(u).durations.Skill_3_End, () => {
          if (u.mem.ascalonEnd === token) visual(u, null);
        }, { owner: u });
      } else visual(u, null);
    } };
}
export function installAscalon({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  const talent = def.talents.find(t => t.bb.attack_speed != null)?.bb;
  const deploy = () => {
    b.addBuff(u, { key: 'ascalon:trait', mods: { dodgePhys: .5, dodgeArts: .5 } });
    if (talent) {
      const high = [[1,0],[-1,0],[0,1],[0,-1]].filter(([dr, dc]) => b.grid.tile(u.tileR + dr, u.tileC + dc).height === 'HIGH').length;
      b.addBuff(u, { key: 'ascalon:aspd', mods: { aspd: talent.attack_speed + (high >= talent.cnt ? talent.attack_speed_add : 0) } });
    }
  };
  b.on('deploy', ({ unit }) => { if (unit === u) deploy(); }, { owner: u });
  if (live(u)) deploy();
  b.on('hit', ({ source, target, dmg }) => {
    if (source === u && live(u) && dmg.isAttack && ['phys','arts'].includes(dmg.type)) poison(b, u, target);
  }, { owner: u });
  b.on('kill', ({ victim }) => {
    if (mode(u) !== 2 || !live(u) || victim.isFlying || !victim.findBuff(auraKey(u))) return;
    for (const e of b.enemiesInRadius(victim.x, victim.y, u.skill.bb.range_radius))
      if (e !== victim && canTargetEnemy(u, e, plain)) poison(b, u, e);
  }, { owner: u });
  const recover = ({ target }) => {
    if (target === u && live(u) && mode(u) === 3)
      b.heal(u, u, u.s.maxHp * u.skill.bb['attack@hp_ratio']);
  };
  b.on('dodge', recover, { owner: u }); b.on('hitFailed', recover, { owner: u });
  b.on('tick', () => syncAura(b, u), { owner: u });
  b.on('death', ({ unit }) => {
    if (unit !== u) return;
    abortS1(b, u); syncAura(b, u);
    for (const e of b.enemies) b.removeBuff(e, poisonKey(u));
    visual(u, null);
  }, { owner: u });
}
