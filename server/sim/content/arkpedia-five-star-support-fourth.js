// SPDX-License-Identifier: GPL-3.0-or-later
import { FIVE_STAR_SUPPORT_FOURTH_OPERATORS } from '../../../shared/arkpedia/five-star-support-fourth-operators.js';
import evidence from '../../../data/arkpedia-five-star-support-fourth-prefabs.json' with { type: 'json' };
import { bodyInKeys } from '../body.js';
import { aggregateMods } from '../buffs.js';
import { isHpLoss } from '../damage.js';
import { resolveHit } from '../ai.js';

const NOTHING = 'char_455_nothin', TSUKI = 'char_343_tknogi', QUERCUS = 'char_492_quercu';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[u.defId][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const timed = (clip, cap = 1) => (_b, u) => model(u).hits[clip][0] / Math.min(cap, u.s.aspd / 100);
const legalAlly = (b, u, a, targetFree = false) => live(a) && a.kind !== 'device'
  && b.allySelectable(a, u) && (targetFree || !a.s.flags.untargetable);
const healable = (b, u, a) => legalAlly(b, u, a) && !a.s.flags.healFree
  && (a === u || !(a.s.flags.noHeal || a.profile?.noHeal));
const injured = (b, u) => b.allyUnits.filter(a => healable(b, u, a)
  && bodyInKeys(a, u.rangeKeySet) && a.hp < a.s.maxHp - .01)
  .sort((a, z) => a.hpRatio - z.hpRatio || a.deploySeq - z.deploySeq);
const form = (u, clip, loop = false, attack) => {
  u.mem.regularFormVisual = { clip, loop, ...(attack ? { attack } : {}) };
};

// The source mode owns its entire beginning/ending clip. A generation guards
// delayed callbacks across cancellation or a subsequent activation.
function transition(b, u, begin, idle, attack) {
  const gen = u.mem.supportFourthGeneration = (u.mem.supportFourthGeneration ?? 0) + 1;
  form(u, begin);
  const duration = model(u).durations[begin];
  b.addBuff(u, { key: 'support-fourth:transition', duration, flags: { disarm: true } });
  b.after(duration, () => {
    if (live(u) && u.skill.active && u.mem.supportFourthGeneration === gen) form(u, idle, true, attack);
  }, { owner: u });
}
function endTransition(b, u, clip, reason) {
  const gen = u.mem.supportFourthGeneration = (u.mem.supportFourthGeneration ?? 0) + 1;
  b.removeBuff(u, 'support-fourth:transition');
  if (reason === 'death' || !live(u)) { u.mem.regularFormVisual = null; return; }
  form(u, clip);
  const duration = model(u).durations[clip];
  b.addBuff(u, { key: 'support-fourth:transition', duration, flags: { disarm: true } });
  b.after(duration, () => {
    if (u.mem.supportFourthGeneration === gen) u.mem.regularFormVisual = null;
  }, { owner: u });
}

export function customizeFiveStarSupportFourthKit({ id, def, unit: u, kit }) {
  if (!FIVE_STAR_SUPPORT_FOURTH_OPERATORS[id]) return;
  kit.install = null;
  const s = def.skill, bb = s.bb, first = s.id === FIVE_STAR_SUPPORT_FOURTH_OPERATORS[id].skillIds[0];
  if (id === NOTHING) {
    // Retain only the reviewed generic merchant payment installer; no generic
    // talent or skill installation is used for these source modes.
    kit.trait = { attack: 'melee', dmgType: 'phys', projectile: 'none', maxTargets: 1,
      canHitFly: false, attackVisual: 'Attack', windup: timed('Attack', 2),
      merchantInterval: def.traitBb.interval, merchantCost: -def.traitBb.cost,
      interruptOnSkillChange: true };
    kit.skill = first ? { kind: 'duration', duration: s.duration, trigger: 'SP_FULL',
      canActivate: () => u.hpRatio < bb.max_hp_ratio,
      flags: { disarm: true }, mods: { blockCntMul: 0, taunt: bb.taunt_level,
        hpRegenRatio: bb.hp_recovery_per_sec_by_max_hp_ratio },
      onStart: ({ battle: b }) => transition(b, u, 'Skill_1_Begin', 'Skill_1_Loop'),
      onEnd: ({ battle: b, reason }) => endTransition(b, u, 'Skill_1_End', reason),
    } : { kind: 'toggle', manualCancel: true, mods: { atkPct: bb.atk },
      attack: { attackVisual: 'Skill_2_Loop', windup: timed('Skill_2_Loop', 2) },
      onStart: ({ battle: b }) => {
        const previous = u.mem.nothingVariant;
        const variant = b.rng.pick(['a', 'b', 'c'].filter(x => x !== previous));
        u.mem.nothingVariant = variant;
        if (variant === 'b') b.addBuff(u, { key: 'nothing:variant', mods: { aspd: bb.attack_speed } });
        else if (variant === 'c') b.addBuff(u, { key: 'nothing:variant',
          mods: { dodgePhys: bb.prob, blockCnt: bb.block_cnt } });
        transition(b, u, 'Skill_2_Begin', 'Idle_2', 'Skill_2_Loop');
      }, onEnd: ({ battle: b, reason }) => {
        b.removeBuff(u, 'nothing:variant'); endTransition(b, u, 'Skill_2_End', reason);
      },
    };
  } else {
    kit.trait = { attack: 'ranged', dmgType: 'arts', projectile: 'orb', projectileSpeed: 8,
      maxTargets: 1, canHitFly: true, install: null, heal: null,
      attackVisual: 'Attack', windup: timed('Attack'), interruptOnSkillChange: true };
    // The original healing projectiles use speed8 and revalidate HEAL legality
    // at impact. A projectile already emitted does not need a live source.
    // Mode switching changes the source profile, not a generic Heal override:
    // the ordinary HEAL fallback would bypass this source projectile callback.
    const healing = { projectile: 'none', heal: null };
    kit.trait.acquireTargets = (b, unit, profile) => profile.dmgType === 'heal'
      ? injured(b, unit).slice(0, 1 + Math.max(0, Math.floor(unit.s.maxTargets))) : null;
    kit.trait.launchAttack = (b, unit, profile, target, info) => b.addProjectile({
        from: unit, target, speed: 8, source: unit, visual: 'orb', data: { arkpediaTrackedVisual: true },
        onHit: ({ target: a }) => {
          if (profile.dmgType !== 'heal') {
            resolveHit(b, unit, profile, a, info, a?.x ?? target.x, a?.y ?? target.y); return;
          }
          if (!healable(b, unit, a)) return;
          b.heal(unit, a, unit.s.atk * def.traitBb.heal_scale);
          // Source demkni_t_2 IsHeal acts on accepted healing output, including
          // an overheal. It does not bypass active/noSp SP restrictions.
          if (id === QUERCUS && !first && live(unit) && unit.skill.active) a.skill?.gainSp(bb.sp, 'quercus:heal');
        },
      });
    if (id === TSUKI) {
      kit.skill = { kind: 'duration', duration: s.duration,
        ...(first ? { attack: { ...healing, attackVisual: 'Attack', windup: timed('Attack', Infinity) } }
          : { flags: { disarm: true } }),
        onStart: ({ battle: b }) => {
          if (first) u.profile.dmgType = 'heal';
          if (!first) transition(b, u, 'Skill_2_Start', 'Skill_2_Loop');
          syncBlessing(b, u, def);
        }, onTick: ({ battle: b }) => syncBlessing(b, u, def),
        onEnd: ({ battle: b, reason }) => {
          u.profile.dmgType = 'arts';
          clearSkillAuras(b, u);
          if (!first) endTransition(b, u, 'Skill_2_End', reason);
          syncBlessing(b, u, def);
        },
      };
    } else {
      const begin = first ? 'Skill_begin' : 'Skill_2_begin', idle = first ? 'Skill_Idle' : 'Skill_2_Idle';
      const attack = first ? 'Skill_Loop' : 'Skill_2_Loop', end = first ? 'Skill_End' : 'Skill_2_End';
      kit.skill = { kind: first ? 'toggle' : 'duration', manualCancel: first,
        duration: s.duration, mods: first ? { atkPct: bb.atk } : { aspd: bb.attack_speed },
        attack: { ...healing, attackVisual: attack, windup: timed(attack, Infinity) },
        onStart: ({ battle: b }) => { u.profile.dmgType = 'heal'; transition(b, u, begin, idle, attack); },
        onEnd: ({ battle: b, reason }) => { u.profile.dmgType = 'arts'; endTransition(b, u, end, reason); } };
    }
  }
  kit.skill.id = s.id; kit.skill.name = s.name;
}

function clearSkillAuras(b, u) {
  for (const a of b.allyUnits) {
    b.removeBuff(a, `tsuki:dodge:${u.id}`); b.removeBuff(a, `tsuki:regen:${u.id}`);
  }
  for (const e of b.enemies) b.removeBuff(e, `tsuki:reveal:${u.id}`);
}
function syncBlessing(b, u, def) {
  const tsuki = def.charId === TSUKI, s = def.skill, first = s.id.endsWith('_1');
  const active = live(u) && u.skill.active;
  const talent = def.talents[0]?.bb, enhanced = tsuki && active && !first;
  const threshold = enhanced ? s.bb['talent@hp_ratio'] : talent?.hp_ratio;
  const value = (talent?.damage_resistance ?? 0) * (enhanced ? s.bb.talent_scale : 1);
  const sanctuary = `blessing:sanctuary:${u.id}`;
  for (const a of b.allyUnits) {
    const inside = live(u) && bodyInKeys(a, u.rangeKeySet);
    const checkerKey = `blessing:checker:${u.id}`;
    const eligible = talent && inside && legalAlly(b, u, a);
    if (!eligible) {
      b.removeBuff(a, checkerKey); b.removeBuff(a, sanctuary);
    } else {
      // Original aura triggerInterval .1 / waitFirstTriggerInterval1 evaluates
      // each recipient after a full first interval, not on membership entry.
      // HP changes are sampled at that cadence; range/detach cleanup is immediate.
      let checker = a.findBuff(checkerKey);
      if (!checker) checker = b.addBuff(a, { key: checkerKey, source: u, interval: .1,
        data: { threshold, value, tsuki }, onTick: ({ buff }) => {
          if (!live(u) || !bodyInKeys(a, u.rangeKeySet) || !legalAlly(b, u, a)) {
            b.removeBuff(a, sanctuary); return;
          }
          const current = buff.data;
          const pass = current.tsuki ? a.hpRatio <= current.threshold : a.hpRatio >= current.threshold;
          if (!pass) b.removeBuff(a, sanctuary);
          else if (a.findBuff(sanctuary)?.data.value !== current.value)
            b.applyStatus(a, 'sanctuary', { key: sanctuary, source: u, value: current.value });
        } });
      checker.data = { threshold, value, tsuki };
    }
    if (!tsuki) continue;
    const dodgeKey = `tsuki:dodge:${u.id}`, regenKey = `tsuki:regen:${u.id}`;
    if (active && first && inside && legalAlly(b, u, a)) {
      if (!a.findBuff(dodgeKey)) b.addBuff(a, { key: dodgeKey, source: u,
        mods: { dodgePhys: s.bb['attack@prob'], dodgeArts: s.bb['attack@prob'] } });
    } else b.removeBuff(a, dodgeKey);
    // Original S2 aura ignores target-free/HealFree, not ally isolation. Its
    // waitFirstTriggerInterval1 deliberately delays the first pulse by1s.
    if (active && !first && inside && legalAlly(b, u, a, true)) {
      if (!a.findBuff(regenKey)) b.addBuff(a, { key: regenKey, source: u, interval: 1,
        onTick: () => {
          if (!live(u) || !u.skill.active || !legalAlly(b, u, a, true) || !bodyInKeys(a, u.rangeKeySet)) return;
          const multiplier = aggregateMods(a.buffs).mul.hpRegenMul ?? 1;
          b.heal(u, a, u.s.atk * s.bb['attack@atk_to_hp_recovery_ratio'] * multiplier,
            { self: true, regen: true });
        } });
    } else b.removeBuff(a, regenKey);
  }
  if (tsuki) for (const e of b.enemies) {
    const key = `tsuki:reveal:${u.id}`;
    if (active && first && live(e) && bodyInKeys(e, u.rangeKeySet)) {
      if (!e.findBuff(key)) b.applyStatus(e, 'reveal', { key, source: u });
    } else b.removeBuff(e, key);
  }
}

export function installFiveStarSupportFourth({ battle: b, unit: u, def }) {
  if (!FIVE_STAR_SUPPORT_FOURTH_OPERATORS[def.charId]) return;
  const talent = def.talents[0]?.bb;
  if (def.charId !== NOTHING) {
    const sync = () => syncBlessing(b, u, def);
    for (const event of ['deploy', 'death', 'tick']) b.on(event, sync, { owner: u });
    return;
  }
  const first = def.skill.id.endsWith('_1');
  if (first) b.addBuff(u, { key: 'nothing:passive-block', persist: true, allowDead: true,
    mods: { blockCnt: def.skill.bb.block_cnt } });
  if (talent) {
    u.mem.nothingReadyAt = b.time + talent.delay;
    b.on('beforeAttack', ({ attacker }) => {
      if (attacker !== u) return;
      u.mem.nothingEmpowered = b.time >= u.mem.nothingReadyAt - 1e-9;
      u.mem.nothingReadyAt = b.time + talent.delay;
    }, { owner: u });
    b.on('hit', ({ source, target, dmg }) => {
      if (source === u && target.side === 'enemy' && dmg.isAttack && u.mem.nothingEmpowered)
        dmg.amount *= talent.atk_scale;
    }, { owner: u });
    b.on('attack', ({ attacker }) => { if (attacker === u) u.mem.nothingEmpowered = false; }, { owner: u });
  }
  b.on('damaged', ({ source, target, dmg }) => {
    if (source !== u || target.side !== 'enemy' || !dmg?.isAttack || isHpLoss(dmg)) return;
    if (talent && u.mem.nothingEmpowered && target.alive)
      b.applyStatus(target, 'stun', { key: 'nothing:stun', source: u, duration: talent.stun });
    if (!first && u.skill.active && u.mem.nothingVariant === 'a') b.addBuff(target, {
      key: 'nothin_s_2[a][attack_speed_down]', source: u,
      duration: def.skill.bb['nothin_s_2[a][attack_speed_down].duration'],
      mods: { aspd: def.skill.bb['nothin_s_2[a][attack_speed_down].attack_speed'] } });
  }, { owner: u });
}
