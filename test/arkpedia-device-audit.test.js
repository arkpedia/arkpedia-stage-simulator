// SPDX-License-Identifier: GPL-3.0-or-later
// A functional Originium Altar is not modeled; no public stage may carry one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import index from '../data/arkpedia-stages.json' with { type: 'json' };

const source = new URL('../../arkpedia-data/source/data/stage-devices.json', import.meta.url);
test('no public stage carries an unmodeled Originium Altar', { skip: existsSync(source) ? false : 'the arkpedia-data source checkout is not present' }, () => {
  const devices = JSON.parse(readFileSync(source, 'utf8'));
  const offenders = index.stages.filter(s => s.data && !s.testOnly
    && (devices[s.id] ?? []).some(d => d.kind === 'device' && d.name === 'Originium Altar')).map(s => s.id);
  assert.deepEqual(offenders, []);
});
