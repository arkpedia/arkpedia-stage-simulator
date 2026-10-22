#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Build data/arkpedia-deployable-tokens.json from the upstream game tables.
//
// The upstream tables are public but not committed here:
//   ArknightsAssets/ArknightsGamedata en/gamedata/excel/{character_table,skill_table}.json
// Fetch them (or point at an existing checkout), then:
//
//   node tools/arkpedia/import-traps.mjs \
//     --character-table /path/character_table.json \
//     --skill-table /path/skill_table.json \
//     --revision <commit> \
//     --geometries ../arkpedia-data/source/data/stage-geometry \
//     --out data/arkpedia-deployable-tokens.json
//
// Only tokens actually offered by a stage's `suppliedUnits.deployable_tokens`
// are emitted. Stats come from character_table phases; skill names,
// descriptions and blackboards from skill_table. This file is the reviewed
// stat source for the token deck; it contains no prefab or decompiled code.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback = null) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const characterPath = opt('--character-table');
const skillPath = opt('--skill-table');
const geometries = opt('--geometries', '../arkpedia-data/source/data/stage-geometry');
const revision = opt('--revision');
const out = opt('--out');
if (!characterPath || !skillPath || !out) {
  console.error('usage: import-traps.mjs --character-table FILE --skill-table FILE --out FILE [--revision SHA] [--geometries DIR]');
  process.exit(2);
}
const character = JSON.parse(readFileSync(characterPath, 'utf8'));
const skills = JSON.parse(readFileSync(skillPath, 'utf8'));

const ids = new Set();
for (const file of readdirSync(geometries).filter(f => f.endsWith('.json'))) {
  let geometry;
  try { geometry = JSON.parse(readFileSync(join(geometries, file), 'utf8')); } catch { continue; }
  for (const token of geometry.suppliedUnits?.deployable_tokens ?? []) {
    if (token.unit_id) ids.add(token.unit_id);
  }
}

const pick = (data) => ({
  maxHp: data.maxHp, atk: data.atk, def: data.def, res: data.magicResistance,
  cost: data.cost, block: data.blockCnt, moveSpeed: data.moveSpeed,
  attackSpeed: data.attackSpeed, attackTime: data.baseAttackTime,
  respawnTime: data.respawnTime, maxDeployCount: data.maxDeployCount,
  tauntLevel: data.tauntLevel, massLevel: data.massLevel,
});
const tokens = {};
for (const id of [...ids].sort()) {
  const c = character[id];
  if (!c) { console.error(`missing character_table record: ${id}`); process.exit(1); }
  const skillRows = (Array.isArray(c.skills) ? c.skills : Object.values(c.skills ?? {})).map((s) => {
    const row = skills[s.skillId];
    const first = row?.levels?.[0];
    return {
      id: s.skillId, name: first?.name ?? null, description: first?.description ?? null,
      skillType: first?.skillType ?? null, durationType: first?.durationType ?? null,
      duration: first?.duration ?? null, blackboard: first?.blackboard ?? {},
    };
  });
  tokens[id] = {
    name: c.name, description: c.description ?? null, profession: c.profession,
    position: c.position, subProfessionId: c.subProfessionId, rarity: c.rarity,
    phases: (Array.isArray(c.phases) ? c.phases : Object.values(c.phases ?? {})).map((p) => ({
      prefabKey: p.characterPrefabKey, rangeId: p.rangeId, maxLevel: p.maxLevel,
      levels: (p.attributesKeyFrames ?? []).map((f) => ({ level: f.level, ...pick(f.data) })),
    })),
    skills: skillRows,
  };
}
const payload = {
  schema_version: 1,
  source: {
    repository: 'ArknightsAssets/ArknightsGamedata',
    revision: revision ?? null,
    paths: ['en/gamedata/excel/character_table.json', 'en/gamedata/excel/skill_table.json'],
  },
  tokens,
};
writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote ${Object.keys(tokens).length} deployable tokens -> ${out}`);
