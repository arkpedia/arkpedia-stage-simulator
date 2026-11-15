// SPDX-License-Identifier: GPL-3.0-or-later
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const ROOT = new URL('../../', import.meta.url);
const COMMIT = 'a550f5e048bb94e7cdefc6eb97a4091f0c4c7add';
const TABLES = {
  character_table: '789dfbf21512118b357129b5f01fd2a40b29e05d',
  skill_table: '3793979c8672129489135e97727bfd9f9fd32873',
  range_table: '8ade26d87026ee7649ff8a2d1636e7c3426959c8',
};
const IDS = ['trap_156_dsshell', 'trap_086_larva', 'trap_075_bgarmn', 'trap_076_bgarms', 'trap_077_rmtarmn', 'trap_078_rmtarms', 'trap_098_mire', 'trap_050_blizzard', 'trap_010_frosts', 'trap_011_ore', 'trap_002_emp', 'trap_005_sensor', 'trap_008_farm', 'trap_057_wpnsts', 'trap_018_bomb', 'trap_019_electric', 'trap_007_ballis', 'trap_013_blower', 'trap_014_tower', 'trap_009_battery', 'trap_006_antidr', 'trap_043_dupilr', 'trap_044_duruin', 'trap_045_dublst', 'trap_001_crate', 'trap_015_tree', 'trap_016_peon', 'trap_012_mine', 'trap_161_lrcage', 'trap_062_magicstart', 'trap_063_magicturn', 'trap_064_magiccircle'];
export async function buildStageDeviceSource() {
  const tables = {}, files = {};
  for (const [name, gitBlob] of Object.entries(TABLES)) {
    const path = `zh_CN/gamedata/excel/${name}.json`, cache = new URL(`.cache/arkpedia/${name}_cn-${COMMIT}.json`, ROOT);
    let bytes;
    try { bytes = await readFile(cache); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const response = await fetch(`https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/${COMMIT}/${path}`);
      if (!response.ok) throw Error(`Cannot fetch pinned device table: ${path} (${response.status})`);
      bytes = Buffer.from(await response.arrayBuffer());
    }
    if (createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') !== gitBlob) throw Error(`Device table checksum mismatch: ${name}`);
    await writeFile(cache, bytes);
    files[name] = { path, gitBlob, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
    tables[name] = JSON.parse(bytes);
  }
  const devices = {}, skills = {}, ranges = {};
  for (const id of [...IDS, 'trap_757_skzbox', 'trap_758_skzmbx', 'trap_759_skzwyx', 'trap_760_skztzs']) {
    const record = tables.character_table[id]; if (!record) throw Error(`Missing device: ${id}`);
    devices[id] = record;
    for (const phase of record.phases) if (phase.rangeId) ranges[phase.rangeId] = tables.range_table[phase.rangeId];
    for (const skill of record.skills) {
      const row = tables.skill_table[skill.skillId]; if (!row) throw Error(`Missing device skill: ${skill.skillId}`);
      skills[skill.skillId] = row;
      for (const level of row.levels) if (level.rangeId) ranges[level.rangeId] = tables.range_table[level.rangeId];
    }
  }
  return { schemaVersion: 1, source: { repository: 'Kengxxiao/ArknightsGameData', commit: COMMIT, files }, devices, skills, ranges };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await buildStageDeviceSource(), bytes = JSON.stringify(result, null, 1) + '\n';
  const file = new URL('data/arkpedia-device-source.json', ROOT);
  if (process.argv.includes('--check')) {
    if (await readFile(file, 'utf8') !== bytes) throw Error('Stage device source is stale');
    console.log('Stage device source matches the pinned tables');
  } else { await writeFile(file, bytes); console.log(`Retained ${Object.keys(result.devices).length} original device records`); }
}
