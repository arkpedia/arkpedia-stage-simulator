// SPDX-License-Identifier: GPL-3.0-or-later
// Derive data/arkpedia-enemy-support.json from the committed enemy catalogue
// and native timing index (shared/arkpedia/enemy-support.js), plus the retained
// native ability evidence, each component of which must hash to the index.
//   node tools/arkpedia/enemy-support.mjs [--check]
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { deriveEnemySupport } from '../../shared/arkpedia/enemy-support.js';
const root = new URL('../../', import.meta.url), OUT = new URL('data/arkpedia-enemy-support.json', root), REGISTRY = new URL('data/arkpedia-regular-enemies.json', root);
const sha = b => createHash('sha256').update(b).digest('hex');
/** The evidence's prefab map, refused unless every component hashes to the index entry it names. */
export function verifiedNative(evidence, prefabs, indexSha) {
  if (evidence.source.sha256 !== indexSha) throw Error('Native ability evidence was extracted from another timing index');
  for (const [path, comps] of Object.entries(evidence.prefabs)) for (const c of comps) {
    const entry = prefabs[path]?.clockComponents.find(x => x.pathId === c.pathId);
    if (!entry || entry.objectName !== c.objectName || sha(c.originalJson) !== entry.originalDataSha256)
      throw Error(`Native ability evidence does not match the timing index: ${path} ${c.pathId}`);
  }
  return evidence.prefabs;
}
export async function buildEnemySupport() {
  const recordsRaw = await readFile(new URL('data/arkpedia-enemy-records.json', root)), indexRaw = await readFile(new URL('data/arkpedia-enemy-clock-source.json', root));
  const nativeRaw = await readFile(new URL('data/arkpedia-enemy-native-abilities.json', root));
  const records = JSON.parse(recordsRaw), prefabs = JSON.parse(indexRaw).prefabs, native = verifiedNative(JSON.parse(nativeRaw), prefabs, sha(indexRaw));
  const enemies = deriveEnemySupport(records.enemies, prefabs, native);
  const supported = Object.values(enemies).filter(e => e.policy).length;
  return { schemaVersion: 1,
    scope: 'Derived regular-stage enemy support. An enemy is supported only when everything it uses has an approved implementation; today that is the stat-only tier. Not a claim of game-frame parity.',
    source: { records: { path: 'data/arkpedia-enemy-records.json', sha256: sha(recordsRaw) }, nativeTimingIndex: { path: 'data/arkpedia-enemy-clock-source.json', sha256: sha(indexRaw) },
      nativeAbilities: { path: 'data/arkpedia-enemy-native-abilities.json', sha256: sha(nativeRaw) } },
    summary: { enemies: Object.keys(enemies).length, supported, unsupported: Object.keys(enemies).length - supported },
    enemies };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const support = await buildEnemySupport(), text = JSON.stringify(support) + '\n';
  // The compact registry the battle and app load: supported id -> policy.
  const registry = JSON.stringify({ schemaVersion: 1, source: 'data/arkpedia-enemy-support.json',
    enemies: Object.fromEntries(Object.entries(support.enemies).filter(([, e]) => e.policy).map(([id, e]) => [id, e.policy])),
    spawns: Object.fromEntries(Object.entries(support.enemies).filter(([, e]) => e.policy && e.spawns.length).map(([id, e]) => [id, e.spawns])) }, null, 1) + '\n';
  if (process.argv.includes('--check')) {
    if (await readFile(OUT, 'utf8') !== text || await readFile(REGISTRY, 'utf8') !== registry) { console.error('Enemy support files are stale'); process.exit(1); }
    console.log('Enemy support matches the catalogue and timing index');
  } else { await writeFile(OUT, text); await writeFile(REGISTRY, registry); console.log(`Wrote ${text.length} + ${registry.length} bytes`); }
}
