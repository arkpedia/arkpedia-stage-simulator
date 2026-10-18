// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {recoverOriginalClocks} from './original-clocks.mjs';

const id = 'char_4218_aigis';
const output = new URL('../../data/arkpedia-aegis-clocks.json', import.meta.url);
export const recoverClocks = ({read = readFile} = {}) => recoverOriginalClocks({
  id, read,
  receipt: new URL(`../../data/arkpedia-native-operators/${id}.json`, import.meta.url),
  cache: new URL(`../../.cache/arkpedia/cn-operators/${id}/`, import.meta.url),
  sha256: 'a2e948ec33bbaa1b7b7b3cf1f9359570c45e2a5057e96e41cf2447b7fc3a982c',
});
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const bytes = JSON.stringify(await recoverClocks(), null, 2) + '\n';
  if (process.argv.includes('--write')) await writeFile(output, bytes);
  else assert.equal(await readFile(output, 'utf8'), bytes);
  console.log('Aegis original exact clocks verified; no public admission.');
}
