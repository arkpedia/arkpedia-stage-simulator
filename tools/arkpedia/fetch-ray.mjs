// SPDX-License-Identifier: GPL-3.0-or-later
// Fetch original Ray/Sandbeast assets from the pinned Global client manifest.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const cache = new URL('../../.cache/arkpedia/', import.meta.url);
const out = new URL('ray-source/', cache);
const version = '26-09-23-17-49-43_b9cc4a';
const hot = JSON.parse(await readFile(new URL('map-source/hot_update_list.json', cache)));
if (hot.versionId !== version) throw Error('Unexpected native client version');
await mkdir(out, { recursive: true });
for (const [name, location] of [
  ['charpack/char_4117_ray.ab', 'all-operator-source/char_4117_ray.ab'],
  ['chararts/char_4117_ray.ab', 'ray-source/char_4117_ray-chararts.ab'],
  ['pkgrps/btl_pfb_tokens_0.ab', 'map-source/ab/pkgrps/btl_pfb_tokens_0.ab'],
]) {
  const row = hot.abInfos.find(r => r.name === name);
  if (!row) throw Error(`Bundle absent from pinned manifest: ${name}`);
  const target = new URL(location, cache);
  await mkdir(dirname(fileURLToPath(target)), { recursive: true });
  let bytes;
  try { bytes = await readFile(target); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const filename = name.replaceAll('/', '_').replace(/\.ab$/, '.dat');
    const response = await fetch(`https://ark-us-static-online.yo-star.com/assetbundle/official/Android/assets/${version}/${filename}`,
      { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw Error(`Original asset unavailable: ${response.status} ${name}`);
    const archive = new URL(filename, out);
    await writeFile(archive, Buffer.from(await response.arrayBuffer()));
    execFileSync('python3', ['-c',
      'import sys,zipfile,pathlib; pathlib.Path(sys.argv[3]).write_bytes(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]))',
      fileURLToPath(archive), name, fileURLToPath(target)]);
    bytes = await readFile(target);
  }
  if (bytes.length !== row.abSize || createHash('md5').update(bytes).digest('hex') !== row.md5)
    throw Error(`Original bundle checksum mismatch: ${name}`);
  console.log(`Verified ${name}`);
}
