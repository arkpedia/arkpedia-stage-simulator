// SPDX-License-Identifier: GPL-3.0-or-later
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { writeJSONAtomic } from './write-json.mjs';

// All content graphs share immutable objects. Callers publish their manifest
// only after this completes, so interrupted builds cannot expose missing edges.
export async function publishComponentObjects(objects, root) {
  const directory = join(root, 'data/arkpedia-stage-library/objects');
  await mkdir(directory, { recursive: true });
  for (const [hash, bytes] of objects) {
    if (createHash('sha256').update(bytes).digest('hex') !== hash) throw Error('Invalid content component digest');
    const file = join(directory, `${hash}.json`);
    let previous;
    try { previous = await readFile(file, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (previous != null && previous !== bytes) throw Error(`Corrupt immutable content component: ${hash}`);
    if (previous == null) await writeJSONAtomic(file, JSON.parse(bytes), { space: 0 });
  }
}
