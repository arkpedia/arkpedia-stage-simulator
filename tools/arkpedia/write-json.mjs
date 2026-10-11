// SPDX-License-Identifier: GPL-3.0-or-later
// Readers keep seeing a complete snapshot while a rebuild prepares its replacement.
import { writeFile, rename, rm } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
export async function writeJSONAtomic(path, value) {
  const target = path instanceof URL ? fileURLToPath(path) : path;
  const temporary = join(dirname(target), `.${basename(target)}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
}
