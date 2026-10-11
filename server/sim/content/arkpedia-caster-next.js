// SPDX-License-Identifier: GPL-3.0-or-later
import { CASTERS_NEXT_OPERATORS } from '../../../shared/arkpedia/caster-next-operators.js';
import evidence from '../../../data/arkpedia-caster-next-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { registerNamedSpRecovery } from './arkpedia-five-star-medic.js';

const ARO = 'char_446_aroma', IFR = 'char_134_ifrit', MOS = 'char_213_mostma', CEO = 'char_2013_cerber';
const live = u => u?.alive && u.deployed;
const model = u => evidence.models[u.defId][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const rate = (u, cap = 1) => Math.min(cap, u.s.aspd / 100);
const timed = (clip, cap = 1) => (_b, u) => model(u).hits[clip][0] / rate(u, cap);
const plain = p => ({ ...p, splashRadius: 0, chain: null, hits: 1, hitsFn: null, dmgMul: null });
const enemies = (b, u, p = { canHitFly: true }) => b.enemiesInKeys(u.rangeKeys, u, p);
const candidates = (b, u, p, priority = null) => {
  const out = enemies(b, u, p); sortEnemyTargets(b, u, out, priority);
  return out;
};
function form(b, u, begin, loop, end, lock = true) {
  const seq = u.deploySeq, activation = u.skill.activations, duration = model(u).durations[begin] / rate(u);
  const key = `caster-next:entrance:${u.id}`;
  u.mem.regularFormVisual = { clip: begin, loop: false };
  if (lock) b.addBuff(u, { key, duration, flags: { disarm: true } });
  b.after(duration, () => {
    if (live(u) && u.deploySeq === seq && u.skill.active && u.skill.activations === activation)
      u.mem.regularFormVisual = { clip: loop, loop: true };
  }, { owner: u });
  return ({ reason } = {}) => {
    b.removeBuff(u, key);
    if (!live(u) || reason === 'death' || !end) { u.mem.regularFormVisual = null; return; }
    const duration = model(u).durations[end] / rate(u);
    u.mem.regularFormVisual = { clip: end, loop: false };
    if (lock) b.addBuff(u, { key: `caster-next:end:${u.id}`, duration, flags: { disarm: true, noSp: true } });
    b.after(duration, () => {
      if (u.deploySeq === seq && u.skill.activations === activation) u.mem.regularFormVisual = null;
    }, { owner: u });
  };
}
function areaRelease(b, u, p, _target, info) {
  // Original blast casters select all current line victims at release; this is
  // one damage per victim, not a repeated splash for every initial target.
  for (const e of enemies(b, u, p)) {
    if (u.defId === IFR && info.isSkill && u.def.skill.id === 'skchr_ifrit_2') {
      const bb = u.def.skill.bb;
      b.addBuff(e, { key: `ifrit:burn:${u.id}`, source: u, duration: bb.duration,
        interval: 1, mods: { defFlat: bb.def },
        onTick: () => b.dealDamage(u, e, { amount: u.s.atk * bb['burn.atk_scale'], type: 'arts',
          isSkill: true, applyWay: 'none', tags: ['dot', 'ifrit:burn'] }) });
    }
    resolveHit(b, u, plain(p), e, info, e.x, e.y);
    if (u.defId === ARO && info.isSkill && u.def.skill.id === 'skchr_aroma_1') {
      const bb = u.def.skill.bb;
      // The active buff waits .1s, then reads FLY_ONLY after the ordinary
      // first-hit levitation has been applied. Its own damage is separate.
      b.after(.1, () => {
        if (live(e) && e.isFlying) b.dealDamage(u, e, { amount: u.s.atk * bb.atk_scale_to_fly,
          type: 'arts', isAttack: true, isSkill: true, attackId: info.attackId,
          applyWay: 'none', tags: ['aroma:aerial'] });
      });
    }
  }
}
function mostimaLaunch(b, u, p, target, info) {
  const victims = info.isSkill && u.def.skill.id === 'skchr_mostma_3'
    ? enemies(b, u, p) : b.enemiesInRadius(target.x, target.y, 1.1).filter(e => canTargetEnemy(u, e, p));
  for (const e of victims) {
    resolveHit(b, u, plain(p), e, info, e.x, e.y);
    if (info.isSkill && u.def.skill.id === 'skchr_mostma_3' && live(e))
      b.push(e, u.def.skill.bb['attack@force'], { from: u });
  }
}
function ceobeLaunch(b, u, p, target, info) {
  const bb = u.def.skill.bb, id = info.isSkill ? u.def.skill.id : null;
  const speed = id === 'skchr_cerber_2' ? 12 : 10;
  b.addProjectile({ from: u, target, source: u, speed, visual: 'orb',
    data: { arkpediaTrackedVisual: true }, onHit: ({ target: e }) => {
      if (!e || !canTargetEnemy(u, e, p)) return;
      if (id === 'skchr_cerber_1') b.applyStatus(e, 'bind', { source: u, duration: bb.duration });
      if (id === 'skchr_cerber_3') b.applyStatus(e, 'silence', { source: u, duration: bb['attack@silence'] });
      resolveHit(b, u, plain(p), e, info, e.x, e.y);
      const talent = u.def.talents[0]?.bb;
      if (talent && live(e)) b.dealDamage(u, e, { amount: e.s.def * talent.atk_scale,
        type: 'arts', applyWay: 'ranged', isAttack: true, isSkill: info.isSkill,
        attackId: info.attackId, tags: ['cerber:talent'] });
    } });
}
function syncAroma(b, u) {
  const key = `aroma:landing:${u.id}`, marked = u.mem.aromaLanding ??= new Set();
  const active = live(u) && u.skill.active && u.skill.id === 'skchr_aroma_2';
  const eligible = new Set(active ? enemies(b, u) : []);
  for (const e of b.enemies) {
    if (!eligible.has(e)) { marked.delete(e); b.removeBuff(e, key); continue; }
    if (e.s.flags.levitate) {
      if (!marked.has(e)) { marked.add(e); b.addBuff(e, { key, source: u }); }
    } else if (marked.delete(e)) {
      b.removeBuff(e, key);
      b.dealDamage(u, e, { amount: u.s.atk * u.def.skill.bb['attack@atk_scale_when_fly_finish'],
        type: 'arts', isAttack: true, isSkill: true, applyWay: 'none', tags: ['aroma:landing'] });
    }
  }
}
function syncIfrit(b, u) {
  const t = u.def.talents[0]?.bb, key = `ifrit:res:${u.id}`;
  const inRange = new Set(live(u) && t ? enemies(b, u) : []);
  for (const e of b.enemies) {
    if (!inRange.has(e)) b.removeBuff(e, key);
    else if (!e.findBuff(key)) b.addBuff(e, { key, source: u, mods: { resMul: 1 + t.magic_resistance } });
  }
}
function syncMostima(b, u) {
  const t = u.def.talents.find(x => x.bb.move_speed != null)?.bb, key = `mostma:slow:${u.id}`;
  const scale = u.skill.active && u.skill.id === 'skchr_mostma_3' ? u.def.skill.bb.talent_scale : 1;
  for (const e of b.enemies) {
    // Original non-HEAL validator ignoreTargetFree1 includes hidden/untargetable
    // living range occupants; this aura selects no attack victim.
    const eligible = live(u) && t && live(e) && bodyInKeys(e, u.rangeKeySet);
    const old = e.findBuff(key), multiplier = t ? 1 + t.move_speed * scale : 1;
    if (!eligible) b.removeBuff(e, key);
    else if (old?.mods.moveMul !== multiplier) b.addBuff(e, { key, source: u, mods: { moveMul: multiplier } });
  }
}
function syncCeobe(b, u) {
  const t = u.def.talents.find(x => x.bb.attack_speed != null)?.bb, key = 'cerber:alone';
  const alone = live(u) && t && !b.allyUnits.some(a => a !== u && live(a)
    && Math.abs(a.tileR - u.tileR) + Math.abs(a.tileC - u.tileC) < 2);
  if (!alone) b.removeBuff(u, key);
  else if (!u.findBuff(key)) b.addBuff(u, { key, source: u, mods: { atkPct: t.atk, aspd: t.attack_speed } });
}
function continuous(b, u, { begin, loop, end, ground, tick, loss = null }) {
  const seq = u.deploySeq, activation = u.skill.activations, valid = () => live(u)
    && u.deploySeq === seq && u.skill.active && u.skill.activations === activation;
  const stopForm = form(b, u, begin, loop, end, false);
  const first = model(u).hits[begin][0] / rate(u), timers = [];
  let cancelled = false;
  const watch = b.every(b.dt, () => { if (!valid() || !u.canAct) cancelled = true; }, { owner: u });
  const fire = () => {
    if (!valid() || !u.canAct) return;
    const victims = enemies(b, u, { canHitFly: !ground });
    if (!victims.length) return;
    const attackId = ++b._attackSeq;
    for (const e of victims) tick(e, attackId);
    u.stats.attacks++;
    b.emit('attack', { attacker: u, targets: victims, isSkill: true });
    u.skill.onAttackPerformed(victims, true);
  };
  timers.push(watch, b.after(first, () => {
    watch.cancel(); if (cancelled || !valid() || !u.canAct) return;
    fire(); timers.push(b.every(1, fire, { owner: u }));
  }, { owner: u }));
  if (loss) timers.push(b.every(1, () => { if (valid()) loss(); }, { owner: u }));
  return ctx => { for (const timer of timers) timer.cancel(); stopForm(ctx); };
}

export function customizeCastersNextKit({ battle: b, id, def, unit: u, kit }) {
  if (!CASTERS_NEXT_OPERATORS[id]) return;
  kit.install = null;
  const s = def.skill, bb = s.bb;
  kit.trait = { attack: 'ranged', dmgType: 'arts', projectile: 'none', canHitFly: true,
    maxTargets: 1, hits: 1, splashRadius: 0, chain: null, rangeAoe: false, allInRange: false,
    attackVisual: 'Attack', windup: timed('Attack'),
    interruptOnSkillChange: true, install: null };
  if (id === ARO || id === IFR) kit.trait.launchAttack = areaRelease;
  else if (id === MOS) kit.trait.launchAttack = mostimaLaunch;
  else kit.trait.launchAttack = ceobeLaunch;
  if (id === ARO) {
    let end;
    kit.skill = s.id.endsWith('_1') ? { kind: 'charges', trigger: { rule: 'DEFAULT' },
      attack: { atkScale: bb.atk_scale, attackVisual: (_battle, unit) => unit.dir === 'DOWN' ? 'Skill_Down_1' : 'Skill_1',
        windup: timed('Skill_1', Infinity) } }
      : { kind: 'duration', duration: s.duration, mods: { atkPct: bb.atk },
        attack: { attackVisual: 'Skill_2_Loop', windup: timed('Skill_2_Loop') },
        onStart: () => { end = form(b, u, 'Skill_2_Begin', 'Skill_2_Idle', 'Skill_2_End'); syncAroma(b, u); },
        onEnd: ctx => { syncAroma(b, u); end?.(ctx); } };
  } else if (id === IFR) {
    if (s.id.endsWith('_1')) kit.skill = { kind: 'duration', duration: s.duration, mods: { atkPct: bb.atk, aspd: bb.attack_speed } };
    else if (s.id.endsWith('_2')) kit.skill = { kind: 'charges', trigger: { rule: 'DEFAULT' },
      attack: { atkScale: bb.atk_scale, windup: 1.25 } };
    else {
      let end;
      kit.skill = { kind: 'duration', duration: s.duration, flags: { disarm: true },
        onStart: () => { const down = u.dir === 'DOWN';
          end = continuous(b, u, { begin: down ? 'Skill_Down_2_Begin' : 'Skill_2_Begin',
            loop: down ? 'Skill_Down_2_Loop' : 'Skill_2_Loop', end: down ? 'Skill_Down_2_End' : 'Skill_2_End', ground: true,
          tick: (e, attackId) => {
            b.addBuff(e, { key: `ifrit:s3-res:${u.id}`, source: u, duration: 1, mods: { resFlat: bb.magic_resistance } });
            b.dealDamage(u, e, { amount: u.s.atk * bb.atk_scale, type: 'arts', isAttack: true,
              isSkill: true, attackId, applyWay: 'ranged' });
          }, loss: () => b.loseHp(u, u.s.maxHp * bb.hp_ratio, { source: u, tags: ['ifrit:loss'] }) }); },
        onEnd: ctx => end?.(ctx) };
    }
  } else if (id === MOS) {
    if (s.id === 'skcom_atk_up[3]') kit.skill = { kind: 'duration', duration: s.duration, mods: { atkPct: bb.atk } };
    else if (s.id.endsWith('_2')) {
      let end;
      kit.skill = { kind: 'duration', duration: s.duration, flags: { disarm: true },
        onStart: () => { end = continuous(b, u, { begin: 'Skill_Begin', loop: 'Skill_Loop', end: 'Skill_End', ground: false,
          tick: (e, attackId) => { b.applyStatus(e, 'stun', { source: u, duration: 1 });
            b.dealDamage(u, e, { amount: u.s.atk * bb.atk_scale, type: 'arts', isAttack: true,
              isSkill: true, attackId, applyWay: 'ranged' }); } }); },
        onEnd: ctx => end?.(ctx) };
    } else {
      let end;
      kit.skill = { kind: 'duration', duration: s.duration, mods: { atkPct: bb.atk, batPct: bb.base_attack_time },
        targeting: { rangeGrid: s.rangeGrid }, attack: { attackVisual: 'Skill_2_Loop', windup: timed('Skill_2_Loop') },
        onStart: () => { end = form(b, u, 'Skill_2_Begin', 'Skill_2_Idle', 'Skill_2_End'); syncMostima(b, u); },
        onEnd: ctx => { syncMostima(b, u); end?.(ctx); } };
    }
  } else {
    if (s.id.endsWith('_1')) kit.skill = { kind: 'charges', trigger: { rule: 'DEFAULT' },
      attack: { atkScale: bb.atk_scale, attackVisual: 'Skill_1', windup: timed('Skill_1'),
        acquireTargets: (battle, unit, p) => {
          const out = candidates(battle, unit, p);
          out.sort((a, c) => Number(!!a.blockedBy) - Number(!!c.blockedBy));
          return out.slice(0, 1 + Math.max(0, Math.floor(unit.s.maxTargets)));
        } } };
    else if (s.id.endsWith('_2')) {
      let end;
      kit.skill = { kind: 'duration', duration: s.duration, mods: { batMul: bb.base_attack_time },
        targeting: { priority: 'highDef' }, attack: { attackVisual: 'Skill_2_Loop', windup: timed('Skill_2_Loop') },
        onStart: () => { end = form(b, u, 'Skill_2_Begin', 'Skill_2_Idle', 'Skill_2_End'); }, onEnd: ctx => end?.(ctx) };
    } else kit.skill = { kind: 'duration', duration: s.duration, mods: { atkPct: bb.atk },
      targeting: { rangeGrid: s.rangeGrid, priority: 'lowDef' },
      attack: { dmgType: 'phys', attackVisual: 'Skill_3', windup: timed('Skill_3') } };
  }
  if (id === ARO || id === IFR) {
    kit.trait.attackVisual = (_battle, unit) => unit.dir === 'DOWN' ? 'Attack_Down' : 'Attack';
  }
}
export function installCastersNext({ battle: b, unit: u, def }) {
  const id = def.charId;
  if (!CASTERS_NEXT_OPERATORS[id]) return;
  if (id === ARO) {
    const t = def.talents[0]?.bb, mark = `aroma:first:${u.id}`;
    if (t) {
      b.on('hit', ({ source, target, dmg }) => {
        if (!live(u) || source !== u || target?.side !== 'enemy' || target.findBuff(mark)) return;
        b.addBuff(target, { key: mark, source: u });
        b.applyStatus(target, 'levitate', { source: u, duration: t.levitate_duration });
        dmg.amount *= t.damage_scale;
      }, { owner: u });
      b.on('death', ({ unit }) => { if (unit === u) for (const e of b.enemies) b.removeBuff(e, mark); }, { owner: u });
    }
    b.every(.1, () => syncAroma(b, u), { owner: u });
    b.on('death', () => syncAroma(b, u), { owner: u });
  } else if (id === IFR) {
    for (const event of ['deploy', 'death', 'tick', 'hit']) b.on(event, () => syncIfrit(b, u), { owner: u });
    const t = def.talents.find(x => x.bb.sp != null)?.bb;
    if (t) b.every(t.interval, () => { if (live(u)) u.skill.gainSp(t.sp, 'ifrit:talent'); }, { owner: u });
  } else if (id === MOS) {
    const t = def.talents.find(x => x.bb.sp_recovery_per_sec != null)?.bb;
    if (t) registerNamedSpRecovery(b, u, t.sp_recovery_per_sec, a => a.def?.profession === 'CASTER');
    for (const event of ['deploy', 'death', 'tick']) b.on(event, () => syncMostima(b, u), { owner: u });
  } else for (const event of ['deploy', 'death', 'tick']) b.on(event, () => syncCeobe(b, u), { owner: u });
}
