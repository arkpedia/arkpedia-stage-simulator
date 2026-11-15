// SPDX-License-Identifier: GPL-3.0-or-later
const attributes = [[0, 1], [1, 1], [2, 1], [6, 1], [7, 1], [3, 0], [13, 1], [19, 1]];
const defaults = { init_stack_cnt: 0, atk: .05000000074505806, def: .05000000074505806,
  max_hp: .25, delay: 50, interval: 50, max_stack_cnt: 50, move_speed: 0, attack_speed: 0, speed_scale: 1 };
const optionKeys = ['targetSide','targetMotion','targetCategory','enableAdvancedOptions','ignoreTargetFree',
  'ignoreAllyTargetFree','ignoreHealFree','ignoreMotionMode','ignoreTargetSide','excludeSomeAbnormalFlags',
  'containSomeAbnormalFlags','excludeAbnormalFlag','containAbnormalFlag','purposeMask','professionMask',
  'checkUnitType','unitTypeMask','onlyIgnoreSomeOfTargetFreeCase','abnormalFlag','abnormalCombo'].sort().join();
const zeroArrays = a => a && Object.values(a).every(v => Array.isArray(v) && v.length === 0);
export function dangerNativeReviewed(source) {
  const rows = source.prefabs?.legion_mode_enemy_boost, c = rows?.[0]?.data, buffs = c?._buffs, b = buffs?.[0];
  const modifiers = b?.attributes?.attributeModifiers, options = c?._options;
  const events = source.templates?.legion_mode_enemy_boost?.eventToActions;
  const start = events?.ON_BUFF_START?.[0], actions = events?.ON_APPLYING_MODIFIER, calc = actions?.[1];
  return rows?.length === 1 && c.m_Script?.m_PathID === '1157428338923407534' && c.m_Enabled === 1
    && c._key === 'legion_mode_enemy_boost' && c._sourceType === 0 && c._overrideCameraEffect === ''
    && c._deckBuffs?.length === 0 && c._keysScaleWithTime?.length === 0 && c._untickInWavePostDelay === 1
    && c._initBlackboard?.length === Object.keys(defaults).length
    && c._initBlackboard.every(p => Object.hasOwn(defaults, p.key) && p.value === defaults[p.key] && p.valueStr === '')
    && new Set(c._initBlackboard.map(p => p.key)).size === c._initBlackboard.length
    && options?.targetSide === 2 && options.targetMotion === 3 && options.targetCategory === 1
    && Object.keys(options).sort().join() === optionKeys
    && Object.entries(options).every(([k,v]) => ['targetSide','targetMotion','targetCategory'].includes(k) || v === 0)
    && buffs?.length === 2 && b.buffKey === 'legion_mode_enemy_boost' && b.templateKey === b.buffKey
    && b.lifeTimeType === 2 && b.disableOverride === 1 && b.blackboard?.length === 0
    && ['isSilenceable','isStunnable','isFreezable','isLevitatable','isGroundBoundable','loadFromDB'].every(k => b[k] === 0)
    && zeroArrays(Object.fromEntries(Object.entries(b.attributes).filter(([k]) => k !== 'attributeModifiers')))
    && modifiers?.length === attributes.length && modifiers.every((m,i) => m.attributeType === attributes[i][0]
      && m.formulaItem === attributes[i][1] && m.loadFromBlackboard === 1 && m.fetchBaseValueFromSourceEntity === 0 && m.value === 0)
    && buffs[1].templateKey === 'empty' && buffs[1].lifeTimeType === 1 && buffs[1].lifeTime === 0
    && buffs[1].blackboard?.length === 0 && zeroArrays(buffs[1].attributes)
    && source.templates.empty?.templateKey === 'empty' && source.templates.empty.effectKey === ''
    && Object.keys(source.templates.empty.eventToActions ?? {}).length === 0
    && Object.keys(events ?? {}).sort().join() === 'ON_APPLYING_MODIFIER,ON_BUFF_START'
    && events.ON_BUFF_START.length === 1 && start.$type.endsWith('+AssignValueToBB, Assembly-CSharp')
    && start._blackboardKey === 'add_param' && start._value === 1 && !start._copyFromKey && !start._assignString
    && actions.length === 3 && actions[0].$type.endsWith('+IsHeal, Assembly-CSharp')
    && calc.$type.endsWith('+CalculateBlackboardValueViaParams, Assembly-CSharp')
    && calc._inputKey === 'heal_scale' && calc._outputKey === 'final_heal_scale' && calc._addParamKey === 'add_param'
    && ['_multiplyParamKey','_dividedParamKey','_minusParamKey','_minValueKey','_maxValueKey'].every(k => calc[k] === null)
    && calc._finalAbs && ['_useRemainder','_finalCeil','_finalFloor','_finalRound','_useAbilityBlackboard'].every(k => calc[k] === false)
    && actions[2].$type.endsWith('+ModifierScaleUp, Assembly-CSharp') && actions[2]._scaleKey === 'final_heal_scale';
}

/** Decode only reviewed source parameters. Danger-grade/run modifiers need
 * their own contract; they must not disappear into an ordinary stat preset. */
export function compileStageDanger(rows) {
  if (rows != null && !Array.isArray(rows)) throw Error('Malformed danger parameters');
  const values = { ...defaults }, seen = new Set(); let limits = [], blacklist = [];
  for (const p of rows ?? []) {
    if (!p || seen.has(p.key)) throw Error('Duplicate danger parameter');
    seen.add(p.key);
    if (p.key === 'danger_level_step_limit') {
      if (p.value !== 0 || typeof p.valueStr !== 'string' || !/^[1-9][0-9]*(\|[1-9][0-9]*)*$/.test(p.valueStr))
        throw Error('Invalid danger wave limits');
      limits = p.valueStr.split('|').map(Number);
      if (limits.some((v,i) => !Number.isSafeInteger(v) || v > defaults.max_stack_cnt || i && v < limits[i-1]))
        throw Error('Invalid danger wave limits');
    } else if (p.key === 'legion_buff_blacklist') {
      if (p.value !== 0 || typeof p.valueStr !== 'string' || !/^trap_[a-z0-9_]+(\|trap_[a-z0-9_]+)*$/.test(p.valueStr))
        throw Error('Unsupported danger blacklist');
      blacklist = p.valueStr.split('|');
      if (new Set(blacklist).size !== blacklist.length) throw Error('Duplicate danger blacklist');
    } else {
      if (!['init_stack_cnt','atk','def','max_hp','move_speed','attack_speed'].includes(p.key)
        || p.valueStr != null && p.valueStr !== '' || !Number.isFinite(p.value) || p.value < 0
        || (p.key === 'init_stack_cnt' ? !Number.isSafeInteger(p.value) || p.value > 50 : p.value > 1))
        throw Error(`Unsupported danger parameter: ${p.key}`);
      values[p.key] = p.value;
    }
  }
  if (limits.length && values.init_stack_cnt > limits[0]) throw Error('Initial danger exceeds first wave limit');
  return { kind: 'legion_mode_enemy_boost', initial: values.init_stack_cnt, max: values.max_stack_cnt,
    delay: values.delay, interval: values.interval, limits, blacklist,
    perLevel: { hpPct: values.max_hp, atkPct: values.atk, defPct: values.def,
      movePct: values.move_speed, aspdPct: values.attack_speed } };
}
