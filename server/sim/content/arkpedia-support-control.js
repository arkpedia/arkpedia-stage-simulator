// SPDX-License-Identifier: GPL-3.0-or-later
import { SUPPORT_CONTROL_OPERATORS } from '../../../shared/arkpedia/support-control-operators.js';
import evidence from '../../../data/arkpedia-support-control-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { bodyInKeys } from '../body.js';
import { canTargetEnemy } from '../targeting.js';

const live = u => u?.alive && u.deployed;
const model = u => evidence.models[u.defId][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const windup = clip => (b, u) => model(u).hits[clip][0] / Math.min(1, u.s.aspd / 100);
const talent = (def, index) => def.talents[index]?.bb ?? {};

/** Source modes use distinct direct MultiMeleeAttack clips. No projectile or
 * inherited generic Stalker rider participates in the reviewed kit. */
export function customizeSupportControlKit({ id, def, unit: u, kit }) {
  if (!SUPPORT_CONTROL_OPERATORS[id]) return;
  kit.install = null;
  const s = def.skill, bb = s.bb;
  kit.trait = { attack: 'melee', dmgType: 'phys', projectile: 'none', canHitFly: false,
    allInRange: true, hitAllBlocked: false, retargetOnRelease: true, install: null,
    windup: windup('Attack'), attackVisual: 'Attack', interruptOnSkillChange: true,
    acquireTargets: (b, unit, profile) => {
      const targets = b.enemiesInKeys(unit.rangeKeys, unit, profile);
      const first = talent(def, 0), mode = profile.isSkill ? s.id : null;
      const count = first['attack@max_target'] +
        (['skchr_mizuki_2', 'skchr_mizuki_3'].includes(mode) ? bb['attack@max_target'] : 0);
      // Original selectTargetTiming0 selects at CAST/release. The native
      // postFilter16 secondary pick therefore uses that actual victim set.
      profile._mizukiMarks = new Set(targets.slice().sort((a, z) => a.hp - z.hp || a.spawnSeq - z.spawnSeq).slice(0, count));
      profile._mizukiTalentScale = first['attack@mizuki_t_1.atk_scale'] *
        (mode === 'skchr_mizuki_1' ? bb.talent_scale : 1);
      profile._mizukiControl = mode === 'skchr_mizuki_2'
        ? { key: 'bind', duration: bb['attack@unmovable'] }
        : mode === 'skchr_mizuki_3' ? { key: 'stun', duration: bb['attack@stun'] } : null;
      return targets;
    },
    launchAttack: (b, unit, profile, target, info) => {
      if (!canTargetEnemy(unit, target, profile)) return;
      unit.mem.mizukiEmittedAttackId = info.attackId;
      resolveHit(b, unit, profile, target, info, target.x, target.y);
      if (!live(target) || !profile._mizukiMarks?.has(target)) return;
      b.dealDamage(unit, target, { amount: unit.s.atk * unit.s.atkScaleMul * profile._mizukiTalentScale,
        type: 'arts', applyWay: 'none', isAttack: true, isSkill: info.isSkill,
        attackId: info.attackId, tags: ['mizuki:talent'] });
      // The conditional target buff is distinct from damage acceptance: Bind
      // and Stun still apply to a living selected victim behind a damage shield.
      if (profile._mizukiControl && target.alive) b.applyStatus(target, profile._mizukiControl.key,
        { duration: profile._mizukiControl.duration, source: unit });
    },
    afterAttack: (b, unit, targets, metadata) => {
      if (s.id === 'skchr_mizuki_1' && unit.mem.mizukiS1RefundPending) {
        if (unit.mem.mizukiEmittedAttackId !== metadata.attackId
          && metadata.inputTargets.every(target => !target.alive)) unit.skill.addCharge(1);
        unit.mem.mizukiS1RefundPending = false;
      }
      if (unit.skill.active && unit.skill.id === 'skchr_mizuki_3'
        && unit.mem.mizukiEmittedAttackId === metadata.attackId && targets.length < 3)
        b.loseHp(unit, unit.s.maxHp * bb['attack@hp_ratio'], { source: unit,
          tags: ['mizuki:s3-hp-loss'] });
    },
  };
  if (s.id === 'skchr_mizuki_1') {
    kit.skill = { id: s.id, name: s.name, kind: 'instant',
      attack: { atkScale: bb.atk_scale },
      onStart: () => { u.mem.mizukiS1RefundPending = true; },
      onEnd: ({ reason }) => { if (reason !== 'instant') u.mem.mizukiS1RefundPending = false; } };
  } else if (s.id === 'skchr_mizuki_2') {
    kit.skill = { id: s.id, name: s.name, kind: 'duration', duration: s.duration,
      mods: { atkPct: bb.atk, batFlat: bb.base_attack_time },
      attack: { attackVisual: 'Skill_1', windup: windup('Skill_1') } };
  } else {
    kit.skill = { id: s.id, name: s.name, kind: 'duration', duration: s.duration,
      mods: { atkPct: bb.atk }, targeting: { rangeGrid: s.rangeGrid },
      attack: { attackVisual: 'Skill_2_Loop', windup: windup('Skill_2_Loop') },
      onStart: ({ battle: b }) => {
        // Original animator hook replaces Idle, while its mix settings use
        // Skill_2_End when the mode returns to the default. Start is not wired.
        u.mem.regularFormVisual = { clip: 'Skill_2_Idle', loop: true, attack: 'Skill_2_Loop' };
      }, onEnd: ({ battle: b }) => {
        if (!live(u)) { u.mem.regularFormVisual = null; return; }
        const seq = u.deploySeq;
        u.mem.regularFormVisual = { clip: 'Skill_2_End', loop: false };
        b.after(model(u).durations.Skill_2_End, () => {
          if (u.deploySeq === seq) u.mem.regularFormVisual = null;
        }, { owner: u });
      } };
  }
}

export function installSupportControl({ battle: b, unit: u, def }) {
  if (!SUPPORT_CONTROL_OPERATORS[def.charId]) return;
  b.addBuff(u, { key: 'mizuki:dodge', persist: true, allowDead: true,
    mods: { dodgePhys: def.traitBb.prob, dodgeArts: def.traitBb.prob } });
  const second = talent(def, 1);
  if (!second.hp_ratio) return;
  const checkerKey = `mizuki:checker:${u.id}`, attackKey = `mizuki:attack:${u.id}`;
  const qualifying = new Set();
  const syncAtk = () => {
    if (qualifying.size && live(u)) {
      if (!u.findBuff(attackKey) || u.findBuff(attackKey).timeLeft !== Infinity)
        b.addBuff(u, { key: attackKey, mods: { atkPct: second.atk } });
    } else {
      const old = u.findBuff(attackKey);
      // Original mizuki_t_2[atk] finish creates the same modifier for .02s.
      if (old && old.timeLeft === Infinity) { old.timeLeft = old.duration = .02; }
    }
  };
  const check = enemy => {
    if (enemy.hpRatio <= second.hp_ratio + 1e-9) qualifying.add(enemy);
    else qualifying.delete(enemy);
    syncAtk();
  };
  const sync = () => {
    for (const e of b.enemies) {
      // Native purpose NONE + ignoreTargetFree1 observes hidden attack states
      // such as stealth/sleep; actual disappeared entities are off the board.
      const eligible = live(u) && live(e) && !e.hidden
        && bodyInKeys(e, u.rangeKeys);
      if (!eligible) {
        if (e.findBuff(checkerKey)) b.removeBuff(e, checkerKey);
        qualifying.delete(e); continue;
      }
      if (!e.findBuff(checkerKey)) {
        b.addBuff(e, { key: checkerKey, source: u, interval: .2,
          onTick: () => check(e) });
        check(e); // Original waitFirstTriggerInterval0.
      }
    }
    syncAtk();
  };
  b.on('tick', sync, { owner: u }); b.on('deploy', sync, { owner: u });
  b.on('death', ({ unit }) => {
    if (unit === u) {
      for (const e of b.enemies) b.removeBuff(e, checkerKey);
      qualifying.clear(); b.removeBuff(u, attackKey); u.mem.regularFormVisual = null;
    } else if (qualifying.delete(unit)) syncAtk();
  }, { owner: u });
}
