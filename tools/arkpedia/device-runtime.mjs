// SPDX-License-Identifier: GPL-3.0-or-later
// Compile finite device configurations through the original native contracts.
// Repeated outputs and invariant dimensions collapse to one runtime definition.
import { readFile } from 'node:fs/promises';
import { resolve, relative, dirname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { writeJSONAtomic } from './write-json.mjs';
import * as devices from '../../shared/arkpedia/stage-devices.js';
import { PILLAR, RUINS } from '../../shared/arkpedia/stage-demolition.js';
import native from '../../data/arkpedia-device-native-source.json' with { type: 'json' };
// Digest keys use '/' on every OS, so Windows reproduces the committed digests.
const repoPath = (from, to) => relative(from, to).split(sep).join('/');

const root = fileURLToPath(new URL('../../', import.meta.url));
const levels = max => Array.from({ length: max }, (_, i) => i + 1);
const direction = ['UP', 'RIGHT', 'DOWN', 'LEFT'];
const standard = { level: levels(30), skillLevel: [1] };
const keySet = (ids, dimensions = standard, bindings = []) => Object.fromEntries(ids.map(id => [id, { dimensions, bindings }]));
// A family is one adapter to an existing source compiler, never a second copy
// of its mechanics. Arbitrary branch identities are validated at stage import.
export const DEVICE_FAMILIES = {
  carapaceDefinition: { module: 'stage-carapaces', variants: keySet(['']) },
  twigsDefinition: { module: 'stage-twigs', variants: keySet([''], standard, ['branchId','actionIndex','pollutionLow','pollutionHigh']) },
  capturableDeviceDefinition: { module: 'stage-capturable-devices', keyed: true,
    variants: keySet(['trap_057_wpnsts'], { level: levels(90), skillLevel: [1], skillIndex: [0, 1] }) },
  electricCoilDefinition: { module: 'stage-electric-coils', variants: keySet([''],
    { level: levels(30), elite: [0], potential: [0], skill_index: [0], skill_level: [1] }) },
  flowGeneratorDefinition: { module: 'stage-flow-generators', variants: keySet([''], { ...standard, skillLevel: [1, 2], direction }) },
  gramophoneDefinition: { module: 'stage-gramophones', variants: keySet([''], { ...standard, skillLevel: [1, 2, 3] }) },
  manualDeviceDefinition: { module: 'stage-manual-devices', keyed: true,
    variants: { ...keySet(['trap_002_emp', 'trap_005_sensor', 'trap_008_farm'], { level: levels(90), skillLevel: [1] }),
      ...keySet(['trap_025_prison'], { ...standard, direction }) } },
  powerArmorDeviceDefinition: { module: 'stage-power-armor', keyed: true,
    variants: keySet(['trap_075_bgarmn', 'trap_076_bgarms', 'trap_077_rmtarmn', 'trap_078_rmtarms'], standard, ['branchId', 'actionIndex']) },
  rewardDeviceDefinition: { module: 'stage-reward-devices', keyed: true, variants: {
    ...keySet(['trap_757_skzbox', 'trap_759_skzwyx', 'trap_760_skztzs']), ...keySet(['trap_758_skzmbx'], standard, ['branchId']) } },
  sceneryDefinition: { module: 'stage-scenery', keyed: true, variants: keySet(['trap_001_crate', 'trap_015_tree']) },
  turretDefinition: { module: 'stage-turrets', variants: keySet([''], { ...standard, direction }) },
  artilleryDefinition: { module: 'stage-artillery', variants: keySet([''], { level: [1], skillLevel: [1, 2, 3] }) },
  magicCircuitDefinition: { module: 'stage-magic-circuit', keyLast: true, variants: {
    ...keySet(['trap_062_magicstart', 'trap_063_magicturn'], { ...standard, direction }), ...keySet(['trap_064_magiccircle']) } },
  predefinedMineDefinition: { module: 'stage-mines', variants: keySet(['']) },
};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export async function buildDeviceRuntime() {
  const values = [], interned = new Map(), families = {};
  const intern = value => {
    const json = JSON.stringify(value);
    if (!interned.has(json)) { interned.set(json, values.length); values.push(value); }
    return interned.get(json);
  };
  for (const [name, family] of Object.entries(DEVICE_FAMILIES)) {
    const factory = (await import(`../../shared/arkpedia/${family.module}.js`))[name];
    const variants = {};
    for (const [id, { dimensions, bindings }] of Object.entries(family.variants)) {
      const fields = Object.keys(dimensions);
      const build = (depth, instance) => {
        if (depth === fields.length) {
          const bound = { ...instance, ...Object.fromEntries(bindings.map(key => [key, key === 'branchId' ? 'runtime-binding' : 0])) };
          const result = family.keyed ? factory(id, bound) : family.keyLast ? factory(bound, id) : factory(bound);
          for (const key of bindings) {
            if (result[key] !== bound[key]) throw Error(`Device compiler lost ${name}.${key}`);
            delete result[key];
          }
          return intern(result);
        }
        const field = fields[depth], children = dimensions[field].map(value => build(depth + 1, { ...instance, [field]: value }));
        // A node explicitly records its dimension; collapsed dimensions still
        // have their complete admission rules in dimensions above.
        return children.every(child => JSON.stringify(child) === JSON.stringify(children[0])) ? children[0] : { field, children };
      };
      variants[id] = { dimensions, ...(bindings.length ? { bindings } : {}), tree: build(0, {}) };
    }
    families[name] = variants;
  }
  const specs = {};
  for (const [name, spec] of Object.entries(devices.STAGE_DEVICES)) {
    const keys = spec.keys ?? [undefined];
    const accepted = keys.filter(key => devices.stageDeviceSpec({ name, key, hidden: false }));
    if (accepted.length) specs[name] = { ...spec, ...(spec.keys ? { keys: accepted } : {}) };
  }
  // Exact retained prefab evidence is needed by the Shredder enemy contract.
  // Carry only that component, rather than the entire device extraction.
  const stump = { prefabs: { trap_017_wooden_broke: native.prefabs.trap_017_wooden_broke } };
  const sourceFiles = new Map();
  async function visit(path) {
    if (sourceFiles.has(path)) return;
    const bytes = await readFile(resolve(root, path)); sourceFiles.set(path, hash(bytes));
    if (path.endsWith('.json')) return;
    for (const match of bytes.toString().matchAll(/\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?["']([^"']+)["']/g))
      if (match[1].startsWith('.')) await visit(repoPath(root, resolve(root, dirname(path), match[1])));
  }
  for (const module of new Set(['stage-devices', 'stage-demolition', ...Object.values(DEVICE_FAMILIES).map(f => f.module)]))
    await visit(`shared/arkpedia/${module}.js`);
  const compiler = repoPath(root, fileURLToPath(import.meta.url));
  sourceFiles.set(compiler, hash(await readFile(resolve(root, compiler))));
  return { schemaVersion: 1, sourceDigest: hash(JSON.stringify([...sourceFiles].sort())), families, values, specs,
    tokens: devices.STAGE_TOKEN_UNITS, pulse: devices.pulseTiles(0, 0), pillar: PILLAR, ruins: RUINS, stump };
}

export async function checkDeviceRuntime(directory = root) {
  const expected = await buildDeviceRuntime();
  const actual = JSON.parse(await readFile(resolve(directory, 'data/arkpedia-device-runtime.json')));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw Error('Stale device runtime: run npm run content:devices');
  return expected;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const data = process.argv.includes('--check') ? await checkDeviceRuntime() : await buildDeviceRuntime();
  if (!process.argv.includes('--check')) await writeJSONAtomic(resolve(root, 'data/arkpedia-device-runtime.json'), data, { space: 0 });
  console.log(JSON.stringify({ families: Object.keys(data.families).length, definitions: data.values.length,
    bytes: Buffer.byteLength(JSON.stringify(data) + '\n'), sourceDigest: data.sourceDigest }));
}
