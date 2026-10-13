// SPDX-License-Identifier: GPL-3.0-or-later
// Verify the supplemental receipt independently against the pinned Git blob.
// --fetch fills the original-source cache; --write writes the selected receipt.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const source = {
  repository: 'Kengxxiao/ArknightsGameData_YoStar',
  commit: '57010cb5b2afea112cae57daa756b58676ba6850',
  path: 'en_US/gamedata/excel/gamedata_const.json',
  gitBlob: '79845a8d9f0cec7b1ca31489a13d0bb25e5dcd9f', size: 52002,
  sha256: '5ce4038089a8bb0effe910ccd92eeb56831f0842b65666aa06757e9f9d6d94b1',
};
const cache = new URL('../../.cache/arkpedia/rmixer-source/gamedata-const.json', import.meta.url);
const receipt = new URL('../../data/arkpedia-ammo-replenishment-source.json', import.meta.url);
if (process.argv.includes('--fetch')) {
  const response = await fetch(`https://raw.githubusercontent.com/${source.repository}/${source.commit}/${source.path}`);
  if (!response.ok) throw Error(`Pinned source unavailable (${response.status})`);
  await mkdir(new URL('./', cache), { recursive: true });
  await writeFile(cache, Buffer.from(await response.arrayBuffer()));
}
const raw = await readFile(cache), hash = (algorithm, bytes) => createHash(algorithm).update(bytes).digest('hex');
assert.equal(raw.length, source.size);
assert.equal(hash('sha1', Buffer.concat([Buffer.from(`blob ${raw.length}\0`), raw])), source.gitBlob);
assert.equal(hash('sha256', raw), source.sha256);
const selected = { source, term: JSON.parse(raw).termDescriptionDict['ba.addbullet'] };
assert.equal(selected.term.termId, 'ba.addbullet');
if (process.argv.includes('--write')) await writeFile(receipt, JSON.stringify(selected, null, 2) + '\n');
assert.deepEqual(JSON.parse(await readFile(receipt)), selected);
console.log('Verified pinned Replenish term, original Git blob, size and SHA-256');
