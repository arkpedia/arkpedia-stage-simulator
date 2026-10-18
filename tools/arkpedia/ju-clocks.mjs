// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {recoverOriginalClocks} from './original-clocks.mjs';

const id = 'char_4221_ju';
const output = new URL('../../data/arkpedia-ju-clocks.json', import.meta.url);
export const recoverClocks = ({read = readFile} = {}) => recoverOriginalClocks({
  id, read,
  receipt: new URL(`../../data/arkpedia-native-operators/${id}.json`, import.meta.url),
  cache: new URL(`../../.cache/arkpedia/cn-operators/${id}/`, import.meta.url),
  sha256: '1a17ccfc1b76330814f9e7a660303ce4061df6c8afe50290ddc88a0e53a32011',
});
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const bytes = JSON.stringify(await recoverClocks(), null, 2) + '\n';
  if (process.argv.includes('--write')) await writeFile(output, bytes);
  else assert.equal(await readFile(output, 'utf8'), bytes);
  console.log('Ju original exact clocks verified; no public admission.');
}
