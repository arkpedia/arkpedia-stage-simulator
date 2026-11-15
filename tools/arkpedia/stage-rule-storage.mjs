// SPDX-License-Identifier: GPL-3.0-or-later
import { readFile, mkdir, writeFile, link, rm, open } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { writeJSONAtomic } from './write-json.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const slug = id => { if (!/^[a-z0-9_-]+$/i.test(id)) throw Error('Invalid stage slug'); };

async function writeExclusive(path, bytes) {
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, bytes, { flag: 'wx' });
    await link(temp, path); // Atomic publication that cannot replace an existing receipt.
  } finally { await rm(temp, { force: true }); }
}

/** Immutable level evidence is stored once. Normal/challenge bindings keep only
 * their identities and original table mapping; compilation still sees schema 1. */
export async function writeSharedStageRuleReceipt(root, id, receipt, { replaceDigest = null } = {}) {
  slug(id);
  if (replaceDigest != null && !/^[a-f0-9]{64}$/.test(replaceDigest)) throw Error('Invalid previous binding checksum');
  const { stageTable, ...source } = receipt.source;
  const level = { schemaVersion: 1, source, ...(receipt.options ? { options: receipt.options } : {}), runes: receipt.runes };
  const bytes = json(level), sha256 = digest(bytes), relative = `levels/${sha256}.json`;
  const dir = join(root, 'data/stage-rules'); await mkdir(join(dir, 'levels'), { recursive: true });
  const levelPath = join(dir, relative);
  try { await writeExclusive(levelPath, bytes); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    if (await readFile(levelPath, 'utf8') !== bytes) throw Error('Shared level evidence hash collision or corruption');
  }
  const binding = { schemaVersion: 2, stageId: receipt.stageId,
    ...(receipt.parentStageId ? { parentStageId: receipt.parentStageId } : {}),
    level: { path: relative, sha256 }, ...(stageTable ? { stageTable } : {}) };
  const path = join(dir, `${id}.json`);
  // The exclusive binding write is the commit point. An interrupted import can
  // leave verified but unreferenced level evidence, never a partial stage entry.
  if (replaceDigest == null) await writeExclusive(path, json(binding));
  else {
    const lockPath = join(root, 'data/.content-add.lock'), lock = await open(lockPath, 'wx');
    try {
      if (digest(await readFile(path)) !== replaceDigest) throw Error('Stage rule binding changed; re-import its evidence');
      await writeJSONAtomic(path, binding);
    } finally { await lock.close(); await rm(lockPath); }
  }
  return path;
}

/** Read either the original inline receipt or a verified shared binding. Every
 * local dependency is returned for the atomic stage publisher's second check. */
export async function loadStageRuleReceipt(root, id) {
  slug(id);
  const relative = `data/stage-rules/${id}.json`;
  let bytes;
  try { bytes = await readFile(join(root, relative)); }
  catch (error) { if (error.code === 'ENOENT') return { receipt: null, sources: [] }; throw error; }
  const binding = JSON.parse(bytes), sources = [{ path: relative, sha256: digest(bytes) }];
  if (binding.schemaVersion !== 2) return { receipt: binding, sources };
  const ref = binding.level;
  if (!ref || !/^[a-f0-9]{64}$/.test(ref.sha256) || ref.path !== `levels/${ref.sha256}.json`
    || Object.keys(binding).some(k => !['schemaVersion', 'stageId', 'parentStageId', 'level', 'stageTable'].includes(k)))
    throw Error('Invalid shared stage rule binding');
  const path = `data/stage-rules/${ref.path}`, levelBytes = await readFile(join(root, path));
  if (digest(levelBytes) !== ref.sha256) throw Error('Shared level evidence checksum mismatch');
  const level = JSON.parse(levelBytes);
  if (level.schemaVersion !== 1 || Object.keys(level).some(k => !['schemaVersion', 'source', 'options', 'runes'].includes(k)))
    throw Error('Invalid shared level evidence');
  sources.push({ path, sha256: ref.sha256 });
  const receipt = { schemaVersion: 1, stageId: binding.stageId,
    ...(binding.parentStageId ? { parentStageId: binding.parentStageId } : {}),
    source: { ...level.source, ...(binding.stageTable ? { stageTable: binding.stageTable } : {}) },
    ...(level.options ? { options: level.options } : {}), runes: level.runes };
  return { receipt, sources };
}
