// SPDX-License-Identifier: GPL-3.0-or-later
// Fetch original Yu bundles from the pinned, checksum-verified client manifest.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cache = new URL('../../.cache/arkpedia/', import.meta.url);
const out = new URL('yu-source/', cache);
const version = '26-09-23-17-49-43_b9cc4a';
const hash = bytes => createHash('md5').update(bytes).digest('hex');
await mkdir(out, { recursive: true });
const hot = JSON.parse(await readFile(new URL('map-source/hot_update_list.json', cache)));
if (hot.versionId !== version) throw Error('Unexpected native client version');
for (const [name, path] of [
  ['charpack/char_2026_yu.ab', 'all-operator-source/char_2026_yu.ab'],
  ['chararts/char_2026_yu.ab', 'yu-source/char_2026_yu-chararts.ab'],
]) {
  const row = hot.abInfos.find(r => r.name === name);
  if (!row) throw Error(`Bundle absent from pinned manifest: ${name}`);
  const target = new URL(path, cache);
  let bytes;
  try { bytes = await readFile(target); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const filename = name.replaceAll('/', '_').replace(/\.ab$/, '.dat');
    const response = await fetch(`https://ark-us-static-online.yo-star.com/assetbundle/official/Android/assets/${version}/${filename}`,
      { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw Error(`Pinned source unavailable: ${name} (${response.status})`);
    const archive = new URL(filename, out);
    await writeFile(archive, Buffer.from(await response.arrayBuffer()));
    await mkdir(new URL('./', target), { recursive: true });
    execFileSync('python3', ['-c',
      'import sys,zipfile,pathlib; pathlib.Path(sys.argv[3]).write_bytes(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]))',
      fileURLToPath(archive), name, fileURLToPath(target)]);
    bytes = await readFile(target);
  }
  if (bytes.length !== row.abSize || hash(bytes) !== row.md5) throw Error(`Original bundle checksum mismatch: ${name}`);
  console.log(`Verified ${name}`);
}
