// SPDX-License-Identifier: GPL-3.0-or-later
// Original effect inputs only; no source pin advance or renderer enablement.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cache = new URL('../../.cache/arkpedia/', import.meta.url);
const out = new URL('tragodia-source/', cache), version = '26-09-23-17-49-43_b9cc4a';
const hot = JSON.parse(await readFile(new URL('map-source/hot_update_list.json', cache)));
if (hot.versionId !== version) throw Error('Wrong pinned native resource version');
const main = 'battle/prefabs/effects/phatm2.ab';
const names = [main, '[uc]shaders.ab', 'arts/[pack]common.ab', 'battle/[pack]common.ab',
  ...hot.abInfos.filter(r => r.name.startsWith('refs/fx/') && !r.name.includes('/overseas/')).map(r => r.name)];
if (names.length !== 23 || new Set(names).size !== 23) throw Error('Changed effect dependency inventory');
const hash = (algorithm, raw) => createHash(algorithm).update(raw).digest('hex'), sources = [];
await mkdir(out, {recursive: true});
for (const name of names) {
  const entry = hot.abInfos.find(r => r.name === name);
  if (!entry) throw Error('Missing original effect dependency: ' + name);
  const path = new URL(name === main ? 'tragodia-source/phatm2-effects.ab' : 'map-source/ab/' + name, cache);
  let raw;
  try { raw = await readFile(path); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const filename = name.replaceAll('/', '_').replaceAll('#', '__').replace(/\.ab$/, '.dat');
    const archive = new URL(filename, out);
    const url = `https://ark-us-static-online.yo-star.com/assetbundle/official/Android/assets/${version}/${filename}`;
    const result = await fetch(url, {signal: AbortSignal.timeout(60000)});
    if (!result.ok) throw Error(`Pinned native dependency unavailable (${result.status}): ${name}`);
    await writeFile(archive, Buffer.from(await result.arrayBuffer()));
    await mkdir(new URL('./', path), {recursive: true});
    execFileSync('python3', ['-c',
      'import sys,zipfile,pathlib; pathlib.Path(sys.argv[3]).write_bytes(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]))',
      fileURLToPath(archive), name, fileURLToPath(path)]);
    raw = await readFile(path);
  }
  if (raw.length !== entry.abSize || hash('md5', raw) !== entry.md5)
    throw Error('Original effect checksum mismatch: ' + name);
  sources.push({path: name, bytes: raw.length, md5: entry.md5, sha256: hash('sha256', raw)});
  console.log('Verified ' + name);
}
await writeFile(new URL('effect-bundles.json', out), JSON.stringify({version, sources}, null, 2) + '\n');
