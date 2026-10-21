// SPDX-License-Identifier: GPL-3.0-or-later
// A zero-count deployable token is a hidden stage device; only positive counts
// mean the player can place something and the stage needs the token layer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stageAdapter } from '../server/sim/arkpedia.js';

const base = JSON.parse(readFileSync(new URL('../data/arkpedia-stage-0-2.json', import.meta.url), 'utf8'));
const withTokens = tokens => ({ ...structuredClone(base), geometry: { ...base.geometry, suppliedUnits: { fixed_squad: [], deployable_tokens: tokens } } });

test('zero-count tokens do not block the adapter', () => {
  assert.doesNotThrow(() => stageAdapter(withTokens([{ unit_id: 'trap_test', count: 0 }])));
});
test('a positive token count still blocks the adapter', () => {
  assert.throws(() => stageAdapter(withTokens([{ unit_id: 'trap_test', count: 1 }])), /Unsupported stage mechanics/);
});
