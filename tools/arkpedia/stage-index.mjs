// SPDX-License-Identifier: GPL-3.0-or-later
// Keep data/arkpedia-stages.json in step with the stage files on disk.
//
//   node tools/arkpedia/stage-index.mjs          # rewrite the catalogue
//   node tools/arkpedia/stage-index.mjs --check  # fail if it is stale
//
// Curated entries (0-1 is embedded, a reviewed file-backed stage has no
// `testOnly`) are preserved. Every other data/arkpedia-stage-*.json becomes a
// `testOnly` entry, so the developer QA view can open it but the public
// simulator neither lists nor accepts it without `?experimental=1`.
import { readFile, readdir, writeFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const INDEX = new URL('data/arkpedia-stages.json', root);
const DATA = new URL('data/', root);
const isStageFile = name => /^arkpedia-stage-.+\.json$/.test(name);

export async function buildStageIndex() {
  const current = JSON.parse(await readFile(INDEX, 'utf8'));
  if (current.schemaVersion !== 1) throw Error('Unsupported stage catalogue schema');
  const curated = current.stages.filter(entry => !entry.testOnly);
  const curatedFiles = new Set(curated.map(entry => entry.data).filter(Boolean));
  const generated = [];
  for (const file of (await readdir(DATA)).filter(isStageFile).sort()) {
    if (curatedFiles.has(file)) continue;
    const stage = JSON.parse(await readFile(new URL(file, DATA), 'utf8'));
    if (!stage.code || !stage.name || !stage.geometry) throw Error(`Invalid stage file: ${file}`);
    generated.push({ id: file.replace(/^arkpedia-stage-/, '').replace(/\.json$/, ''),
      code: stage.code, name: stage.name, description: stage.description ?? '', data: file, testOnly: true });
  }
  generated.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  const ids = new Set(curated.map(entry => entry.id));
  for (const entry of generated) {
    if (ids.has(entry.id)) throw Error(`Duplicate stage id: ${entry.id}`);
    ids.add(entry.id);
  }
  return { schemaVersion: 1, defaultStage: current.defaultStage, stages: [...curated, ...generated] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const index = await buildStageIndex(), text = JSON.stringify(index, null, 2) + '\n';
  if (process.argv.includes('--check')) {
    if (await readFile(INDEX, 'utf8') !== text) { console.error('Stage catalogue is stale: run node tools/arkpedia/stage-index.mjs'); process.exit(1); }
    console.log(`Stage catalogue matches ${index.stages.length} entries`);
  } else {
    await writeFile(INDEX, text);
    console.log(`Wrote ${index.stages.length} stage entries (${index.stages.filter(entry => entry.testOnly).length} test-only)`);
  }
}
