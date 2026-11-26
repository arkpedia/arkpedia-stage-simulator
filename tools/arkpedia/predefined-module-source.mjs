// SPDX-License-Identifier: GPL-3.0-or-later
// Retains the source of the operator modules a stage's preset operators wear (shared/arkpedia/predefined-modules.js).
// - Table rows: the Global tables at the commit the operator records use.
// - Prefabs and buff templates: the pinned CN client (`[uc]equips.ab`, buff_template_data.json).
// Player loadouts have no modules; this is not a module catalogue.
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CN_NATIVE_PIN } from './cn-native-source.mjs';
const ROOT = new URL('../../', import.meta.url);
const GLOBAL = { repository: 'Kengxxiao/ArknightsGameData_YoStar', commit: '57010cb5b2afea112cae57daa756b58676ba6850' };
const TABLES = {
  battle_equip_table: '6b52e7d6fe3276ef65b9eddaa32960a2c5b6d725',
  uniequip_table: '07c28844440048b5f6823f98db6ed927dba08a5f',
};
const BUNDLE = { path: 'battle/prefabs/[uc]equips.ab', bytes: 728179, md5: '6506f489f0f5b7bb7709d9df05d2895c',
  sha256: '52a56a0d2c10eb422aaf8a7a3a296bb45bbd8c825fb4ab136a08dd53d536ac81' };
const TEMPLATES = { path: 'zh_CN/gamedata/battle/buff_template_data.json', bytes: 27996217, gitBlob: 'a94bbb391fded80e59db38ad7c3ded89e25fd682' };
// module id -> its reviewed stage's prefabs and the buff templates they attach
const MODULES = { uniequip_002_logos: { prefabs: ['uniequip_002_logos', 'logos_equip_1_3_p1', 'logos_equip_1_3_p2'], templates: ['logos_e_002_tr', 'logos_e_002_t_1'] } };
const META = ['uniEquipId', 'uniEquipName', 'typeIcon', 'typeName1', 'typeName2', 'charId', 'tmplId', 'type', 'unlockEvolvePhase', 'unlockLevel'];
const hash = (algorithm, bytes) => createHash(algorithm).update(bytes).digest('hex');
const gitBlob = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
async function cached(file, download) {
  try { return await readFile(file); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const response = await fetch(download);
    if (!response.ok) throw Error(`Cannot fetch pinned module source: ${download} (${response.status})`);
    return Buffer.from(await response.arrayBuffer());
  }
}
export async function buildPredefinedModuleSource() {
  const tables = {}, files = {};
  for (const [name, blob] of Object.entries(TABLES)) {
    const path = `en_US/gamedata/excel/${name}.json`, cache = new URL(`.cache/arkpedia/${name}_global-${GLOBAL.commit}.json`, ROOT);
    const bytes = await cached(cache, `https://raw.githubusercontent.com/${GLOBAL.repository}/${GLOBAL.commit}/${path}`);
    if (gitBlob(bytes) !== blob) throw Error(`Module table checksum mismatch: ${name}`);
    await writeFile(cache, bytes);
    files[name] = { path, gitBlob: blob, bytes: bytes.length, sha256: hash('sha256', bytes) };
    tables[name] = JSON.parse(bytes);
  }
  const native = new URL('.cache/arkpedia/cn-native-source/', ROOT), target = new URL('bundles/' + BUNDLE.path, native);
  let bundle;
  try { bundle = await readFile(target); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const name = BUNDLE.path.replaceAll('/', '_').replace(/\.ab$/, '.dat'), archive = new URL('archives/' + name, native);
    await mkdir(new URL('./', archive), { recursive: true }); await mkdir(new URL('./', target), { recursive: true });
    const response = await fetch(new URL(encodeURIComponent(name), CN_NATIVE_PIN.baseURL));
    if (!response.ok) throw Error(`Cannot fetch the pinned module bundle (${response.status})`);
    await writeFile(archive, Buffer.from(await response.arrayBuffer()));
    const tmp = new URL(target.href + '.partial');
    try {
      execFileSync('python3', ['-c', 'import sys,zipfile,pathlib; z=zipfile.ZipFile(sys.argv[1]); pathlib.Path(sys.argv[3]).write_bytes(z.read(z.getinfo(sys.argv[2])))',
        fileURLToPath(archive), BUNDLE.path, fileURLToPath(tmp)], { stdio: 'pipe' });
      bundle = await readFile(tmp);
    } finally { await rm(tmp, { force: true }); }
  }
  if (bundle.length !== BUNDLE.bytes || hash('md5', bundle) !== BUNDLE.md5 || hash('sha256', bundle) !== BUNDLE.sha256)
    throw Error('Module bundle differs from its pin');
  await writeFile(target, bundle);
  const prefabKeys = Object.values(MODULES).flatMap(m => m.prefabs);
  const prefabs = JSON.parse(execFileSync('python3', [fileURLToPath(new URL('tools/arkpedia/extract-predefined-module-native.py', ROOT)),
    BUNDLE.path, String(BUNDLE.bytes), BUNDLE.sha256, ...prefabKeys], { maxBuffer: 64 << 20 }));
  const templateBytes = await readFile(new URL('tables/buff_template_data.json', native));
  if (templateBytes.length !== TEMPLATES.bytes || gitBlob(templateBytes) !== TEMPLATES.gitBlob) throw Error('Buff template table differs from its pin');
  const templateTable = JSON.parse(templateBytes), modules = {}, templates = {};
  for (const [id, spec] of Object.entries(MODULES)) {
    const meta = tables.uniequip_table.equipDict?.[id], battle = tables.battle_equip_table[id];
    if (!meta || !battle) throw Error(`Missing module: ${id}`);
    modules[id] = { equip: Object.fromEntries(META.map(k => [k, meta[k]])), battle };
    for (const key of spec.templates) { if (!templateTable[key]) throw Error(`Missing module template: ${key}`); templates[key] = templateTable[key]; }
  }
  return { schemaVersion: 1,
    scope: 'Modules worn by stage preset operators only. Player loadouts have no modules.',
    tableSource: { ...GLOBAL, files },
    nativeSource: { repository: CN_NATIVE_PIN.repository, commit: CN_NATIVE_PIN.commit, clientVersion: CN_NATIVE_PIN.clientVersion,
      resourceVersion: CN_NATIVE_PIN.resourceVersion, bundle: BUNDLE,
      templates: { ...TEMPLATES, sha256: hash('sha256', templateBytes) } },
    modules, prefabs, templates };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await buildPredefinedModuleSource(), bytes = JSON.stringify(result, null, 1) + '\n';
  const file = new URL('data/arkpedia-predefined-module-source.json', ROOT);
  if (process.argv.includes('--check')) {
    if (await readFile(file, 'utf8') !== bytes) throw Error('Predefined module source is stale');
    console.log('Predefined module source matches its pins');
  } else { await writeFile(file, bytes); console.log(`Retained ${Object.keys(result.modules).length} preset-operator module(s)`); }
}
