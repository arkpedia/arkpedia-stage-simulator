#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional original CN battle tables for selected native-template comparison.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { CN_NATIVE_PIN } from './cn-native-source.mjs';
const out = new URL('../../.cache/arkpedia/cn-native-source/tables/', import.meta.url);
await mkdir(out, { recursive: true });
const rows = [
  { name: 'buff_template_data', path: 'zh_CN/gamedata/battle/buff_template_data.json', bytes: 27996217,
    gitBlob: 'a94bbb391fded80e59db38ad7c3ded89e25fd682' },
  { name: 'buff_table', path: 'zh_CN/gamedata/buff_table.json', bytes: 176162,
    gitBlob: 'b588d86b514d61c0025c0d9534f2a4e548aae302' },
];
for (const row of rows) {
  const file = new URL(row.name + '.json', out); let bytes;
  try { bytes = await readFile(file); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const response = await fetch(`https://raw.githubusercontent.com/${CN_NATIVE_PIN.repository}/${CN_NATIVE_PIN.commit}/${row.path}`,
      { signal: AbortSignal.timeout(90000) });
    if (!response.ok) throw Error('Pinned CN table unavailable: ' + row.path + ' (' + response.status + ')');
    bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== row.bytes || createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') !== row.gitBlob)
      throw Error('Changed original CN table: ' + row.path);
    await writeFile(file, bytes);
  }
  if (bytes.length !== row.bytes || createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') !== row.gitBlob)
    throw Error('Changed cached CN table: ' + row.path);
  console.log('Verified original CN table: ' + row.path);
}
