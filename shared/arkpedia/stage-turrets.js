// SPDX-License-Identifier: GPL-3.0-or-later
import native from '../../data/arkpedia-device-native-source.json' with { type: 'json' };
import tables from '../../data/arkpedia-device-source.json' with { type: 'json' };
const rows = (e, key) => e.prefabs[key]?.components.map(c => c.data) ?? [];
export function turretNativeReviewed(e = native) {
  const r = rows(e, 'trap_007_ballis'), s = rows(e, 'sktok_ballis'), p = rows(e, 'projectile_ballis');
  const root = r.find(c => '_modes' in c), mode = r.find(c => '_tileOptions' in c);
  const cast = s.find(c => '_projectileKey' in c), account = s.find(c => '_allowSpRecoveryWhenAffecting' in c);
  const life = p.find(c => '_lifeTime' in c), move = p.find(c => '_speed' in c), collider = p.find(c => '_targetOptions' in c);
  const circle = p.find(c => 'm_Radius' in c), transform = p.find(c => c.m_GameObject?.m_PathID === circle?.m_GameObject.m_PathID && 'm_LocalScale' in c);
  return root?._sideType === 2 && root._category === 2 && root._occupiedRemainingCharacterCnt === 0 && root._withdrawable === 0
    && root._modes.length === 1 && root._commonAbilities.length === 0 && root._animator.m_PathID === '0'
    && mode?._combat.m_PathID === '0' && mode._attack.m_PathID === '0' && mode._generalAbilities.length === 1
    && mode._tileOptions.buildableType === 0 && mode._tileOptions.passableMask === 2
    && r.some(c => c._buffs?.length === 1 && c._buffs[0].attributes.abnormalFlags.join() === '5' && c._buffs[0].lifeTimeType === 2)
    && account?._allowSpRecoveryWhenAffecting === 0 && account._canCastWithNoSp === 0 && account._canSilenced === 0
    && account._checkHasTargetBeforeDoCast === 0 && account._allowNoTarget === 1
    && cast?._projectileKey === 'projectile_ballis' && cast._waitForAttackEvent === 0 && cast._affectedBySlowDown === 0
    && cast._preDelay === Math.fround(.167) && cast._atkScale === 1 && cast._damageType === 1 && cast._attackType === 0
    && cast._activeBuffs.length === 0 && cast._extraProjectileKeys.length === 0 && cast._waitForProjectileInvalid === 0
    && life?._lifeTime === 60 && life._maxHitNum === 1 && life._stopAfterMaxHit === 1 && life._stopWhenSourceInvalid === 0
    && life._managedBySource === 0 && life._canHitSameTargetMultipleTimes === 0 && life._actionController._extraBuffsInTheEnd.length === 0
    && move?._speed === 10 && move._useSourceDirection === 1 && move._useTargetDirection === 0 && move._moveType === 4
    && move._comeBack === 0 && move._delayToStart === 0 && collider?._targetOptions.targetSide === 2
    && collider._targetOptions.targetMotion === 3 && collider._targetOptions.targetCategory === 1
    && collider._targetOptions.ignoreTargetFree === 0 && collider._ignoreCamouflage === 0 && collider._goThroughWall === 1
    && circle?.m_Radius === .5 && circle.m_Offset.x === 0 && circle.m_Offset.y === 0
    && transform?.m_LocalScale.x === 1 && transform.m_LocalScale.y === 1 && transform.m_LocalScale.z === 1;
}
export function turretDefinition(instance) {
  if (!turretNativeReviewed() || !instance || !Number.isSafeInteger(instance.level) || instance.level < 1 || instance.level > 30
    || instance.skillLevel !== 1 || !['UP', 'RIGHT', 'DOWN', 'LEFT'].includes(instance.direction)) throw Error('Unsupported original Turret instance');
  const record = tables.devices.trap_007_ballis, skill = tables.skills.sktok_ballis.levels[0];
  const frames = record.phases[0].attributesKeyFrames, first = frames[0], last = frames.at(-1);
  if (skill.skillType !== 'AUTO' || skill.duration !== 0 || skill.spData.spType !== 'INCREASE_WITH_TIME'
    || skill.spData.spCost !== 5 || skill.spData.initSp !== 0 || skill.spData.increment !== 1
    || skill.blackboard.length !== 1 || skill.blackboard[0].key !== 'atk_scale' || skill.blackboard[0].value !== 1) throw Error('Changed Turret skill');
  const atk = Math.round(first.data.atk + (last.data.atk - first.data.atk) * (instance.level - first.level) / (last.level - first.level));
  return { kind: 'turret', passive: true, position: record.position, atk, hp: first.data.maxHp, direction: instance.direction,
    spCost: skill.spData.spCost, initSp: skill.spData.initSp, spPerSecond: skill.spData.increment,
    release: Math.fround(.167), speed: 10, lifetime: 60, radius: .5, range: [],
    description: `Automatically fires a bolt after charging 5 SP. Each bolt deals ${atk} Physical damage to the first allied unit it touches.` };
}
