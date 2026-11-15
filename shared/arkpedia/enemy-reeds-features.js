// SPDX-License-Identifier: GPL-3.0-or-later
import { passiveOutcomeBuff, sameOutcomeValue as same } from './enemy-outcome-contracts.js';
import { conditionalContactBuff } from './enemy-contact-contracts.js';
const zero = r => r?.m_FileID === 0 && r.m_PathID === '0';
export const REEDS_SOLDIER_TEXT = 'Gains <$ba.invisible>Invisibility</> while in Reeds';
export function reedsSoldierNative(r, n) {
  if (!['enemy_1286_dumcy', 'enemy_1286_dumcy_2'].includes(r.prefabKey)
    || r.skills.length || Object.keys(r.talents.groups).length || r.applyWay !== 'MELEE' || r.stats.dmgType !== 'phys'
    || r.abilities.length !== 1 || r.abilities[0].text !== REEDS_SOLDIER_TEXT) return false;
  const root = n[r.prefabKey]?.[0], mode = n.$ref(root?._modes?.[0]), combat = n.$ref(mode?._combat);
  const toggle = n['1']?.find(c => '_checker' in c), checker = n.$ref(toggle?._checker), buff = toggle?._buffs?.[0];
  const child = conditionalContactBuff(n, 'enemy_dumcy_checker', 'buff_reed_extinct[enemy]', 'enemy_dumcy_invisible');
  return root?._modes.length === 1 && root._commonAbilities.length === 0 && mode?._generalAbilities.length === 0
    && zero(mode._attack) && zero(mode._attackTrigger) && combat?._activeBuffs.length === 0
    && combat._damageType === 1 && combat._atkScale === 1 && zero(combat._selector)
    && toggle?.m_Script.m_PathID === '5578302910068743633' && zero(toggle._selector) && toggle._buffs.length === 1
    && toggle._buffsWhenToggleOff.length === 0 && toggle._unmanagedBuffsWhenToggleOn.length === 0
    && toggle._isInverseToggle === 0 && toggle._setToggleFalseOnDetached === 0
    && checker?.m_Script.m_PathID === '-6339019266161532961' && checker._isInitToggled === 1 && checker._restoreDelay === 3
    && checker._disableWhenAttack === 1 && checker._disableWhenBlocked === 1
    && Object.entries(checker).filter(([k]) => k.startsWith('_disable') && !['_disableWhenAttack', '_disableWhenBlocked'].includes(k)).every(([,v]) => v === 0)
    && passiveOutcomeBuff(buff) && buff.buffKey === 'enemy_dumcy_checker' && buff.templateKey === 'enemy_dumcy_checker'
    && buff.triggerLifeType === 2 && Math.abs(buff.triggerInterval - .1) < 1e-8 && buff.firstTriggerInterval === 0 && !buff.blackboard.length
    && child && same(child.attributes, { abnormalFlags: ['INVISIBLE'], abnormalImmunes: [], abnormalAntis: [], abnormalCombos: [], abnormalComboImmunes: [], attributeModifiers: [] });
}
