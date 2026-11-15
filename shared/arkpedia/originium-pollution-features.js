// SPDX-License-Identifier: GPL-3.0-or-later
const rows = value => {
  const result = [];
  const visit = v => { if (!v || typeof v !== 'object') return; if (v.$type) result.push(v); Object.values(v).forEach(visit); };
  visit(value); return result;
};
/** Damage-family tie rules and environmental classification are original
 * template behavior, shared by tiles, Chimeras and storms. */
export function pollutionTemplatesReviewed(n) {
  for (const [key, comparisons, references] of [
    ['enemy_lrcmra[originum][dmg]', ['GE', 'GE'], ['enemy_bigstorm[dmg]', 'tile_originum_t_1[dmg]']],
    ['tile_originum_t_1[dmg]', ['GT', 'GT'], ['enemy_bigstorm[dmg]', 'enemy_lrcmra[originum][dmg]']],
    ['enemy_bigstorm[dmg]', ['GE', 'GT'], ['tile_originum_t_1[dmg]', 'enemy_lrcmra[originum][dmg]']],
  ]) {
    const actions = rows(n.$template(key)?.eventToActions?.ON_BUFF_TRIGGER);
    const damage = actions.filter(a => a.$type.includes('+FixedValueDamage,'));
    if (damage.length !== 3 || !damage.every(a => a._damageType === 'PURE' && a._ignoreForSp === true
      && a._noSourceDamage === true && a._isEnvDamage === true && a._damageKey === 'damage')) return false;
    if (actions.filter(a => a.$type.includes('+FilterByBlackboardValue,')).map(a => a._condType).join() !== comparisons.join()
      || actions.filter(a => a.$type.includes('+CheckContainsBuff,')).map(a => a._buffKeys?.join()).join() !== references.join()) return false;
  }
  return true;
}
export function stormNative(r, n) {
  if (!['enemy_1420_lrmm', 'enemy_1420_lrmm_2'].includes(r.prefabKey) || !pollutionTemplatesReviewed(n)) return false;
  if (!stormBodyReviewed(r, n)) return false;
  const a = (n.StormAura ?? []).find(c => '_buffs' in c), opts = n.$ref(a?._targetValidator)?._targetOptions;
  if (a?._buffs?.map(b => b.buffKey).join() !== 'enemy_bigstorm[mark],enemy_bigstorm[dmg],enemy_bigstorm[killLrboom],level_main14[sp]'
    || a._removeBuffWhenAbilityDetached !== 1 || a._removeBuffWhenTargetLeave !== 1 || a._selfOption !== 2
    || opts?.targetSide !== 3 || opts.targetMotion !== 3 || opts.professionMask !== 767 || opts.ignoreTargetFree !== 1
    || a._buffs[1].triggerInterval !== 1 || a._buffs[1].waitFirstTriggerInterval !== 1) return false;
  const [ctrl, radius] = a._passiveBuffs ?? [];
  if (ctrl?.templateKey !== 'enemy_lrmm[stormCtrl]' || ctrl.triggerInterval !== 1
    || radius?.templateKey !== 'enemy_lrmm[ctrl_radius]' || radius.triggerInterval !== Math.fround(.03)
    || radius.blackboard.find(x => x.key === 'unit_radius')?.value !== Math.fround(.0083)) return false;
  const control = rows(n.$template('enemy_lrmm[stormCtrl]'));
  const consumes = control.find(a => a.$type.includes('+SwitchDynamicBuffTileModeInRange,'));
  if (consumes?._modeIndex !== 0 || consumes._requireCharacterNotOn !== false || consumes._useRangeRadius !== true
    || consumes._rangeRadiusKey !== 'range_radius_current' || consumes._countBbKey !== 'count') return false;
  const grow = control.filter(a => a.$type.includes('+CalculateBlackboardValueViaParams,') && ['damage_step', 'radius_step'].includes(a._inputKey));
  if (grow.length !== 4 || grow.some(a => a._multiplyParamKey !== 'count')) return false;
  const kill = rows(n.$template('enemy_bigstorm[killLrboom]'));
  return kill.some(a => a.$type.includes('+InstantKill,') && a._skipReborn === true && a._noSource === false)
    && a._buffs[2].blackboard.find(x => x.key === 'lrboom_count')?.value === 1;
}

/** Body and pursuit used by the same storm aura, retained from its prefab. */
export function stormBodyReviewed(r, n) {
  const root = n[r.prefabKey]?.find(c => '_modes' in c);
  const buffs = n.SelfBuff?.flatMap(c => c._buffs ?? []) ?? [];
  const body = buffs.find(c => c.buffKey === 'enemy_bigstorm[passive]');
  const trace = buffs.find(c => c.templateKey === 'enemy_bigstorm[traceStorm]');
  const action = n.$template('enemy_bigstorm[traceStorm]')?.eventToActions.ON_BUFF_TRIGGER;
  const controller = n.TraceStorm?.find(c => '_traceTileSelector' in c);
  const tile = controller && n.$ref(controller._traceTileSelector), selector = tile && n.$ref(tile._selector);
  return root?._canNotExit === 1 && body?.attributes.abnormalFlags.join() === '5,7,3'
    && body.attributes.abnormalImmunes.join() === '0,16,23,25,12,11'
    && body.attributes.abnormalComboImmunes.join() === '0' && body.isSilenceable === 0
    && buffs.some(c => c.buffKey === 'immune_shu_blink')
    && trace?.triggerInterval === 2 && trace.waitFirstTriggerInterval === 1 && trace.isSilenceable === 0
    && action?.length === 1 && action[0]._abilityName === 'TraceStorm' && action[0]._castDirectly === true
    && controller?._enableTraceTarget === 0 && controller._enableForceTraceTile === 1
    && controller._traceRandomOffset.x === 0 && controller._traceRandomOffset.y === 0
    && controller._minTileSeletorRange === Math.fround(.3) && controller._reachedBuffs.length === 0
    && tile?._limitTargetNum === 1 && tile._selectorIsTile === 0
    && selector?._buffKey === 'enemy_stormcoord[passive]' && selector._postFilter === 34
    && selector._targetSide === 1 && selector._targetMotion === 3 && selector._limitTargetNum === 1;
}
