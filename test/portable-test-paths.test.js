// SPDX-License-Identifier: GPL-3.0-or-later
// CI runs every test on Windows too. A URL's pathname is not a file path there
// ('/D:/a/...'), nor anywhere for names with spaces or non-ASCII characters
// (percent-encoded), so tests convert file URLs with fileURLToPath.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

test('test files turn import.meta.url into paths with fileURLToPath, never URL.pathname', () => {
  const directory = new URL('./', import.meta.url);
  const offenders = readdirSync(directory, { recursive: true })
    .filter(name => /\.(m?js)$/.test(name))
    .filter(name => /import\.meta\.url\)\.pathname/.test(readFileSync(new URL(name.split('\\').join('/'), directory), 'utf8')));
  assert.deepEqual(offenders, []);
});
