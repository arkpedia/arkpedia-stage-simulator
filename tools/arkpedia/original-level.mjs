// SPDX-License-Identifier: GPL-3.0-or-later
import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const PINNED_REPOSITORIES = new Set(['Kengxxiao/ArknightsGameData', 'Kengxxiao/ArknightsGameData_YoStar']);
const pending = new Map();
const sha256Of = bytes => createHash('sha256').update(bytes).digest('hex');
const blobOf = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');

/** Download one pinned original level into the ignored cache. The receipt's
 * repository, commit, path, Git blob and SHA-256 all come from committed
 * evidence; bytes that differ are never written. A machine without the cache
 * (CI, a fresh checkout) therefore reproduces exactly the reviewed input. */
async function restoreOriginalLevel(root, source, path) {
  if (!PINNED_REPOSITORIES.has(source.repository) || !/^[a-f0-9]{40}$/.test(source.commit ?? '')
    || typeof source.path !== 'string' || !/^[a-zA-Z_]+\/gamedata\/levels\/[\w./-]+\.json$/.test(source.path) || source.path.includes('..'))
    throw Error('Original level cache missing and its source is not a pinned original level; restore it with content:rules for this stage');
  const url = `https://raw.githubusercontent.com/${source.repository}/${source.commit}/${source.path}`;
  let bytes, failure;
  for (let attempt = 0; attempt < 3 && !bytes; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
    } catch (error) { failure = error; await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1))); }
  }
  if (!bytes) throw Error(`Original level download failed (${failure?.message}); restore it with content:rules for this stage`);
  if (blobOf(bytes) !== source.gitBlob || sha256Of(bytes) !== source.sha256) throw Error('Downloaded original level differs from its pinned checksums');
  const target = join(root, path), temp = `${target}.partial-${randomUUID()}`;
  await mkdir(dirname(target), { recursive: true });
  // Test files run in separate processes, so two may restore the same blob at
  // once; on Windows the losing rename can fail with EPERM/EBUSY. The bytes are
  // already verified, so a failed rename only skips the cache write.
  try { await writeFile(temp, bytes); await rename(temp, target); } catch { /* verified bytes are still returned */ } finally { await rm(temp, { force: true }); }
  return bytes;
}

/** Full original level shared by alias/device compilers; one verified cache blob. */
export async function readOriginalLevel(root, receipt) {
  if (!/^[a-f0-9]{40}$/.test(receipt?.source?.gitBlob ?? '') || !/^[a-f0-9]{64}$/.test(receipt?.source?.sha256 ?? ''))
    throw Error('Missing verified original level definitions');
  const path = `.cache/arkpedia/original-level-blobs/${receipt.source.gitBlob}.json`;
  let bytes;
  try { bytes = await readFile(join(root, path)); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    // Concurrent compilers share one download per blob.
    const key = join(root, path);
    if (!pending.has(key)) pending.set(key, restoreOriginalLevel(root, receipt.source, path).finally(() => pending.delete(key)));
    bytes = await pending.get(key);
  }
  const sha256 = sha256Of(bytes);
  const blob = blobOf(bytes);
  if (sha256 !== receipt.source.sha256 || blob !== receipt.source.gitBlob) throw Error('Original level definitions checksum mismatch');
  return { level: JSON.parse(bytes), source: { path, sha256 } };
}
