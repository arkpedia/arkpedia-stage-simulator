// SPDX-License-Identifier: GPL-3.0-or-later
import { pollutionTemplatesReviewed } from './originium-pollution-features.js';
const zero = ref => ref?.m_FileID === 0 && ref.m_PathID === '0';
const one = (n, name, field) => (n[name] ?? []).find(c => field in c);
const signature = (r, group, keys) => JSON.stringify(r.talents.groups[group]) === JSON.stringify(keys);
const finiteNonnegative = v => Number.isFinite(v) && v >= 0;
export function chimeraNative(r, n) {
  if (!pollutionTemplatesReviewed(n) || !['enemy_1425_lrcmra', 'enemy_1425_lrcmra_2'].includes(r.prefabKey)
    || !signature(r, 'OrigAura', ['damage', 'sp_recover_ratio']) || !signature(r, 'AtkBoost', ['atk'])
    || !finiteNonnegative(r.talents.bb['OrigAura.damage']) || r.talents.bb['OrigAura.sp_recover_ratio'] !== -.8
    || !finiteNonnegative(r.talents.bb['AtkBoost.atk']) || r.skills.length !== 1) return false;
  const skill = r.skills[0];
  if (skill.prefabKey !== 'triggerAnim' || skill.cooldown !== 9999 || skill.initCooldown !== 9999
    || skill.spCost !== 0 || Object.keys(skill.bb).length) return false;
  const root = one(n, r.prefabKey, '_modes'), normal = one(n, 'Default', '_combat'), transformed = one(n, 'Originium', '_combat');
  if (root?._modes?.length !== 2 || n.$ref(root._modes[0]) !== normal || n.$ref(root._modes[1]) !== transformed) return false;
  for (const [mode, damageType] of [[normal, 1], [transformed, 2]]) {
    const attack = n.$ref(mode?._combat);
    if (!zero(mode?._attack) || attack?._damageType !== damageType || attack._atkScale !== 1
      || attack._attackType !== 1 || attack._activeBuffs?.length !== 0 || !zero(attack._selector)) return false;
  }
  const aura = one(n, 'OrigAura', '_buffs'), opts = n.$ref(aura?._targetValidator)?._targetOptions;
  const circle = n.$siblings(aura).find(c => 'm_Radius' in c), tr = n.$siblings(aura).find(c => 'm_LocalScale' in c);
  if (!aura || aura._buffs.length !== 3 || !zero(aura._selector) || aura._selfOption !== 2
    || aura._removeBuffWhenAbilityDetached !== 1 || aura._removeBuffWhenTargetLeave !== 1
    || opts?.targetSide !== 3 || opts.targetMotion !== 1 || opts.professionMask !== 767
    || opts.ignoreAllyTargetFree !== 1 || opts.ignoreTargetFree !== 0
    || circle?.m_Radius !== Math.fround(1.2) || circle.m_Offset?.x !== 0 || circle.m_Offset?.y !== 0
    || tr?.m_LocalScale?.x !== 1 || tr.m_LocalScale.y !== 1) return false;
  const [damage, mark, sp] = aura._buffs;
  if (damage.templateKey !== 'enemy_lrcmra[originum][dmg]' || damage.triggerInterval !== .5
    || damage.waitFirstTriggerInterval !== 1 || damage.isSilenceable !== 0
    || mark.buffKey !== 'enemy_lrcmra[originum][mark]' || mark.templateKey !== 'empty'
    || sp.buffKey !== 'level_main14[sp]' || sp.attributes?.attributeModifiers?.length !== 1) return false;
  const spMod = sp.attributes.attributeModifiers[0], boost = one(n, 'AtkBoost', '_buffs')?._buffs?.[0];
  const atkMod = boost?.attributes?.attributeModifiers?.[0];
  if (spMod.attributeType !== 30 || spMod.formulaItem !== 0 || spMod.loadFromBlackboard !== 1
    || boost?.templateKey !== 'empty' || boost.lifeTimeType !== 2 || boost.isSilenceable !== 0
    || atkMod?.attributeType !== 1 || atkMod.formulaItem !== 0 || atkMod.loadFromBlackboard !== 1) return false;
  const cast = one(n, 'triggerAnim', '_animKey'), wrapper = one(n, 'triggerAnim', '_familyMask');
  const during = n.$siblings(cast).find(c => c.m_Script?.m_PathID === '1339719624887862345');
  if (cast?._animKey !== 'Skill' || cast._preDelay !== Math.fround(1.17) || cast._escapeTime !== Math.fround(.66)
    || cast._timeMode !== 1 || cast._waitForAttackEvent !== 1 || cast._affectedBySlowDown !== 1
    || wrapper?._familyMask !== 3 || wrapper._ignoreSilence !== 0 || wrapper._castLikeAttack !== 0
    || during?._buffs?.[0]?.attributes?.abnormalFlags?.join() !== '11,18'
    || during._buffs[1]?.templateKey !== 'enemy_lrcmra[switchMode]') return false;
  const finish = n.$template('enemy_lrcmra[switchMode]')?.eventToActions?.ON_BUFF_FINISH;
  const check = n.$template('enemy_lrcmra[switchMode][toOrig]')?.eventToActions?.ON_BUFF_TRIGGER;
  const toggle = one(n, 'switchToOrig', '_buffs')?._buffs?.[0];
  if (finish?.[0]?._modeIndex !== 1 || finish[1]?._buffKey !== 'enemy_lrcmra[unmovable]'
    || check?.[0]?._buffKeys?.join() !== 'enemy_bigstorm[mark],buff_originum[tile],enemy_lrcmra[originum][mark]'
    || check[0].isAND !== false || check[1]?._skillName !== 'triggerAnim'
    || toggle?.triggerInterval !== .5 || toggle.waitFirstTriggerInterval !== 1) return false;
  const template = n.$template('enemy_lrcmra[originum][dmg]');
  const actions = []; const visit = value => {
    if (!value || typeof value !== 'object') return;
    if (value.$type?.includes('+FixedValueDamage,')) actions.push(value);
    for (const child of Object.values(value)) visit(child);
  }; visit(template);
  return actions.length === 3 && actions.every(a => a._damageType === 'PURE' && a._ignoreForSp === true
    && a._noSourceDamage === true && a._isEnvDamage === true);
}
export const CHIMERA_ENEMY_FEATURES = {
  'talent:OrigAura': { covers: chimeraNative,
    ability: { kind: 'profaneChimera', params: r => ({ damage: r.talents.bb['OrigAura.damage'],
      spRatio: r.talents.bb['OrigAura.sp_recover_ratio'], atkFlat: r.talents.bb['AtkBoost.atk'] }) },
    stageOverrides: { 'OrigAura.damage': finiteNonnegative }, nativeClaim: () => ({ wrappers: 1 }),
    note: 'lasting pollution transformation and shared environmental aura',
    explains: /^Continuously causes an area of Originium pollution around itself when affected by Originium pollution or an Active Originium Storm, and attacks deal Arts damage instead\.$/ },
  'talent:AtkBoost': { covers: chimeraNative, stageOverrides: { 'AtkBoost.atk': finiteNonnegative },
    note: 'flat ATK addition in the transformed mode' },
  'skill:triggerAnim': { covers: chimeraNative, note: 'pollution transformation cast; mode switches when its cast buff finishes' },
};
