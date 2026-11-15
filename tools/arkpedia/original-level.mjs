// SPDX-License-Identifier: GPL-3.0-or-later
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

/** Full original level shared by alias/device compilers; one verified cache blob. */
export async function readOriginalLevel(root, receipt) {
  if (!/^[a-f0-9]{40}$/.test(receipt?.source?.gitBlob ?? '') || !/^[a-f0-9]{64}$/.test(receipt?.source?.sha256 ?? ''))
    throw Error('Missing verified original level definitions');
  const path = `.cache/arkpedia/original-level-blobs/${receipt.source.gitBlob}.json`;
  let bytes;
  try { bytes = await readFile(join(root, path)); }
  catch (error) {
    if (error.code === 'ENOENT') throw Error('Original level cache missing; restore it with content:rules for this stage');
    throw error;
  }
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  if (sha256 !== receipt.source.sha256 || blob !== receipt.source.gitBlob) throw Error('Original level definitions checksum mismatch');
  return { level: JSON.parse(bytes), source: { path, sha256 } };
}
