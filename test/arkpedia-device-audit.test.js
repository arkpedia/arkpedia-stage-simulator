// SPDX-License-Identifier: GPL-3.0-or-later
// A functional Originium Altar is not modeled; no public stage may carry one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import index from '../data/arkpedia-stages.json' with { type: 'json' };
import { STAGE_DEVICES } from '../shared/arkpedia/stage-devices.js';

const source = new URL('../../arkpedia-data/source/data/stage-devices.json', import.meta.url);
test('public Originium Altar stages carry the reviewed device data', { skip: existsSync(source) ? false : 'the arkpedia-data source checkout is not present' }, () => {
  const devices = JSON.parse(readFileSync(source, 'utf8'));
  assert.ok(STAGE_DEVICES['Originium Altar']);
  for (const entry of index.stages.filter(s => s.data && !s.testOnly
    && (devices[s.id] ?? []).some(d => d.kind === 'device' && d.name === 'Originium Altar'))) {
    const stage = JSON.parse(readFileSync(new URL(`../data/${entry.data}`, import.meta.url), 'utf8'));
    assert.ok((stage.devices ?? []).some(d => d.name === 'Originium Altar'), `${entry.id} keeps its altar`);
  }
});
