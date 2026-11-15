// SPDX-License-Identifier: GPL-3.0-or-later
const zero = r => r?.m_FileID === 0 && r.m_PathID === '0';
const count = n => Number.isSafeInteger(n) && n > 0;
const token = s => typeof s === 'string' && /^trap_[a-z0-9_]+$/.test(s);
export function sponsorNative(r, n) {
  if (!['enemy_1105_tyokai', 'enemy_1105_tyokai_2'].includes(r.prefabKey) || r.applyWay !== 'NONE' || r.stats.motion !== 'FLY'
    || r.skills.length || Object.keys(r.talents.groups).some(k => k !== 'loot') || Object.keys(r.talents.bb).some(k => k !== 'loot.cnt')
    || Object.keys(r.talents.bbStr).some(k => k !== 'loot.token_key')) return false;
  const [root] = n[r.prefabKey] ?? [], mode = n.$ref(root?._modes?.[0]), loot = n.loot?.find(c => '_projectileActions' in c);
  const [buff] = loot?._buffs ?? [], gain = JSON.parse(loot?._projectileActions?.SerializedState ?? '[]');
  const action = n.$template('projectile_on_killed')?.eventToActions, [silence, emit] = action?.ON_OWNER_KILLED ?? [];
  const projectileKey = r.prefabKey.endsWith('_2') ? 'projectile_enemy_tyokai_2' : 'projectile_enemy_tyokai';
  const projectile = n.$projectile(projectileKey).find(c => '_lifeTime' in c);
  return root?._modes.length === 1 && root._commonAbilities.length === 1 && mode?._generalAbilities.length === 0
    && zero(mode._attack) && zero(mode._attackTrigger) && n.$ref(mode._combat)?._activeBuffs.length === 0
    && loot?._buffs.length === 1 && buff.templateKey === 'projectile_on_killed' && buff.lifeTimeType === 2 && buff.triggerCnt === 1
    && buff.blackboard.length === 1 && buff.blackboard[0].key === 'projectile' && buff.blackboard[0].valueStr === projectileKey
    && gain.length === 1 && gain[0].$type === 'Torappu.Battle.Action.Nodes+GainToken' && gain[0]._rechargeTiming === 'NORMAL'
    && !gain[0]._getPlayerSideFromActionTargetType && gain[0]._targetType === 'BUFF_OWNER' && !gain[0]._spiltTokenKey
    && loot._projectileBuffs.length === 0 && loot._ignoredProjectileEvents.length === 0
    && Object.keys(action ?? {}).join() === 'ON_OWNER_KILLED' && action.ON_OWNER_KILLED.length === 2
    && silence._abnormalFlag === 'SILENCED' && silence._targetType === 'SOURCE' && silence._isUnset
    && emit.$type === 'Torappu.Battle.Action.Nodes+EmitProjectile, Assembly-CSharp' && emit._ev === 'ON_HIT_OBJECT'
    && emit._sourceType === 'BUFF_OWNER' && emit._targetType === 'TARGET' && !emit._overwriteActions
    && projectile?._lifeTime === 1 && projectile._alwaysReachInTheEnd === 1 && projectile._stopWhenSourceInvalid === 0
    && projectile._maxHitNum === 0 && projectile._actionController._extraBuffsInTheEnd.length === 0;
}
const supply = {
  covers: sponsorNative,
  stageInjectedParameters: {
    'loot.cnt': { type: 'number', validate: count },
    'loot.token_key': { type: 'string', validate: token },
  },
  stageTokenDependencies(r) {
    const key = r.talents.bbStr['loot.token_key'], n = r.talents.bb['loot.cnt'];
    if (!token(key) || !count(n)) throw Error(`Missing original enemy supply parameters: ${r.key}`);
    return [key];
  },
  ability: { kind: 'stageSupplyDrop', params: r => ({ token: r.talents.bbStr['loot.token_key'], count: r.talents.bb['loot.cnt'], delay: 1 }) },
  note: 'Original per-level token identity and count feed a scheduler-owned supply delivery on death; leaks grant nothing',
};
export const SUPPLY_ENEMY_FEATURES = {
  'talent:loot': { covers: sponsorNative, stageTokenDependencies: supply.stageTokenDependencies,
    note: 'Explicit source loot parameters; the inherited Sponsor ability owns the single death delivery' },
  'ability:When destroyed, grants a deployable unit': supply,
  'ability:When destroyed, grants a large number of deployable units': supply,
};
