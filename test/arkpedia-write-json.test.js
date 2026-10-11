// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { writeJSONAtomic } from '../tools/arkpedia/write-json.mjs';

test('a concurrent reader only observes complete JSON snapshots during repeated large rebuilds', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'arkpedia-json-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'snapshot.json'), payload = 'source data '.repeat(100000);
  await writeJSONAtomic(file, { revision: 0, payload });
  let finished = false, reads = 0;
  const writer = (async () => {
    try { for (let revision = 1; revision <= 8; revision++) await writeJSONAtomic(file, { revision, payload }); }
    finally { finished = true; }
  })();
  while (!finished) {
    const snapshot = JSON.parse(await readFile(file, 'utf8'));
    assert.ok(snapshot.revision >= 0 && snapshot.revision <= 8); assert.equal(snapshot.payload, payload); reads++;
  }
  await writer;
  assert.ok(reads > 0); assert.equal(JSON.parse(await readFile(file, 'utf8')).revision, 8);
  assert.deepEqual(await readdir(dir), ['snapshot.json']);
});
test('serialization failure preserves the previous file and does not leave a temporary snapshot', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'arkpedia-json-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'snapshot.json'); await writeJSONAtomic(file, { valid: true });
  const cycle = {}; cycle.self = cycle;
  await assert.rejects(writeJSONAtomic(file, cycle), /circular/i);
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), { valid: true });
  assert.deepEqual(await readdir(dir), ['snapshot.json']);
});
test('a failed final rename cleans its temporary file and preserves the existing target directory', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'arkpedia-json-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const target = join(dir, 'existing'); await mkdir(target);
  await assert.rejects(writeJSONAtomic(pathToFileURL(target), { valid: true }));
  assert.deepEqual(await readdir(dir), ['existing']); assert.deepEqual(await readdir(target), []);
});
