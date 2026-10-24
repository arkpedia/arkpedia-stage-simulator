// SPDX-License-Identifier: GPL-3.0-or-later
// Fetch and verify the canonical raw simulator inputs at one immutable arkpedia-data commit.
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');

export async function loadCanonicalEnemyTables({ lock, cacheDir, fetchImpl = fetch } = {}) {
  const pin = lock ?? JSON.parse(await readFile(new URL('../../data/arkpedia-canonical.lock.json', import.meta.url), 'utf8'));
  if (!/^[a-f0-9]{40}$/.test(pin.commit ?? '')) throw new Error('Canonical data lock has an invalid commit');
  if (!cacheDir) throw new Error('A cache directory is required');
  await mkdir(cacheDir, { recursive: true });
  const staged = [];
  for (const [name, file] of Object.entries(pin.files ?? {})) {
    if (!file || typeof file.path !== 'string' || file.path.split('/').some(part => !part || part === '.' || part === '..')) throw new Error(`Invalid canonical path for ${name}`);
    const url = `https://raw.githubusercontent.com/${pin.repository}/${pin.commit}/${file.path}`;
    const response = await fetchImpl(url);
    if (!response.ok) throw new Error(`Canonical fetch failed for ${name}: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== file.bytes || sha(bytes) !== file.sha256) throw new Error(`Canonical checksum mismatch for ${name}`);
    staged.push({ name, bytes, url, file });
  }
  // All-or-nothing: only after every input has verified do we expose any file.
  const out = {};
  const nonce = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  for (const { name, bytes, url, file } of staged) {
    const target = join(cacheDir, `${name}.json`);
    const temp = `${target}.${nonce}.tmp`;
    await writeFile(temp, bytes);
    await rename(temp, target);
    out[name] = { bytes, url, path: target, sha256: file.sha256 };
  }
  return { commit: pin.commit, repository: pin.repository, upstream: pin.upstream ?? null, files: out };
}
