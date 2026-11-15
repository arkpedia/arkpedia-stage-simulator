// SPDX-License-Identifier: GPL-3.0-or-later
/** Native battle-result counters. A stage reports these to its caller; it does
 * not invent a run wallet, rewards, or progression from a counter's name. */
export function recordStageOutcome(battle, enemy, key, value = 1) {
  if (!key || !Number.isSafeInteger(value) || value <= 0) throw Error('Invalid stage outcome');
  const outcomes = battle.stageOutcomes ??= { counters: Object.create(null), events: [] };
  outcomes.counters[key] = (outcomes.counters[key] ?? 0) + value;
  const event = { key, value, time: battle.time, enemy: enemy.defId, instance: enemy.id };
  outcomes.events.push(event);
  return event;
}
export function readStageOutcomes(battle) {
  return { ...(battle.stageReeds ? { tileStates: battle.stageReeds.resultTiles() } : {}), counters: { ...battle.stageOutcomes?.counters }, events: (battle.stageOutcomes?.events ?? []).map(e => ({ ...e })) };
}
export function stageOutcomeCounter({ killedKey, exitKey, exitTile, immediateAttackType = null }) {
  return {
    spawn(_battle, enemy) {
      if (immediateAttackType) { enemy.profile.deferHit = true; enemy.profile.shot = 'none'; }
    },
    attack(c, battle, enemy) {
      if (!immediateAttackType) return;
      for (const target of c.targets) if (target.alive && target.deployed)
        battle.dealDamage(enemy, target, { amount: enemy.s.atk * (enemy.profile.atkScale ?? 1),
          type: immediateAttackType, isAttack: true, attackId: battle._attackSeq, applyWay: 'ranged' });
    },
    death(c, battle, enemy, state) {
    if (state.recorded) return;
    state.recorded = true;
    if (c.reason === 'killed' && killedKey) recordStageOutcome(battle, enemy, killedKey);
    if (c.reason === 'leak' && exitKey && battle.grid.tile(enemy.tileR, enemy.tileC)?.key === exitTile)
      recordStageOutcome(battle, enemy, exitKey);
  } };
}
