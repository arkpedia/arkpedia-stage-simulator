// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createLocalAssets } from '../scripts/arkpedia-local-assets.mjs';
import { artBase } from '../shared/arkpedia/stage-art.js';

test('loopback assets serve only pinned public asset-tree blobs and ignore checkout changes, arbitrary files and refs', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'arkpedia-local-assets-'));
  try {
    const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
    git(['init', '-q']);
    git(['remote', 'add', 'origin', 'git@github.com:arkpedia/arkpedia-sd-assets.git']);
    await mkdir(path.join(root, 'models/operator/test'), { recursive: true });
    await writeFile(path.join(root, 'models/operator/test/model.skel'), 'pinned skeleton');
    await writeFile(path.join(root, 'private.txt'), 'not an asset');
    git(['add', '.']);
    git(['-c', 'user.name=Asset Test', '-c', 'user.email=asset-test@example.invalid', 'commit', '-qm', 'Fixture']);
    const commit = git(['rev-parse', 'HEAD']);
    const source = { sd: { repository: 'arkpedia/arkpedia-sd-assets', commit },
      stage: { art: { repository: 'arkpedia/arkpedia-sd-assets', commit } },
      tokens: { token: { avatar: `https://raw.githubusercontent.com/arkpedia/arkpedia-sd-assets/${commit}/models/operator/test/icon.png` } } };
    const local = createLocalAssets(root), snapshot = await local.snapshot(source);
    assert.equal(source.sd.localBase, undefined);
    assert.equal(artBase(snapshot.sd), `/arkpedia-assets/${commit}/`);
    assert.equal(snapshot.stage.art.localBase, snapshot.sd.localBase);
    assert.equal(snapshot.tokens.token.avatar, snapshot.sd.localBase + 'models/operator/test/icon.png');
    await writeFile(path.join(root, 'models/operator/test/model.skel'), 'modified checkout');
    await writeFile(path.join(root, 'models/operator/test/untracked.skel'), 'untracked');
    async function request(file, method = 'GET', revision = commit) {
      const result = {};
      const handled = await local.handle({ method }, {
        writeHead: (status, headers) => Object.assign(result, { status, headers }),
        end: body => { result.body = body; },
      }, new URL(`http://localhost/arkpedia-assets/${revision}/${file}`));
      assert.equal(handled, true);
      return result;
    }
    const response = await request('models/operator/test/model.skel');
    assert.equal(response.status, 200);
    assert.equal(response.body.toString(), 'pinned skeleton');
    assert.equal(response.headers['Content-Length'], 15);
    assert.equal((await request('models/operator/test/model.skel', 'HEAD')).body, undefined);
    for (const file of ['private.txt', 'models/operator/test/untracked.skel', 'models/%2E%2E/private.txt', '.git/config'])
      assert.equal((await request(file)).status, 404);
    assert.equal((await request('models/operator/test/model.skel', 'POST')).status, 404);
    assert.equal((await request('models/operator/test/model.skel', 'GET', 'main')).status, 404);
    assert.equal((await request('models/operator/test/model.skel', 'GET', '0'.repeat(40))).status, 404);
    assert.throws(() => artBase({ ...snapshot.sd, localBase: '/other/' }), /Invalid/);
    assert.throws(() => artBase({ ...snapshot.sd, localBase: 'https://example.com/' }), /Invalid/);
    git(['remote', 'set-url', 'origin', 'git@github.com:someone/unrelated.git']);
    await assert.rejects(createLocalAssets(root).snapshot(source), /Unexpected local/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
