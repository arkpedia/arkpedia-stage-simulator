// SPDX-License-Identifier: GPL-3.0-or-later
import native from '../../data/arkpedia-device-native-source.json' with { type: 'json' };
import tables from '../../data/arkpedia-device-source.json' with { type: 'json' };
const rows = (n, id) => n.prefabs[id]?.components.map(c => c.data) ?? [];
const buffs = r => r.flatMap(c => c._buffs ?? []);
const bb = values => Object.fromEntries(values.map(p => [p.key, p.value]));
export function demolitionNativeReviewed(n = native) {
  const p = rows(n, 'trap_043_dupilr'), r = rows(n, 'trap_044_duruin'), d = rows(n, 'trap_045_dublst');
  const roots = [p, r, d].map(a => a.find(c => '_modes' in c));
  if (!roots.every((c, i) => c?._sideType === [2, 1, 1][i] && c._category === [1, 4, 2][i]
    && c._occupiedRemainingCharacterCnt === 0 && c._withdrawable === 1)
    || roots[0]._hitRangeId !== 'x-5' || roots[0]._filterTag.join() !== 'dupilr'
    || roots[2]._filterTag.join() !== 'dupilr' || roots[2]._withdrawCostRecoverRatio !== 0
    || roots[2]._buildCondition.buildableType !== 3 || roots[2]._buildCondition.needSpecifyDirection !== 1) return false;
  const skill = rows(n, 'sktok_dupilr'), death = buffs(skill).find(b => b.templateKey === 'trap_duplir_s[DeadLike]');
  const attack = skill.find(c => c._damageType === 3), spawn = skill.find(c => '_tokenToSpawn' in c);
  const blast = d.find(c => c._damageType === 3), trigger = buffs(rows(n, 'sktok_dublst'))[0];
  const selector = d.find(c => '_postFilter' in c);
  return death?.lifeTime === 1.5 && death.attributes.abnormalFlags.join() === '5,6,2,15,3'
    && attack?._preDelay === 1.5 && attack._atkScale === 1
    && spawn?._preDelay === 1.5 && spawn._tokenToSpawn.inst.characterKey === 'trap_044_duruin'
    && spawn._checkBuildableType === 1 && spawn._forceSpawn === 0
    && buffs(p).some(b => b.templateKey === 'trap_dupilr_trait')
    && buffs(p).some(b => b.templateKey === 'trap_dupilr_trait[ondead]')
    && [p, r, d].every(a => buffs(a).some(b => b.templateKey === 'immu_environment_damage'))
    && blast?._preDelay === Math.fround(.65) && blast._timeMode === 2 && blast._atkScale === 1
    && blast._allowNoTarget === 1 && blast._affectedBySlowDown === 0
    && selector?._targetSide === 2 && selector._targetCategory === 1 && selector._targetMotion === 1 && selector._ignoreTargetFree === 1
    && trigger?.templateKey === 'triggerability_tick_trigger' && trigger.triggerCnt === 1
    && trigger.triggerInterval === .5 && trigger.waitFirstTriggerInterval === 1
    && n.templates['knockback[dir]']?.eventToActions.ON_BUFF_START[0]._useSourceDirection === true;
}
export const PILLAR = Object.freeze({
  recovery: bb(tables.devices.trap_043_dupilr.talents[0].candidates[0].blackboard)['dupilr_trait[startdead].duration'],
  collapse: buffs(rows(native, 'sktok_dupilr')).find(b => b.templateKey === 'trap_duplir_s[DeadLike]').lifeTime,
  stun: bb(tables.skills.sktok_dupilr.levels[0].blackboard).stun,
  range: tables.ranges['2-2'].grids.map(p => [p.row, p.col]) });
export const RUINS = Object.freeze({ ...tables.devices.trap_044_duruin.phases[0].attributesKeyFrames[0].data,
  blockRadiusSquare: rows(native, 'trap_044_duruin').find(c => '_blockRadiusSquare' in c)._blockRadiusSquare });
export function demolitionDefinition(instance) {
  if (!demolitionNativeReviewed() || !Number.isSafeInteger(instance.level) || instance.level < 1 || instance.level > 30
    || instance.elite !== 0 || instance.potential !== 0 || instance.skill_index !== 0 || instance.skill_level !== 1)
    throw Error('Unsupported Demolition Device instance');
  const record = tables.devices.trap_045_dublst, stats = record.phases[0].attributesKeyFrames[0].data;
  return { supplyCard: true, obstacle: false, hp: stats.maxHp, cost: stats.cost, cooldown: stats.respawnTime,
    maxActive: stats.maxDeployCount, refundRatio: 0, anyBuildOnly: true, chooseFacing: true,
    damage: stats.atk, force: bb(record.talents[0].candidates[0].blackboard).force,
    delay: buffs(rows(native, 'sktok_dublst'))[0].triggerInterval + rows(native, 'trap_045_dublst').find(c => c._damageType === 3)._preDelay,
    range: tables.ranges[record.phases[0].rangeId].grids.map(p => [p.row, p.col]),
    description: 'After a short delay, deals 2000 True damage and pushes ground enemies in front. Topples Tattered Pillars. Consumed after use.' };
}
