// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {recoverOriginalClocks} from './original-clocks.mjs';

const id = 'char_4223_botany';
const output = new URL('../../data/arkpedia-botany-clocks.json', import.meta.url);
export const recoverClocks = ({read = readFile} = {}) => recoverOriginalClocks({
  id, read,
  receipt: new URL(`../../data/arkpedia-native-operators/${id}.json`, import.meta.url),
  cache: new URL(`../../.cache/arkpedia/cn-operators/${id}/`, import.meta.url),
  sha256: 'dd8f7cccb8e291d0598ea8a4972377c967f790aa05820b3734eba9aeb2dfd6c7',
});
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const bytes = JSON.stringify(await recoverClocks(), null, 2) + '\n';
  if (process.argv.includes('--write')) await writeFile(output, bytes);
  else assert.equal(await readFile(output, 'utf8'), bytes);
  console.log('Botany original exact clocks verified; no public admission.');
}
