// SPDX-License-Identifier: GPL-3.0-or-later
// Loopback development only: read immutable public asset Git blobs, never
// arbitrary checkout files or moving refs. Hosted snapshots keep GitHub URLs.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { MIME } from '../server/index.js';
import path from 'node:path';
const run = promisify(execFile);
const repository = 'arkpedia/arkpedia-sd-assets';
const shaPattern = /^[a-f0-9]{40}$/;
const safeFile = file => /^(models|stages|effects)\/[\w./-]+\.(skel|atlas|png|webp|json|bin)$/.test(file)
  && file.split('/').every(segment => segment && segment !== '.' && segment !== '..');

export function createLocalAssets(assetRoot) {
  const revisions = new Map();
  const git = async args => (await run('git', args, { cwd: assetRoot,
    encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 })).stdout;
  async function revision(commit) {
    if (!shaPattern.test(commit)) throw Error('Local assets require a full immutable commit');
    if (!revisions.has(commit)) revisions.set(commit, (async () => {
      const origin = (await git(['config', '--get', 'remote.origin.url'])).toString().trim();
      if (!/^git@github\.com:arkpedia\/arkpedia-sd-assets(?:\.git)?$/.test(origin)
        && !/^https:\/\/github\.com\/arkpedia\/arkpedia-sd-assets(?:\.git)?$/.test(origin))
        throw Error('Unexpected local asset repository');
      const files = new Set((await git(['ls-tree', '-r', '--name-only', commit])).toString().trim()
        .split('\n').filter(safeFile));
      return { files };
    })());
    return revisions.get(commit);
  }
  async function snapshot(data) {
      if (data.sd.repository !== repository) throw Error('Unexpected snapshot asset repository');
      await revision(data.sd.commit);
      const local = structuredClone(data);
      const base = `/arkpedia-assets/${data.sd.commit}/`;
      for (const descriptor of [local.sd, local.stage.art, local.stage.gates, local.skillEffects, ...Object.values(local.nativeEffects ?? {})]) {
        if (descriptor?.repository === repository && descriptor.commit === data.sd.commit)
          descriptor.localBase = base;
      }
      // Additive artwork releases retain their own immutable pins. Never use
      // the main snapshot's local URL for a model from another revision.
      const modelRevisions = [...new Set(Object.values(local.sd.models ?? {})
        .map(model => model.assetsCommit).filter(Boolean))];
      const available = new Set();
      for (const commit of modelRevisions) {
        try { await revision(commit); available.add(commit); }
        catch { /* A partial checkout can still use this model's published URL. */ }
      }
      for (const model of Object.values(local.sd.models ?? {})) if (model.assetsCommit) {
        delete model.localBase;
        if (available.has(model.assetsCommit)) model.localBase = `/arkpedia-assets/${model.assetsCommit}/`;
      }
      for (const token of Object.values(local.tokens ?? {})) {
        const remote = `https://raw.githubusercontent.com/${repository}/${data.sd.commit}/`;
        if (typeof token.avatar === 'string' && token.avatar.startsWith(remote))
          token.avatar = base + token.avatar.slice(remote.length);
      }
      return local;
  }
  return {
    snapshot,
    async library(index, models) {
      const common = await snapshot({ ...index.common, stage: {}, sd: { ...index.common.sd, models } });
      const localModelBases = Object.fromEntries(Object.values(common.sd.models)
        .filter(model => model.assetsCommit && model.localBase).map(model => [model.assetsCommit, model.localBase]));
      // Model objects remain byte-identical to their content hashes. Transport
      // configuration belongs to the mutable bootstrap, never its components.
      delete common.stage;
      common.sd = { ...common.sd, models: {}, localModelBases };
      return { ...index, common };
    },
    async handle(req, res, url) {
      if (!url.pathname.startsWith('/arkpedia-assets/')) return false;
      const parts = url.pathname.slice('/arkpedia-assets/'.length).split('/');
      const commit = parts.shift();
      let file;
      try { file = decodeURIComponent(parts.join('/')); } catch { file = ''; }
      const pending = revisions.get(commit);
      if (!['GET', 'HEAD'].includes(req.method) || !shaPattern.test(commit ?? '') || !safeFile(file)
        || !pending || !(await pending).files.has(file)) {
        res.writeHead(404); res.end('Unknown pinned asset'); return true;
      }
      // Git's immutable tree is the source; modified/untracked working files
      // cannot replace a battle's assets. Avoid retaining the full roster in RAM.
      const bytes = await git(['show', `${commit}:${file}`]);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)],
        'Content-Length': bytes.length, 'Cache-Control': 'public, max-age=31536000, immutable' });
      res.end(req.method === 'HEAD' ? undefined : bytes);
      return true;
    },
  };
}
