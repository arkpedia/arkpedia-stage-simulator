// SPDX-License-Identifier: GPL-3.0-or-later
import { isMephisto, mephistoNative } from './enemy-mephisto-features.js';
import { ratKingNative } from './enemy-ratking-features.js';
import { mudrockNative } from './enemy-mudrock-features.js';
import {isPatriot,patriotNative} from './enemy-patriot-features.js';
const zero = ref => ref?.m_FileID === 0 && ref.m_PathID === '0';
const node = (action, name) => action?.$type === `Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`;
function barrierTemplate(n, key, last, effect = false) {
  const t = n.$template(key), a = t?.eventToActions?.ON_TAKE_DAMAGE;
  return Object.keys(t?.eventToActions ?? {}).join() === 'ON_TAKE_DAMAGE' && a?.length === (last ? effect ? 5 : 4 : 3)
    && node(a[0], 'BlockDamage') && a[0]._filterDamageType && a[0]._damageMask === 'MAGICAL'
    && a[0]._useDynamicVar && !a[0]._allowNegativeDynamicVar && !a[0]._useFixedValue
    && !a[0]._filterApplyWay && !a[0]._useSource
    && node(a[1], 'IsBlackboardZero') && a[1]._var === 'dynamic'
    && node(a[2], 'FinishBuff') && !a[2]._decCntIfStack
    && (!last || node(a[3], 'SwitchMode') && a[3]._loadModeFromBlackboard && !a[3]._restoreDefault
      && !a[3]._restartFSM && a[3]._targetType === 'TARGET')
    && (!effect || node(a[4], 'CreateEffect'));
}
function attribute(buff, type, formula) {
  const a = buff?.attributes, m = a?.attributeModifiers;
  return m?.length === 1 && m[0].attributeType === type && m[0].formulaItem === formula
    && m[0].loadFromBlackboard === 1 && m[0].value === 0 && m[0].fetchBaseValueFromSourceEntity === 0
    && ['abnormalFlags', 'abnormalImmunes', 'abnormalAntis', 'abnormalCombos', 'abnormalComboImmunes'].every(k => a[k]?.length === 0);
}
export function greytailNative(r, n) {
  if (!['enemy_1060_emouse', 'enemy_1060_emouse_2'].includes(r.prefabKey) || r.skills.length || r.applyWay !== 'MELEE'
    || Object.keys(r.talents.groups).sort().join() !== 'shield,speedup'
    || r.talents.groups.shield?.join() !== 'def,dynamic' || r.talents.groups.speedup?.join() !== 'move_speed'
    || !['shield.dynamic', 'shield.def', 'speedup.move_speed'].every(k => Number.isFinite(r.talents.bb[k]) && r.talents.bb[k] > 0)) return false;
  const [root] = n[r.prefabKey] ?? [], [normal] = n.Default ?? [], [fast] = n.SpeedUp ?? [];
  const [shield] = n.shield ?? [], [speed] = n.speedup ?? [], buffs = shield?._buffs, s = speed?._buffs?.[0];
  if (!root || root._modes.length !== 2 || n.$ref(root._modes[0]) !== normal || n.$ref(root._modes[1]) !== fast
    || root._commonAbilities.length || ![normal, fast].every(mode => mode._generalAbilities.length === 0
      && zero(mode._attack) && zero(mode._attackTrigger) && n.$ref(mode._combat)?._damageType === 1)
    || !zero(shield?._selector) || buffs?.length !== 4 || !zero(speed?._selector) || speed._buffs.length !== 1
    || !buffs.every(b => b.isSilenceable === 0 && b.lifeTimeType === 2)
    || buffs.slice(0, 3).some((b, i) => b.templateKey !== (i === 2 ? 'mousek_shield_end' : 'mousek_shield')
      || b.disableOverride !== 1 || b.attributes.attributeModifiers.length)
    || buffs[2].blackboard?.length !== 1 || buffs[2].blackboard[0].key !== 'mode' || buffs[2].blackboard[0].value !== 1
    || buffs[3].buffKey !== 'emouse_defup' || buffs[3].templateKey !== 'empty' || !attribute(buffs[3], 2, 0)
    || s?.templateKey !== 'empty' || s.isSilenceable !== 0 || s.lifeTimeType !== 2 || !attribute(s, 6, 3)) return false;
  return barrierTemplate(n, 'mousek_shield', false) && barrierTemplate(n, 'mousek_shield_end', true);
}
export function zealotNative(r, n) {
  if (!['enemy_1091_mdhmmr', 'enemy_1091_mdhmmr_2'].includes(r.prefabKey) || r.skills.length || r.applyWay !== 'MELEE'
    || Object.keys(r.talents.groups).join() !== 'shield' || r.talents.groups.shield.join() !== 'attack_speed,dynamic,max_hp'
    || Object.keys(r.talents.bbStr).length || r.talents.bb['shield.dynamic'] !== (r.prefabKey.endsWith('_2') ? 3334 : 2000)
    || r.talents.bb['shield.max_hp'] !== .5 || r.talents.bb['shield.attack_speed'] !== 50) return false;
  const root = n[r.prefabKey]?.[0], modes = root?._modes.map(ref => n.$ref(ref));
  const buffs = n.shield?.find(c => '_buffs' in c)?._buffs;
  if (modes?.length !== 2 || root._commonAbilities.length || modes.some(m => m._generalAbilities.length
    || !zero(m._attack) || !zero(m._attackTrigger) || n.$ref(m._combat)?._damageType !== 1)
    || buffs?.length !== 4 || buffs.some(b => b.isSilenceable !== 0 || b.lifeTimeType !== 2)
    || buffs.slice(0, 3).some((b, i) => b.templateKey !== (i === 2 ? 'enemy_mdhmmr_shield_end' : 'enemy_mdhmmr_shield')
      || b.disableOverride !== 1 || b.attributes.attributeModifiers.length)
    || buffs[2].blackboard.length !== 1 || buffs[2].blackboard[0].key !== 'mode' || buffs[2].blackboard[0].value !== 1
    || buffs[3].buffKey !== 'mdhmmr_buff' || buffs[3].templateKey !== 'empty') return false;
  const mods = buffs[3].attributes.attributeModifiers;
  return mods.length === 2 && mods.every((m, i) => m.attributeType === [0, 7][i] && m.formulaItem === [1, 0][i]
    && m.loadFromBlackboard === 1 && m.fetchBaseValueFromSourceEntity === 0)
    && barrierTemplate(n, 'enemy_mdhmmr_shield', false) && barrierTemplate(n, 'enemy_mdhmmr_shield_end', true, true);
}
export const BARRIER_ENEMY_FEATURES = {
  'talent:shield': { covers: (r, n) => isPatriot(r) ? patriotNative(r, n) : isMephisto(r) ? mephistoNative(r, n) : greytailNative(r, n) || zealotNative(r, n) || mudrockNative(r, n) || ratKingNative(r, n),
    ability: r => isPatriot(r) || isMephisto(r) || ['enemy_1511_mdrock', 'enemy_1509_mousek'].includes(r.prefabKey) ? null : ({ kind: 'layeredBarrier', params: r => ({ layers: 3, amount: r.talents.bb['shield.dynamic'], type: 'arts',
      ...(r.prefabKey.startsWith('enemy_1091_mdhmmr') ? { mods: { hpPct: r.talents.bb['shield.max_hp'], aspd: r.talents.bb['shield.attack_speed'] } }
        : { defense: r.talents.bb['shield.def'], speed: 1 + r.talents.bb['speedup.move_speed'] }) }) }),
    explains: /^(DEF significantly increases when the Barrier is present\.|Has a Barrier that absorbs Arts damage\.|Max HP and ASPD significantly increases while the Barrier persists\.)$/,
    note: 'Three native Arts-only barriers; flat DEF leaves only when the last barrier breaks.' },
  'talent:speedup': { covers: greytailNative,
    explains: /^Movement Speed significantly increases when the Barrier is destroyed\.$/,
    note: 'Permanent final movement multiplier after the final barrier; unsilenceable.' },
};
