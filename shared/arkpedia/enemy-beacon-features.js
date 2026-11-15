// SPDX-License-Identifier: GPL-3.0-or-later
export function beaconNative(r, n) {
  if (r.key !== 'enemy_1421_lrchld' || r.prefabKey !== r.key || r.skills.length || Object.keys(r.talents.bb).length) return false;
  const root = n[r.prefabKey]?.find(c => '_modes' in c), mode = n.Default?.find(c => '_combat' in c);
  const buffs = n.Immune?.flatMap(c => c._buffs ?? []) ?? [];
  const body = buffs.find(c => c.buffKey === 'enemy_stormcoord[passive]'), hp = buffs.find(c => c.templateKey === 'enemy_stormcoord[lock_hp]');
  const floor = n.$template('enemy_stormcoord[lock_hp]')?.eventToActions.ON_TAKE_DAMAGE;
  const selectors = ['SelectChld', 'SelectChildSingle'].map(k => n[k]?.find(c => '_selector' in c));
  return root?._modes.length === 1 && root._commonAbilities.length === 2 && root._canNotExit === 1
    && mode?._attack.m_PathID === '0' && mode._generalAbilities.length === 0
    && body?.attributes.abnormalFlags.join() === '3,22' && body.isSilenceable === 0
    && body.attributes.abnormalImmunes.join() === '0,16,23,12,25,11' && body.attributes.abnormalComboImmunes.join() === '0'
    && hp?.blackboard.length === 1 && hp.blackboard[0].key === 'min_hp_ratio' && hp.blackboard[0].value === 1
    && floor?.length === 1 && floor[0].$type.endsWith('HpNoLessThanCertainPercentModifier, Assembly-CSharp')
    && buffs.some(c => c.buffKey === 'immune_shu_blink')
    && selectors.every((c, i) => {
      const s = c && n.$ref(c._selector);
      return s?._buffKey === 'enemy_stormcoord[passive]' && s._targetSide === 1 && s._targetMotion === 3
        && s._limitTargetNum === i && s._postFilter === [4, 34][i];
    });
}
export const BEACON_FEATURE = Object.freeze({
  covers: beaconNative, ability: { kind: 'beacon', params: () => ({}) }, nativeClaim: () => ({ active: 2 }),
  note: 'non-attacking, stationary, pushable Beacon; full-HP damage floor and native immunities; selector helpers only transfer visual markers',
});
