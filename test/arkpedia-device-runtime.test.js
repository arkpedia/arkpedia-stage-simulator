// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import * as runtime from '../shared/arkpedia/device-runtime.js';
import * as source from '../shared/arkpedia/stage-devices.js';
import { DEVICE_FAMILIES, buildDeviceRuntime, checkDeviceRuntime } from '../tools/arkpedia/device-runtime.mjs';

function* configurations(dimensions, instance = {}) {
  const [field, values] = Object.entries(dimensions)[0] ?? [];
  if (!field) { yield instance; return; }
  const rest = { ...dimensions }; delete rest[field];
  for (const value of values) yield* configurations(rest, { ...instance, [field]: value });
}
const invoke = (fn, family, id, instance) => family.keyed ? fn(id, instance) : family.keyLast ? fn(instance, id) : fn(instance);

for (const [name, family] of Object.entries(DEVICE_FAMILIES)) test(`${name}: every admitted configuration matches its source compiler`, async () => {
  const original = (await import(`../shared/arkpedia/${family.module}.js`))[name];
  for (const [id, variant] of Object.entries(family.variants)) {
    for (const instance of configurations(variant.dimensions)) {
      Object.assign(instance, Object.fromEntries(variant.bindings.map(field => [field, field === 'branchId' ? 'stage-specific-branch' : 7])));
      assert.deepEqual(invoke(runtime[name], family, id, instance), invoke(original, family, id, instance), JSON.stringify({ id, instance }));
    }
    const instance = configurations(variant.dimensions).next().value;
    Object.assign(instance, Object.fromEntries(variant.bindings.map(field => [field, field === 'branchId' ? 'branch' : 0])));
    for (const field of [...Object.keys(variant.dimensions), ...variant.bindings]) for (const invalid of [-1, 1000, NaN, '1', null, undefined, false, '']) {
      const changed = { ...instance, [field]: invalid };
      let expected, rejected = false;
      try { expected = invoke(original, family, id, changed); } catch { rejected = true; }
      if (rejected) assert.throws(() => invoke(runtime[name], family, id, changed));
      else assert.deepEqual(invoke(runtime[name], family, id, changed), expected);
    }
    const first = invoke(runtime[name], family, id, instance), originalValue = structuredClone(first);
    first.hp = -123; if (first.range?.length) first.range[0][0] = -999;
    assert.deepEqual(invoke(runtime[name], family, id, instance), originalValue);
  }
});

test('device specs, pulse geometry and token identities match the build contracts', () => {
  for (const [name, spec] of Object.entries(source.STAGE_DEVICES)) for (const key of [...spec.keys ?? [undefined], 'unknown'])
    for (const hidden of [undefined, true, false]) {
      const device = { name, key, hidden };
      assert.deepEqual(runtime.stageDeviceSpec(device), source.stageDeviceSpec(device));
    }
  assert.deepEqual(runtime.STAGE_TOKEN_UNITS, source.STAGE_TOKEN_UNITS);
  assert.deepEqual(runtime.pulseTiles(3, -2), source.pulseTiles(3, -2));
  assert.equal(runtime.stageDeviceSpec({ name: 'constructor' }), null);
  assert.throws(() => runtime.compiledDeviceDefinition('constructor', '', {}));
  assert.throws(() => runtime.sceneryDefinition('constructor', { level: 1, skillLevel: 1 }));
});

test('generated definitions reject stale or modified publication', async t => {
  await checkDeviceRuntime();
  const root = await mkdtemp(join(tmpdir(), 'device-runtime-')); t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'data'));
  const data = await buildDeviceRuntime(); data.values[0].hp = -1;
  await writeFile(join(root, 'data/arkpedia-device-runtime.json'), JSON.stringify(data));
  await assert.rejects(checkDeviceRuntime(root), /Stale device runtime/);
});

test('the battle import graph excludes raw device evidence and source compilers', async () => {
  const visited = new Set();
  async function visit(path) {
    if (visited.has(path)) return; visited.add(path);
    assert.ok(!path.endsWith('arkpedia-device-native-source.json') && !path.endsWith('arkpedia-device-source.json'), path);
    const text = await readFile(path, 'utf8'); if (path.endsWith('.json')) return;
    for (const match of text.matchAll(/\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?["']([^"']+)["']/g))
      if (match[1].startsWith('.')) await visit(resolve(dirname(path), match[1]));
  }
  await visit(resolve('server/sim/arkpedia.js'));
  for (const { module } of Object.values(DEVICE_FAMILIES)) assert.ok(!visited.has(resolve(`shared/arkpedia/${module}.js`)), module);
});
