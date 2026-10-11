#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Full CN roster target is separate from the reviewed, pinned Global battle data.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const repository = 'Kengxxiao/ArknightsGameData';
const paths = ['zh_CN/gamedata/excel/character_table.json', 'zh_CN/gamedata/excel/char_patch_table.json'];
const cache = new URL('../../.cache/arkpedia/cn-coverage/', import.meta.url);
export function rosterTargetFor({ characters, patchCharacters, source }) {
  const rows = Object.entries({ ...characters, ...patchCharacters })
    .filter(([id, op]) => id.startsWith('char_') && !op.isNotObtainable && !['TOKEN', 'TRAP'].includes(op.profession))
    .sort(([a], [z]) => a.localeCompare(z))
    .map(([id, op]) => ({ id, sourceName: op.name, rarity: Number(op.rarity.replace('TIER_', '')),
      skills: op.skills.map(s => s.skillId), alternateFormOf: patchCharacters[id] ? 'char_002_amiya' : null }));
  // This table currently has exactly two Amiya forms. Unknown future patch
  // owners need explicit mapping instead of silently being counted as Amiya.
  if (Object.keys(patchCharacters).some(id => !['char_1001_amiya2', 'char_1037_amiya3'].includes(id)))
    throw Error('Unreviewed alternate-form owner mapping');
  return { schemaVersion: 1, scope: 'Full pinned CN roster, including Amiya Guard and Medic; a work target, not playable support.',
    source, summary: { operators: rows.filter(r => !r.alternateFormOf).length,
      operatorForms: rows.length, additionalAmiyaForms: rows.filter(r => r.alternateFormOf).length }, operators: rows };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await mkdir(cache, { recursive: true });
  let source;
  if (process.argv.includes('--refresh')) {
    const commit = execFileSync('gh', ['api', `repos/${repository}/commits/master`, '--jq', '.sha'], { encoding: 'utf8' }).trim();
    const tables = [];
    for (const path of paths) {
      const response = await fetch(`https://raw.githubusercontent.com/${repository}/${commit}/${path}`);
      if (!response.ok) throw Error(`CN roster source failed: ${response.status}`);
      const text = await response.text();
      await writeFile(new URL(path.split('/').at(-1), cache), text);
      tables.push({ path, sha256: createHash('sha256').update(text).digest('hex') });
    }
    source = { repository, commit, tables };
    await writeFile(new URL('roster-source.json', cache), JSON.stringify(source, null, 2) + '\n');
  } else source = JSON.parse(await readFile(new URL('roster-source.json', cache), 'utf8'));
  const texts = await Promise.all(paths.map(p => readFile(new URL(p.split('/').at(-1), cache), 'utf8')));
  texts.forEach((text, i) => {
    if (createHash('sha256').update(text).digest('hex') !== source.tables[i].sha256) throw Error('CN source cache hash mismatch');
  });
  const target = rosterTargetFor({ characters: JSON.parse(texts[0]), patchCharacters: JSON.parse(texts[1]).patchChars, source });
  await writeFile(new URL('../../data/arkpedia-roster-target.json', import.meta.url), JSON.stringify(target, null, 2) + '\n');
  console.log(JSON.stringify(target.summary));
}
