// SPDX-License-Identifier: GPL-3.0-or-later
// Literal S3 producer actions. Called only by its separately owned attack clock.
import {selectedAphrissaInputs, aphrissaNativeInputs} from './arkpedia-aphrissa-source.js';
import {aphrissaRayCells, APHRISSA_RAY_CONTRACT} from './arkpedia-aphrissa-ray.js';
import {bodyOnTile} from '../body.js';
const type = action => action?.$type?.split('+').at(-1).split(',')[0];

export function createAphrissaS3Payload(b, u) {
  const record = selectedAphrissaInputs(u), n = aphrissaNativeInputs();
  const actions = n.templates.aphris_sk3.eventToActions.ON_BUFF_START;
  const [range, condition, calculate, create, loop] = actions, cap = condition?._succeedNodes?.[0];
  const damage = loop?._loopBody?.[0], producer = n.s3Producer._buffs[0];
  if (record.index !== 2 || actions.length !== 5 || type(range) !== 'AssignAphrisRangeInfoToBB'
    || range._aphrisRangeSource !== 'BUFF_SOURCE' || range._target !== 'BUFF_OWNER' || range._extendTimesBbKey !== 'extendTimes'
    || condition._conditionsNode[0]._blackboardKey !== 'max_times' || condition._conditionsNode[0]._condType !== 'GE'
    || condition._conditionsNode[0]._valueToCompare !== 0 || type(cap) !== 'CalculateBlackboardValueViaParams'
    || cap._inputKey !== 'extendTimes' || cap._outputKey !== 'extendTimes' || cap._maxValueKey !== 'max_times'
    || cap._finalRound !== true || cap._finalAbs !== true || calculate._inputKey !== 'extra_sluggish'
    || calculate._multiplyParamKey !== 'extendTimes' || calculate._addParamKey !== 'origin_sluggish'
    || calculate._outputKey !== 'sluggish' || type(create) !== 'CreateBuff' || create._buff.buffKey !== 'sluggish'
    || create._buff.loadFromDB !== true || create._isDerivedBuff !== false || create._finishDerivedBuffIfParentFinish !== false
    || type(loop) !== 'Loop' || loop._loopCntKey !== 'extendTimes' || loop._loopBody.length !== 1
    || type(damage) !== 'AdvancedApplyDamage' || damage._atkScaleVar !== 'extra_atk_scale'
    || damage._damageType !== 'MAGICAL' || damage._attackType !== 'NORMAL' || damage._applyWay !== 'NONE'
    || damage._forceUseProjectileCachedAtk !== false || damage._getCachedAtkFromBlackboard !== false
    || damage._ignoreForSp !== false || producer.buffKey !== 'aphris_sk3' || producer.templateKey !== 'aphris_sk3'
    || producer.isDamageMissable !== 0 || producer.lifeTimeType !== 0
    || n.s3DownProducer._buffs[0].buffKey !== producer.buffKey)
    throw Error('Changed original Aphrissa S3 hit producer');
  const bb = record.bb;
  return (target, {attackId, permit}) => {
    if (!permit() || target.findBuff('aphris_sk3')) return;
    const ticket = Object.freeze({attackId, life: target.deploySeq});
    const admit = (unit, buff) => unit === target && permit() && target.deploySeq === ticket.life
      && !target.findBuff('aphris_sk3') && buff.key === 'aphris_sk3' && buff.source === u
      && buff.data?.aphrissaS3Hit === ticket && buff.duration === 0
      && !Object.keys(buff.mods ?? {}).length && !Object.keys(buff.flags ?? {}).length;
    const parent = b.addBuff(target, {key: 'aphris_sk3', source: u, duration: 0,
      data: {aphrissaS3Hit: ticket, nativeKey: 'aphris_sk3'}, admit});
    const owns = () => !!parent && target.findBuff('aphris_sk3') === parent
      && parent.source === u && parent.data?.aphrissaS3Hit === ticket;
    const current = () => owns() && permit() && target.deploySeq === ticket.life;
    try {
      if (!current()) return;
      const cells = aphrissaRayCells(b, u, {contract: APHRISSA_RAY_CONTRACT}).cells;
      let count = cells.find(cell => bodyOnTile(target, cell.row, cell.col))?.extensionCount ?? 0;
      if (bb['attack@max_times'] >= 0) count = Math.round(Math.abs(Math.min(count, bb['attack@max_times'])));
      const duration = Math.abs(bb['attack@origin_sluggish'] + bb['attack@extra_sluggish'] * count);
      b.applyStatus(target, 'sluggish', {source: u, duration, admit: current});
      for (let i = 0; i < count && current(); i++) b.dealDamage(u, target, {
        amount: u.s.atk * bb['attack@extra_atk_scale'] * u.s.atkScaleMul, type: 'arts',
        isAttack: true, isSkill: true, attackId, applyWay: 'none', tags: ['aphrissa:s3-extra']});
    } finally { if (owns()) b.removeBuff(target, parent); }
  };
}
