// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {parseSkel} from '../assets/skel.mjs';
import {recoverOriginalClocks} from './original-clocks.mjs';

const id = 'char_4229_aphris', token = 'token_10070_aphris_pc';
const receipt = new URL(`../../data/arkpedia-native-operators/${id}.json`, import.meta.url);
const cache = new URL(`../../.cache/arkpedia/cn-operators/${id}/`, import.meta.url);
const output = new URL('../../data/arkpedia-aphrissa-clocks.json', import.meta.url);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const receiptHash = '77207d3d44737940e6bc4aee4a4a57abea27a1490d3870168e9f1615527ca254';

export async function recoverClocks({read = readFile} = {}) {
  const owner = await recoverOriginalClocks({id, receipt, cache, read, sha256: receiptHash});
  const receiptBytes = await read(receipt);
  assert.equal(hash(receiptBytes), receiptHash);
  const e = JSON.parse(receiptBytes);
  assert.deepEqual(Object.keys(e.officialSkeletonBindings[token]), ['Single']);
  const binding = e.officialSkeletonBindings[token].Single;
  const bytes = await read(new URL(`tokens/${token}/single.skel`, cache));
  assert.equal(bytes.length, binding.bytes);
  assert.equal(hash(bytes), binding.sha256);
  const legacy = parseSkel(bytes, undefined, {includeEventPayloads: true});
  const exact = parseSkel(bytes, undefined, {includeEventPayloads: true, includeExactDurations: true});
  assert.deepEqual(exact.durations, e.models[token].Single.durations);
  assert.deepEqual(exact.eventPayloads, e.models[token].Single.eventPayloads);
  const {exactDurations, ...unchanged} = exact;
  assert.deepEqual(unchanged, legacy);
  return {...owner, tokens: {[token]: {models: {Single: {
    sha256: binding.sha256, bytes: binding.bytes, exactDurations,
  }}}}};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const bytes = JSON.stringify(await recoverClocks(), null, 2) + '\n';
  if (process.argv.includes('--write')) await writeFile(output, bytes);
  else assert.equal(await readFile(output, 'utf8'), bytes);
  console.log('Aphrissa owner and relay original exact animation clocks verified; no public admission.');
}
