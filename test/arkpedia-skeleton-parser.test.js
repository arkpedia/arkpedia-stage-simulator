// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseSkel, parseJsonSkel } from '../tools/assets/skel.mjs';

// A valid empty Spine 3.8 skeleton, with bounds but no attachments/game art.
function fixture() {
  const string = value => Buffer.concat([Buffer.from([value.length + 1]), Buffer.from(value)]);
  const bounds = Buffer.alloc(16);
  [-12, -24, 360, 400].forEach((value, index) => bounds.writeFloatBE(value, index * 4));
  // nonessential=false; empty strings, bones, slots, constraints, skins,
  // events and animations.
  return Buffer.concat([string('offset fixture'), string('3.8.99'), bounds, Buffer.alloc(11)]);
}

test('original skeleton inspection respects pooled Buffer and Uint8Array slice boundaries', () => {
  const original = fixture();
  const expected = { version: '3.8.99', animations: [], durations: {}, events: [],
    hits: {}, bounds: { x: -12, y: -24, width: 360, height: 400 }, missingRegions: [] };
  assert.deepEqual(parseSkel(new Uint8Array(original)), expected);
  const pool = Buffer.alloc(original.length + 93, 0xff);
  original.copy(pool, 37);
  const slice = pool.subarray(37, 37 + original.length);
  assert.ok(slice.byteOffset > 0);
  assert.deepEqual(parseSkel(slice), expected);
  assert.deepEqual(parseSkel(slice,undefined,{includeAttachmentTimelines:true}),{...expected,attachmentTimelines:{},setupAttachments:[]});
  assert.deepEqual(parseSkel(new Uint8Array(pool.buffer, slice.byteOffset, slice.length)), expected);
  // Changing adjacent pooled bytes must not change the selected skeleton.
  pool.fill(0, 0, 37); pool.fill(0, 37 + original.length);
  assert.deepEqual(parseSkel(slice), expected);
  assert.throws(() => parseSkel(slice.subarray(0, slice.length - 2)), /bounds|offset|DataView/i);
});

test('original Spine JSON inspection keeps event payloads, float timeline duration and exact byte slice', () => {
  const source = { skeleton: { spine: '3.8.99' }, bones: [{ name: 'root' }], events: { OnAttack: { int: 2, float: .5, string: 'default' } },
    animations: { Attack: { events: [{ time: .8, name: 'OnAttack', int: 3, string: 'hit' }],
      bones: { root: { rotate: [{ time: 0 }, { time: 2, angle: 5 }] } } } } };
  const raw = Buffer.from(JSON.stringify(source)), pool = Buffer.concat([Buffer.from('unrelated'), raw, Buffer.from('tail')]);
  const result = parseJsonSkel(pool.subarray(9, 9+raw.length), undefined, { includeEventPayloads: true, includeExactDurations: true });
  assert.equal(result.version, '3.8.99'); assert.deepEqual(result.animations, ['Attack']); assert.equal(result.exactDurations.Attack, 2);
  assert.deepEqual(result.eventPayloads.Attack, [{ time: Math.fround(.8), name: 'OnAttack', int: 3, float: .5, string: 'hit' }]);
  assert.throws(() => parseJsonSkel(Buffer.from('{')), SyntaxError);
  assert.throws(() => parseJsonSkel(Buffer.from(JSON.stringify({ ...source, skeleton: { spine: '4.0' } }))), /Spine 3.8/);
});

test('both original crossbow JSON skeletons retain distinct ranged and combat event clocks', () => {
  const source = JSON.parse(readFileSync(new URL('../data/candidates/arkpedia-ch16-crossbow-animation-source.json', import.meta.url)));
  assert.equal(Object.keys(source.enemies).length, 2);
  for (const row of Object.values(source.enemies)) {
    const raw = Buffer.from(row.base64, 'base64');
    assert.equal(raw.length, row.bytes); assert.equal(createHash('sha256').update(raw).digest('hex'), row.sha256);
    assert.equal(createHash('sha256').update(row.skeletonDataOriginalJson).digest('hex'), row.skeletonDataSha256);
    const d = parseJsonSkel(raw, undefined, { includeEventPayloads: true, includeExactDurations: true });
    assert.deepEqual(d.eventPayloads.Attack.map(e => [e.name,e.time]), [['OnAttack',.5]]);
    assert.deepEqual(d.eventPayloads.Skill.map(e => [e.name,e.time]), [['OnAttack',.53329998254776]]);
    assert.equal(d.exactDurations.Attack,1.7999999523162842); assert.equal(d.exactDurations.Skill,1.8667000532150269);
  }
});
