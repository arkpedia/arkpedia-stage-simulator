// SPDX-License-Identifier: GPL-3.0-or-later
// Ave Mujica Fever: official constants plus each member's per-skill Fever
// component, read from the pinned CN table and the verified owner foundations.
// `node tools/arkpedia/fever-source.mjs` fetches gamedata_const.json once into
// the ignored cache and rewrites data/arkpedia-fever-source.json.
import assert from 'node:assert/strict';
import {readFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {writeJSONAtomic} from './write-json.mjs';
export const FEVER_MEMBERS = Object.freeze(['char_4182_oblvns', 'char_4183_mortis', 'char_4184_dolris', 'char_4185_amoris', 'char_4186_tmoris']);
const sha = b => createHash('sha256').update(b).digest('hex');
const root = new URL('../../', import.meta.url);
const COMPONENT = ['_feverKey', '_tryJoinFeverOnSkillStart', '_continusCastWhenInFever', '_leaveFeverWhenSkillEnd', '_skipSkillStateTickJoinFever'];
function walk(o, visit) {
  if (Array.isArray(o)) for (const v of o) walk(v, visit);
  else if (o && typeof o === 'object') { visit(o); for (const v of Object.values(o)) walk(v, visit); }
}
// Every template action that reads or writes the Fever system, by owner.
function feverActions(e) {
  const out = {};
  for (const [key, t] of Object.entries(e.templates)) walk(t, o => {
    const type = typeof o.$type === 'string' ? o.$type.split('+').at(-1).split(',')[0] : null;
    if (type && /Fever/.test(type)) (out[key] ??= []).push(type);
  });
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}
function skillComponents(e) {
  const out = {};
  for (const [skill, rows] of Object.entries(e.skills)) for (const row of rows) for (const c of row.components) {
    const d = c.data ?? {};
    if (!('_tryJoinFeverOnSkillStart' in d)) continue;
    assert.equal(out[skill], undefined, 'One Fever component per skill');
    const buffs = d._buffs.map(b => ({key: b.buffKey, flags: b.attributes.abnormalFlags, templateKey: b.templateKey}));
    out[skill] = {pathId: c.pathId, ...Object.fromEntries(COMPONENT.map(k => [k, d[k]])), buffs, buffAfterFever: d._buffAfterFever.length};
  }
  return out;
}
export async function feverSource(constBytes, constMeta) {
  const raw = JSON.parse(constBytes), terms = raw.termDescriptionDict;
  const members = {}, skills = {};
  for (const id of FEVER_MEMBERS) {
    const bytes = await readFile(new URL(`data/arkpedia-native-operators/${id}.json`, root)), e = JSON.parse(bytes);
    assert.equal(e.source.commit, constMeta.commit, 'Foundation and constants come from one table commit');
    const c = skillComponents(e);
    assert.deepEqual(Object.keys(c).sort(), Object.keys(e.tables.skills).sort(), 'Every member skill carries one Fever component');
    for (const [k, v] of Object.entries(c)) { assert.equal(v._feverKey, 'env_033_fever'); skills[k] = v; }
    members[id] = {name: e.tables.character.name, foundationSha256: sha(bytes), feverActions: feverActions(e)};
    assert.ok(terms['ba.mujica'].description.includes(e.tables.character.name), 'Member named by the official Ave Mujica term');
  }
  return {schemaVersion: 1, feverKey: 'env_033_fever', source: constMeta,
    feverNeed: raw.feverGameData.feverNeed, feverDuration: raw.feverGameData.feverDuration,
    terms: {fever: terms['ba.fever'], mujica: terms['ba.mujica']}, members, skills};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const commit = JSON.parse(await readFile(new URL('data/arkpedia-cn-source.json', root))).source.commit;
  const path = 'zh_CN/gamedata/excel/gamedata_const.json', cache = new URL('.cache/arkpedia/fever/', root);
  await mkdir(cache, {recursive: true});
  const file = new URL('gamedata_const.json', cache);
  let bytes; try { bytes = await readFile(file); } catch {
    bytes = execFileSync('curl', ['-sSfL', `https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/${commit}/${path}`], {maxBuffer: 64 << 20});
    await writeJSONAtomic(file, JSON.parse(bytes)); bytes = await readFile(file);
  }
  const meta = {repository: 'Kengxxiao/ArknightsGameData', commit, path, cachedBytes: bytes.length, cachedSha256: sha(bytes)};
  await writeJSONAtomic(new URL('data/arkpedia-fever-source.json', root), await feverSource(bytes, meta));
  console.log('Wrote data/arkpedia-fever-source.json');
}
