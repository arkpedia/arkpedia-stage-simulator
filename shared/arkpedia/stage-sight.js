// SPDX-License-Identifier: GPL-3.0-or-later
// Chapter-12 sight (视野范围) for identification (鉴定): the global buff `mainline12_sightManager` puts
// `[g]mainline12_sightManager` on every own-side unit (characters and devices, targetCategory 3); on attach, every
// 0.5 s and at each skill start and end it runs TriggerEnvSystem env_005_mainline12_sightSystem for that unit. The
// env system marks the unit's attack-range tiles inSight (tile masks 4 and 8) and clears mask 8 when they leave
// (outOfSight); identification reads KEEP_REVEALED, read here as mask 8 ("in sight now"). PRTS 视野范围: a unit's
// sight is its attack-range tiles (display range, else the attack trigger's range, plus range extension).
// docs/CHAPTER-12-IDENTIFICATION-RESEARCH.md.
import native from '../../data/arkpedia-environment-native-source.json' with { type: 'json' };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const SIGHT_ENVIRONMENT = 'mainline12_sightManager', SIGHT_SYSTEM = 'env_005_mainline12_sightSystem';
export function sightNativeReviewed(e = native) {
  const c = e.prefabs?.[SIGHT_ENVIRONMENT]?.[0]?.data, b = c?._buffs?.[0], o = c?._options ?? {};
  const t = e.templates?.['[g]mainline12_sightManager']?.eventToActions;
  const trig = a => a?.length === 1 && a[0].$type.includes('TriggerEnvSystem') && a[0]._envKey === SIGHT_SYSTEM && a[0]._target === 'BUFF_OWNER'
    && a[0]._triggerWithEvent === false && a[0]._triggerWithBlackboard === false;
  const sys = e.envSystems?.[SIGHT_SYSTEM] ?? [], masks = sys.find(r => r.data._maskSettings)?.data._maskSettings;
  const keys = sys.find(r => '_inSight' in r.data)?.data;
  return e.prefabs[SIGHT_ENVIRONMENT].length === 1 && c._sourceType === 0 && c._deckBuffs?.length === 0 && c._buffs.length === 1
    && o.targetSide === 1 && o.targetMotion === 3 && o.targetCategory === 3 && o.enableAdvancedOptions === 0
    && b.templateKey === '[g]mainline12_sightManager' && b.lifeTimeType === 2 && b.triggerLifeType === 2 && b.triggerInterval === .5
    && b.waitFirstTriggerInterval === 0 && b.isSilenceable === 0 && b.isStunnable === 0
    && Object.keys(t ?? {}).sort().join() === 'ON_BUFF_TRIGGER,ON_SKILL_FINISH,ON_SKILL_START' && Object.values(t).every(trig)
    && sys.length === 3 && sys.some(r => r.data._sideType === 2)
    && same(masks, [{ statusKey: 'inSight', tileInfoMask: [4, 8], isEnable: 1 }, { statusKey: 'outOfSight', tileInfoMask: [8], isEnable: 0 }])
    && keys?._inSight === 'inSight' && keys._outOfSight === 'outOfSight';
}
