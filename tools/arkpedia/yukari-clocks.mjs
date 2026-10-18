// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {recoverOriginalClocks} from './original-clocks.mjs';

const id = 'char_4219_yukari';
const output = new URL('../../data/arkpedia-yukari-clocks.json', import.meta.url);
export const recoverClocks = ({read = readFile} = {}) => recoverOriginalClocks({
  id, read,
  receipt: new URL(`../../data/arkpedia-native-operators/${id}.json`, import.meta.url),
  cache: new URL(`../../.cache/arkpedia/cn-operators/${id}/`, import.meta.url),
  sha256: 'eb4b2640253141e8a0cae32a5712348258cba08da239c16eae53bf7726a710f9',
});
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const bytes = JSON.stringify(await recoverClocks(), null, 2) + '\n';
  if (process.argv.includes('--write')) await writeFile(output, bytes);
  else assert.equal(await readFile(output, 'utf8'), bytes);
  console.log('Yukari original exact clocks verified; no public admission.');
}
