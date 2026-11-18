// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-shredder-animations.json' with { type: 'json' };
import deviceRuntime from '../../data/arkpedia-device-runtime.json' with { type: 'json' };
import { isBigUglyThing, bigUglyThingNative } from './enemy-big-ugly-thing-features.js';
const devices = deviceRuntime.stump;
const zero = r => r?.m_PathID === '0';
const matches = (row, fields) => row && Object.entries(fields).every(([k, v]) => row[k] === v);
export function brokenStumpNative(n = devices) {
  const rows = n.prefabs.trap_017_wooden_broke?.components.map(c => c.data) ?? [];
  const root = rows.find(c => '_modes' in c), mode = rows.find(c => '_tileOptions' in c);
  return matches(root, { _category: 2, _sideType: 1, _occupiedRemainingCharacterCnt: 0, _withdrawable: 0 })
    && root._modes.length === 1 && mode?._generalAbilities.length === 0 && zero(mode._attack) && zero(mode._combat)
    && matches(mode, { _keepCurrentPassableMask: 0, _keepCurrentBuildableType: 0, _rewriteTileHeightType: 0,
      _rewriteTileHeight: 1, _rewriteHeight: Math.fround(.4), _rewriteTileAdvancedBuildMask: 0 })
    && matches(mode._tileOptions, { buildableType: 0, passableMask: 2, advancedBuildMask: 0, forceSetHeightType: 0 });
}
const circle = (n, ref, radius) => {
  const rows = n.$siblings(ref), c = rows.find(c => 'm_Radius' in c), t = rows.find(c => 'm_LocalScale' in c);
  return c?.m_Radius === Math.fround(radius) && c.m_Offset.x === 0 && c.m_Offset.y === 0
    && t?.m_LocalScale.x === 1 && t.m_LocalScale.y === 1;
};
export function shredderNative(r, n, stump = devices, animations = clocks) {
  if (!['enemy_1097_cclmbjk', 'enemy_1097_cclmbjk_2'].includes(r.prefabKey) || !brokenStumpNative(stump)
    || r.applyWay !== 'RANGED' || r.stats.dmgType !== 'phys' || Object.keys(r.talents.groups).length
    || r.skills.length !== 1 || !matches(r.skills[0], { prefabKey: 'cuttree', cooldown: 0, initCooldown: 0, spCost: 4 })
    || Object.keys(r.skills[0].bb).join() !== 'max_cnt' || r.skills[0].bb.max_cnt !== 1
    || !matches(r.sp, { type: 'INCREASE_WHEN_ATTACK', maxSp: 4, initSp: 0, increment: 1 })) return false;
  const root = n[r.prefabKey]?.[0], mode = n.Default?.[0], attack = n.Attack?.find(c => '_damageType' in c);
  const selector = n.$siblings(mode?._attackTrigger).find(c => '_targetSide' in c);
  const wrapper = n.CutTree?.find(c => '_familyMask' in c), skill = n.CutTree?.find(c => '_actions' in c);
  const tiles = n.$ref(skill?._selector), graphic = n.$ref(root?._animator), clock = animations.enemies[r.prefabKey];
  if (root?._modes.length !== 1 || n.$ref(root._modes[0]) !== mode || root._commonAbilities.length
    || mode?._generalAbilities.length || n.$ref(mode._attack) !== attack || n.$ref(mode._combat) !== attack
    || !matches(attack, { _attackType: 1, _damageType: 1, _atkScale: 1, _timeMode: 0, _maxAnimScale: 1,
      _epDamageRatio: 0, _extraDamageType: 0, _selectTargetSource: 1 }) || attack._activeBuffs.length
    || !zero(attack._selector)
    || !matches(selector, { _targetSide: 2, _targetMotion: 1, _targetCategory: 1, _postFilter: 4,
      _ignoreTargetFree: 0, _forceIgnoreCamouflage: 0, _limitTargetNum: 1, _maxNum: 1 })
    || !circle(n, mode._attackTrigger, 1.3)
    || !matches(wrapper, { _familyMask: 3, _ignoreSilence: 0, _castLikeAttack: 0, _maxTriggerTime: -1,
      _resetMainAbilityCdWhenCastEnd: 0, _immuneStunWhenAffecting: 0 })
    || !matches(skill, { _selectTargetSource: 1, _selectTargetTiming: 0, _timeMode: 1, _preDelay: 0,
      _forceSpawn: 0, _checkBuildableType: 0, _spawnLikePredefine: 0, _spawnSelf: 0, _specifySide: 0 })
    || skill._activeBuffs.length || skill._buffsToToken.length || skill._tokenToSpawn.inst.characterKey !== 'trap_017_wooden_broke'
    || !matches(tiles, { _filterType: 8, _targetSide: 1, _targetMotion: 3, _targetCategory: 3,
      _limitTargetNum: 1, _maxNum: 1, _tileSortType: 0, _alwaysRandomInTheEnd: 1, _excludeAllCharacter: 0,
      _excludeCamouflagCharacter: 0, _ignoreHitRange: 0 })
    || tiles._tileOrTokenIdListPreferred.join() !== 'trap_015_tree,tile_wooden_wall'
    || !matches(tiles._options, { buildableType: 3, passableMask: 3, allowNoneBuildableType: 0,
      allowNonePassableMask: 0, advancedBuildableMask: 1, allowAllAdvancedBuildableMask: 0 })
    || !circle(n, skill._selector, 1.8) || !clock
    || n.$ref(graphic?._skeleton)?.skeletonDataAsset.m_PathID !== clock.source.skeletonDataPathId) return false;
  const actions = JSON.parse(skill._actions.SerializedState);
  if (actions.length !== 1 || !matches(actions[0], { $type: 'Torappu.Battle.Action.Nodes+InstantKill', _targetType: 'TARGET',
    _killSource: false, _noSource: false, _withdrawIfRallyPoint: false, _skipReborn: false, _noReason: false,
    _markReachExit: false, _switchState: false })) return false;
  for (const a of [attack, skill]) if (!matches(a, { _waitForAttackEvent: 1, _affectedBySlowDown: 1,
    _animKey: 'Attack', _downAnimKey: 'Attack_Down', _upAnimKey: 'Attack_Up', _endAnimKey: 'Idle' })) return false;
  return ['Attack', 'Attack_Down', 'Attack_Up'].every(clip => {
    const binding = graphic._animations.find(a => a.animKey === clip), events = clock.events[clip];
    return matches(binding, { animName: clip, loop: 0, speed: 1 }) && events?.length === 1
      && events[0].name === 'OnAttack' && events[0].time === Math.fround(43 / 30)
      && clock.durations[clip] === Math.fround(clip === 'Attack_Up' ? 82 / 30 : 81 / 30);
  });
}
export const SHREDDER_FEATURES = Object.freeze({
  // The Big Ugly Thing's level-zero cut shares the key; his contract (talent:bird_run) runs and claims it.
  'skill:cuttree': { matchesRecord: r => isBigUglyThing(r) || ['enemy_1097_cclmbjk', 'enemy_1097_cclmbjk_2'].includes(r.prefabKey),
    covers: (r, n) => isBigUglyThing(r) ? bigUglyThingNative(r, n) : shredderNative(r, n), nativeClaim: (_p, n) => n?.enemy_1512_mcmstr ? {} : ({ wrappers: 1 }),
    explains: /^After several attacks, destroys Giant Mushrooms and Stumps, rendering them unable to be deployed upon$/,
    ability: r => isBigUglyThing(r) ? null : { kind: 'stumpShredder', params: r => ({ attackRadius: Math.fround(1.3), skillRadius: Math.fround(1.8),
      initialSp: r.sp.initSp, increment: r.sp.increment, spCost: r.skills[0].spCost,
      animations: Object.fromEntries(['Attack', 'Attack_Down', 'Attack_Up'].map(clip => [clip,
        { dur: clocks.enemies[r.prefabKey].durations[clip], hit: clocks.enemies[r.prefabKey].events[clip][0].time }])) }) },
    note: 'Four attack releases charge a silenceable native-event cast. One random nearby mushroom/stump tile loses allied occupants through normal death/rebirth and becomes permanently undeployable. Tile-center range and deterministic selection are simulator conventions; native frame ordering is not certified.' },
});
