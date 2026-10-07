// SPDX-License-Identifier: GPL-3.0-or-later
import { acquireTargets, performAttack, resolveHit } from '../ai.js';
import { absoluteRangeKeys, sortEnemyTargets } from '../targeting.js';
import { COLS } from '../constants.js';

const enemiesInSkill = (b, u, skill, profile = {}) => b.enemiesInKeys(
  absoluteRangeKeys(skill.rangeGrid, u.tileR, u.tileC, u.dir), u,
  { ...u.profile, ...profile });

export function customizeGuardExpansionKit({ id, def, kit }) {
  const skill = def.skill;
  if (!skill) return;
  const bb = skill.bb;
  if (id === 'char_137_brownb') {
    kit.skill = skill.id === 'skchr_brownb_1'
      ? { id: skill.id, name: skill.name, kind: 'passive', mods: { dodgePhys: bb.prob } }
      : { id: skill.id, name: skill.name, kind: 'duration', duration: skill.duration,
        mods: { batPct: bb.base_attack_time } };
  } else if (id === 'char_347_jaksel' && skill.id === 'skchr_jaksel_2') {
    // Original BASE_ATTACK_TIME FINAL_SCALER controls counter frequency; its
    // mode uses an evasion-charge trigger instead of ordinary attack readiness.
    kit.skill = { id: skill.id, name: skill.name, kind: 'duration', duration: skill.duration,
      mods: { dodgePhys: bb['jaksel_skill_2[evade].prob'], batMul: bb.base_attack_time },
      attack: { noAttack: true } };
  } else if (id === 'char_271_spikes') {
    const second = skill.id === 'skchr_spikes_2';
    kit.skill = { id: skill.id, name: skill.name, kind: 'duration', duration: skill.duration,
      ...(second ? { targeting: { rangeGrid: skill.rangeGrid } } : { mods: { blockCntMul: 0 } }),
      attack: { attack: second ? 'ranged' : 'melee', projectile: second ? 'bolt' : 'none',
        projectileSpeed: 10, dmgType: second ? 'arts' : 'phys',
        atkScale: bb['attack@atk_scale'], hits: second ? 1 : 2,
        maxTargets: second ? bb['attack@max_target'] : 1,
        // The S2 selector is ordinary; normal/S1 explicitly prefer the drone tag.
        priority: second ? null : 'drone',
        dmgMul: (_b, u, t) => (second || t.blockedBy === u ? 1 : .8)
          * (t.tags.has('drone') ? def.talents[0]?.bb.atk_scale ?? 1 : 1),
      } };
  } else if (id === 'char_4063_quartz' && skill.id === 'skchr_quartz_2') {
    kit.skill = { id: skill.id, name: skill.name, kind: 'duration', duration: skill.duration,
      mods: { aspd: bb.attack_speed, dmgTakenMul: bb.damage_scale },
      attack: { atkScale: bb['attack@s2_atk_scale'],
        onHit: ({ battle, unit, target }) => {
          if (target.alive && battle.rng.chance(bb['attack@s2_buff_prob']))
            battle.applyStatus(target, 'stun', { source: unit, duration: bb['attack@s2_stun'] });
        } } };
  } else if (id === 'char_159_peacok') {
    kit.skill = skill.id === 'skchr_peacok_1'
      ? { id: skill.id, name: skill.name, kind: 'instant', attack: {
        atkScale: bb.atk_scale,
        dmgMul: b => b.rng.chance(bb['peacok_s_1[crit].prob']) ? bb['peacok_s_1[crit].atk_scale'] : 1,
      } }
      : { id: skill.id, name: skill.name, kind: 'instant', onStart: ({ battle, unit }) => {
        if (battle.rng.chance(bb.prob)) {
          for (const target of enemiesInSkill(battle, unit, skill, { canHitFly: true })) {
            battle.dealDamage(unit, target, { type: 'arts', amount: unit.s.atk * bb['success.atk_scale'], isSkill: true });
            if (target.alive) battle.applyStatus(target, 'silence', { source: unit, duration: bb['success.silence'] });
          }
        } else {
          const keys = new Set(absoluteRangeKeys(skill.rangeGrid, unit.tileR, unit.tileC, unit.dir));
          for (const ally of battle.allyUnits)
            if (ally.alive && ally.deployed && !ally.hidden && !ally.s.flags.untargetable
              && keys.has(Math.round(ally.y) * COLS + Math.round(ally.x)))
              battle.applyStatus(ally, 'stun', { source: unit, duration: bb['failure.stun'] });
        }
      } };
  } else if (id === 'char_301_cutter') {
    kit.skill = { id: skill.id, name: skill.name, kind: 'instant', onStart: ({ battle, unit }) => {
      if (skill.id === 'skchr_cutter_1') {
        // Source additionalTimes3, triggerDelta0.2, speed10, random selector.
        const fire = () => {
          if (!unit.alive || !unit.deployed || !unit.canAct) return;
          const targets = enemiesInSkill(battle, unit, skill, { canHitFly: true });
          if (!targets.length) return;
          const target = targets[Math.floor(battle.rng() * targets.length)];
          battle.addProjectile({ from: unit, source: unit, target, speed: 10, visual: 'bolt',
            onHit: ({ target }) => battle.dealDamage(unit, target,
              { type: 'phys', amount: unit.s.atk * bb.atk_scale, isSkill: true, isAttack: true }) });
        };
        battle.addBuff(unit, { key: 'cutter:knife-cast', duration: .6,
          flags: { disarm: true, noSp: true } });
        fire();
        for (let i = 1; i < bb.times; i++) battle.after(.2 * i, fire, { owner: unit });
        unit.atkCd = Math.max(unit.atkCd, .6);
      } else {
        const targets = enemiesInSkill(battle, unit, skill, { canHitFly: true });
        // Ordinary progress/block priority still applies before the source cap.
        sortEnemyTargets(battle, unit, targets, null);
        for (const target of targets.slice(0, bb.max_target)) battle.dealDamage(unit, target,
          { type: 'phys', amount: unit.s.atk * bb.atk_scale
            * (target.isFlying ? bb['cutter_s_2[drone].atk_scale'] : 1), isSkill: true, isAttack: true });
      }
    } };
  } else if (id === 'char_337_utage') {
    kit.skill = skill.id === 'skchr_utage_1'
      ? { id: skill.id, name: skill.name, kind: 'duration', duration: skill.duration,
        mods: { defPct: bb.def, blockCntMul: 0, hpRegenRatio: bb.hp_recovery_per_sec_by_max_hp_ratio },
        flags: { disarm: true } }
      : { id: skill.id, name: skill.name, kind: 'passive', onStart: ({ battle, unit }) => {
        battle.loseHp(unit, unit.hp * bb.hp_ratio, { source: unit });
        unit.profile.dmgType = 'arts';
        battle.addBuff(unit, { key: 'utage:deployment-arts', duration: bb.duration,
          mods: { atkPct: bb.atk }, onExpire: () => { unit.profile.dmgType = 'phys'; } });
      } };
  } else if (id === 'char_4067_lolxh') {
    kit.skill = skill.id === 'skchr_lolxh_1'
      ? { id: skill.id, name: skill.name, kind: 'instant', onStart: ({ battle, unit }) => {
        unit.mem.luoCat = !unit.mem.luoCat;
        if (unit.mem.luoCat) {
          battle.addBuff(unit, { key: 'luo:cat', mods: { dodgePhys: bb.prob, aspd: bb.attack_speed } });
          unit.rangeGrid = skill.rangeGrid;
          Object.assign(unit.profile, { attack: 'melee', projectile: 'none', canHitFly: false,
            dmgMul: () => 1 });
        } else {
          battle.removeBuff(unit, 'luo:cat');
          unit.rangeGrid = unit.mem.luoBaseGrid;
          Object.assign(unit.profile, { attack: 'ranged', projectile: 'bolt', canHitFly: true,
            dmgMul: (_b, u, t) => t.blockedBy === u ? 1 : .8 });
        }
        battle._refreshRange(unit);
      } }
      : { id: skill.id, name: skill.name, kind: 'duration', duration: skill.duration,
        mods: { atkPct: bb.atk }, attack: { maxTargets: 2, dmgMul: () => 1,
          // The source hit buff checks target HP at impact BEFORE the ordinary
          // attack, adding one separate normal damage instance under 50% HP.
          launchAttack: (battle, unit, profile, target, info) => {
            battle.addProjectile({ from: unit, source: unit, target, speed: 10, visual: 'bolt',
              onHit: c => {
                if (c.target?.alive && c.target.hpRatio < bb['attack@hp_ratio'])
                  battle.dealDamage(unit, c.target, { amount: unit.s.atk, type: 'phys',
                    defIgnoreFlat: bb['attack@def_penetrate_fixed'], isSkill: true, isAttack: true });
                resolveHit(battle, unit, profile, c.target, info, c.x, c.y);
              } });
          } } };
  } else if (id === 'char_491_humus') {
    if (skill.id === 'skchr_humus_1') kit.skill = {
      id: skill.id, name: skill.name, kind: 'instant', attack: { atkScale: bb.atk_scale },
      onStart: ({ battle, unit }) => battle.heal(unit, unit, bb.value,
        { self: true, ignoreHealFree: true }),
    };
    else {
      const update = ({ battle, unit }) => {
        const high = 'humus_s_2[peak_2].peak_performance.', low = 'humus_s_2[peak_1].peak_performance.';
        const bonus = unit.hpRatio > bb[high + 'hp_ratio'] ? bb[high + 'atk']
          : unit.hpRatio > bb[low + 'hp_ratio'] ? bb[low + 'atk'] : 0;
        battle.addBuff(unit, { key: 'humus:vigor', mods: { atkPct: bonus } });
      };
      kit.skill = { id: skill.id, name: skill.name, kind: 'duration', duration: skill.duration,
        mods: { blockCnt: bb.block_cnt }, onStart: update, onTick: update,
        onEnd: ({ battle, unit }) => battle.removeBuff(unit, 'humus:vigor') };
    }
  } else if (id === 'char_445_wscoot') {
    kit.skill = { id: skill.id, name: skill.name, kind: 'duration', duration: skill.duration,
      ...(skill.id === 'skchr_wscoot_1' ? { mods: { aspd: bb.attack_speed, defPct: bb.def } }
        : { rangeGrid: skill.rangeGrid, attack: { atkScale: bb['attack@atk_scale'], maxTargets: bb['attack@max_target'] } }),
    };
  }
}

export function installGuardExpansion({ battle, unit, def }) {
  const id = def.charId, talent = def.talents[0];
  if (id === 'char_137_brownb') {
    // Client's two visual punches divide one mitigated damage value. This uses
    // the same scoped splitDamage interpretation documented for Gravel.
    Object.assign(unit.profile, { hits: 2, atkScale: 1, hitDamageScale: .5,
      onlyFirstHitGainsSp: true });
    if (!talent) return;
    let targetId = null, stacks = 0;
    battle.on('beforeAttack', ({ attacker, targets }) => {
      if (attacker !== unit || !targets[0]) return;
      const next = targets[0].id;
      if (next !== targetId) { targetId = next; stacks = 0; }
      stacks = Math.min(stacks + 1, talent.bb.max_stack_cnt);
      battle.addBuff(unit, { key: 'beehunter:consecutive',
        mods: { atkPct: talent.bb.atk * stacks } });
    }, { owner: unit });
  } else if (id === 'char_347_jaksel') {
    if (talent) battle.addBuff(unit, { key: 'jackie:evasion', persist: true,
      allowDead: true, mods: { dodgePhys: talent.bb.prob } });
    let counterAt = -Infinity;
    battle.on('dodge', ({ target, dmg }) => {
      if (target !== unit || !unit.alive || !unit.deployed || dmg.type !== 'phys') return;
      if (talent) battle.addBuff(unit, { key: 'jackie:evasion-speed',
        duration: talent.bb['charge_atk_speed_on_evade.duration'],
        mods: { aspd: talent.bb['charge_atk_speed_on_evade.attack_speed'] } });
      if (def.skill.id !== 'skchr_jaksel_2' || !unit.skill.active || !unit.canAct
        || battle.time + 1e-9 < counterAt) return;
      const profile = { ...unit.profile, noAttack: false, isSkill: true,
        atkScale: def.skill.bb['attack@atk_scale'] };
      const targets = acquireTargets(battle, unit, profile);
      if (!targets.length) return;
      counterAt = battle.time + unit.s.interval;
      performAttack(battle, unit, profile, targets);
    }, { owner: unit });
    battle.on('skillStart', ({ unit: casting }) => {
      if (casting === unit) counterAt = -Infinity;
    }, { owner: unit });
  } else if (id === 'char_271_spikes') {
    Object.assign(unit.profile, { priority: 'drone', attack: 'ranged', projectile: 'bolt',
      projectileSpeed: 10,
      dmgMul: (_b, u, t) => (t.blockedBy === u ? 1 : .8)
        * (t.tags.has('drone') ? talent?.bb.atk_scale ?? 1 : 1) });
  } else if (id === 'char_4063_quartz') {
    // Both selectors limit by CURRENT block count; they are not splash attacks.
    unit.profile.hitAllBlocked = false;
    Object.defineProperty(unit.profile, 'maxTargets', {
      enumerable: true, get: () => Math.max(1, unit.s.blockCnt),
    });
  } else if (id === 'char_159_peacok') {
    battle.on('deploy', ({ unit: deployed }) => {
      if (deployed === unit) battle.applyStatus(unit, 'stun', { source: unit, duration: talent.bb.stun });
    }, { owner: unit });
  } else if (id === 'char_301_cutter' && talent) {
    battle.on('damaged', ({ source, target }) => {
      if (source === unit && target.side === 'enemy' && !unit.skill.active
        && battle.rng.chance(talent.bb.prob))
        unit.skill.gainSp(talent.bb.sp, 'cutter:talent');
    }, { owner: unit });
  } else if (id === 'char_337_utage' && talent) {
    const sync = () => battle.addBuff(unit, { key: 'utage:tenacity',
      mods: { aspd: talent.bb.min_attack_speed * Math.min(1,
        (1 - unit.hpRatio) / (1 - talent.bb.min_hp_ratio)) } });
    // Original talent polls HP once every .25s, starting at deployment.
    battle.on('deploy', ({ unit: deployed }) => { if (deployed === unit) sync(); }, { owner: unit });
    battle.every(.25, sync, { owner: unit });
  } else if (id === 'char_4067_lolxh') {
    unit.mem.luoBaseGrid = unit.rangeGrid;
    Object.assign(unit.profile, { attack: 'ranged', projectile: 'bolt', projectileSpeed: 10,
      dmgMul: (_b, u, t) => t.blockedBy === u ? 1 : .8,
      canTarget: (_u, target) => !target.findBuff('cripple') });
    Object.defineProperty(unit.profile, 'maxTargets', { enumerable: true,
      get: () => unit.mem.luoCat ? Math.max(1, unit.s.blockCnt) : 1 });
    battle.on('fatal', c => {
      if (c.source !== unit || c.unit.side !== 'enemy') return;
      c.prevented = true; c.unit.hp = 1;
      if (c.unit.findBuff('cripple')) return;
      const target = c.unit;
      battle._unblock(target);
      battle.addBuff(target, { key: 'cripple', source: unit,
        mods: { moveMul: 1 + talent.bb.move_speed, blockCntMul: 0 },
        flags: { disarm: true, healFree: true, unblockable: true },
        interval: talent.bb.interval, onTick: () => {
          if (!target.hidden) battle.kill(target, null);
        }, data: { sp: talent.bb.sp } });
      // The source cripple survives Luo's retreat/death and credits its eventual
      // killer, so this target-owned kill listener must not belong to Luo.
      battle.on('kill', ({ victim, killer }) => {
        if (victim === target && killer?.side === 'ally')
          killer.skill?.gainSp(talent.bb.sp, 'cripple');
      }, { owner: target });
      battle.on('enemyBeforeAppear', ({ enemy }) => {
        if (enemy === target) battle.kill(target, null);
      }, { owner: target });
      battle.on('heal', heal => { if (heal.target === target) heal.amount = 0; }, { owner: target });
    }, { owner: unit });
  } else if (id === 'char_491_humus' && talent) {
    battle.on('heal', c => {
      if (c.target !== unit) return;
      const excess = Math.max(0, c.amount - Math.max(0, unit.s.maxHp - unit.hp));
      if (!excess) return;
      const old = unit.findBuff('humus:barrier');
      battle.addBuff(unit, { key: 'humus:barrier', source: unit,
        shield: Math.min(unit.s.maxHp * talent.bb.max_hp_ratio, (old?.shield ?? 0) + excess) });
    }, { owner: unit });
  } else if (id === 'char_445_wscoot' && talent) {
    const inactiveBlock = ({ unit: changed }) => {
      if (changed === unit && !unit.skill.active) battle.addBuff(unit,
        { key: 'trait:libratorBlock', mods: { blockCntMul: 0 } });
    };
    battle.on('deploy', inactiveBlock, { owner: unit });
    battle.on('skillEnd', inactiveBlock, { owner: unit });
    battle.on('hit', c => {
      if (c.source !== unit) return;
      if (unit.skill.active && unit.skill.id === 'skchr_wscoot_2') c.dmg.canDodge = false;
      if (unit.trait.ramp + 1e-9 < unit.profile.rampMax || c.dmg.tags.includes('windscoot:extra')) return;
      // ON_OUTPUT_DAMAGE precedes the main hit; the extra hit gets separate
      // DEF mitigation and does not recursively trigger itself.
      battle.dealDamage(unit, c.target, { amount: unit.s.atk * talent.bb.atk_scale,
        type: 'phys', canDodge: c.dmg.canDodge, isAttack: true, isSkill: c.dmg.isSkill,
        tags: ['windscoot:extra'], attackId: c.dmg.attackId });
    }, { owner: unit });
  }
}
