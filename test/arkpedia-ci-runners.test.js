// SPDX-License-Identifier: GPL-3.0-or-later
// The owner runs every check on GitHub-hosted images, never on the NAS self-hosted runners.
// This guard fails the suite if a workflow grows a self-hosted label or a runner variable.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const WORKFLOWS = new URL('../.github/workflows/', import.meta.url);
const HOSTED = /^(ubuntu|windows|macos)-[a-z0-9.]+$/;

test('every workflow job runs on a GitHub-hosted runner image', async () => {
  const files = (await readdir(WORKFLOWS)).filter(name => /\.ya?ml$/.test(name));
  assert.ok(files.length, 'workflows exist');
  for (const file of files) {
    const text = await readFile(new URL(file, WORKFLOWS), 'utf8');
    const body = text.replace(/^\s*#.*$/gm, '');                 // policy comments may name what is forbidden
    assert.doesNotMatch(body, /self-hosted/i, `${file} must not name a self-hosted runner`);
    assert.doesNotMatch(body, /vars\.\w*RUNNER/i, `${file} must not select a runner through a repository variable`);

    const runsOn = [...body.matchAll(/^\s*runs-on:\s*(.+?)\s*$/gm)].map(m => m[1]);
    assert.ok(runsOn.length, `${file} has a runs-on`);
    for (const target of runsOn) {
      if (target.includes('matrix.')) {
        const images = [...text.matchAll(/^\s*os:\s*\[([^\]]+)\]/gm)]
          .flatMap(m => m[1].split(',').map(value => value.trim()));
        assert.ok(images.length, `${file} matrix has an os list`);
        for (const image of images) assert.match(image, HOSTED, `${file} matrix image ${image}`);
      } else {
        assert.match(target, HOSTED, `${file} runs-on ${target}`);
      }
    }
  }
});
