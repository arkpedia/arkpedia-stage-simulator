// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { writeJSONAtomic, renameWithRetry } from '../tools/arkpedia/write-json.mjs';

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

test('Windows transient replacement locks retry without deleting or changing the target path',async()=>{
  const calls=[],delays=[];let failures=2;
  await renameWithRetry('prepared','snapshot',{platform:'win32',wait:async ms=>delays.push(ms),
    renameFile:async(...args)=>{calls.push(args);if(failures-->0)throw Object.assign(Error('locked'),{code:'EPERM'});}});
  assert.deepEqual(calls,Array.from({length:3},()=>['prepared','snapshot']));assert.deepEqual(delays,[10,20]);
});
test('permanent rename errors and non-Windows failures are not retried',async()=>{
  for(const [platform,code]of [['win32','EISDIR'],['linux','EPERM']]){
    let calls=0;const error=Object.assign(Error('permanent'),{code});
    await assert.rejects(renameWithRetry('a','b',{platform,wait:async()=>assert.fail('Unexpected retry'),renameFile:async()=>{calls++;throw error;}}),e=>e===error);
    assert.equal(calls,1);
  }
});
test('persistent Windows locks fail after a bounded retry window',async()=>{
  let calls=0;const delays=[],error=Object.assign(Error('locked'),{code:'EBUSY'});
  await assert.rejects(renameWithRetry('a','b',{platform:'win32',wait:async ms=>delays.push(ms),renameFile:async()=>{calls++;throw error;}}),e=>e===error);
  assert.equal(calls,8);assert.equal(delays.reduce((a,b)=>a+b,0),1270);
});
