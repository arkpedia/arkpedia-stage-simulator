// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {recoverOriginalClocks} from './original-clocks.mjs';

const id = 'char_4213_skybx';
const output = new URL('../../data/arkpedia-skybox-clocks.json', import.meta.url);
export const recoverClocks = ({read = readFile} = {}) => recoverOriginalClocks({
  id, read,
  receipt: new URL(`../../data/arkpedia-native-operators/${id}.json`, import.meta.url),
  cache: new URL(`../../.cache/arkpedia/cn-operators/${id}/`, import.meta.url),
  sha256: '0aec7d8b76cb41f690498414047b829c29662703a1244abc57ea018496387100',
});
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const bytes = JSON.stringify(await recoverClocks(), null, 2) + '\n';
  if (process.argv.includes('--write')) await writeFile(output, bytes);
  else assert.equal(await readFile(output, 'utf8'), bytes);
  console.log('Skybox original exact clocks verified; no public admission.');
}
