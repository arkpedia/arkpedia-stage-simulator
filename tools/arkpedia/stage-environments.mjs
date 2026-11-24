// SPDX-License-Identifier: GPL-3.0-or-later
import { readOriginalLevel } from './original-level.mjs';
import { compileStageEnvironments } from '../../shared/arkpedia/stage-environments.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { PARASITIC_ENVIRONMENT, parasiticHostParameters } from '../../shared/arkpedia/stage-parasitic.js';
export async function prepareStageEnvironments({ root, rules, compiledRules }) {
  const { level, source } = await readOriginalLevel(root, rules);
  const environment = compileStageEnvironments(level.globalBuffs);
  const parasitic = environment.find(e => e.kind === PARASITIC_ENVIRONMENT);
  if (parasitic) Object.assign(parasitic, parasiticHostParameters(level.enemyDbRefs));
  if (environment.some(e => e.kind === 'strife_mode_feature')) {
    const wave = level.waves?.[0];
    if (level.waves?.length !== 1 || wave.preDelay !== 0 || wave.postDelay !== 0
      || wave.maxTimeWaitingForNextWave !== -1)
      throw Error('Unsupported Strife deadline wave program');
  }
  // The chapter-12 sight system and its global buff come as a pair.
  if (!!compiledRules?.sightSystem !== environment.some(e => e.kind === 'mainline12_sightManager'))
    throw Error('Unpaired chapter-12 sight system');
  const danger = environment.find(e => e.kind === 'legion_mode_enemy_boost');
  if (danger?.limits.length && danger.limits.length !== level.waves?.length)
    throw Error('Unsupported danger-limit wave mapping');
  const sources = [source];
  if (environment.length || Object.keys(compiledRules?.environmentOverrides ?? {}).length) {
    const path = 'data/arkpedia-environment-native-source.json';
    sources.push({ path, sha256: createHash('sha256').update(await readFile(join(root, path))).digest('hex') });
  }
  return { environment, sources };
}
