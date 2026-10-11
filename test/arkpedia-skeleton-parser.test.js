// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSkel } from '../tools/assets/skel.mjs';

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
  assert.deepEqual(parseSkel(new Uint8Array(pool.buffer, slice.byteOffset, slice.length)), expected);
  // Changing adjacent pooled bytes must not change the selected skeleton.
  pool.fill(0, 0, 37); pool.fill(0, 37 + original.length);
  assert.deepEqual(parseSkel(slice), expected);
  assert.throws(() => parseSkel(slice.subarray(0, slice.length - 2)), /bounds|offset|DataView/i);
});
