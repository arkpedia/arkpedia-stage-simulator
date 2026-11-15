// SPDX-License-Identifier: GPL-3.0-or-later
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readOriginalLevel } from './original-level.mjs';
import native from '../../data/arkpedia-device-native-source.json' with { type: 'json' };
import tables from '../../data/arkpedia-device-source.json' with { type: 'json' };
const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
const digest = v => createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
// Exact retained action graphs: selection, immediate/periodic trigger, immunity,
// mass threshold, stacking, derived cleanup and character contact counter.
// A source update needs a new review; hashes never certify native frame order.
const REVIEWED = {
  "prefabs": {
    "trap_098_mire": "61e5d0811ce757f344cafbd1b638439db8aa59c5ff9afe7becb6165491bc2429",
    "sktok_mire": "c20539f61521d6132cf6481ebc23fcb631dc3e928c2da3d88aef4c454847f5f1",
    "tile_mire": "06233f2ad9cf3ef27f1866c45a44b43ebcdacb5a433171a63aa4633450af169b"
  },
  "templates": {
    "buff_mire": "dd654d7a9c366e30c8dc39c8bb015ae4c7ff1f1514231710c7060052ea54bce4",
    "buff_mire[trigger]": "e971101539751642b457f5d0addad5ea3b44ba7de215af17c0ae812d62a767e3",
    "buff_mire[mark]": "36ea67891aba2d0bac5ee80e07e2f06d9a3f84570b3ab5f67da9ddfa80114bf9",
    "buff_mire[checker]": "63a64cbfec9648792d97afde4d24ce9e8b7f1b5f961869ddad64dd9718b34481",
    "buff_mire[log]": "8b15c138da781baeff4306a8b18e95f3687f8d611cffb64309d02ced136106a1"
  }
};
export function mireNativeReviewed(evidence = native) {
  return Object.keys(REVIEWED.prefabs).length === 3 && Object.keys(REVIEWED.templates).length === 5
    && Object.entries(REVIEWED.prefabs).every(([key, sha]) => evidence.prefabs[key] && digest(evidence.prefabs[key].components.map(c => c.data)) === sha)
    && Object.entries(REVIEWED.templates).every(([key, sha]) => evidence.templates[key] && digest(evidence.templates[key]) === sha);
}
export function compileStageMire(level, geometry, devices, evidence = native, source = tables) {
  const tiles = [];
  geometry.tileGrid.forEach((cells, row) => cells.forEach((type, col) => {
    const tile = geometry.tileLegend[type];
    if (tile.key === 'tile_mire') {
      if (tile.blackboard && Object.keys(tile.blackboard).length) throw Error('Unsupported Mire tile parameters');
      tiles.push([row, col]);
    }
  }));
  const originals = (level.predefines?.tokenInsts ?? []).filter(p => p.inst?.characterKey === 'trap_098_mire');
  const exported = devices.filter(d => d.key === 'trap_098_mire');
  if (!originals.length && !exported.length && !tiles.length) return null;
  if (!mireNativeReviewed(evidence)) throw Error('Unreviewed Mire native source');
  if (originals.length !== 1 || exported.length !== 1) throw Error('Mire requires one original controller');
  const p = originals[0], d = exported[0];
  if (p.hidden !== false || d.hidden !== false || p.position.row !== d.row || p.position.col !== d.col
    || p.skillIndex !== 0 || p.mainSkillLvl !== 1 || p.inst.level !== 1 || ![0, 'PHASE_0'].includes(p.inst.phase)
    || p.inst.favorPoint !== 0 || p.inst.potentialRank !== 0 || p.uniEquipIds?.length || p.masterInfos?.length
    || p.overrideTalents != null || p.tmplId)
    throw Error('Unsupported Mire controller instance');
  const actions = [...(level.waves ?? []).flatMap(w => w.fragments.flatMap(f => f.actions)),
    ...Object.values(level.branches ?? {}).flatMap(b => b.phases?.flatMap(f => f.actions) ?? [])];
  if (actions.some(a => a.key === d.key || p.alias && a.key === p.alias)) throw Error('Scheduled Mire controller is not implemented');
  const skill = source.skills.sktok_mire?.levels?.[0], record = source.devices.trap_098_mire;
  const bb = Object.fromEntries((skill?.blackboard ?? []).map(v => [v.key, v.value]));
  if (record?.skills.length !== 1 || record.skills[0].skillId !== 'sktok_mire'
    || skill?.prefabId !== 'sktok_mire' || skill.skillType !== 'AUTO' || skill.duration !== -1
    || skill.spData.spType !== 'INCREASE_WITH_TIME' || skill.spData.spCost !== 0 || skill.spData.initSp !== 0
    || Object.keys(bb).sort().join() !== 'attack_speed,max_stack_cnt,move_speed,value'
    || bb.attack_speed !== -.05 || bb.move_speed !== -.05 || bb.max_stack_cnt !== 10 || bb.value !== 3)
    throw Error('Unsupported Mire skill parameters');
  const seen = new Set();
  if (p.overrideSkillBlackboard != null && !Array.isArray(p.overrideSkillBlackboard)) throw Error('Invalid Mire overrides');
  for (const value of p.overrideSkillBlackboard ?? []) {
    if (!Object.hasOwn(bb, value.key) || seen.has(value.key) || !Number.isFinite(value.value)
      || value.valueStr != null && value.valueStr !== '') throw Error('Unsupported Mire parameter');
    bb[value.key] = value.value; seen.add(value.key);
  }
  if (bb.attack_speed < -1 || bb.attack_speed > 0 || bb.move_speed < -1 || bb.move_speed > 0
    || !Number.isSafeInteger(bb.max_stack_cnt) || bb.max_stack_cnt < 1 || bb.max_stack_cnt > 1000
    || bb.value < 0 || bb.value > 20) throw Error('Invalid Mire parameter bounds');
  const map = level.mapData;
  if (map?.map?.length !== geometry.rows || map.map.some(row => row.length !== geometry.cols)) throw Error('Mire map dimensions differ');
  for (const [row, cells] of geometry.tileGrid.entries()) for (const [col, type] of cells.entries()) {
    const original = map.tiles[map.map[geometry.rows - 1 - row][col]], exported = geometry.tileLegend[type];
    if ((original.tileKey === 'tile_mire') !== (exported.key === 'tile_mire')) throw Error('Mire tile export differs');
    if (original.tileKey === 'tile_mire' && (original.blackboard?.length || original.effects?.length)) throw Error('Unsupported Mire tile effects');
  }
  return { kind: 'mire', tiles, scanInterval: .1, interval: 1, max: bb.max_stack_cnt,
    aspdPer: bb.attack_speed * 100, movePer: bb.move_speed, heavyWeight: bb.value };
}
export async function prepareStageMire({ root, rules, geometry, devices }) {
  if (!geometry || !devices.some(d => d.key === 'trap_098_mire') && !geometry.tileLegend.some(t => t.key === 'tile_mire'))
    return { mire: null, sources: [] };
  const { level, source } = await readOriginalLevel(root, rules);
  const mire = compileStageMire(level, geometry, devices);
  const sources = [source];
  for (const path of ['data/arkpedia-device-native-source.json', 'data/arkpedia-device-source.json'])
    sources.push({ path, sha256: createHash('sha256').update(await readFile(join(root, path))).digest('hex') });
  return { mire, sources };
}
