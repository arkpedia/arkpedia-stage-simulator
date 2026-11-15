// SPDX-License-Identifier: GPL-3.0-or-later
const componentKeys = ['m_GameObject', 'm_Enabled', 'm_Script', 'm_Name', '_attachPassiveBuffsOnDummy', '_buffs',
  '_forceAsDmgOrHealAbility', '_ignoreIfOwnerDead', '_interruptAbilityOnDetach', '_metadata', '_selector'].sort().join();
const emptyAttributes = a => a && Object.keys(a).sort().join()
  === ['abnormalAntis', 'abnormalComboImmunes', 'abnormalCombos', 'abnormalFlags', 'abnormalImmunes', 'attributeModifiers'].sort().join()
  && Object.values(a).every(list => Array.isArray(list) && list.length === 0);
const logAction = { $type: 'Torappu.Battle.Action.Nodes+LogExtraBattleInfo, Assembly-CSharp', _logType: 'SIMPLE',
  _key: 'killed', _loadKeyFromBlackBoard: true, _countInHostIfToken: false, _additionValue: 1,
  _attributeType: 'NONE', _target: 'BUFF_OWNER' };
const filterAction = { $type: 'Torappu.Battle.Action.Nodes+FilterTargetWithPlayerSide, Assembly-CSharp',
  _target: 'BUFF_OWNER', _source: 'BUFF_OWNER', filterMapLayer: true, filterTargetPlayerSide: false, filterSourcePlayerSide: false };
const same = (a, b) => a && Object.keys(a).length === Object.keys(b).length && Object.entries(b).every(([k, v]) => a[k] === v);

function auxiliaryBuff(buff, nat) {
  if (!emptyAttributes(buff.attributes) || buff.blackboard?.length !== 0 || buff.loadFromDB !== 0
    || buff.lifeTimeType !== 2 || buff.lifeTime !== 0 || buff.maxStackCnt !== 1 || buff.isSilenceable !== 0
    || buff.isDurableBuff !== 0 || buff.isFreezable !== 0 || buff.isGroundBoundable !== 0 || buff.isLevitatable !== 0
    || buff.isStunnable !== 0 || buff.triggerCnt !== 0 || buff.overrideKey !== ''
    || typeof buff.durationKey !== 'string' || buff.templateKey !== 'empty' && buff.durationKey !== '') return false;
  if (buff.templateKey === 'empty') {
    const template = nat.$template('empty');
    return !!template && Object.keys(template.eventToActions ?? {}).length === 0;
  }
  if (!['log_killed', 'log_killed[filter_map_layer]'].includes(buff.templateKey)) return false;
  const template = nat.$template(buff.templateKey), actions = template?.eventToActions;
  if (!actions || Object.keys(actions).join() !== 'ON_OWNER_KILLED') return false;
  const expected = buff.templateKey === 'log_killed' ? [logAction] : [filterAction, logAction];
  return actions.ON_OWNER_KILLED?.length === expected.length
    && expected.every((action, i) => same(actions.ON_OWNER_KILLED[i], action));
}

/** Account only for verified, always-attached stateless visual/kill-log buffs.
 * These produce no combat state. Unknown actions, selectors and attributes
 * remain gameplay blockers, even when their names look like logging. */
export function nativeAuxiliaryClaims(prefab, nat) {
  const refs = prefab.clockComponents.flatMap(c => ['_commonAbilities', '_generalAbilities']
    .flatMap(k => c.fields[k] ?? []).filter(ref => ref.m_FileID === 0 && ref.m_PathID !== '0'));
  const components = [];
  for (const ref of refs) {
    const c = nat.$ref(ref);
    if (!c || Object.keys(c).sort().join() !== componentKeys
      || c.m_Script?.m_FileID !== 1 || c.m_Script.m_PathID !== '3800760148018415462'
      || c._selector?.m_PathID !== '0' || c._forceAsDmgOrHealAbility !== 0
      || c._metadata?.blackboardPrefix !== '' || typeof c._metadata?.namedAsAlias !== 'string'
      || c._metadata.namedAsAlias !== '' && !c._buffs?.every(buff => buff.templateKey === 'empty')
      || !c._buffs?.length || !c._buffs.every(buff => auxiliaryBuff(buff, nat))) continue;
    components.push({ pathId: ref.m_PathID, templates: c._buffs.map(buff => buff.templateKey) });
  }
  return { active: components.length, components };
}
