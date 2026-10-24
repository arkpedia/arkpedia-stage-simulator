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
/** The evidence, refused unless every indexed component hashes to the index entry it names, every referenced one to
 * its own recorded digest, and its templates come from the pinned buff_template_data. */
export function verifiedNative(evidence, prefabs, indexSha, templatePin) {
  if (evidence.source.sha256 !== indexSha) throw Error('Native ability evidence was extracted from another timing index');
  if (JSON.stringify(evidence.source.templates) !== JSON.stringify(templatePin)) throw Error('Native ability evidence names another template source');
  for (const [path, comps] of Object.entries(evidence.prefabs)) for (const c of comps) {
    const entry = c.referenced ? null : prefabs[path]?.clockComponents.find(x => x.pathId === c.pathId);
    const ok = c.referenced ? sha(c.originalJson) === c.sha256 && prefabs[path]
      : entry && entry.objectName === c.objectName && sha(c.originalJson) === entry.originalDataSha256;
    if (!ok) throw Error(`Native ability evidence does not match the timing index: ${path} ${c.pathId}`);
  }
  return evidence;
}
export async function buildEnemySupport({ candidate = false } = {}) {
  const recordsPath = candidate ? 'data/candidates/arkpedia-enemy-records.canonical.json' : 'data/arkpedia-enemy-records.json';
  const recordsRaw = await readFile(new URL(recordsPath, root)), indexRaw = await readFile(new URL('data/arkpedia-enemy-clock-source.json', root));
  const nativeRaw = await readFile(new URL('data/arkpedia-enemy-native-abilities.json', root));
  const records = JSON.parse(recordsRaw), prefabs = JSON.parse(indexRaw).prefabs, native = verifiedNative(JSON.parse(nativeRaw), prefabs, sha(indexRaw), JSON.parse(await readFile(new URL('data/arkpedia-mvp.json', root))).behaviors.source);
  let candidateSources;
  if (candidate) {
    const receipt = JSON.parse(await readFile(new URL('data/candidates/arkpedia-enemy-records.canonical.receipt.json', root)));
    if (receipt.output.sha256 !== sha(recordsRaw) || receipt.output.bytes !== recordsRaw.length
      || JSON.stringify(receipt.canonicalData) !== JSON.stringify(records.canonicalData))
      throw Error('Canonical chapter 16 snapshot does not match its receipt');
    const extraRaw = await readFile(new URL('data/candidates/arkpedia-ch16-native-abilities.json', root));
    const extra = verifiedNative(JSON.parse(extraRaw), prefabs, sha(indexRaw), native.source.templates);
    const actionRaw = await readFile(new URL('data/candidates/arkpedia-ch16-action-source.json', root));
    const actions = JSON.parse(actionRaw), inventoryRaw = await readFile(new URL('data/arkpedia-cn-native-source.json', root));
    const inventory = JSON.parse(inventoryRaw);
    if (actions.source.sha256 !== sha(inventoryRaw)) throw Error('Chapter 16 actions name another native inventory');
    for (const row of actions.source.bundles) {
      const pinned = inventory.bundles.find(b => b.path === row.path);
      if (pinned ? pinned.sha256 !== row.sha256 : row.manifestSha256 !== inventory.source.manifestSha256)
        throw Error('Chapter 16 action bundle is not pinned');
    }
    for (const row of [...Object.values(actions.templates), ...Object.values(actions.projectiles).flat(), ...Object.values(actions.environments).flat()])
      if (sha(row.originalJson) !== row.sha256) throw Error('Chapter 16 serialized action checksum mismatch');
    const contractRaw = await readFile(new URL('data/candidates/arkpedia-ch17-reviewed-contracts.json', root));
    native.actions = actions;
    candidateSources = { reviewedContract: { path: 'data/candidates/arkpedia-ch17-reviewed-contracts.json', sha256: sha(contractRaw) }, nativeAbilities: { path: 'data/candidates/arkpedia-ch16-native-abilities.json', sha256: sha(extraRaw) },
      actions: { path: 'data/candidates/arkpedia-ch16-action-source.json', sha256: sha(actionRaw) } };
    Object.assign(native.prefabs, extra.prefabs);
  }
  const enemies = deriveEnemySupport(records.enemies, prefabs, native);
  const supported = Object.values(enemies).filter(e => e.policy).length;
  return { schemaVersion: 1,
    scope: 'Derived regular-stage enemy support. An enemy is supported only when everything it uses has an approved implementation; today that is the stat-only tier. Not a claim of game-frame parity.',
    source: { records: { path: recordsPath, sha256: sha(recordsRaw) }, nativeTimingIndex: { path: 'data/arkpedia-enemy-clock-source.json', sha256: sha(indexRaw) },
      nativeAbilities: { path: 'data/arkpedia-enemy-native-abilities.json', sha256: sha(nativeRaw) },
      ...(candidateSources ? { candidate: candidateSources } : {}) },
    summary: { enemies: Object.keys(enemies).length, supported, unsupported: Object.keys(enemies).length - supported },
    enemies };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const candidate = process.argv.includes('--candidate-ch16');
  const output = candidate ? new URL('data/candidates/arkpedia-ch16-enemy-support.json', root) : OUT;
  const registryOutput = candidate ? new URL('data/candidates/arkpedia-ch16-regular-enemies.json', root) : REGISTRY;
  const support = await buildEnemySupport({ candidate }), text = JSON.stringify(support) + '\n';
  // The compact registry the battle and app load: supported id -> policy.
  const registry = JSON.stringify({ schemaVersion: 1, source: candidate ? 'data/candidates/arkpedia-ch16-enemy-support.json' : 'data/arkpedia-enemy-support.json',
    enemies: Object.fromEntries(Object.entries(support.enemies).filter(([, e]) => e.policy).map(([id, e]) => [id, e.policy])),
    spawns: Object.fromEntries(Object.entries(support.enemies).filter(([, e]) => e.policy && e.spawns.length).map(([id, e]) => [id, e.spawns])) }, null, 1) + '\n';
  if (process.argv.includes('--check')) {
    if (await readFile(output, 'utf8') !== text || await readFile(registryOutput, 'utf8') !== registry) { console.error('Enemy support files are stale'); process.exit(1); }
    console.log('Enemy support matches the catalogue and timing index');
  } else { await writeFile(output, text); await writeFile(registryOutput, registry); console.log(`Wrote ${text.length} + ${registry.length} bytes`); }
}
