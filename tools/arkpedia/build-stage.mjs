// SPDX-License-Identifier: GPL-3.0-or-later
// Build one file-backed stage from the public Arkpedia sources used by the
// simulator. It is the small counterpart of build-mvp.mjs: the global payload
// keeps operators/enemies/effects, and each stage stays in its own JSON file.
//
//   node tools/arkpedia/build-stage.mjs \
//     --stage ../arkpedia-data/source/data/stages/0-2.json \
//     --geometry ../arkpedia-data/source/data/stage-geometry/0-2.json \
//     --playback ../arkpedia-stage-overhaul/public/stage-detail/0-2.json \
//     --out data/arkpedia-stage-0-2.json
//
// A stage is refused unless its route export matches the geometry hash and its
// spawns only use supported enemy records. Original stage art and gates are
// optional: the renderer labels the simplified fallback when they are absent.
import { carapaceDefinition } from '../../shared/arkpedia/stage-carapaces.js';
import { twigsDefinition } from '../../shared/arkpedia/stage-twigs.js';
import { powerArmorDeviceDefinition } from '../../shared/arkpedia/stage-power-armor.js';
import { enemyRuntimeRecord } from '../../shared/arkpedia/enemy-features.js';
import { prepareStageEnemyBlackboards } from './stage-enemy-blackboards.mjs';
import { prepareStageReeds } from './stage-reeds.mjs';
import { prepareStageHuiMing } from './stage-hui-ming.mjs';
import { hasHuiMingTiles } from '../../shared/arkpedia/stage-hui-ming.js';
import { REED_TILE_KEYS } from '../../shared/arkpedia/stage-reeds.js';
import { prepareStageMire } from './stage-mire.mjs';
import { prepareStageWater } from './stage-water.mjs';
import { loadStageRuleReceipt } from './stage-rule-storage.mjs';
import { stageCardMultiplier } from '../../shared/arkpedia/stage-card-rules.js';
import { stageDeviceAttributes } from '../../shared/arkpedia/stage-character-attributes.js';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { stageAdapter } from '../../server/sim/arkpedia.js';
import { stageEnemyTokenDependencies, applyStageEnemyBlackboard, applyStageEnemySkillCooldown, applyStageEnemyTalentMultipliers, applyStageEnemySkillRadius, applyStageEnemySkillMultipliers } from '../../shared/arkpedia/stage-enemy-talents.js';
import { STAGE_TOKEN_UNITS, STAGE_DEVICES } from '../../shared/arkpedia/stage-devices.js';
import { stageDeviceSpec } from '../../shared/arkpedia/stage-devices.js';
import { manualDeviceDefinition } from '../../shared/arkpedia/stage-manual-devices.js';
import { artilleryDefinition } from '../../shared/arkpedia/stage-artillery.js';
import { flameDefinition } from '../../shared/arkpedia/stage-flames.js';
import { magicCircuitDefinition } from '../../shared/arkpedia/stage-magic-circuit.js';
import { gramophoneDefinition } from '../../shared/arkpedia/stage-gramophones.js';
import { flowGeneratorDefinition } from '../../shared/arkpedia/stage-flow-generators.js';
import { turretDefinition } from '../../shared/arkpedia/stage-turrets.js';
import { shieldguardDefinition } from '../../shared/arkpedia/stage-shieldguard.js';
import { bloodAltarDefinition } from '../../shared/arkpedia/stage-blood-altar.js';
import { bloodThroneDefinition } from '../../shared/arkpedia/stage-blood-throne.js';
import { lightOfGloryDefinition } from '../../shared/arkpedia/stage-light-of-glory.js';
import { charlesLynchDefinition } from '../../shared/arkpedia/stage-charles-lynch.js';
import { revenantCoreDefinition, revenantGunDefinition } from '../../shared/arkpedia/stage-kindling-revenant.js';
import { weakeningNodeDefinition } from '../../shared/arkpedia/stage-weakening-node.js';
import { prtsStaticForm } from '../../shared/arkpedia/stage-prts-static-forms.js';
import { PRTS_STATIC_FORMS, prtsStaticFormReviewed } from '../../shared/arkpedia/stage-prts-static-forms.js';
import { bombLoaderDefinition } from '../../shared/arkpedia/stage-bomb-loader.js';
import { electricCoilDefinition } from '../../shared/arkpedia/stage-electric-coils.js';
import { stunTokenDefinition } from '../../shared/arkpedia/stage-supply-tokens.js';
import { witheredAltarDefinition } from '../../shared/arkpedia/stage-withered-altars.js';
import { workerDefinition } from '../../shared/arkpedia/stage-workers.js';
import { alladyDefinition } from '../../shared/arkpedia/stage-allerdale.js';
import { mineDefinition, predefinedMineDefinition } from '../../shared/arkpedia/stage-mines.js';
import { demolitionDefinition } from '../../shared/arkpedia/stage-demolition.js';
import { roadblockDefinition, sceneryDefinition } from '../../shared/arkpedia/stage-scenery.js';
import { rangeSupplyDefinition } from '../../shared/arkpedia/stage-range-supplies.js';
import { capturableDeviceDefinition } from '../../shared/arkpedia/stage-capturable-devices.js';
import { prepareStageSupplyCards } from './stage-supply-cards.mjs';
import { prepareStageDeviceInstances } from './stage-device-instances.mjs';
import { mergePristineHiddenGroups } from '../../shared/arkpedia/stage-conditional.js';
import { syntheticRoutePath } from '../../shared/arkpedia/stage-path.js';
import { assertRegularEnemies } from '../../shared/arkpedia/enemies.js';
import { compileStageTerrain } from '../../shared/arkpedia/stage-terrain.js';
import { compileStageRules, stageEnemyKey } from '../../shared/arkpedia/stage-rules.js';
import { stageEnvironmentEnemyDependencies } from '../../shared/arkpedia/stage-environments.js';
import { prepareStageEnvironments } from './stage-environments.mjs';
import { rewardDeviceDefinition } from '../../shared/arkpedia/stage-reward-devices.js';
import { resolveStageRandomWaves } from '../../server/sim/content/arkpedia-stage-random.js';

export const STANDARD_STAGE_MODES = new Set(['main', 'sub', 'activity', 'event', 'daily', 'campaign', 'guide', 'integrated_strategies']);

/** Compile one stage without mutating inputs or writing files. Unsupported content
 * fails before an addition can reach the catalogue. */
export function compileStage({ source, geometry: inputGeometry, playback = {}, mvp, records, support,
  tokenData, supportOperators = { operators: {} }, devices = [], deviceInstances = {}, conditional = [], rules = null, environment = [], waveProgram, mode = null, water = null, mire = null, reeds = null, huiMing = null, enemyAliases = {}, enemyBlackboards = {}, enemyAttributes = null }) {
  for (const key of ['code', 'name']) if (typeof source[key] !== 'string' || !source[key].trim())
    throw Error(`Missing stage ${key}`);
  const compiledRules = compileStageRules(source, rules);
  if (Object.keys(compiledRules?.predefinedOperators ?? {}).length && !waveProgram?.predefined)
    throw Error('Predefined-operator rules require the original actor/card program');
  if (inputGeometry.tileLegend.some(t => REED_TILE_KEYS.includes(t.key)) && !reeds) throw Error('Missing original Reeds terrain program');
  if (hasHuiMingTiles(inputGeometry) !== !!huiMing) throw Error(huiMing ? 'Hui-Ming tile program has no matching terrain' : 'Missing reviewed Hui-Ming tile program');
  if ((devices.some(d => d.key === 'trap_098_mire') || inputGeometry.tileLegend.some(t => t.key === 'tile_mire')) && !mire) throw Error('Missing original Mire controller program');
  if (devices.some(d => d.key === 'trap_042_tidectrl') && !water) throw Error('Missing original water controller program');
  if (devices.some(d => stageDeviceSpec(d)?.scheduled) && !waveProgram) throw Error('Scheduled devices require the original wave program');
  environment = [...new Map([...environment, ...Object.values(compiledRules?.environmentOverrides ?? {})].map(e => [e.kind, e])).values()];
  for (const [from, to] of Object.entries(compiledRules?.enemyReplacements ?? {})) {
    if (!records.enemies[from] || !records.enemies[to] || !support.enemies[to]?.policy)
      throw Error(`Unsupported stage enemy replacement: ${from} -> ${to}`);
  }
  for (const id of compiledRules?.battle.excluded_operator_ids ?? [])
    if (!mvp.operators[id] && !supportOperators.operators[id]) throw Error(`Unknown operator in stage rule: ${id}`);
  for (const rule of compiledRules?.characterAttributes ?? []) for (const id of rule.ids ?? [])
    if (!mvp.operators[id] && !supportOperators.operators[id] && !tokenData.tokens[id] && !devices.some(d => d.key === id)
      && !Object.keys(STAGE_DEVICES).some(name => STAGE_DEVICES[name].keys?.includes(id) && stageDeviceSpec({name,key:id,hidden:false}))
      // Chapter 15: the static forms the Intrusive Call deploys (stage-prts-static-forms.js).
      && !(Object.values(PRTS_STATIC_FORMS).includes(id) && prtsStaticFormReviewed(Object.keys(PRTS_STATIC_FORMS).find(k => PRTS_STATIC_FORMS[k] === id))))
      throw Error(`Unknown character attribute target: ${id}`);
  if (source.stage_type && !STANDARD_STAGE_MODES.has(source.stage_type))
    throw Error(`Unsupported stage mode: ${source.stage_type}`);
  if (source.stage_type === 'integrated_strategies' && (!waveProgram || mode?.kind !== source.stage_type || mode.scope !== 'individual-stage'))
    throw Error('Missing original individual-stage mode rules');
  const geometry = structuredClone(inputGeometry), playbackFile = structuredClone(playback);
  const configs = new Map((geometry.enemyConfigurations ?? []).map(config => {
    if (enemyAttributes == null || Object.hasOwn(enemyAliases, config.enemy_id)) return [config.enemy_id, config];
    const original = enemyAttributes[config.enemy_id];
    if (!original || original.level !== (config.database_level ?? 0))
      throw Error(`Missing or mismatched original enemy attributes: ${config.enemy_id}`);
    const canonical = { ...config };
    if (Object.keys(original.overrides).length || Object.hasOwn(config, 'overrides')) canonical.overrides = original.overrides;
    return [config.enemy_id, canonical];
  }));
  if (enemyAttributes != null) geometry.enemyConfigurations = [...configs.values()];
  const tokenRules = compiledRules?.tokenCountAdd ?? {}, cards = geometry.suppliedUnits?.deployable_tokens ?? [];
  if (compiledRules?.excludePredefinedTraps && (devices.length || cards.length))
    throw Error('Predefined trap exclusion requires prepared device removal and no supplied trap cards');
  for (const id of Object.keys(tokenRules).filter(id => id !== '*'))
    if (cards.filter(t => t.unit_id === id).length !== 1 || !STAGE_TOKEN_UNITS[id]) throw Error(`Missing or ambiguous stage token rule target: ${id}`);
  for (const card of cards) {
    const amount = (tokenRules['*'] ?? 0) + (tokenRules[card.unit_id] ?? 0);
    if (!amount) continue;
    const count = card.count + amount;
    if (!Number.isSafeInteger(card.count) || card.count < 0 || !Number.isSafeInteger(count) || count < 0)
      throw Error(`Invalid stage token count: ${card.unit_id}`);
    card.count = count;
  }
  if (geometry.hasConditionalSpawns) mergePristineHiddenGroups(geometry, conditional, compiledRules?.hiddenGroups);
  if (geometry.waves.some(w => w.spawns.some(s => s.random)) && !waveProgram)
    throw Error('Random spawns require an original wave program');
  const paths = playbackFile.playbackPaths ?? playbackFile.paths ?? {};
  // The geometry route is a reviewed start/checkpoint/end chain. When the viewer export omits a route,
  // synthesize the same chain so the stage can still be played; the original path is preferred.
  const syntheticRoutes = [];
  const usedRoutes = new Set(geometry.waves.flatMap(wave => (wave.spawns || []).map(spawn => spawn.route)));
  // Every phase of a branch: `spawns` is only its first phase. A random-phase branch (the Bloodcalling Altar, the
  // Throne of Blood) and a sequence branch (the Core Amplifiers) run the others too, on their own routes.
  const branchSpawns = branch => [...branch.spawns, ...(branch.randomPhases ?? []).flat(), ...(branch.sequencePhases ?? []).flat()];
  for (const branch of Object.values(waveProgram?.branches ?? {})) for (const spawn of branchSpawns(branch)) usedRoutes.add(spawn.routeIndex);
  for (const [index, route] of geometry.routes.entries()) {
    if (!route || paths[index] || route.placeholder || !usedRoutes.has(index)) continue;
    paths[index] = syntheticRoutePath(route);
    syntheticRoutes.push(index);
  }
  if (!Object.keys(paths).length) throw Error('Playback export has no paths and no route to synthesize');
  const tokens = (geometry.suppliedUnits?.deployable_tokens ?? []).filter(t => t.count !== 0 || STAGE_TOKEN_UNITS[t.unit_id]?.supplyCard).map(t => {
    const spec = STAGE_TOKEN_UNITS[t.unit_id];
    if (!spec) throw Error(`Unsupported stage token: ${t.unit_id}`);
    const token = tokenData.tokens[t.unit_id];
    if (!token) throw Error(`No token stats for ${t.unit_id}`);
    const stats = token.phases[0].levels.at(-1);
    const behavior = spec.behavior === 'stun-pulse' ? stunTokenDefinition(t) : spec.behavior === 'electric-coil' ? electricCoilDefinition(t)
      : spec.behavior === 'withered-altar' ? witheredAltarDefinition(t) : spec.behavior === 'interference-mine' ? mineDefinition(t) : spec.behavior === 'demolition' ? demolitionDefinition(t) : spec.behavior === 'roadblock' ? roadblockDefinition(t)
      : spec.behavior === 'mushroom-worker' ? workerDefinition(t)
      : spec.behavior === 'range-supply' ? rangeSupplyDefinition(t.unit_id, t)
      // Allerdale's Guard aims at the ally on the tile it faces (stage-allerdale.js), so the card asks for a facing.
      : spec.behavior === 'barrier' ? (alladyDefinition({ level: 1, skillLevel: 1, skillIndex: 0 }), { chooseFacing: true }) : {};
    // A hidden supply card (validated as revealed by one wave action) starts empty and holds its stock until then.
    return { unitId: t.unit_id, name: token.name, count: t.hidden === true ? 0 : t.count, ...(t.hidden === true ? { hiddenCount: t.count } : {}), ...behavior,
      cost: Math.floor((behavior.cost ?? stats.cost) * stageCardMultiplier(compiledRules, { profession: 'TRAP', position: token.position }, 'cost')),
      ...stageDeviceAttributes(compiledRules, t.unit_id, { hp: behavior.hp ?? stats.maxHp, def: stats.def ?? 0, block: stats.block,
        ...(behavior.atk != null ? { atk: behavior.atk } : {}) }, token.position),
      position: token.position, behavior: spec.behavior, obstacle: spec.obstacle,
    };
  });
  const fixedCards = [...(geometry.suppliedUnits?.fixed_squad ?? []),
    ...(waveProgram?.predefined?.entries ?? []).map(e => ({ unit_id: e.build.id }))];
  const supportForStage = Object.fromEntries(fixedCards
    .filter(card => !mvp.operators[card.unit_id] && supportOperators.operators[card.unit_id])
    .map(card => [card.unit_id, supportOperators.operators[card.unit_id]]));
  const stage = {
    code: source.code,
    name: source.name,
    description: source.description,
    battle: { ...source.battle, ...compiledRules?.battle },
    rules: compiledRules ?? undefined,
    ...(mode ? { mode } : {}),
    ...(water ? { water } : {}),
    ...(mire ? { mire } : {}),
    ...(reeds ? { reeds } : {}),
    ...(huiMing ? { huiMing } : {}),
    ...(waveProgram ? { waveProgram } : {}),
    ...(environment.length ? { environment: structuredClone(environment) } : {}),
    ...(Object.keys(enemyAliases).length ? { enemyAliases } : {}),
    mapTags: [],
    mapTagSource: null,
    geometry,
    terrain: compileStageTerrain(geometry),
    conditionalHandled: false,
    devices: devices.map(d => {
      const spec = stageDeviceSpec(d);
      // A level-placed drink machine (15-3, 15-7, 15-11) carries its reviewed device numbers; the battle places the
      // paired enemy as its fixed form when the wave action switches it on.
      if (spec?.prtsStatic) return { ...d, staticForm: prtsStaticForm(spec.prtsStatic) };
      // Excrescent Carapaces carry their original instance too (StageCarapaces reads d.instance).
      if (!spec?.carapace && !spec?.twigs && !spec?.powerArmor && !spec?.reward && !spec?.magicCircuit && !spec?.manual && !spec?.capturable && !spec?.electricCoil && !spec?.turret && !spec?.flowGenerator && !spec?.gramophone && !spec?.scenery && !spec?.demolition && !spec?.mine && !spec?.artillery && !spec?.flame && !spec?.guard && !spec?.shieldguard && !spec?.bloodAltar && !spec?.bombLoader && !spec?.bloodThrone && !spec?.lightOfGlory && !spec?.charlesLynch && !spec?.revenantGun && !spec?.revenantCore && !spec?.weakeningNode) return d;
      const instance = deviceInstances[spec.guard ? `${d.key}:${d.alias}` : `${d.key}:${d.row}:${d.col}`];
      if (spec.carapace) carapaceDefinition(instance);
      else if (spec.twigs) twigsDefinition(instance);
      else if (spec.powerArmor) powerArmorDeviceDefinition(d.key, instance);
      else if (spec.magicCircuit) magicCircuitDefinition(instance, d.key);
      else if (spec.reward) rewardDeviceDefinition(d.key, instance);
      else if (spec.mine) predefinedMineDefinition(instance);
      else if (spec.scenery) sceneryDefinition(d.key, instance);
      else if (spec.demolition) { if (!instance) throw Error('Missing original pillar instance'); }
      else if (spec.artillery) artilleryDefinition(instance);
      else if (spec.flame) flameDefinition(instance);
      else if (spec.guard) alladyDefinition(instance);
      else if (spec.shieldguard) shieldguardDefinition(instance);
      else if (spec.bloodAltar) bloodAltarDefinition(instance);
      else if (spec.bombLoader) bombLoaderDefinition(instance);
      else if (spec.bloodThrone) bloodThroneDefinition(instance);
      else if (spec.lightOfGlory) lightOfGloryDefinition(instance);
      else if (spec.charlesLynch) charlesLynchDefinition(instance);
      else if (spec.revenantGun) revenantGunDefinition(instance);
      else if (spec.weakeningNode) weakeningNodeDefinition(instance);
      else if (spec.revenantCore) revenantCoreDefinition(instance);
      else if (spec.gramophone) gramophoneDefinition(instance);
      else if (spec.flowGenerator) flowGeneratorDefinition(instance);
      else if (spec.turret) turretDefinition(instance);
      else if (spec.electricCoil) electricCoilDefinition(instance);
      else (spec.capturable ? capturableDeviceDefinition : manualDeviceDefinition)(d.key, instance);
      return { ...d, instance };
    }),
    tokens,
    operators: Object.keys(supportForStage).length ? supportForStage : undefined,
    pathing: {
      schemaVersion: 1,
      syntheticRoutes,
      producer: 'Arkpedia stage browser / buildPlaybackPaths',
      stage: source.code,
      geometryHash: createHash('sha256').update(JSON.stringify(geometry)).digest('hex'),
      moveScale: 0.65,
      paths,
    },
    art: null,
    gates: null,
    fixedSquad: null,
  };
  // The battle compiler and the supported-enemy gate are the same ones used by 0-1.
  const adapter = stageAdapter({ ...stage, waveProgram: resolveStageRandomWaves(stage.waveProgram) });
  if (stage.battle.max_play_time == null && (adapter.spawns.some(spawn => spawn.time >= 300)
    || stage.waveProgram?.waves.some(w => w.fragments.some(f => f.spawns.some(s => s.offset >= 300)))))
    throw Error('Missing original time limit for a wave scheduled beyond the legacy 300-second limit');
  stage.fixedSquad = adapter.fixedSquad;
  // The level file owns each enemy's database level and any attribute overrides
  // (stage geometry `enemyConfigurations`); the catalogue is the source record.
  const OVERRIDE = Object.freeze({ hp: 'maxHp', atk: 'atk', def: 'def', res: 'res', move_speed: 'moveSpeed',
    attack_interval: 'bat', attack_speed: 'aspd', weight: 'massLevel', range: 'rawRangeRadius', life_cost: 'lpr',
    taunt: 'tauntLevel', elemental_res: 'elementRes', elemental_damage_res: 'elementDmgRes', hpRecoveryPerSec: 'hpRecoveryPerSec' });
  for (const from of Object.keys(compiledRules?.enemyReplacements ?? {})) {
    if (Object.keys(configs.get(from)?.overrides ?? {}).length || enemyBlackboards[from])
      throw Error(`Unreviewed overrides on replaced enemy: ${from}`);
  }
  const configured = id => {
    const entry = records.enemies[id], config = configs.get(id), level = config?.database_level ?? 0;
    const original = entry?.levels[level];
    const base = original && applyStageEnemyBlackboard(original, enemyBlackboards[id]);
    if (!base) throw Error(`Missing enemy record: ${id}@${level}`);
    // Stage-local definitions were compiled in full from the original level;
    // the viewer's partial stat projection must not overwrite those records.
    if (Object.hasOwn(enemyAliases, id)) return base;
    if (!config?.overrides || !Object.keys(config.overrides).length) return base;
    const record = structuredClone(base), stats = record.stats;
    for (const [key, value] of Object.entries(config.overrides)) {
      // Some original maps restate all database attributes. Identical immunity
      // assertions are evidence, not a new status policy. Changed ones still
      // require a reviewed implementation rather than silently altering a kit.
      const immunity = { stunImmune: 'stun', silenceImmune: 'silence', sleepImmune: 'sleep',
        frozenImmune: 'frozen', levitateImmune: 'levitate' }[key];
      const extraImmunity = { disarmedCombatImmune: 'disarmedCombat', fearedImmune: 'feared',
        palsyImmune: 'palsy', attractImmune: 'attract', teleportImmune: 'teleport', groundBoundImmune: 'groundBound' }[key];
      if (typeof value === 'boolean' && (immunity && value === !!stats.immunities[immunity]
        || extraImmunity && value === stats.otherImmunities.includes(extraImmunity))) continue;
      if (key === 'spRecoveryPerSec' && !record.skills.length && record.sp?.maxSp === 0
        && record.sp.initSp === 0 && value === record.sp.increment) { stats.spRecoveryPerSec = value; continue; }
      if (!(key in OVERRIDE) || !Number.isFinite(value))
        throw Error(`Unsupported enemy override: ${id}.${key}`);
      const field = OVERRIDE[key];
      stats[field] = value;
      if (field === 'rawRangeRadius') stats.rangeRadius = record.applyWay === 'MELEE' ? 0 : Math.max(0, value);
    }
    return record;
  };
  const enemyIds = new Set();
  const addEnemy = id => {
    if (enemyIds.has(id)) return;
    if (!records.enemies[id]) throw Error(`Missing enemy record: ${id}`);
    if (!support.enemies[id]?.policy) throw Error(`Unsupported regular-stage enemy: ${id} (${support.enemies[id]?.reasons.join(', ')})`);
    enemyIds.add(id);
    for (const child of support.enemies[id].spawns ?? []) addEnemy(child);
  };
  for (const spawn of adapter.spawns) addEnemy(spawn.enemyKey);
  // The seeded validation adapter expands one choice. Published content must
  // still contain every candidate a different battle seed can select.
  for (const wave of waveProgram?.waves ?? []) for (const fragment of wave.fragments) for (const spawn of fragment.spawns)
    addEnemy(stageEnemyKey(compiledRules, spawn.enemyKey));
  for (const branch of Object.values(waveProgram?.branches ?? {})) for (const spawn of branchSpawns(branch))
    addEnemy(stageEnemyKey(compiledRules, spawn.enemyKey));
  for (const token of tokens) for (const child of STAGE_TOKEN_UNITS[token.unitId]?.spawns ?? []) addEnemy(child);
  for (const child of stageEnvironmentEnemyDependencies(environment)) addEnemy(child);
  for (const device of devices) for (const child of stageDeviceSpec(device)?.spawns ?? []) addEnemy(child);
  stage.enemies = Object.fromEntries([...enemyIds].map(id => [id, enemyRuntimeRecord(configured(id))]));
  for (const id of Object.keys(compiledRules?.enemyScoped ?? {}))
    if (!records.enemies[id]) throw Error(`Unknown enemy in stage rule: ${id}`);
  for (const id of [...Object.keys(compiledRules?.enemyDynamicAbilities ?? {}), ...Object.keys(compiledRules?.enemyScopedAdd ?? {})])
    if (!records.enemies[id] || !support.enemies[id]?.policy) throw Error(`Unsupported stage enemy modifier target: ${id}`);
  for (const id of new Set([...Object.keys(compiledRules?.enemyTalentScoped ?? {}), ...Object.keys(compiledRules?.enemyTalentAddScoped ?? {})])) {
    if (!records.enemies[id] || !support.enemies[id]?.policy) throw Error(`Unsupported enemy talent rule target: ${id}`);
    // Validate even a source target not present in this stage's waves.
    applyStageEnemyTalentMultipliers(stage.enemies[id] ?? records.enemies[id].levels[0], compiledRules.enemyTalentScoped?.[id], compiledRules.enemyTalentAddScoped?.[id]);
  }
  for (const [id, multiplier] of Object.entries(compiledRules?.enemySkillRadiusScoped ?? {})) {
    if (!records.enemies[id] || !support.enemies[id]?.policy) throw Error(`Unsupported enemy skill-radius target: ${id}`);
    applyStageEnemySkillRadius(stage.enemies[id] ?? records.enemies[id].levels[0], multiplier);
  }
  for (const [id, skills] of Object.entries(compiledRules?.enemySkillScoped ?? {})) {
    if (!records.enemies[id] || !support.enemies[id]?.policy) throw Error(`Unsupported enemy skill target: ${id}`);
    applyStageEnemySkillMultipliers(stage.enemies[id] ?? records.enemies[id].levels[0], skills);
  }
  if (compiledRules) for (const [id, original] of Object.entries(stage.enemies)) {
    const multipliers = { ...compiledRules.enemyTalentScoped?.[id] };
    for (const [key, scale] of Object.entries(compiledRules.enemyTalentGlobal ?? {}))
      if (Object.hasOwn(original.talents.bb, key)) multipliers[key] = (multipliers[key] ?? 1) * scale;
    const record = applyStageEnemySkillCooldown(applyStageEnemySkillRadius(applyStageEnemySkillMultipliers(applyStageEnemyTalentMultipliers(original, multipliers, compiledRules.enemyTalentAddScoped?.[id]), compiledRules.enemySkillScoped?.[id]),
      compiledRules.enemySkillRadiusScoped?.[id]), compiledRules.enemySkillCooldownScale);
    for (const [key, multiplier] of Object.entries(compiledRules.enemies)) record.stats[key] *= multiplier;
    for (const [key, multiplier] of Object.entries(compiledRules.enemyScoped?.[id] ?? {})) record.stats[key] *= multiplier;
    for (const [key, amount] of Object.entries(compiledRules.enemyAdd)) record.stats[key] += amount;
    for (const [key, amount] of Object.entries(compiledRules.enemyScopedAdd?.[id] ?? {})) record.stats[key] += amount;
    if (compiledRules.enemyDynamicAbilities?.[id]?.includes('silenceimmue'))
      record.stats.immunities = { ...record.stats.immunities, silence: true };
    stage.enemies[id] = record;
  }
  for (const record of Object.values(stage.enemies)) for (const key of stageEnemyTokenDependencies(record))
    if (stage.tokens.filter(t => t.unitId === key).length !== 1) throw Error(`Missing or ambiguous enemy supply card: ${record.key} -> ${key}`);
  // A global rune may mention a talent absent from this level (11-5 includes
  // Rot Eater parameters without any Rot Eater). The complete spawn/child
  // closure above owns the only candidate records. Absent keys are no-ops;
  // every matching key still requires its feature's multiplier declaration.
  assertRegularEnemies({ ...mvp, enemies: stage.enemies, stage });
  return stage;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = Object.fromEntries(process.argv.slice(2).flatMap((arg, i, all) =>
    arg.startsWith('--') ? [[arg.slice(2), all[i + 1]]] : []));
  for (const key of ['stage', 'geometry', 'out']) if (!args[key]) throw Error(`Missing --${key}`);
  if (args.allowConditional) throw Error('Conditional spawns require an implemented controller; bypassing validation is not supported');
  const read = async file => JSON.parse(await readFile(file, 'utf8'));
  const [source, geometry, playback, mvp, records, support, tokenData, supportOperators] = await Promise.all([
    read(args.stage), read(args.geometry), args.playback ? read(args.playback) : {},
    ...['arkpedia-mvp', 'arkpedia-enemy-records', 'arkpedia-enemy-support', 'arkpedia-deployable-tokens',
      'arkpedia-support-operators'].map(name => read(new URL(`../../data/${name}.json`, import.meta.url))),
  ]);
  const conditionalPath = args.conditional ?? join(dirname(args.geometry), '..', 'stage-conditional', basename(args.geometry));
  const conditional = existsSync(conditionalPath) ? await read(conditionalPath) : [];
  const devicePath = join(dirname(args.stage), '..', 'stage-devices.json');
  const deviceIndex = existsSync(devicePath) ? await read(devicePath) : {};
  const baseSlug = source.slug.replace(/_(challenge_mode|six_star|adverse_environment)$/, '');
  let devices = deviceIndex[source.geometryKey ?? source.slug] ?? deviceIndex[baseSlug] ?? [];
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const rules = args.rules ? await read(args.rules) : (await loadStageRuleReceipt(root, source.slug)).receipt;
  const { overrides: enemyBlackboards, attributes: enemyAttributes } = await prepareStageEnemyBlackboards({ root, rules });
  const { environment } = await prepareStageEnvironments({ root, rules });
  await prepareStageSupplyCards({ root, rules, geometry, compiledRules: compileStageRules(source, rules) });
  const deviceInstances = {};
  ({ devices } = await prepareStageDeviceInstances({ root, rules, compiledRules: compileStageRules(source, rules), devices, instances: deviceInstances }));
  const { reeds } = await prepareStageReeds({ root, rules, compiledRules: compileStageRules(source, rules), geometry });
  const { huiMing } = await prepareStageHuiMing({ root, geometry });
  const { mire } = await prepareStageMire({ root, rules, geometry, devices });
  const { water } = await prepareStageWater({ root, rules, geometry, devices });
  const stage = compileStage({ source, geometry, playback, mvp, records, support, tokenData, supportOperators, devices, deviceInstances, conditional, rules, environment, water, mire, reeds, huiMing, enemyBlackboards, enemyAttributes });
  await writeFile(args.out, JSON.stringify(stage, null, 1) + '\n');
  console.log(`Built ${stage.code}: ${stage.geometry.rows}x${stage.geometry.cols}, ${stage.geometry.waves.length} waves, ${Object.keys(stage.enemies).length} enemies -> ${args.out}`);
}
