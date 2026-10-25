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

/** Validate unadmitted family evidence without granting a feature/support claim. */
export function verifiedChapter16FamilyGraph(raw, inventoryRaw, enemyInventoryRaw, index) {
  const graph = JSON.parse(raw), inventory = JSON.parse(inventoryRaw), enemies = JSON.parse(enemyInventoryRaw);
  if (graph.source.inventory !== 'data/arkpedia-cn-native-source.json'
    || graph.source.sha256 !== sha(inventoryRaw)
    || graph.source.enemyInventory?.path !== 'data/arkpedia-cn-enemy-native-source.json'
    || graph.source.enemyInventory.sha256 !== sha(enemyInventoryRaw)
    || index.source.inventory !== 'data/arkpedia-cn-enemy-native-source.json'
    || index.source.sha256 !== sha(enemyInventoryRaw)) throw Error('Chapter 16 family inventories disagree');
  for (const row of graph.source.bundles) {
    const pinned = [...inventory.bundles, ...enemies.bundles].find(b => b.path === row.path);
    if (pinned ? ['sha256', 'bytes', 'md5'].some(key => pinned[key] !== row[key])
      : row.manifestSha256 !== inventory.source.manifestSha256) throw Error('Chapter 16 family bundle is not pinned');
  }
  const all = [...Object.values(graph.prefabs).flat(), ...Object.values(graph.projectiles).flat(), ...Object.values(graph.templates)];
  for (const row of all) if (sha(row.originalJson) !== row.sha256) throw Error('Chapter 16 family component checksum mismatch');
  for (const [path, rows] of Object.entries(graph.prefabs)) {
    const prefab = index.prefabs[path];
    if (!prefab || new Set(rows.map(r => r.pathId)).size !== rows.length) throw Error('Unknown or duplicate Chapter 16 family component');
    const bundle = graph.source.bundles.find(b => b.path === prefab.bundle);
    if (!bundle) throw Error('Chapter 16 family prefab bundle missing');
    for (const entry of prefab.clockComponents) if (!rows.some(r => r.pathId === entry.pathId && r.sha256 === entry.originalDataSha256))
      throw Error('Chapter 16 family graph differs from indexed component');
  }
  const projects = new Set(Object.keys(graph.projectiles).map(path => path.split('/').at(-1).replace(/\.prefab$/, '')));
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === '_projectileKey' && child && !projects.has(child)) throw Error('Chapter 16 family projectile closure incomplete: ' + child);
      if (key === 'templateKey' && child && !graph.templates[child]) throw Error('Chapter 16 family template closure incomplete: ' + child);
      if (key === 'SerializedState') visit(JSON.parse(child)); else visit(child);
    }
  }
  for (const row of all) visit(JSON.parse(row.originalJson));
  return graph;
}

/** Keep the complete graph proof on the same inventory as the indexed components. */
export function verifiedChapter16Devices(raw, inventoryRaw, enemyInventoryRaw, timingSource) {
  const evidence = JSON.parse(raw), inventory = JSON.parse(inventoryRaw), enemies = JSON.parse(enemyInventoryRaw);
  if (evidence.source.sha256 !== sha(inventoryRaw) || evidence.source.enemyInventory?.sha256 !== sha(enemyInventoryRaw)
    || timingSource.inventory !== 'data/arkpedia-cn-enemy-native-source.json' || timingSource.sha256 !== sha(enemyInventoryRaw)
    || JSON.stringify(evidence.tableSource) !== JSON.stringify(inventory.source.tableSource))
    throw Error('Chapter 16 full graph and timing inventories disagree');
  for (const row of evidence.source.bundles) {
    const pinned = [...inventory.bundles, ...enemies.bundles].find(b => b.path === row.path);
    if (pinned ? pinned.sha256 !== row.sha256 : row.manifestSha256 !== inventory.source.manifestSha256)
      throw Error('Chapter 16 full graph bundle is not pinned: ' + row.path);
  }
  for (const row of [...Object.values(evidence.prefabs).flat(), ...Object.values(evidence.enemyPrefabs).flat(),
    ...Object.values(evidence.globalPrefabs).flat(), ...Object.values(evidence.templates)])
    if (sha(row.originalJson) !== row.sha256) throw Error('Chapter 16 full graph component checksum mismatch');
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
    const extra10120Raw = await readFile(new URL('data/candidates/arkpedia-ch16-native-10120.json', root));
    const extra10120 = verifiedNative(JSON.parse(extra10120Raw), prefabs, sha(indexRaw), native.source.templates);
    Object.assign(native.prefabs, extra10120.prefabs);
    candidateSources.nativeAbilities10120 = { path: 'data/candidates/arkpedia-ch16-native-10120.json', sha256: sha(extra10120Raw) };
    const engagementRaw = await readFile(new URL('data/candidates/arkpedia-ch16-reviewed-engagement.json', root));
    const engagement = JSON.parse(engagementRaw);
    if (engagement.nativeSource?.path !== candidateSources.nativeAbilities10120.path
      || engagement.nativeSource.sha256 !== sha(extra10120Raw))
      throw Error('Chapter 16 indexed engagement evidence differs from reviewed contract');
    native.chapter16EngagementSha256 = sha(extra10120Raw);
    const deviceRaw = await readFile(new URL(engagement.deviceSource.path, root));
    if (sha(deviceRaw) !== engagement.deviceSource.sha256) throw Error('Chapter 16 engagement source differs from reviewed contract');
    verifiedChapter16Devices(deviceRaw, inventoryRaw, await readFile(new URL('data/arkpedia-cn-enemy-native-source.json', root)), JSON.parse(indexRaw).source);
    native.chapter16DeviceSha256 = sha(deviceRaw);
    candidateSources.deviceEvidence = engagement.deviceSource;
    candidateSources.engagementContract = { path: 'data/candidates/arkpedia-ch16-reviewed-engagement.json', sha256: sha(engagementRaw) };
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
