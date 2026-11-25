// SPDX-License-Identifier: GPL-3.0-or-later
import { readFile, readdir, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { REGULAR_OPERATORS, assertRegularOperator } from '../../shared/arkpedia/operators.js';
import { stageDeviceSpec, STAGE_TOKEN_UNITS } from '../../shared/arkpedia/stage-devices.js';
import { mergePristineHiddenGroups } from '../../shared/arkpedia/stage-conditional.js';
import { compileStage, STANDARD_STAGE_MODES } from './build-stage.mjs';
import { compileStageRules, stageEnemyKey } from '../../shared/arkpedia/stage-rules.js';
import { loadStageRuleReceipt } from './stage-rule-storage.mjs';
import { prepareStageDeploymentTiles } from './stage-deployment-tiles.mjs';
import { prepareStageSupplyCards } from './stage-supply-cards.mjs';
import { prepareStageDeviceInstances } from './stage-device-instances.mjs';
import { applyStageEnemyBlackboard, stageEnemyTokenDependencies } from '../../shared/arkpedia/stage-enemy-talents.js';
import { prepareStageEnemyBlackboards } from './stage-enemy-blackboards.mjs';
import { prepareStageEnemyAliases } from './stage-enemy-aliases.mjs';
import { prepareStageEnvironments } from './stage-environments.mjs';
import { stageEnvironmentEnemyDependencies } from '../../shared/arkpedia/stage-environments.js';
import { prepareStageWaves } from './stage-waves.mjs';
import { prepareStageBranches } from './stage-branches.mjs';
import { prepareStageMode } from './stage-mode-rules.mjs';
import { prepareStageReeds } from './stage-reeds.mjs';
import { prepareStageHuiMing } from './stage-hui-ming.mjs';
import { prepareStageMire } from './stage-mire.mjs';
import { prepareStageWater } from './stage-water.mjs';
import { groupStageBlockers } from './content-priorities.mjs';
import { writeJSONAtomic } from './write-json.mjs';
import { writeFile } from 'node:fs/promises';
import { checkDeviceRuntime } from './device-runtime.mjs';
import { damaztiStageRuleOk, DAMAZTI_RUNE_TARGETS } from '../../shared/arkpedia/enemy-damazti-features.js';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const exists = async path => { try { await access(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };
export const readJSON = async path => JSON.parse(await readFile(path, 'utf8'));

export async function loadContentContext({ root = ROOT, source = resolve(root, '../arkpedia-data/source/data'), requireStageSource = true } = {}) {
  await checkDeviceRuntime(root);
  const names = ['mvp', 'enemy-records', 'enemy-support', 'deployable-tokens', 'support-operators', 'stages', 'roster-target'];
  const values = await Promise.all(names.map(name => readJSON(join(root, 'data', `arkpedia-${name}.json`))));
  const [mvp, records, support, tokenData, supportOperators, index, roster] = values;
  let devices = {}, commit = null, deviceTableSha256 = null;
  if (requireStageSource) {
    // A missing device table must not silently turn a functional map into an empty map.
    const bytes = await readFile(join(source, 'stage-devices.json'));
    devices = JSON.parse(bytes); deviceTableSha256 = digest(bytes);
    try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim(); }
    catch { commit = null; }
  }
  return { root, source, mvp, records, support, tokenData, supportOperators, index, roster, devices,
    sourceRevision: { commit, deviceTableSha256 } };
}

/** Shared preflight for the inventory and single-stage additions. All known
 * blockers are retained so one early failure cannot hide a dependency. */
export async function planStage(context, id, { compile = true, waves = false } = {}) {
  if (!/^[a-z0-9_-]+$/i.test(id)) throw Error(`Invalid stage id: ${id}`);
  const { source: sourceRoot, index } = context;
  let { support, records } = context;
  const receipts = [];
  const readSource = async path => {
    const bytes = await readFile(path);
    receipts.push({ path: path.slice(sourceRoot.length + 1), sha256: digest(bytes) });
    return JSON.parse(bytes);
  };
  const source = await readSource(join(sourceRoot, 'stages', `${id}.json`));
  if (source.slug !== id) throw Error(`Stage identity mismatch: ${id} != ${source.slug}`);
  const entry = index.stages.find(entry => entry.id === id);
  const blockers = [];
  if (!source.battle) blockers.push({ kind: 'non-combat', id });
  if (source.battle && !STANDARD_STAGE_MODES.has(source.stage_type)) blockers.push({ kind: 'mode', id: source.stage_type });
  let rules = null, compiledRules = null;
  const localSources = [];
  {
    try {
      const loaded = await loadStageRuleReceipt(context.root, id);
      rules = loaded.receipt; localSources.push(...loaded.sources);
      // Normal levels can contain active roster/stat restrictions too (OF-6).
      // Absence of a variant label is not evidence that the original has no rules.
      if (source.battle && !rules) throw Error('Missing original level rule receipt');
      compiledRules = compileStageRules(source, rules);
      if (compiledRules?.enemyDynamicAbilities || compiledRules?.environmentBuffs || compiledRules?.deploymentDamage || compiledRules?.enemyElementalDamage) {
        const path = 'data/arkpedia-native-stage-rules.json';
        localSources.push({ path, sha256: digest(await readFile(join(context.root, path))) });
      }
    }
    catch (error) { blockers.push({ kind: 'stage-rules', id: source.variant?.kind ?? 'level', message: error.message }); }
  }
  const base = id.replace(/_(challenge_mode|six_star|adverse_environment)$/, '');
  const keys = [...new Set([id, source.geometryKey, base].filter(Boolean))];
  if (keys.some(key => !/^[a-z0-9_-]+$/i.test(key))) throw Error(`Unsafe geometry key for ${id}`);
  let geometry, geometryKey;
  for (const key of keys) {
    const path = join(sourceRoot, 'stage-geometry', `${key}.json`);
    if (await exists(path)) { geometry = await readSource(path); geometryKey = key; break; }
  }
  if (!geometry) blockers.push({ kind: 'geometry', id });
  const localEnemies = await prepareStageEnemyAliases({ root: context.root, rules, geometry, records, support });
  localSources.push(...localEnemies.sources);
  for (const failure of localEnemies.failures) blockers.push({ kind: 'enemy-alias', ...failure });
  const aliasIds = new Set(localEnemies.ids);
  records = { ...records, enemies: { ...records.enemies, ...localEnemies.records } };
  support = { ...support, enemies: { ...support.enemies, ...localEnemies.support } };
  let devices = context.devices[source.geometryKey ?? id] ?? context.devices[base] ?? [];
  receipts.push({ path: 'stage-devices.json', sha256: context.sourceRevision.deviceTableSha256 });
  const deviceInstances = {};
  try {
    const prepared = await prepareStageDeviceInstances({ root: context.root, rules, compiledRules, devices, instances: deviceInstances });
    devices = prepared.devices; localSources.push(...prepared.sources);
  } catch (error) { blockers.push({ kind: 'device-instance', id, message: error.message }); }
  const deviceNames = [...new Set(devices.filter(device => device.kind === 'device' && !String(device.key).startsWith('char_')).map(device => device.name))];
  for (const name of deviceNames) if (devices.some(d => d.name === name && !stageDeviceSpec(d))) blockers.push({ kind: 'device', id: name });
  let reeds;
  try {
    const prepared = await prepareStageReeds({ root: context.root, rules, compiledRules, geometry });
    reeds = prepared.reeds; localSources.push(...prepared.sources);
  } catch (error) { blockers.push({ kind: 'stage-data', id: 'Reeds terrain', message: error.message }); }
  let huiMing;
  try {
    const prepared = await prepareStageHuiMing({ root: context.root, geometry });
    huiMing = prepared.huiMing; localSources.push(...prepared.sources);
  } catch (error) { blockers.push({ kind: 'stage-data', id: 'Hui-Ming tiles', message: error.message }); }
  let mire;
  try {
    const prepared = await prepareStageMire({ root: context.root, rules, geometry, devices });
    mire = prepared.mire; localSources.push(...prepared.sources);
  } catch (error) { blockers.push({ kind: 'stage-data', id: 'Mire controller', message: error.message }); }
  let water;
  try {
    const prepared = await prepareStageWater({ root: context.root, rules, geometry, devices });
    water = prepared.water; localSources.push(...prepared.sources);
  } catch (error) { blockers.push({ kind: 'stage-data', id: 'water controller', message: error.message }); }
  let stage, waveProgram, mode, enemyBlackboards = {}, enemyAttributes = null, environment = [];
  if (source.battle && rules) try {
    const prepared = await prepareStageMode({ root: context.root, rules, source });
    mode = prepared.mode; localSources.push(...prepared.sources);
  } catch (error) { blockers.push({ kind: 'mode', id: source.stage_type, message: error.message }); }
  if (source.battle && geometry && rules) {
    try {
      const prepared = await prepareStageEnemyBlackboards({ root: context.root, rules });
      enemyBlackboards = prepared.overrides; enemyAttributes = prepared.attributes; localSources.push(...prepared.sources);
    } catch (error) { blockers.push({ kind: 'enemy-parameters', id, message: error.message }); }
    try {
      const prepared = await prepareStageEnvironments({ root: context.root, rules, compiledRules });
      environment = prepared.environment; localSources.push(...prepared.sources);
    } catch (error) { blockers.push({ kind: 'environment', id, message: error.message }); }
  }
  let conditional = [], working, branches;
  const enemyIds = new Set(), tokenIds = new Set();
  if (geometry) {
    try { localSources.push(...await prepareStageSupplyCards({ root: context.root, rules, geometry, compiledRules })); }
    catch (error) { blockers.push({ kind: 'supply-card', id, message: error.message }); }
    try { localSources.push(...await prepareStageDeploymentTiles({ root: context.root, geometry, rules, compiledRules })); }
    catch (error) { blockers.push({ kind: 'deployment-tiles', id, message: error.message }); }
    working = structuredClone(geometry);
    if (working.hasConditionalSpawns) {
      for (const key of [...new Set([id, geometryKey])]) {
        const path = join(sourceRoot, 'stage-conditional', `${key}.json`);
        if (await exists(path)) { conditional = await readSource(path); break; }
      }
      let mainConditional = conditional;
      if (waves && conditional.some(e => e.source === 'branch' || e.branch)) try {
        const prepared = await prepareStageBranches({ root: context.root, rules, compiledRules, geometry: working, conditional, devices, instances: deviceInstances });
        branches = prepared.branches; working = prepared.geometry; localSources.push(...prepared.sources);
        mainConditional = conditional.filter(e => e.source !== 'branch' && !e.branch);
        if (!mainConditional.length) working.hasConditionalSpawns = false;
      } catch (error) { blockers.push({ kind: 'branch-program', id, message: error.message }); }
      if (working.hasConditionalSpawns && !mergePristineHiddenGroups(working, mainConditional, compiledRules?.hiddenGroups, { random: waves }))
        blockers.push({ kind: 'conditional', id });
    }
    if (working.rows > 19 || working.cols > 21) blockers.push({ kind: 'grid-size', id: `${working.rows}x${working.cols}` });
    for (const token of working.suppliedUnits?.deployable_tokens ?? []) {
      if (token.count === 0 && !STAGE_TOKEN_UNITS[token.unit_id]?.supplyCard) continue;
      tokenIds.add(token.unit_id);
      if (!STAGE_TOKEN_UNITS[token.unit_id]) blockers.push({ kind: 'token', id: token.unit_id });
      else if (!context.tokenData.tokens[token.unit_id]) blockers.push({ kind: 'token-data', id: token.unit_id });
    }
    for (const card of working.suppliedUnits?.fixed_squad ?? [])
      if (!context.mvp.operators[card.unit_id] && !context.supportOperators.operators[card.unit_id])
        blockers.push({ kind: 'operator', id: card.unit_id });
    const addEnemy = id => {
      if (!id || enemyIds.has(id)) return;
      enemyIds.add(id);
      if (!records.enemies[id] && !aliasIds.has(id)) blockers.push({ kind: 'enemy-data', id });
      else if (!support.enemies[id]?.policy) blockers.push({ kind: 'enemy', id, reasons: support.enemies[id]?.reasons ?? ['missing support decision'] });
      if (records.enemies[id]) try {
        const level = working.enemyConfigurations?.find(c => c.enemy_id === id)?.database_level ?? 0;
        const record = applyStageEnemyBlackboard(records.enemies[id].levels[level], enemyBlackboards[id]);
        for (const key of stageEnemyTokenDependencies(record)) {
          tokenIds.add(key);
          if (!STAGE_TOKEN_UNITS[key] || !context.tokenData.tokens[key]
            || (working.suppliedUnits?.deployable_tokens ?? []).filter(t => t.unit_id === key).length !== 1)
            blockers.push({ kind: 'enemy-supply', id, message: `Missing or unsupported supply card: ${key}` });
        }
      } catch (error) { blockers.push({ kind: 'enemy-parameters', id, message: error.message }); }
      for (const child of support.enemies[id]?.spawns ?? []) addEnemy(child);
    };
    for (const token of tokenIds) for (const child of STAGE_TOKEN_UNITS[token]?.spawns ?? []) addEnemy(child);
    for (const child of stageEnvironmentEnemyDependencies(environment)) addEnemy(child);
    for (const device of devices) for (const child of stageDeviceSpec(device)?.spawns ?? []) addEnemy(child);
    const spawnEnemy = id => stageEnemyKey(compiledRules, id);
    for (const wave of working.waves ?? []) for (const spawn of wave.spawns ?? []) addEnemy(spawnEnemy(spawn.enemy_id));
    // Even unresolved branches expose their enemy dependencies.
    if (working.hasConditionalSpawns || branches) for (const spawn of conditional) addEnemy(spawnEnemy(spawn.enemy_id));
  }
  // The Deconstructed Distortion's and the family's Corrosion is a stage rune, not an enemy ability (PRTS).
  if ([...enemyIds].some(id => DAMAZTI_RUNE_TARGETS.includes(id)) && !damaztiStageRuleOk(compiledRules))
    blockers.push({ kind: 'stage-rules', id: 'damazti-corrosion', message: "Missing the 'Damazti Cluster' Corrosion rune" });
  if ([...enemyIds].some(id => /^enemy_(?:121[78]|1105)_/.test(id))) {
    for (const path of ['data/arkpedia-enemy-records.json', 'data/arkpedia-enemy-support.json', 'data/arkpedia-enemy-native-abilities.json', 'data/arkpedia-snack-animations.json'])
      localSources.push({ path, sha256: digest(await readFile(join(context.root, path))) });
  }
  if ([...enemyIds].some(id => id.startsWith('enemy_1513_dekght')))
    for (const path of ['data/arkpedia-enemy-records.json', 'data/arkpedia-enemy-support.json', 'data/arkpedia-enemy-native-abilities.json', 'data/arkpedia-knight-animations.json'])
      localSources.push({ path, sha256: digest(await readFile(join(context.root, path))) });
  if ([...enemyIds].some(id => id.startsWith('enemy_2085_skzjxd')))
    for (const path of ['data/arkpedia-enemy-records.json', 'data/arkpedia-enemy-support.json', 'data/arkpedia-enemy-native-abilities.json', 'data/arkpedia-fatty-animations.json'])
      localSources.push({ path, sha256: digest(await readFile(join(context.root, path))) });
  if ([...enemyIds].some(id => id.startsWith('enemy_1104_lfkght')))
    for (const path of ['data/arkpedia-enemy-records.json', 'data/arkpedia-enemy-support.json', 'data/arkpedia-enemy-native-abilities.json', 'data/arkpedia-blade-animations.json'])
      localSources.push({ path, sha256: digest(await readFile(join(context.root, path))) });
  if ([...tokenIds].some(id => STAGE_TOKEN_UNITS[id]?.supplyCard)) for (const path of ['data/arkpedia-device-source.json', 'data/arkpedia-device-native-source.json'])
    localSources.push({ path, sha256: digest(await readFile(join(context.root, path))) });
  if (tokenIds.has('trap_018_bomb')) {
    const path = 'data/arkpedia-mrboom-animations.json';
    localSources.push({ path, sha256: digest(await readFile(join(context.root, path))) });
  }
  if ((waves || Object.keys(compiledRules?.predefinedOperators ?? {}).length) && compiledRules && working && !working.hasConditionalSpawns) {
    try {
      const prepared = await prepareStageWaves({ root: context.root, rules, compiledRules, geometry: working,
        operators: { ...context.mvp.operators, ...context.supportOperators.operators }, devices, branches });
      waveProgram = prepared.waveProgram;
      geometry = prepared.geometry; localSources.push(...prepared.sources);
      // Hidden Turrets switched on by an activation branch (Faust's ballistae).
      devices = [...devices, ...prepared.hiddenTurrets.devices]; Object.assign(deviceInstances, prepared.hiddenTurrets.instances);
    } catch (error) { blockers.push({ kind: 'wave-program', id, message: error.message }); }
  }
  if (compile && blockers.length === 0) {
    try { stage = compileStage({ ...context, records, support, source, geometry, devices, deviceInstances, conditional, rules, environment, waveProgram, mode, water, mire, reeds, huiMing, enemyBlackboards, enemyAttributes, enemyAliases: localEnemies.aliases }); }
    catch (error) { blockers.push({ kind: 'compile', id, message: error.message }); }
  }
  const uniqueLocalSources = new Map();
  for (const source of localSources) {
    const previous = uniqueLocalSources.get(source.path);
    if (previous && previous.sha256 !== source.sha256) throw Error(`Local source changed during preflight: ${source.path}`);
    uniqueLocalSources.set(source.path, source);
  }
  return { id, code: source.code, name: source.name, mode: source.stage_type, combat: !!source.battle,
    status: entry ? entry.testOnly ? 'test-only' : 'public' : blockers.length ? 'blocked' : 'ready',
    blockers, dependencies: { enemies: [...enemyIds].sort(), devices: deviceNames.sort(), tokens: [...tokenIds].sort() },
    sources: receipts, localSources: [...uniqueLocalSources.values()], stage };
}

export function operatorInventory({ roster, mvp }) {
  return roster.operators.map(target => {
    const imported = mvp.operators[target.id], policy = REGULAR_OPERATORS[target.id];
    const allowed = policy?.skillIds ?? (policy?.skillId ? [policy.skillId] : []);
    const missingSkills = target.skills.filter(id => !imported?.skills.some(skill => skill.id === id) || !allowed.includes(id));
    let error = null;
    if (imported) { try { assertRegularOperator(imported); } catch (failure) { error = failure.message; } }
    return { id: target.id, name: imported?.name ?? target.sourceName, imported: !!imported,
      skills: target.skills, missingSkills, status: imported && policy && !missingSkills.length && !error ? 'registered' : 'blocked',
      ...(error ? { error } : {}) };
  });
}

export async function buildContentInventory(context) {
  context ??= await loadContentContext();
  const files = (await readdir(join(context.source, 'stages'))).filter(name => name.endsWith('.json')).sort();
  const stages = [];
  const sourceFiles = new Map();
  for (const file of files) {
    const { stage, sources, ...row } = await planStage(context, file.slice(0, -5), { waves: true });
    for (const source of sources) sourceFiles.set(source.path, source.sha256);
    stages.push(row);
  }
  const operators = operatorInventory(context);
  const combat = stages.filter(row => row.combat);
  const dependencies = groupStageBlockers(combat).map(row => ({ ...row, id: row.id ?? row.reason }));
  const missingStageEnemyRecords = [...new Set(combat.flatMap(stage => stage.blockers
    .filter(blocker => blocker.kind === 'enemy-data').map(blocker => blocker.id)))].sort();
  const byMode = {};
  for (const stage of combat) {
    const bucket = byMode[stage.mode] ??= { total: 0, public: 0, testOnly: 0, ready: 0, blocked: 0, loadable: 0, capabilityBlocked: 0 };
    bucket.total++;
    bucket[stage.status === 'test-only' ? 'testOnly' : stage.status]++;
    bucket[stage.blockers.length ? 'capabilityBlocked' : 'loadable']++;
  }
  return { schemaVersion: 1,
    scope: 'Capability-checked content at named source revisions, with legacy registration reported separately; not a client-fidelity certificate. Blockers are non-exclusive.',
    sources: { operatorTarget: context.roster.source, stageCheckout: { ...context.sourceRevision,
      contentSha256: digest(JSON.stringify([...sourceFiles].sort(([a], [b]) => a.localeCompare(b)))) },
      enemyRecords: context.support.source, snapshot: context.mvp.sources },
    summary: { operators: { total: operators.length, registered: operators.filter(row => row.status === 'registered').length,
      skills: operators.reduce((n, row) => n + row.skills.length, 0), missingSkills: operators.reduce((n, row) => n + row.missingSkills.length, 0) },
    enemies: context.support.summary,
    missingStageEnemyRecords: missingStageEnemyRecords.length,
    stages: { total: combat.length, public: combat.filter(row => row.status === 'public').length,
      loadable: combat.filter(row => !row.blockers.length).length, capabilityBlocked: combat.filter(row => row.blockers.length).length,
      testOnly: combat.filter(row => row.status === 'test-only').length, ready: combat.filter(row => row.status === 'ready').length,
      blocked: combat.filter(row => row.status === 'blocked').length, nonCombat: stages.length - combat.length,
      catalogue: context.index.stages.length, embedded: context.index.stages.filter(row => !row.data).length }, byMode },
    operators, stages: combat, missingStageEnemyRecords,
    blockers: dependencies };
}

export function remainingMarkdown(report) {
  const { operators, enemies, stages, byMode } = report.summary;
  return `# Remaining content

Generated by \`npm run content:inventory -- --write\`. Detailed dependencies and
all blocked stage IDs are in \`data/arkpedia-content-inventory.json\`.

| Area | Registered / loadable | Target |
|---|---:|---:|
| Operator forms | ${operators.registered} | ${operators.total} |
| Source skills registered | ${operators.skills - operators.missingSkills} | ${operators.skills} |
| Enemies supported | ${enemies.supported} | ${enemies.enemies} |
| Capability-checked combat stages | ${stages.loadable} | ${stages.total} |

The generated library can load ${stages.loadable} stages; ${stages.capabilityBlocked}
have missing capabilities. The legacy catalogue contains ${stages.catalogue}
entries (${stages.public} public, ${stages.testOnly} developer-only, ${stages.embedded} embedded).
${stages.nonCombat} story/non-combat source entries are excluded from the combat target.
The stage sources also reference ${report.summary.missingStageEnemyRecords} enemy IDs absent from the
pinned enemy catalogue; those require source import before behavior admission.
Registration is not a certificate of complete modules, visuals, mode rules or
client frame parity. Legacy catalogue membership does not bypass current
source checks or determine admission to the generated library.

## Source revisions

- CN operator target: \`${report.sources.operatorTarget.commit}\`.
- Arkpedia stage checkout: \`${report.sources.stageCheckout.commit ?? 'unversioned'}\`.
- Read source content SHA-256: \`${report.sources.stageCheckout.contentSha256}\`.
- Enemy record/native source hashes: see the report's \`sources.enemyRecords\`.

## Combat stages by mode

| Mode | Loadable | Missing capabilities | Total |
|---|---:|---:|---:|
${Object.entries(byMode).map(([mode, row]) => `| ${mode} | ${row.loadable} | ${row.capabilityBlocked} | ${row.total} |`).join('\n')}

## Highest-impact missing dependencies

Counts overlap: a stage can require several missing mechanics. Fixing one does
not imply that every listed stage becomes playable.

| Kind | Dependency | Affected stages |
|---|---|---:|
${report.blockers.slice(0, 25).map(row => `| ${row.kind} | ${String(row.id).replaceAll('|', '\\|')} | ${row.stages.length} |`).join('\n')}

## Workflow

Use \`npm run content -- plan operator <id>\`, \`plan enemy <id>\` or
\`plan stage <slug>\` to inspect dependencies. Implement a shared mechanic and
its source contract, then run \`npm run content:library\` to discover and compile
every compatible stage. Run \`npm run content:library:check\` for graph/runtime
validation. Individual stage additions are legacy regression fixtures, not
library admission gates. See [ADDING-CONTENT.md](ADDING-CONTENT.md) and
[CONTENT-PLAN.md](CONTENT-PLAN.md).
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await buildContentInventory(await loadContentContext({ source: process.env.ARKPEDIA_CONTENT_SOURCE
    ? resolve(process.env.ARKPEDIA_CONTENT_SOURCE) : undefined }));
  if (process.argv.includes('--write')) {
    await writeJSONAtomic(join(ROOT, 'data/arkpedia-content-inventory.json'), report);
    await writeFile(join(ROOT, 'docs/REMAINING.md'), remainingMarkdown(report));
  }
  console.log(JSON.stringify(process.argv.includes('--json') ? report : {
    summary: report.summary, topBlockers: report.blockers.slice(0, 25).map(row => ({ ...row, stages: row.stages.length })),
    ready: report.stages.filter(row => row.status === 'ready').map(row => row.id),
  }, null, 2));
}
