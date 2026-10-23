#!/usr/bin/env node
// Build data/arkpedia-support-operators.json for operators that only exist in a
// stage's fixed squad (Sharp, Pith, Touch, Stormeye, Raidian).
//
//   node tools/arkpedia/import-support-operators.mjs \
//     --character-table /path/character_table.json \
//     --skill-table /path/skill_table.json \
//     --ids char_508_aguard,char_509_acast,... \
//     --out data/arkpedia-support-operators.json
//
// The records use the same shape as data/arkpedia-mvp.json operators; skills are
// joined to skill_table levels. No prefab or decompiled code is copied.
import { readFileSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const characterPath = opt('--character-table'), skillPath = opt('--skill-table');
const ids = (opt('--ids') ?? '').split(',').filter(Boolean), out = opt('--out');
if (!characterPath || !skillPath || !ids.length || !out) {
  console.error('usage: import-support-operators.mjs --character-table FILE --skill-table FILE --ids a,b --out FILE');
  process.exit(2);
}
const character = JSON.parse(readFileSync(characterPath, 'utf8'));
const skills = JSON.parse(readFileSync(skillPath, 'utf8'));
const operators = {};
for (const id of ids) {
  const c = character[id];
  if (!c) throw Error(`missing character_table record: ${id}`);
  const skillRows = (c.skills ?? []).map((s) => {
    const levels = skills[s.skillId]?.levels;
    if (!levels) throw Error(`missing skill_table record: ${s.skillId}`);
    return { id: s.skillId, unlockCondition: s.unlockCond, levels };
  });
  operators[id] = { ...c, id, supportOnly: true, skills: skillRows,
    potentialRanks: Array.isArray(c.potentialRanks) ? c.potentialRanks : Object.values(c.potentialRanks ?? {}) };
}
writeFileSync(out, `${JSON.stringify({ schema_version: 1, source: { repository: 'ArknightsAssets/ArknightsGamedata', paths: ['en/gamedata/excel/character_table.json', 'en/gamedata/excel/skill_table.json'] }, operators }, null, 2)}\n`);
console.log(`Wrote ${Object.keys(operators).length} support operators -> ${out}`);
