#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// File-backed stage catalogue files compiled before an enemy gained a declared
// spawn dependency lack the spawned child's record, so the battle refuses them.
// This adds exactly those records, nothing else: each child is the compiler's
// own record, chosen by what the file already does:
//  - every record in the file is one of its own unmodified database levels
//    (the file applies no stage rules to enemies): the child gets the
//    unmodified database level the stage configures for it, level 0 when the
//    stage configures none, as the compiler does, so the file stays consistent;
//  - otherwise the stage must still compile, agree with the file on every
//    existing record, and the child is taken from that compile;
//  - anything else is refused.
// `--check` fails while any file still lacks a declared child record.
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { loadContentContext, planStage } from './content-inventory.mjs';
import { isStageFile } from './stage-index.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const read = async path => JSON.parse(await readFile(join(root, path), 'utf8'));
// Keep each file's own indentation so a repair diff shows only the added records.
const escapeAscii = text => text.replace(/[\u007f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
/** Pretty-printed member insertion: find `"key": {` of the named member inside
 * the top-level object field, then the line that closes it at the same indent. */
function insertAfterMember(text, field, key, newKey, value) {
  const top = text.match(/^\{\n( +)"/); if (!top) throw Error('Unrecognized stage file layout');
  const unit = top[1], fieldAt = text.indexOf(`\n${unit}${JSON.stringify(field)}: {\n`);
  if (fieldAt < 0) throw Error(`Missing ${field} object`);
  const indent = unit + unit, open = `\n${indent}${JSON.stringify(key)}: {\n`, start = text.indexOf(open, fieldAt);
  if (start < 0) throw Error(`Missing member ${key}`);
  const close = text.indexOf(`\n${indent}}`, start + open.length);
  if (close < 0) throw Error(`Unclosed member ${key}`);
  const end = close + 1 + indent.length + 1, comma = text[end] === ',';
  const ascii = /\\u[0-9a-f]{4}/.test(text) && !/[\u007f-\uffff]/.test(text);
  let body = JSON.stringify(value, null, unit.length).split('\n').map((line, i) => i ? indent + line : line).join('\n');
  if (ascii) body = escapeAscii(body);
  const insert = `,\n${indent}${JSON.stringify(newKey)}: ${body}`;
  return comma ? text.slice(0, end) + insert + text.slice(end) : text.slice(0, end) + insert + text.slice(end);
}
const records = (await read('data/arkpedia-enemy-records.json')).enemies;
const support = (await read('data/arkpedia-enemy-support.json')).enemies;
const check = process.argv.includes('--check');
const repaired = [];
let context;
const unmodifiedFiles = [];
const configuredLevel = (stage, id) => { const rows = (stage.geometry?.enemyConfigurations ?? []).filter(c => c.enemy_id === id);
  if (rows.length > 1 && new Set(rows.map(c => c.database_level)).size > 1) throw Error(`Ambiguous configured level for ${id}`);
  return rows[0]?.database_level ?? 0; };
const refused = [];
for (const file of (await readdir(join(root, 'data'))).filter(isStageFile).sort()) {
  const raw = await readFile(join(root, 'data', file), 'utf8'), stage = JSON.parse(raw);
  if (!stage?.enemies || !stage.geometry) continue;
  const missing = [];
  const visit = id => { for (const child of support[id]?.spawns ?? []) if (!stage.enemies[child] && !missing.some(m => m.child === child)) { missing.push({ parent: id, child }); visit(child); } };
  for (const id of Object.keys(stage.enemies)) visit(id);
  if (!missing.length) continue;
  if (check) { repaired.push(`${file}: ${missing.map(m => m.child).join(', ')}`); continue; }
  const id = file.slice('arkpedia-stage-'.length, -'.json'.length);
  const unmodified = Object.entries(stage.enemies).every(([key, value]) => Object.values(records[key]?.levels ?? {}).some(level => JSON.stringify(level) === JSON.stringify(value)))

  let compiled = null;
  if (!unmodified) { context ??= await loadContentContext({ root }); compiled = (await planStage(context, id, { compile: true })).stage; }
  const enemies = {};
  for (const [key, value] of Object.entries(stage.enemies)) {
    enemies[key] = value;
    for (const { parent, child } of missing.filter(m => m.parent === key)) {
      if (!records[child]?.levels?.[0] || !support[child]?.policy) throw Error(`${file}: unsupported spawned enemy ${child}`);
      if (unmodified) { const level = records[child].levels[configuredLevel(stage, child)]; if (!level) throw Error(`${file}: ${child} has no configured database level`); enemies[child] = structuredClone(level); }
      else if (compiled) {
        // The compiled stage must agree with the file on every record the file already has.
        const differs = Object.entries(stage.enemies).find(([other, value]) => JSON.stringify(compiled.enemies[other]) !== JSON.stringify(value));
        if (differs || !compiled.enemies[child]) refused.push(`${file}: ${differs ? `recompiled ${differs[0]} differs from the file` : `the compiler does not add ${child}`}; refresh the stage instead`);
        else enemies[child] = compiled.enemies[child];
      } else { refused.push(`${file}: the file applies stage rules but the stage no longer compiles; refresh it instead`); }
    }
  }
  if (missing.some(({ child }) => !enemies[child])) continue;
  if (unmodified) unmodifiedFiles.push(file);
  // Insert each record's text right after its parent's record, leaving every
  // other byte of the file as written, then prove the result is exactly the
  // intended object in the intended order.
  let out = raw;
  for (const { parent, child } of missing) {
    const anchor = parent in stage.enemies ? parent : missing.find(m => m.child === parent)?.parent;
    out = insertAfterMember(out, 'enemies', parent, child, enemies[child]);
    if (!anchor) throw Error(`${file}: no anchor for ${child}`);
  }
  if (JSON.stringify(JSON.parse(out)) !== JSON.stringify({ ...stage, enemies })) throw Error(`${file}: inserted text does not reproduce the repaired stage`);
  const target = join(root, 'data', file), temp = `${target}.${randomUUID()}.tmp`;
  try { await writeFile(temp, out, { flag: 'wx' }); await rename(temp, target); } finally { await rm(temp, { force: true }); }
  repaired.push(`${file}: ${missing.map(m => m.child).join(', ')}`);
}
if (refused.length) { console.error(refused.join('\n')); process.exitCode = 1; }
if (check && repaired.length) { console.error(`Stage files lack spawned child records:\n${repaired.join('\n')}`); process.exit(1); }
console.log(check ? 'Every stage file carries its spawned child records' : `Repaired ${repaired.length} stage files (${unmodifiedFiles.length} apply no stage enemy rules)\n${repaired.join('\n')}`);
