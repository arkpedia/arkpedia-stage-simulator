// SPDX-License-Identifier: GPL-3.0-or-later
import { compileStageEnvironments } from '../../shared/arkpedia/stage-environments.js';
import { PARASITIC_ENVIRONMENT, parasiticHostParameters, withoutParasiticParameters } from '../../shared/arkpedia/stage-parasitic.js';

/** These keys belong to the reviewed level environment, not an enemy kit.
 * Remove only those parameters before the existing strict enemy compilers. */
export function parasiticLevelState(level) {
  const instances = (level.globalBuffs ?? []).filter(e => e.prefabKey === PARASITIC_ENVIRONMENT);
  if (!instances.length) return null;
  if (instances.length !== 1) throw Error('Duplicate parasitic environment');
  compileStageEnvironments(instances);
  return parasiticHostParameters(level.enemyDbRefs);
}
export function withoutParasiticRef(ref) {
  if (!ref?.overwrittenData?.talentBlackboard) return ref;
  return { ...ref, overwrittenData: { ...ref.overwrittenData,
    talentBlackboard: withoutParasiticParameters(ref.overwrittenData.talentBlackboard) } };
}
