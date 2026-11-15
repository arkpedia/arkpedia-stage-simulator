// SPDX-License-Identifier: GPL-3.0-or-later
import { readFile, writeFile, mkdir, open, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, digest } from './content-inventory.mjs';
import { compileStageRules } from '../../shared/arkpedia/stage-rules.js';
import { writeSharedStageRuleReceipt } from './stage-rule-storage.mjs';

const REPOSITORIES = {
  cn: { repository: 'Kengxxiao/ArknightsGameData', language: 'zh_CN' },
  global: { repository: 'Kengxxiao/ArknightsGameData_YoStar', language: 'en_US' },
};
const gitBlob = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const tableCache = new WeakMap();

/** Import evidence only. Unknown rules are retained but remain blocked by the
 * same compiler used for additions; this command never changes the catalogue. */
export async function buildStageRuleReceipt({ stage, channel = 'cn', commit, tree, stageTableBytes, fetchImpl = fetch }) {
  const source = REPOSITORIES[channel];
  if (!source || !/^[a-f0-9]{40}$/.test(commit ?? '')) throw Error('An immutable supported source revision is required');
  const sharedLevel = stage.variant && (stage.variant.shares_parent_level_file === true
    || stage.variant.kind === 'challenge_mode' && stage.variant.shares_parent_level_file !== false);
  const levelId = sharedLevel ? stage.variant.of_stage_id : stage.id;
  if (!/^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*$/i.test(levelId ?? '')) throw Error('Unsupported original level identity');
  if (tree.truncated || !Array.isArray(tree.tree)) throw Error('Incomplete original level tree');
  let originalPath, stageTableSource;
  if (levelId.includes('/')) {
    // Mode-only levels have no stage_table row. Their source identity is the
    // level path itself; require an exact entry in the pinned original tree.
    originalPath = `${source.language}/gamedata/levels/${levelId.toLowerCase()}.json`;
  } else if (stageTableBytes) {
    const path = `${source.language}/gamedata/excel/stage_table.json`;
    const tableEntry = tree.tree.find(entry => entry.path === path && entry.type === 'blob');
    if (!tableEntry || gitBlob(stageTableBytes) !== tableEntry.sha) throw Error('Stage table does not match its pinned Git blob');
    let parsed = tableCache.get(stageTableBytes);
    if (!parsed || parsed.gitBlob !== tableEntry.sha) {
      parsed = { gitBlob: tableEntry.sha, sha256: digest(stageTableBytes), stages: JSON.parse(stageTableBytes.toString('utf8')).stages };
      tableCache.set(stageTableBytes, parsed);
    }
    const level = parsed.stages?.[levelId]?.levelId;
    if (typeof level !== 'string' || !/^[a-z0-9_/-]+$/i.test(level)) throw Error(`Missing original level mapping for ${levelId}`);
    originalPath = `${source.language}/gamedata/levels/${level.toLowerCase()}.json`;
    stageTableSource = { path, gitBlob: tableEntry.sha, sha256: parsed.sha256, stageId: levelId, levelId: level };
  }
  const candidates = tree.tree.filter(entry => entry.type === 'blob'
    && entry.path.startsWith(`${source.language}/gamedata/levels/`)
    && (originalPath ? entry.path === originalPath : entry.path.endsWith(`/level_${levelId}.json`)));
  if (candidates.length !== 1) throw Error(`Expected one original level for ${levelId}; found ${candidates.length}`);
  const entry = candidates[0];
  if (entry.path.split('/').includes('..') || !/^[a-f0-9]{40}$/.test(entry.sha ?? '')) throw Error('Invalid original level entry');
  const response = await fetchImpl(`https://raw.githubusercontent.com/${source.repository}/${commit}/${entry.path}`);
  if (!response.ok) throw Error(`Original level download failed: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (gitBlob(bytes) !== entry.sha) throw Error('Original level does not match its pinned Git blob');
  const level = JSON.parse(bytes.toString('utf8'));
  const hasTimeLimit = Object.hasOwn(level.options ?? {}, 'maxPlayTime');
  if (!level.mapData || !Array.isArray(level.waves) || !level.options || !Object.hasOwn(level, 'runes')
    || (hasTimeLimit && (!Number.isFinite(level.options.maxPlayTime) || (level.options.maxPlayTime !== -1 && level.options.maxPlayTime <= 0))))
    throw Error('Not a complete original level with a supported time limit');
  const receipt = { schemaVersion: 1, stageId: stage.id,
    ...(stage.variant?.of_stage_id ? { parentStageId: stage.variant.of_stage_id } : {}),
    source: { repository: source.repository, commit, path: entry.path, sha256: digest(bytes), gitBlob: entry.sha,
      ...(stageTableSource ? { stageTable: stageTableSource } : {}) },
    ...(hasTimeLimit ? { options: { maxPlayTime: level.options.maxPlayTime } } : {}), runes: level.runes };
  let blocker = null;
  try { compileStageRules(stage, receipt); } catch (error) { blocker = error.message; }
  return { receipt, status: blocker ? 'blocked' : 'ready', blocker };
}

export async function writeStageRuleReceipt(root, id, receipt) {
  if (!/^[a-z0-9_-]+$/i.test(id)) throw Error('Invalid stage slug');
  const dir = join(root, 'data/stage-rules'); await mkdir(dir, { recursive: true });
  const path = join(dir, `${id}.json`), handle = await open(path, 'wx');
  try { await handle.writeFile(JSON.stringify(receipt, null, 2) + '\n'); }
  catch (error) { await rm(path); throw error; }
  finally { await handle.close(); }
  return path;
}

export async function createStageRuleImporter({ root = ROOT, channel = 'cn', fetchImpl = fetch } = {}) {
  if (!REPOSITORIES[channel]) throw Error('Unknown original rule channel');
  const { repository } = REPOSITORIES[channel];
  const mvp = JSON.parse(await readFile(join(root, 'data/arkpedia-mvp.json'))), commit = mvp.sources[repository];
  if (!/^[a-f0-9]{40}$/.test(commit ?? '')) throw Error('Missing immutable source revision');
  const cacheDir = join(root, '.cache/arkpedia'), cache = join(cacheDir, `level-tree-${channel}-${commit}.json`);
  let tree;
  try { tree = JSON.parse(await readFile(cache)); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const response = await fetchImpl(`https://api.github.com/repos/${repository}/git/trees/${commit}?recursive=1`);
    if (!response.ok) throw Error(`Original level tree download failed: HTTP ${response.status}`);
    tree = await response.json();
    if (tree.truncated || !Array.isArray(tree.tree)) throw Error('Incomplete original level tree');
    await mkdir(cacheDir, { recursive: true }); await writeFile(cache, JSON.stringify(tree));
  }
  const tableCache = join(cacheDir, `stage-table-${channel}-${commit}.json`);
  let stageTableBytes;
  try { stageTableBytes = await readFile(tableCache); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const path = `${REPOSITORIES[channel].language}/gamedata/excel/stage_table.json`;
    const response = await fetchImpl(`https://raw.githubusercontent.com/${repository}/${commit}/${path}`);
    if (!response.ok) throw Error(`Stage table download failed: HTTP ${response.status}`);
    stageTableBytes = Buffer.from(await response.arrayBuffer());
    const entry = tree.tree.find(entry => entry.path === path && entry.type === 'blob');
    if (!entry || gitBlob(stageTableBytes) !== entry.sha) throw Error('Stage table does not match its pinned Git blob');
    await writeFile(tableCache, stageTableBytes);
  }
  const prefix = `https://raw.githubusercontent.com/${repository}/${commit}/`;
  const blobs = new Map(tree.tree.filter(e => e.type === 'blob').map(e => [prefix + e.path, e.sha]));
  const pending = new Map(), levels = join(cacheDir, 'original-level-blobs'); await mkdir(levels, { recursive: true });
  const cachedFetch = async url => {
    const hash = blobs.get(url);
    if (!/^[a-f0-9]{40}$/.test(hash ?? '')) throw Error('Unpinned original level request');
    if (!pending.has(hash)) pending.set(hash, (async () => {
      const path = join(levels, `${hash}.json`);
      let bytes;
      try { bytes = await readFile(path); }
      catch (error) {
        if (error.code !== 'ENOENT') throw error;
        const response = await fetchImpl(url);
        if (!response.ok) throw Error(`Original level download failed: HTTP ${response.status}`);
        bytes = Buffer.from(await response.arrayBuffer());
        if (gitBlob(bytes) !== hash) throw Error('Original level does not match its pinned Git blob');
        await writeFile(path, bytes);
      }
      if (gitBlob(bytes) !== hash) throw Error('Cached original level checksum mismatch');
      return bytes;
    })());
    let bytes;
    try { bytes = await pending.get(hash); }
    finally { pending.delete(hash); }
    return { ok: true, arrayBuffer: async () => bytes };
  };
  return stage => buildStageRuleReceipt({ stage, channel, commit, tree, stageTableBytes, fetchImpl: cachedFetch });
}

export async function runStageRules(args) {
  const [id, ...flags] = args;
  if (!id || !/^[a-z0-9_-]+$/i.test(id) || flags.some(f => !['--apply', '--global', '--refresh'].includes(f))
    || new Set(flags).size !== flags.length || flags.includes('--refresh') && !flags.includes('--apply'))
    throw Error('Usage: npm run content:rules -- <stage-slug> [--global] [--apply [--refresh]]');
  const source = process.env.ARKPEDIA_CONTENT_SOURCE ? resolve(process.env.ARKPEDIA_CONTENT_SOURCE)
    : resolve(ROOT, '../arkpedia-data/source/data');
  const stage = JSON.parse(await readFile(join(source, 'stages', `${id}.json`)));
  if (stage.slug !== id) throw Error('Stage source identity mismatch');
  const replaceDigest = flags.includes('--refresh') ? digest(await readFile(join(ROOT, 'data/stage-rules', `${id}.json`))) : null;
  const importer = await createStageRuleImporter({ channel: flags.includes('--global') ? 'global' : 'cn' });
  const result = await importer(stage);
  const path = flags.includes('--apply') ? await writeSharedStageRuleReceipt(ROOT, id, result.receipt, { replaceDigest }) : null;
  console.log(JSON.stringify({ id, ...result, written: path,
    scope: 'Original rule evidence only; no stage was admitted or published.' }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await runStageRules(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
