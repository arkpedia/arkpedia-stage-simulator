// SPDX-License-Identifier: GPL-3.0-or-later
// Separate donor metadata receipt; never change the held native foundation.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
const cache = new URL('../../.cache/arkpedia/muelsyse-source/', import.meta.url);
const target = new URL('../../data/arkpedia-muelsyse-copy-source.json', import.meta.url);
const commit = '57010cb5b2afea112cae57daa756b58676ba6850';
const path = 'en_US/gamedata/excel/gamedata_const.json';
const sha = '79845a8d9f0cec7b1ca31489a13d0bb25e5dcd9f', size = 52002;
const rawPath = new URL('gamedata_const.json', cache);
if (process.argv.includes('--fetch')) {
  const response = await fetch(`https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData_YoStar/${commit}/${path}`,
    { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw Error(`Pinned constants unavailable (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== size || createHash('sha1').update(`blob ${size}\0`).update(bytes).digest('hex') !== sha)
    throw Error('Pinned constants Git blob mismatch');
  await mkdir(cache, { recursive: true });
  await writeFile(rawPath, bytes);
}
const bytes = await readFile(rawPath);
if (bytes.length !== size || createHash('sha1').update(`blob ${size}\0`).update(bytes).digest('hex') !== sha)
  throw Error('Original constants Git blob mismatch');
const native = await readFile(new URL('../../data/arkpedia-muelsyse-prefabs.json', import.meta.url));
const nativeSha = createHash('sha256').update(native).digest('hex');
if (nativeSha !== '61b12822227e45497f9e68aba5d0d929a7211fe8b535d0e0b177cc69c6527549')
  throw Error('Muelsyse foundation changed');
const receipt = { schemaVersion: 1,
  source: { repository: 'Kengxxiao/ArknightsGameData_YoStar', commit, gitBlob: { path, sha, size },
    sha256: createHash('sha256').update(bytes).digest('hex'), foundationSha256: nativeSha },
  subProfessionDamageTypePairs: JSON.parse(bytes).subProfessionDamageTypePairs,
  enabledOperators: [], frameParity: false, moduleSupport: false,
  reviewStatus: 'Original donor damage types; playable copy selection remains separately reviewed' };
if (process.argv.includes('--verify')) {
  const i = process.argv.indexOf('--verify'), filename = process.argv[i + 1];
  const actual = JSON.parse(await readFile(filename || target));
  if (!isDeepStrictEqual(actual, receipt)) throw Error('Donor metadata differs from original pinned constants');
  console.log(`Verified ${Object.keys(receipt.subProfessionDamageTypePairs).length} original donor damage types`);
} else {
  await writeFile(target, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(`Extracted ${Object.keys(receipt.subProfessionDamageTypePairs).length} original donor damage types`);
}
