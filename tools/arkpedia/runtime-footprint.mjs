// SPDX-License-Identifier: GPL-3.0-or-later
// Source-byte audit, not a timing benchmark or compressed-transfer estimate.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { OPERATOR_RUNTIME_INDEX } from '../../server/sim/content/arkpedia-operator-runtime-index.js';
import { OPERATOR_SERVICE_INDEX } from '../../server/sim/content/arkpedia-operator-service-index.js';
import { writeJSONAtomic } from './write-json.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export async function runtimeFootprint(ids) {
  const files = new Map();
  async function visit(path, set) {
    if (set.has(path)) return; set.add(path);
    if (!files.has(path)) {
      const bytes = await readFile(resolve(root, path)), source = bytes.toString('utf8');
      const dependencies = path.endsWith('.json') ? [] : [...source.matchAll(/\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?["']([^"']+)["']/g)]
        .map(m => m[1]).filter(p => p.startsWith('.')).map(p => relative(root, resolve(root, dirname(path), p)));
      files.set(path, { path, bytes: bytes.length, sha256: digest(bytes), dependencies });
    }
    for (const dependency of files.get(path).dependencies) await visit(dependency, set);
  }
  const common = new Set(); await visit('server/sim/arkpedia.js', common);
  const selected = new Set(common), eager = new Set(common), chosen = new Set(ids), adapters = [];
  for (const entry of [...OPERATOR_RUNTIME_INDEX, ...OPERATOR_SERVICE_INDEX]) {
    const path = `server/sim/content/${entry.module.slice(2)}`;
    await visit(path, eager);
    if (entry.ids ? entry.ids.some(id => chosen.has(id)) : !entry.id || chosen.has(entry.id)) {
      adapters.push(entry.key); await visit(path, selected);
    }
  }
  const summarize = set => ({ modules: set.size, bytes: [...set].reduce((n, p) => n + files.get(p).bytes, 0),
    sha256: digest(JSON.stringify([...set].sort().map(p => ({ path: p, sha256: files.get(p).sha256 })))) });
  return { schemaVersion: 1, scope: 'Uncompressed static source closure plus explicitly selected adapter imports. Excludes roster/stage/model transfers and optional dynamic visual effects; not native fidelity or load-time certification.',
    ids, adapters, common: summarize(common), selected: summarize(selected), eager: summarize(eager),
    largestSelected: [...selected].map(p => files.get(p)).sort((a, b) => b.bytes - a.bytes).slice(0, 15).map(({ dependencies, ...file }) => file) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values } = parseArgs({ options: { ids: { type: 'string', default: 'char_123_fang,char_124_kroos' }, out: { type: 'string' } } });
  const report = await runtimeFootprint(values.ids.split(','));
  if (values.out) await writeJSONAtomic(resolve(values.out), report);
  console.log(JSON.stringify({ ids: report.ids, adapters: report.adapters.length, common: report.common, selected: report.selected, eager: report.eager }, null, 2));
}
