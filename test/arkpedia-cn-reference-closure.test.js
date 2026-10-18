// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('Both CN source walkers distinguish formula variables from required projectile assets', t => {
  const python = process.env.ARKPEDIA_SOURCE_PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');
  const result = spawnSync(python, ['tools/arkpedia/test-cn-reference-closure.py'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', timeout: 10000,
  });
  if (result.error?.code === 'ENOENT') return t.skip('Python source-audit runtime unavailable');
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stderr, /Ran 6 tests/);
});
