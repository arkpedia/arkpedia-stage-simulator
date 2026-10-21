// SPDX-License-Identifier: GPL-3.0-or-later
// Build one file-backed stage from the public Arkpedia sources used by the
// simulator. It is the small counterpart of build-mvp.mjs: the global payload
// keeps operators/enemies/effects, and each stage stays in its own JSON file.
//
//   node tools/arkpedia/build-stage.mjs \
//     --stage ../arkpedia-data/source/data/stages/0-2.json \
//     --geometry ../arkpedia-data/source/data/stage-geometry/0-2.json \
//     --playback ../arkpedia-stage-overhaul/public/stage-detail/0-2.json \
//     --out data/arkpedia-stage-0-2.json
//
// A stage is refused unless its route export matches the geometry hash and its
// spawns only use supported enemy records. Original stage art and gates are
// optional: the renderer labels the simplified fallback when they are absent.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { stageAdapter } from '../../server/sim/arkpedia.js';
import { assertRegularEnemies } from '../../shared/arkpedia/enemies.js';

const args = Object.fromEntries(process.argv.slice(2).flatMap((arg, i, all) =>
  arg.startsWith('--') ? [[arg.slice(2), all[i + 1]]] : []));
for (const key of ['stage', 'geometry', 'playback', 'out']) if (!args[key]) throw Error(`Missing --${key}`);
const read = async file => JSON.parse(await readFile(file, 'utf8'));
const [source, geometry, playbackFile, mvp] = await Promise.all([
  read(args.stage), read(args.geometry), read(args.playback), read(new URL('../../data/arkpedia-mvp.json', import.meta.url)),
]);
const paths = playbackFile.playbackPaths ?? playbackFile.paths;
if (!paths || !Object.keys(paths).length) throw Error('Playback export has no paths');
const stage = {
  code: source.code,
  name: source.name,
  description: source.description,
  battle: source.battle,
  mapTags: [],
  mapTagSource: null,
  geometry,
  pathing: {
    schemaVersion: 1,
    producer: 'Arkpedia stage browser / buildPlaybackPaths',
    stage: source.code,
    geometryHash: createHash('sha256').update(JSON.stringify(geometry)).digest('hex'),
    moveScale: 0.65,
    paths,
  },
  art: null,
  gates: null,
};
// The battle compiler and the supported-enemy gate are the same ones used by 0-1.
stageAdapter(stage);
assertRegularEnemies({ ...mvp, stage });
await writeFile(args.out, JSON.stringify(stage, null, 1) + '\n');
console.log(`Built ${stage.code}: ${stage.geometry.rows}x${stage.geometry.cols}, ${stage.geometry.waves.length} waves, ${stageAdapter(stage).spawns.length} spawns -> ${args.out}`);
