// SPDX-License-Identifier: GPL-3.0-or-later
// Fetch original Ela bundles from the pinned, checksum-verified client manifest.
// Existing shared tables/buff/projectile bundles use the standard source cache.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cache = new URL('../../.cache/arkpedia/', import.meta.url);
const out = new URL('ela-source/', cache);
const version = '26-09-23-17-49-43_b9cc4a';
const hash = (algorithm, bytes) => createHash(algorithm).update(bytes).digest('hex');
async function download(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw Error(`Pinned source unavailable: ${url} (${r.status})`);
  return Buffer.from(await r.arrayBuffer());
}
await mkdir(out, { recursive: true });
let bytes;
const hot = JSON.parse(await readFile(new URL('map-source/hot_update_list.json', cache)));
if (hot.versionId !== version) throw Error('Unexpected native client version');
for (const [name, path] of [
  ['charpack/char_4123_ela.ab', 'all-operator-source/char_4123_ela.ab'],
  ['chararts/char_4123_ela.ab', 'ela-source/char_4123_ela-chararts.ab'],
  ['pkgrps/btl_pfb_tokens_0.ab', 'map-source/ab/pkgrps/btl_pfb_tokens_0.ab'],
]) {
  const row = hot.abInfos.find(r => r.name === name);
  if (!row) throw Error(`Bundle absent from pinned manifest: ${name}`);
  const target = new URL(path, cache);
  try { bytes = await readFile(target); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const filename = name.replaceAll('/', '_').replace(/\.ab$/, '.dat');
    const archive = new URL(filename, out);
    await writeFile(archive, await download(`https://ark-us-static-online.yo-star.com/assetbundle/official/Android/assets/${version}/${filename}`));
    await mkdir(new URL('./', target), { recursive: true });
    execFileSync('python3', ['-c',
      'import sys,zipfile,pathlib; pathlib.Path(sys.argv[3]).write_bytes(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]))',
      fileURLToPath(archive), name, fileURLToPath(target)]);
    bytes = await readFile(target);
  }
  if (bytes.length !== row.abSize || hash('md5', bytes) !== row.md5)
    throw Error(`Original bundle checksum mismatch: ${name}`);
  console.log(`Verified ${name}`);
}
