// SPDX-License-Identifier: GPL-3.0-or-later
import { createRng, deriveSeed } from '../rng.js';

/** Main-wave, fragment-local plain weighted groups only. Selection happens
 * once before count expansion. This is a reproducible simulator seed, not the
 * client's RNG stream. Packs, branches and refresh policies are not accepted. */
export function resolveStageRandomWaves(program, seed = 1) {
  if (!hasStageRandomChoices(program)) return program;
  const rng = createRng(deriveSeed(seed, 'stage-wave-groups')), choices = [];
  const waves = program.waves.map((wave, wi) => ({ ...wave, fragments: wave.fragments.map((fragment, fi) => {
    const groups = new Map();
    const candidatesInOrder = ['spawns', 'activations', 'emptyChoices'].flatMap(kind => (fragment[kind] ?? [])
      .map((action, ai) => ({ action, ai, kind }))).sort((a, b) => (a.action.order ?? a.ai) - (b.action.order ?? b.ai));
    for (const { action, ai, kind } of candidatesInOrder) if (action.random) {
      const { group, weight } = action.random;
      if (typeof group !== 'string' || !group || !Number.isSafeInteger(weight) || weight < 0)
        throw Error('Invalid stage random group');
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push({ action, ai, kind, weight });
    }
    if (!groups.size) return fragment;
    if (!Number.isFinite(fragment.fixedDuration) || fragment.fixedDuration < 0
      || !Number.isSafeInteger(fragment.fixedActionCount) || fragment.fixedActionCount < 0)
      throw Error('Missing stage random timing program');
    const selected = new Set();
    for (const [group, candidates] of groups) {
      const total = candidates.reduce((n, c) => n + c.weight, 0);
      if (!Number.isSafeInteger(total) || total <= 0) throw Error('Invalid stage random group weight');
      const pick = rng.weighted(candidates, c => c.weight);
      selected.add(pick.action);
      choices.push({ wave: wi, fragment: fi, group, action: pick.ai,
        ...(pick.kind === 'spawns' ? { enemy: pick.action.enemyKey } : { kind: pick.kind, key: pick.action.key }) });
    }
    const spawns = fragment.spawns.filter(s => !s.random || selected.has(s)).map(({ random, ...s }) => s);
    const activations = (fragment.activations ?? []).filter(s => !s.random || selected.has(s)).map(({ random, ...s }) => s);
    const duration = Math.max(fragment.fixedDuration, ...[...spawns, ...activations].map(s => s.offset + (s.count - 1) * s.interval));
    const { fixedDuration, fixedActionCount, empty, emptyChoices, activations: originalActivations, ...rest } = fragment;
    const actionCount = fixedActionCount + [...selected].filter(s => !(fragment.emptyChoices ?? []).includes(s)).reduce((n, s) => n + s.count, 0);
    return { ...rest, duration, spawns, ...(activations.length ? { activations } : {}), ...(actionCount === 0 ? { empty: true } : {}) };
  }) }));
  return { ...program, waves, randomChoices: choices };
}

export function hasStageRandomChoices(program) {
  return !!program?.waves?.some(w => w.fragments.some(f => ['spawns', 'activations', 'emptyChoices']
    .some(kind => f[kind]?.some(s => s.random))));
}
