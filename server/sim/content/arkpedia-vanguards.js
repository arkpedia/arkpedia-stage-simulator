// SPDX-License-Identifier: GPL-3.0-or-later
// Original client bindings and selected fields: data/arkpedia-vanguard-prefabs.json.
import { VANGUARD_OPERATORS } from '../../../shared/arkpedia/vanguard-operators.js';
import { compileBuffTemplate } from '../../../shared/arkpedia/behavior.js';
import evidence from '../../../data/arkpedia-vanguard-prefabs.json' with { type: 'json' };

// The exact charge_cost template is bound by the S1 / Scavenger S2 / Courier
// once prefabs. periodic_cost uses the identical ModifyCost action on each
// ON_BUFF_TRIGGER; its source interval and count are scheduled by the skill.
const chargeCost = compileBuffTemplate(evidence.templates.charge_cost);
function grant({ battle, unit }, cost) {
  chargeCost.run('ON_BUFF_START', { battle, unit, blackboard: { cost } });
}
function periodicCost(spec, { interval, count, cost, once = 0, healScale = 0 }) {
  let elapsed = 0, granted = 0;
  spec.onStart = ctx => {
    elapsed = 0; granted = 0;
    if (once) grant(ctx, once);
  };
  spec.onTick = ctx => {
    // SkillRuntime calls onTick before decrementing the duration. Clamp the
    // final step so neither DP nor continuous healing runs past the skill.
    const dt = Math.min(ctx.dt, Math.max(0, ctx.skill.timeLeft));
    const previousElapsed = elapsed;
    elapsed += dt;
    while (granted < count && elapsed + 1e-9 >= (granted + 1) * interval) {
      grant(ctx, cost); granted++;
    }
    const healingDt = healScale ? Math.max(0, elapsed - evidence.myrtle.healingAbility._preDelay)
      - Math.max(0, previousElapsed - evidence.myrtle.healingAbility._preDelay) : 0;
    if (healingDt > 0 && ctx.unit.canAct) {
      const target = ctx.battle.lowestHpAllyInRange(ctx.unit);
      if (target) ctx.battle.heal(ctx.unit, target, ctx.unit.s.atk * healScale * healingDt);
    }
  };
}

/** Apply before setup so the selected skill owns its duration and callbacks. */
export function customizeVanguardKit({ id, def, unit, kit }) {
  if (!VANGUARD_OPERATORS[id]) return;
  const skill = def.skill, bb = skill.bb;
  if (skill.id === 'skcom_charge_cost[2]') {
    kit.skill = { kind: 'instant', onStart: ctx => grant(ctx, bb.cost) };
  } else if (id === 'char_198_blackd') {
    kit.skill.mods = { defPct: bb['blackd_s_2[period].def'] };
    periodicCost(kit.skill, {
      interval: bb['blackd_s_2[period].interval'], count: bb['blackd_s_2[period].trig_cnt'],
      cost: bb['blackd_s_2[period].cost'], once: bb['blackd_s_2[once].cost'],
    });
  } else if (id === 'char_149_scave') {
    kit.skill.mods = { atkPct: bb.atk };
    kit.skill.onStart = ctx => grant(ctx, bb.cost);
  } else if (id === 'char_290_vigna') {
    kit.skill.mods = { atkPct: bb.atk };
    if (skill.id === 'skchr_vigna_2') {
      // BASE_ATTACK_TIME ADDITION, not a percentage of an externally modified BAT.
      kit.skill.mods.batFlat = bb.base_attack_time;
    }
  } else if (id === 'char_151_myrtle') {
    // Character-table override binds S1 to skchr_myrtle_1. Both channel modes
    // set BLOCK_CNT FINAL_SCALER to zero, including outside block-count buffs.
    kit.skill.mods = { blockCntMul: 0 };
    kit.skill.attack = { noAttack: true };
    if (skill.id === 'skchr_myrtle_2')
      kit.skill.targeting = { rangeGrid: skill.rangeGrid };
    // S2's original HealAbility has isCont=1 and a single injured ally selector:
    // heal continuously at ATK * heal_scale / second, not at ordinary attack BAT.
    periodicCost(kit.skill, {
      interval: bb.interval, count: bb.value, cost: bb.cost,
      healScale: skill.id === 'skchr_myrtle_2' ? bb['attack@heal_scale'] : 0,
    });
  }
}

const liveAllies = battle => battle.allyUnits.filter(u => u.alive && u.deployed && !u.hidden);
function conditionalBuff(battle, unit, key, mods, active) {
  const buff = unit.findBuff(key);
  if (active) {
    if (!buff) battle.addBuff(unit, { key, mods, source: unit });
  } else if (buff) battle.removeBuff(unit, buff);
}

/** Owned talent hooks are installed before deployment, and removed on retreat. */
export function installVanguard({ battle, unit, def }) {
  const id = def.charId, talent = def.talents[0]?.bb;
  if (!VANGUARD_OPERATORS[id] || !talent) return;
  if (id === 'char_198_blackd') {
    const sync = () => {
      if (!unit.alive || !unit.deployed) return;
      conditionalBuff(battle, unit, 'courier:patrol', { defPct: talent.def },
        unit.blocking.filter(enemy => enemy.alive && enemy.blockedBy === unit).length >= talent.cnt);
    };
    battle.on('blocked', sync, { owner: unit });
    battle.on('death', sync, { owner: unit });
    battle.on('tick', sync, { owner: unit });
  } else if (id === 'char_149_scave') {
    const sync = () => {
      if (!unit.alive || !unit.deployed) return;
      const adjacent = liveAllies(battle).some(ally => ally !== unit &&
        Math.abs(ally.tileR - unit.tileR) + Math.abs(ally.tileC - unit.tileC) === 1);
      conditionalBuff(battle, unit, 'scavenger:lone-wolf', { atkPct: talent.atk, defPct: talent.def }, !adjacent);
    };
    battle.on('deploy', sync, { owner: unit });
    battle.on('death', sync, { owner: unit });
    battle.on('tick', sync, { owner: unit });
  } else if (id === 'char_290_vigna') {
    const key = 'vigna:fierce-stabbing';
    battle.on('beforeAttack', ({ attacker }) => {
      if (attacker !== unit) return;
      battle.removeBuff(unit, key);
      if (battle.rng.chance(unit.skill.active ? talent.prob2 : talent.prob1))
        // Source ATK PERCENTAGE adds to the skill's ATK buff; multiplying final
        // damage would incorrectly multiply the talent by the skill as well.
        battle.addBuff(unit, { key, mods: { atkPct: talent.atk }, source: unit });
    }, { owner: unit });
    battle.on('attack', ({ attacker }) => {
      if (attacker === unit) battle.removeBuff(unit, key);
    }, { owner: unit });
  } else if (id === 'char_151_myrtle') {
    const key = `myrtle:glistening:${unit.id}`;
    const clear = () => {
      for (const ally of battle.allyUnits) battle.removeBuff(ally, key);
    };
    const sync = () => {
      if (!unit.alive || !unit.deployed) return;
      // The validator has professionMask=512 (PIONEER) and includes the owner.
      // HP_RECOVERY_PER_SEC is regeneration, also valid on unhealable Vanguards.
      for (const ally of liveAllies(battle).filter(ally => ally.def.profession === 'PIONEER'))
        if (!ally.findBuff(key)) battle.addBuff(ally, {
          key, source: unit, mods: { hpRegen: talent.hp_recovery_per_sec },
        });
    };
    battle.on('deploy', sync, { owner: unit });
    battle.on('tick', sync, { owner: unit });
    battle.on('death', ({ unit: dead }) => { if (dead === unit) clear(); }, { owner: unit });
  }
}
