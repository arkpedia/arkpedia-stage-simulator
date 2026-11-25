import { deviceRuntimeFor } from './content/arkpedia-device-runtime.js';
import { stageEnemyKey } from '../../shared/arkpedia/stage-rules.js';
import { readStageOutcomes } from './content/arkpedia-stage-outcomes.js';
import { spawnWitheredAltar } from './content/arkpedia-stage-withered-altars.js';
import { altarSelectsUnit } from '../../shared/arkpedia/device-runtime.js';
import { installStageWorker } from './content/arkpedia-stage-workers.js';
import { installStageMine, installPredefinedMines } from './content/arkpedia-stage-mines.js';
import { installRangeSupply } from './content/arkpedia-stage-range-supplies.js';
import { startStunToken } from './content/arkpedia-stage-supply-tokens.js';
import { installNativeStageRules } from './content/arkpedia-stage-native-rules.js';
import { stageDeviceAttributes } from '../../shared/arkpedia/stage-character-attributes.js';
import { registerOriginiumPollution } from './content/arkpedia-originium-pollution.js';
// SPDX-License-Identifier: GPL-3.0-or-later
// Standard-stage commands around Stronghold's combat primitives. Nothing in this module enters the private host.
import { customizeRegularOperator, installRegularOperator, operatorServicesFor } from './content/arkpedia-operator-runtime.js';
import { installStageTerrain } from './content/arkpedia-stage-terrain.js';
import { installStageEnvironments } from './content/arkpedia-stage-environments.js';
import { stageCardBaseCost, stageCardRespawnTime } from './content/arkpedia-stage-card-cost.js';
import { stageCardDeploymentBlocked } from '../../shared/arkpedia/stage-card-rules.js';
import { cardLockError } from './content/arkpedia-card-locks.js';
import { cardRedeployRatio } from './content/arkpedia-card-redeploy.js';
import { forbiddenStageTiles, stageBuildableType } from '../../shared/arkpedia/stage-deployment-tiles.js';
import { excludedStageOperators, stageSquadLimit, stageUsesFixedSquad } from '../../shared/arkpedia/stage-roster.js';
import { Battle } from './BattleCore.js';
import { RegularDisplacement } from './regular-displacement.js';
import { StageWaveScheduler, stageWaveSpawns } from './content/arkpedia-stage-waves.js';
import { StageBranchScheduler } from './content/arkpedia-stage-branches.js';
import { resolveStageRandomWaves } from './content/arkpedia-stage-random.js';
import { stageRouteClockWaits } from '../../shared/arkpedia/stage-path.js';
import { SkillRuntime } from './skills.js';
import { applyStageModeRules } from '../../shared/arkpedia/stage-mode-rules.js';
import { DataSource } from './simdata.js';
import { genericKit } from './content/generic.js';
import { elem } from './content/arkpedia-enemy-effects.js';
import { regularDpMinimum, canSpendDp, spendDp, regularDpRecoveryForStep } from './content/arkpedia-dp-budget.js';
import { regularModelKey } from '../../shared/arkpedia/facing.js';
import { selectedRegularSummon } from './content/arkpedia-summon-deck.js';
import { assertClosurEnemyCompatibility } from '../../shared/arkpedia/closur-enemy-compatibility.js';
import { catalogueFor, recordFor, fixedSquadBuilds } from '../../shared/arkpedia/loadout.js';
import { REGULAR_OPERATORS } from '../../shared/arkpedia/operator-support.js';
import { assertRegularEnemies } from '../../shared/arkpedia/enemies.js';
import { installEnemyFeatures,enemyRuntimeFor } from './content/arkpedia-enemy-runtime.js';
import { sealsStageRoute } from './content/arkpedia-stage-route-blocking.js';
import { StageReeds } from './content/arkpedia-stage-reeds.js';
import { installHuiMingTiles } from './content/arkpedia-hui-ming-tiles.js';
import { validateHuiMingProgram } from '../../shared/arkpedia/stage-hui-ming.js';
import { StageMire } from './content/arkpedia-stage-mire.js';
import { StageWater } from './content/arkpedia-stage-water.js';
import { configureStageObstacle } from './content/arkpedia-stage-obstacles.js';
import { sceneryDefinition, alladyDefinition } from '../../shared/arkpedia/device-runtime.js';
import { installAllerdaleGuard } from './content/arkpedia-stage-allerdale.js';
import { stageDeviceSpec, STAGE_TOKEN_UNITS, pulseTiles, artilleryTiles, artilleryDefinition } from '../../shared/arkpedia/device-runtime.js';
import { compileBuffTemplate } from '../../shared/arkpedia/behavior.js';
import { prepareSquad, canDeployInViewport } from '../../shared/arkpedia/squad.js';

export function stageAdapter(source) {
  const devices = (source.devices ?? []).filter(d => d.kind === 'device' && !String(d.key).startsWith('char_'));
  const unsupported = devices.filter(d => !stageDeviceSpec(d));
  if (unsupported.length) throw new Error(`Unsupported stage devices: ${[...new Set(unsupported.map(d => d.name))].join(', ')}`);
  const g = source.geometry;
  const fixedSquad = !Array.isArray(g.suppliedUnits) && g.suppliedUnits?.fixed_squad?.length
    ? g.suppliedUnits.fixed_squad : null;
  const tokenCards = Array.isArray(g.suppliedUnits) ? [] : (g.suppliedUnits?.deployable_tokens ?? []).filter(t => t.count !== 0);
  const unsupportedTokens = tokenCards.filter(t => !STAGE_TOKEN_UNITS[t.unit_id]);
  if (unsupportedTokens.length) throw new Error(`Unsupported stage tokens: ${[...new Set(unsupportedTokens.map(t => t.unit_id))].join(', ')}`);
  if (g.rows > 19 || g.cols > 21 || (g.hasConditionalSpawns && !source.conditionalHandled))
    throw new Error("Unsupported stage mechanics");
  const baseChars = ["#", "h", "r", "S", "E"];
  const chars = g.tileLegend.map((_, i) => baseChars[i] ?? String.fromCharCode(65 + i - baseChars.length));
  const legend = Object.fromEntries(
    g.tileLegend.map((t, i) => [
      chars[i],
      {
        height: t.height.toUpperCase(),
        build: stageBuildableType(t.deployable),
        pass: t.walkable ? "ALL" : t.flyable ? "FLY" : "NONE",
        key: t.key,
      },
    ]),
  );
  const tileChars = g.tileGrid.map(row => row.map(t => chars[t]));
  for (const [i, device] of devices.entries()) {
    const tile = stageDeviceSpec(device)?.tile;
    // A branch-activated device changes its tile only when it appears (activateStagePredefined).
    if (!tile || device.branchActivated && device.hidden) continue;
    if (!Number.isInteger(device.row) || !Number.isInteger(device.col) || !tileChars[device.row]?.[device.col])
      throw Error('Invalid device position');
    const old = tileChars[device.row][device.col], code = String.fromCharCode(0xe000 + i);
    legend[code] = { ...legend[old], ...tile };
    tileChars[device.row][device.col] = code;
  }
  for (const [i, { row, col }] of forbiddenStageTiles(source).entries()) {
    const old = tileChars[row][col], code = String.fromCharCode(0xf000 + i);
    legend[code] = { ...legend[old], build: 'NONE' };
    tileChars[row][col] = code;
  }
  const pair = (p) => [p.row, p.col];
  const pollution = [];
  g.tileGrid.forEach((row, r) => row.forEach((type, c) => {
    if (String(g.tileLegend[type]?.key ?? '').includes('toxic')) pollution.push([r, c]);
  }));
  // A route no wave spawns on never has to walk, so a viewer export may omit it. Only refuse a missing path
  // for a route the stage actually uses.
  const usedRoutes = new Set(g.waves.flatMap(wave => (wave.spawns || []).map(spawn => spawn.route)));
  for (const branch of Object.values(source.waveProgram?.branches ?? {})) for (const spawn of branch.spawns) usedRoutes.add(spawn.routeIndex);
  const routes = g.routes.map((route, index) => {
    if (!route || route.placeholder)
      return { start: [0, 0], end: [0, 0], checkpoints: [] };
    const path = source.pathing?.paths?.[index];
    if (!path && !usedRoutes.has(index))
      return { motion: route.motion, start: pair(route.start), end: pair(route.end), checkpoints: [] };
    if (path) {
      // A viewer break is a tunnel: disappear at the entrance point, wait the reviewed tunnel hold, then
      // appear at the first point after the break. The engine's DISAPPEAR/APPEAR legs already hide and teleport.
      const tunnels = new Map(), appears = (route.checkpoints ?? []).filter((c) => c.type === "appear_at_pos");
      for (const at of path.breaks) {
        const hold = path.holds.find((h) => h.tunnel && h.at === path.distances[at - 1]);
        if (hold) { tunnels.set(at, hold); continue; }
        // A viewer break with no tunnel hold is a teleport (`appear_at_pos`): keep it only when the level
        // geometry names that exact appear point, then use a zero-second DISAPPEAR/WAIT/APPEAR pair.
        const [col, row] = path.points[at] ?? [];
        if (!appears.some((c) => c.position.row === row && c.position.col === col)) throw new Error("Unsupported route tunnel");
        tunnels.set(at, { seconds: 0, synthetic: true });
      }
      for (const hold of path.holds.filter((h) => h.tunnel)) {
        const at = path.distances.findIndex((distance) => distance === hold.at) + 1;
        if (!tunnels.has(at)) throw new Error("Unsupported route tunnel");
      }
      const checkpoints = [];
      const clockWaits = source.waveProgram ? stageRouteClockWaits(route, path) : new Map();
      path.points.forEach(([col, row], at) => {
        if (at > 0) checkpoints.push(tunnels.has(at) ? { type: "APPEAR", pos: [row, col] } : { type: "MOVE", pos: [row, col] });
        checkpoints.push(...(clockWaits.get(at) ?? []));
        for (const hold of path.holds.filter(
          (h) => h.at === path.distances[at] && !h.tunnel && !clockWaits.has(at),
        ))
          checkpoints.push({
            type: "WAIT",
            pos: [row, col],
            time: hold.seconds,
          });
        const nextTunnel = tunnels.get(at + 1);
        if (nextTunnel) {
          checkpoints.push({ type: "DISAPPEAR" });
          checkpoints.push({ type: "WAIT", pos: [row, col], time: nextTunnel.seconds });
        }
      });
      return {
        motion: route.motion,
        start: pair(route.start),
        end: pair(route.end),
        checkpoints,
      };
    }
    throw new Error("Missing stage viewer path for route " + index);
  });
  // Compatibility for old snapshots. The viewer already includes pre_delay in
  // spawn times and both delays in duration. New graphs retain original fragments.
  let cursor = 0;
  const spawns = g.waves.flatMap((wave) => {
    const waveStart = cursor;
    const out = (wave.spawns || []).flatMap((s) =>
      Array.from({ length: Math.max(1, s.count || 1) }, (_, i) => ({
        enemyKey: stageEnemyKey(source.rules, s.enemy_id),
        time: waveStart + (s.time || 0) + i * (s.interval || 0),
        routeIndex: s.route,
        ownerPlayerId: "arkpedia",
      })),
    );
    cursor = waveStart + (wave.duration || 0);
    return out;
  }).sort((a, b) => a.time - b.time);
  return {
    fixedSquad,
    stage: {
      id: source.code,
      tokens: source.tokens ?? [],
      rows: tileChars.map(row => row.join("")),
      legend,
    },
    rect: { r0: 0, r1: g.rows - 1, c0: 0, c1: g.cols - 1 },
    routes,
    spawns: source.waveProgram ? stageWaveSpawns(source.waveProgram, source.rules) : spawns,
  };
}

export class StandardBattle extends Battle {
  constructor(data, selection, { seed = 1, operatorRuntime = null, enemyRuntime = null, deviceRuntime = null } = {}) {
    data = applyStageModeRules(data, selection?.modeRules);
    const waveProgram = resolveStageRandomWaves(data.stage.waveProgram, seed);
    if (waveProgram !== data.stage.waveProgram) data = { ...data, stage: { ...data.stage, waveProgram } };
    if (data.stage?.operators) data = { ...data, operators: { ...data.operators, ...data.stage.operators } };
    assertRegularEnemies(data);
    enemyRuntime=enemyRuntimeFor(enemyRuntime);
    enemyRuntime.assertPrepared(data.enemies);
    deviceRuntime=deviceRuntimeFor(deviceRuntime);
    deviceRuntime.assertPrepared(data.stage);
    const predefined = data.stage.waveProgram?.predefined?.entries;
    const fixed = stageUsesFixedSquad(data.stage)
      ? predefined ? predefined.filter(e => e.kind === 'card').map(e => e.build) : fixedSquadBuilds(data) : null;
    const squad = fixed ? null : prepareSquad(selection, catalogueFor(data));
    const chosenBuilds = fixed ?? [
      ...squad.operators,
      ...(squad.support ? [squad.support] : []),
    ];
    if (chosenBuilds.length > stageSquadLimit(data.stage)) throw Error(`This stage allows at most ${stageSquadLimit(data.stage)} operators, including support.`);
    const builds = [...chosenBuilds, ...(predefined ?? []).filter(e => e.kind === 'actor').map(e => e.build)];
    operatorRuntime?.assertPrepared(builds.map(build => build.id));
    const services = operatorServicesFor(builds.map(build => build.id), operatorRuntime);
    const excluded = excludedStageOperators(data.stage, data.operators);
    for (const build of chosenBuilds) if (excluded.has(build.id))
      throw Error(`This stage excludes ${data.operators[build.id]?.name ?? build.id}.`);
    if (new Set(builds.map(b => b.id)).size !== builds.length) throw Error('Selected squad duplicates a preplaced operator');
    if (builds.some(b => b.id === 'char_4228_closur' && b.skillId === 'skchr_closur_3'))
      assertClosurEnemyCompatibility(data);
    const chess = Object.fromEntries(
      builds.map((b) => [b.id, recordFor(b, data)]),
    );
    // Compile and validate before the battle starts or any DP/SP is spent.
    const behaviors = new Map();
    for (const build of builds) {
      const support = REGULAR_OPERATORS[build.id];
      if (!support.templateKey) continue;
      const level = data.operators[build.id].skills.find(skill => skill.id === build.skillId)?.levels[build.skillRank - 1];
      if (level.prefabId !== support.prefabId)
        throw Error(`Unsupported regular-stage skill prefab: ${level.prefabId}`);
      const program = compileBuffTemplate(data.behaviors?.templates?.[support.templateKey]);
      if (program.key !== support.templateKey) throw Error('Behaviour template key mismatch');
      program.validateBlackboard(chess[build.id].skill.bb);
      behaviors.set(build.id, program);
    }
    const stageInitialCosts = new Map(Object.entries(chess).map(([id, record]) => [id, record.baseCardStats?.cost ?? record.stats.cost]));
    const startingVanguardDp = services.prepareFiveStarVanguardSquad(chess);
    services.prepareFiveStarSniperSquad(chess);
    services.prepareRosaSquad(chess);
    services.prepareNianSquad(chess);
    services.prepareSpecterAlterSquad(chess);
    const config = data.stage.battle;
    if (config.max_play_time != null && config.max_play_time !== -1
      && !(Number.isFinite(config.max_play_time) && config.max_play_time > 0)) throw Error('Invalid stage time limit');
    super({
      ...stageAdapter(data.stage),
      seed,
      data: new DataSource({ chess, enemies: Object.fromEntries(Object.entries(data.enemies)
        .map(([id, record]) => [id, enemyRuntime.record(record)])), tokens: data.tokens }),
      content: "none",
      timeLimit: config.max_play_time === -1 ? Infinity : (config.max_play_time ?? 300),
      flags: {
        layerGainsEnabled: false,
        dpInit: config.initial_dp,
        dpMax: config.max_dp,
        ...(Number.isSafeInteger(config.max_dp_ceil) ? { dpMaxCeil: config.max_dp_ceil } : {}),
        dpPerSec: config.dp_per_second,
        startOpCooldown: 0,
        moveScale: data.stage.pathing?.moveScale ?? 0.65,
      },
      players: [
        { playerId: "arkpedia", side: "L", coords: "field", units: [] },
      ],
    });
    this.operatorRuntime = operatorRuntime;
    this.enemyRuntime = enemyRuntime;
    this.deviceRuntime = deviceRuntime;
    this.operatorServices = services;
    this.regularDisplacement = new RegularDisplacement(this);
    this.stageForbiddenTiles = new Set(forbiddenStageTiles(data.stage).map(p => `${p.row},${p.col}`));
    this.modeRules = data.modeRules ?? null;
    this.stageCardRules = data.stage.rules;
    this.stageGroundRoutes = data.stage.geometry.routes;
    this.stageInitialCosts = stageInitialCosts;
    this.regularReviewCandidates = Object.freeze([...(data.reviewCandidates ?? [])]);
    this.life = config.max_life;
    this.regularModels = data.sd?.models ?? {};
    // Source team membership (e.g. Ursus Student Self-Governing Group) for team-scoped effects.
    this.regularTeams = Object.freeze(Object.fromEntries(Object.values(data.operators ?? {}).map(o => [o.id, o.teamId ?? null])));
    this.regularNations = Object.freeze(Object.fromEntries(Object.values(data.operators ?? {}).map(o => [o.id, o.nationId ?? null])));
    this.regularFactionTags = Object.freeze(Object.fromEntries(Object.values(data.operators ?? {}).map(o =>
      [o.id, Object.freeze([...(o.factionTags ?? [o.nationId, o.groupId, o.teamId].filter(t => typeof t === 'string' && t))])])));
    this.regularSkillUses = new Map();
    // Approved enemy feature traits (shared/arkpedia/enemy-features.js) apply at spawn.
    installEnemyFeatures(this);
    installNativeStageRules(this, data.stage.rules);
    installStageTerrain(this, data.stage.terrain);
    this.addDp('arkpedia', startingVanguardDp);
    services.installMedicSquad({ battle: this, records: chess });
    services.installGuardSixStarSquad({ battle: this, records: chess });
    services.installBagpipeSquad({ battle: this, records: chess });
    services.installRadiantKnightSquad({ battle: this, records: chess });
    services.installLapplandSquad({ battle: this, records: chess });
    // The road talent scans initial terrain even when Thorns deploys much later.
    services.captureThornsRoads(this);
    this.behaviors = behaviors;
    this.mvpStageDevices = (data.stage.devices ?? [])
      .filter(d => d.kind === 'device' && stageDeviceSpec(d))
      .map(d => {
        // The artillery's cost and starting SP follow its original skill level (stage-artillery.js).
        const gun = stageDeviceSpec(d).artillery ? { ...stageDeviceSpec(d).artillery, ...artilleryDefinition(d.instance) } : null;
        return { ...d, sp: gun?.initSp ?? 0, acc: 0, active: !((d.branchActivated || d.scheduledActivation) && d.hidden), ...(gun ? { artillery: gun } : {}) };
      });
    const pollution = [];
    data.stage.geometry.tileGrid.forEach((row, r) => row.forEach((type, c) => {
      if (String(data.stage.geometry.tileLegend[type]?.key ?? '').includes('toxic')) pollution.push([r, c]);
    }));
    this.mvpStagePollution = new Set(pollution.map(([r, c]) => `${r},${c}`));
    for (const d of this.mvpStageDevices) {
      const spec = stageDeviceSpec(d)?.environment;
      if (spec) registerOriginiumPollution(this, { id: d, kind: 'tile', damage: spec.damage,
        spRatio: spec.spMul - 1, interval: spec.interval,
        contains: u => this.mvpStagePollution.has(`${Math.round(u.y)},${Math.round(u.x)}`) });
    }
    this.stageTokenReadyAt = new Map();
    this.mvpStageTokens = new Map((data.stage.tokens ?? []).map(t => [t.unitId, t.count]));
    if (this.mvpStageDevices.length) this.on('tick', ({ dt }) => this._tickMvpStageDevices(dt));
    this._installUnitStageDevices(data.stage.devices ?? []);
    this.manualStageDevices = deviceRuntime.create('manual', this, data.stage);
    this.capturableStageDevices = deviceRuntime.create('capturable', this, data.stage);
    this.electricCoils = deviceRuntime.create('coils', this, data.stage);
    this.stageTurrets = deviceRuntime.create('turrets', this, data.stage);
    this.stageFlames = deviceRuntime.create('flames', this, data.stage);
    this.stageShieldguards = deviceRuntime.create('shieldguards', this, data.stage);
    this.stageMagicCircuit = deviceRuntime.create('magicCircuit', this, data.stage);
    installStageEnvironments(this, data.stage.environment);
    this.stageFlowGenerators = deviceRuntime.create('flow', this, data.stage);
    this.stageGramophones = deviceRuntime.create('gramophones', this, data.stage);
    this.stageDemolition = deviceRuntime.create('demolition', this, data.stage);
    this.stageCarapaces = deviceRuntime.create('carapaces', this, data.stage);
    this.stageScenery = deviceRuntime.create('scenery', this, data.stage);
    this.stageBranches = new StageBranchScheduler(this, data.stage.waveProgram?.branches, data.stage.rules);
    this.stageBloodAltars = deviceRuntime.create('bloodAltars', this, data.stage);
    this.stagePowerArmor = deviceRuntime.create('powerArmor', this, data.stage);
    this.stageTwigs = deviceRuntime.create('twigs', this, data.stage);
    this.stageRewardDevices = deviceRuntime.create('rewards', this, data.stage);
    installPredefinedMines(this, data.stage.devices ?? []);
    this._installHighTide(data.stage.tide);
    this._installDeepWater(data.stage.deepWater);
    this.stageReeds = data.stage.reeds ? new StageReeds(this, data.stage.reeds) : null;
    // Hui-Ming mark and switch tiles: one battle-level controller over the shared attribute account.
    if (data.stage.huiMing) { const p = validateHuiMingProgram(data.stage.huiMing); installHuiMingTiles(this, { marks: p.marks, switches: p.switches, interval: p.scanInterval }); }
    this.stageMire = data.stage.mire ? new StageMire(this, data.stage.mire) : null;
    this.stageWater = data.stage.water ? new StageWater(this, data.stage.water) : null;
    this.unitLimit = config.unit_limit;
    this.regularMapSize = Object.freeze({ rows: data.stage.geometry.rows, cols: data.stage.geometry.cols });
    this.mapTags = Object.freeze([...(data.stage.mapTags ?? [])]);
    this.viewport = "preview";
    this.bench = Object.fromEntries(
      builds.map((b) => [
        b.id,
        { build: b, unit: null, deployments: 0, readyAt: 0, lastCost: 0 },
      ]),
    );
    services.installSelectedClosurRoster(this, builds);
    services.installShuRoster({ battle: this, records: chess });
    services.installMarcilSquad(this);
    services.installPublicMuelsyseSquad(this);
    this.stagePredefined = new Map((predefined ?? []).map(e => [e.key, { ...e, activated: false }]));
    for (const entry of this.stagePredefined.values()) Object.assign(this.bench[entry.build.id], {
      hidden: entry.kind === 'actor' || entry.hidden, noCard: entry.kind === 'actor', disableSkill: !!entry.disableSkill,
    });
    for (const entry of this.stagePredefined.values()) if (entry.kind === 'actor' && !entry.hidden) this.activateStagePredefined(entry.key);
    if (data.stage.waveProgram) this.stageWaveScheduler = new StageWaveScheduler(this, data.stage.waveProgram);
    this.start();
  }
  _processSpawns() {
    if (!this.stageWaveScheduler) return super._processSpawns();
    // Each successful transition advances a wave/fragment or arms it. Bound
    // same-tick work by the finite program rather than an arbitrary timer loop.
    const scheduler = this.stageWaveScheduler;
    for (let i = 0; i < scheduler.transitionLimit; i++) {
      super._processSpawns();
      if (!scheduler.advance()) break;
    }
  }
  _hasPendingEnemySchedules() {
    return (this.stageWaveScheduler && !this.stageWaveScheduler.done) || super._hasPendingEnemySchedules();
  }
  setViewport(viewport) {
    this.viewport = viewport;
  }
  activateStagePredefined(key) {
    if (this.stageTwigs?.activate(key)) return;
    if (this.stageTurrets?.activate(key)) return;
    if (this.stageFlames?.activate(key)) return;
    if (this.stageShieldguards?.activate(key)) return;
    const crystal = this.mvpStageDevices?.find(d => d.alias === key && d.branchActivated && stageDeviceSpec(d)?.statusPulse);
    if (crystal) {
      if (crystal.active) return;
      crystal.active = true; crystal.sp = 0;
      const tile = stageDeviceSpec(crystal).tile;
      if (tile) this.grid.setTile(crystal.row, crystal.col, { ...this.grid.tile(crystal.row, crystal.col), ...tile });
      this.fx?.('explode', { x: crystal.col, y: crystal.row, r: 1, kind: 'cold' });
      return;
    }
    if (this.stageRewardDevices?.activate(key)) return;
    // A hidden supply card: its stock arrives once, when the wave action reveals it (TR-8's crates).
    const supply = (this.stage.tokens ?? this.stage.raw?.tokens ?? []).find(t => t.unitId === key && t.hiddenCount > 0);
    if (supply) { if (!this.revealedStageCards?.has(key)) { (this.revealedStageCards ??= new Set()).add(key); this.grantStageToken(key, supply.hiddenCount); } return; }
    // A scheduled artillery: it starts charging from its starting SP when switched on.
    const gun = this.mvpStageDevices?.find(d => d.alias === key && d.scheduledActivation && d.artillery);
    if (gun) { gun.active = true; return; }
    // A hidden Allerdale's Guard (11-19): it appears on its tile and runs its instance's skill (stage-allerdale.js).
    const guard = this.mvpStageDevices?.find(d => d.alias === key && d.hidden && (d.branchActivated || d.scheduledActivation)
      && stageDeviceSpec(d)?.guard);
    if (guard) {
      if (guard.active) return;
      guard.active = true;
      const def = alladyDefinition(guard.instance);
      const unit = this.spawnDevice('device:trap_087_allady', guard.row, guard.col, { hp: def.hp, blockCnt: def.block, obstacle: false,
        name: "Allerdale's Guard" });
      if (unit) installAllerdaleGuard(this, unit, def, guard.instance.direction);
      return;
    }
    const entry = this.stagePredefined.get(key);
    if (!entry) throw Error(`Unknown predefined operator: ${key}`);
    if (entry.activated) return;
    const card = this.bench[entry.build.id];
    if (entry.kind === 'actor') this._deployOperator(entry.build.id, entry.row, entry.col, entry.direction, { fromSkill: true, predefined: true });
    card.hidden = false; entry.activated = true;
  }
  get dp() {
    return this.getPlayer("arkpedia").dp;
  }
  dpMinimumFor(ownerId = 'arkpedia') { return regularDpMinimum(this, ownerId); }
  dpRecoveryForStep(ownerId, dt) { return regularDpRecoveryForStep(this, ownerId, dt); }
  isUnitInBornState(unit) {
    if (!unit?.alive || !unit.deployed) return false;
    // Selected native controllers may advertise a more specific FSM endpoint.
    // Otherwise follow the same reviewed deployment clip shown by the viewer.
    // This source-backed visual observer does not claim compiled Unity BORN parity.
    const explicit = unit.mem.regularBornUntil;
    if (Number.isFinite(explicit)) return this.time + 1e-9 < explicit;
    const model = this.regularModels?.[regularModelKey(unit)], clip = model?.animationRoles?.deploy;
    const duration = model?.animations?.[clip];
    return Number.isFinite(duration) && duration > 0 && this.time + 1e-9 < unit.deployedAt + duration;
  }
  dpRecoveryRateFor(ownerId = 'arkpedia') {
    if ((this.flags.dpRegenHaltUntil ?? 0) > this.time) return 0;
    const scale = this.allyUnits.filter(u => u.ownerId === ownerId && u.alive && u.deployed && !u.hidden)
      .reduce((n, u) => n * (u.mem.regularDpRegenScale ?? 1), 1);
    return this.flags.dpPerSec * scale;
  }
  deployedSlots() {
    return this.allyUnits.filter(unit => unit.alive && unit.deployed)
      .reduce((slots, unit) => slots + (unit.deploymentSlotCost ?? 1), 0);
  }
  deploymentSlotCost(id) {
    if (id === 'char_4087_ines' && this.bench[id]?.build.skillId === 'skchr_ines_3'
      && !this.inesState?.firstUsed) return 0;
    const config = REGULAR_OPERATORS[id];
    if (config?.deploymentSlotExemptSkillIds?.includes(this.bench[id]?.build.skillId)) return 0;
    return (this.bench[id]?.build.elite ?? 0) >= (config?.deploymentSlotExemptMinElite ?? 0)
      && config?.deploymentSlotExemptTags?.some(tag => this.mapTags.includes(tag))
      ? 0 : config?.deploymentSlotCost ?? 1;
  }
  cost(id) {
    const entry = this.bench[id];
    if (!entry) return Infinity;
    // An owner may swap a card's base cost until its next deployment (SilverAsh the Reignfrost's S3).
    const ordinary = Math.floor((entry.baseCost ?? stageCardBaseCost(this, this.data.getChess(id)))
      // An owner may keep its redeployment cost unchanged (Violet Mizutsune Orchid).
      * Math.min(2, 1 + (entry.noCostIncrease ? 0 : entry.deployments) * 0.5));
    const vanguard = this.operatorServices.adjustFiveStarVanguardSecondCost(this, id, ordinary);
    const discounted = this.operatorServices.adjustInesCost(this, id, this.operatorServices.adjustAshCost(this, id, this.operatorServices.adjustFangFireSharpenedCost(this, id, this.operatorServices.adjustSaileachCost(this, id, this.operatorServices.adjustJieyunCost(this, id, vanguard)))));
    // Content card discounts (e.g. Matsukiri): a per-card delta kept until that operator deploys.
    return Math.max(0, this.operatorServices.adjustMuelsyseSquadCost(this, id, discounted) + (entry.costDelta ?? 0));
  }
  placementError(id, row, col) {
    return this._placementError(id, row, col);
  }
  deploymentRestrictionError(id) {
    const held = cardLockError(this.bench[id]);
    if (held) return held;
    return this.bench[id] && stageCardDeploymentBlocked(this.stageCardRules, this.data.getChess(id))
      ? "This operator's class cannot deploy in this stage." : null;
  }
  _placementError(id, row, col, { fromSkill = false, predefined = false } = {}) {
    const entry = this.bench[id];
    if (!fromSkill && !canDeployInViewport(this.viewport))
      return "Open the fullscreen workspace to deploy.";
    if (this.finished) return "Battle has ended.";
    if (!entry || entry.unit?.alive) return "Operator is unavailable.";
    if (entry.removedFromDeck) return "This operator has been removed from the squad for this battle.";
    if (entry.noCard && !predefined && !fromSkill) return "This stage ally has no deployment card.";
    if (entry.hidden && !predefined) return "Operator has not been activated yet.";
    const restriction = this.deploymentRestrictionError(id);
    if (restriction) return restriction;
    if (!fromSkill && entry.readyAt > this.time) return "Operator is still redeploying.";
    if (this.deployedSlots() + this.deploymentSlotCost(id) > this.unitLimit)
      return "Deployment limit reached.";
    if (
      !Number.isInteger(row) ||
      !Number.isInteger(col) ||
      row < this.rect.r0 ||
      row > this.rect.r1 ||
      col < this.rect.c0 ||
      col > this.rect.c1
    )
      return "Select a tile on the map.";
    // An owner may give a tile another build type (Nasti's platform becomes a ranged tile).
    const tile = { ...this.grid.tile(row, col), ...(this.regularTileBuild?.(row, col) ? { build: this.regularTileBuild(row, col) } : {}), ...(this.platformTiles?.has(`${row},${col}`) ? { build: 'ALL' } : {}) },
      position = this.data.getChess(id).position;
    const rangedTrait = REGULAR_OPERATORS[id]?.deployOnRanged && tile.build === 'RANGED';
    // An owner may admit another build type on specific tiles (Violet Mizutsune Orchid's talent).
    const ownerTile = this.regularPlacementAllow?.[id]?.(row, col, tile) === true;
    if (!predefined && !ownerTile && this.stageWater?.contains(row, col)) return 'Place a floating platform before deploying here.';
    // Source-predefined actors can occupy tiles unavailable to manual cards
    // (e.g. a ranged NPC on a ground tile). Bounds and occupancy still apply.
    if (!predefined && tile.build !== "ALL" && tile.build !== position && !rangedTrait && !ownerTile)
      return position === "RANGED"
        ? "Choose a ranged tile."
        : "Choose a melee tile.";
    // An owner may restrict a card to specific tiles (Kal'tsit·Esperanta's S3 transported allies).
    const ownerDeny = this.regularPlacementDeny?.[id]?.(row, col, tile);
    if (ownerDeny) return ownerDeny;
    if (
      this.allyUnits.some((u) => u.alive && u.tileR === row && u.tileC === col
        && !(u.mem?.regularHost?.accepts?.({ defId: id, def: this.data.getChess(id), kind: 'op' }) === true))
    )
      return "Tile is occupied.";
    if (this.tileReservation(row, col)) return "Tile is reserved for an operator's return.";
    if (this.noDeployTiles?.has(`${row},${col}`)) return "Tile is unavailable for deployment.";
    // Zones that follow a living owner (the Kazdel fire elemental's enemy_vcblva_t_tile).
    for (const [owner, tiles] of this.noDeployZones ?? []) if (owner.alive && tiles.has(`${row},${col}`)) return "Tile is unavailable for deployment.";
    if (!fromSkill && !canSpendDp(this, 'arkpedia', this.cost(id))) return "Not enough DP.";
    return null;
  }
  deployOperator(id, row, col, dir) {
    const unit = this._deployOperator(id, row, col, dir);
    if (unit && this.bench[id]) { this.bench[id].costDelta = 0; delete this.bench[id].baseCost; }
    return unit;
  }
  retreatStageToken(id) {
    const unit = this.units.find(u => u.mem.stageSupplyId === id);
    if (!unit?.alive || !unit.deployed || this.finished) throw Error('This token is no longer available.');
    if (unit.mem.stageSupplyDefinition?.retreatable === false) throw Error('This supply cannot be retreated.');
    this._remove(unit, 'retreat', null, true);
    if (unit.mem.stageSupplyRefund) this.addDp('arkpedia', unit.mem.stageSupplyRefund);
  }
  grantStageToken(unitId, count) {
    const cards = this.stage.tokens ?? this.stage.raw?.tokens ?? [];
    if (cards.filter(t => t.unitId === unitId).length !== 1 || !Number.isSafeInteger(count) || count <= 0)
      throw Error(`Invalid stage supply delivery: ${unitId}`);
    const stock = (this.mvpStageTokens.get(unitId) ?? 0) + count;
    if (!Number.isSafeInteger(stock)) throw Error('Stage token stock overflow');
    this.mvpStageTokens.set(unitId, stock);
    this.fx('supply', { token: unitId, count });
  }
  tokenPlacementError(unitId, row, col) {
    try { this._stageTokenForPlacement(unitId, row, col); return ''; } catch (error) { return error.message; }
  }
  _stageTokenForPlacement(unitId, row, col) {
    const found = (this.stage.tokens ?? this.stage.raw?.tokens ?? []).find(t => t.unitId === unitId);
    if (!found) throw new Error('This stage has no such token.');
    const token = { ...(unitId === 'trap_001_crate' ? sceneryDefinition(unitId, { level: 1, skillLevel: 1 }) : {}),
      ...(STAGE_TOKEN_UNITS[unitId] ?? {}), ...found };
    if (this.finished) throw new Error('The battle has ended.');
    if ((this.stageTokenReadyAt.get(unitId) ?? 0) > this.time + 1e-9) throw new Error('Token is recharging.');
    if (token.maxActive && this.allyUnits.filter(u => u.alive && u.mem.stageSupplyToken === unitId).length >= token.maxActive)
      throw new Error('This token is already deployed.');
    if (this.stageForbiddenTiles.has(`${row},${col}`)) throw new Error('Tile is unavailable for deployment.');
    if (token.rangedBuildOnly && !['RANGED', 'ALL'].includes(this.grid.tile(row, col)?.build)) throw new Error('Token needs a ranged tile.');
    if (token.groundBuildOnly && !['MELEE', 'ALL'].includes(this.grid.tile(row, col)?.build)) throw new Error('Token needs a deployable ground tile.');
    if (token.anyBuildOnly && !['MELEE', 'RANGED', 'ALL'].includes(this.grid.tile(row, col)?.build)) throw new Error('Token needs a deployable tile.');
    if ((this.mvpStageTokens.get(unitId) ?? 0) <= 0) throw new Error('No tokens remaining.');
    if (!this.grid.inRect(row, col) || (!token.groundBuildOnly && !token.rangedBuildOnly && !token.anyBuildOnly && !this.grid.groundPassable(row, col, true)
      && !(token.water && /water|deep/.test(String(this.grid.tile(row, col)?.key ?? ''))))) throw new Error('Token must be placed on the ground or water.');
    if (this._occ[row * this.grid.cols + col]?.alive) throw new Error('Tile is occupied.');
    if (token.behavior === 'roadblock' && sealsStageRoute(this, row, col)) throw Error('Cannot seal an enemy route.');
    if (!canSpendDp(this, 'arkpedia', token.cost)) throw new Error('Not enough DP.');
    return token;
  }
  deployToken(unitId, row, col, dir = 'RIGHT') {
    const token = this._stageTokenForPlacement(unitId, row, col);
    if (!['UP', 'RIGHT', 'DOWN', 'LEFT'].includes(dir)) throw Error('Choose a facing direction.');
    const unit = token.behavior === 'withered-altar' ? spawnWitheredAltar(this, token, row, col) : this.spawnDevice(`token:${unitId}`, row, col, { hp: token.hp, def: token.def ?? 0, blockCnt: token.block,
      obstacle: token.obstacle ?? !token.supplyCard, obstacleKind: token.obstacle, name: token.name });
    if (!unit) throw new Error('Token cannot be placed here.');
    if (token.platform) { unit.mem.regularHost = { accepts: () => true }; this.platformTiles ??= new Set(); this.platformTiles.add(`${row},${col}`); }
    // Allerdale's Guard: after 1 s it shields the ally it faces and the 3x3 around it for 10 s, then leaves.
    if (token.behavior === 'barrier') installAllerdaleGuard(this, unit, alladyDefinition({ level: 1, skillLevel: 1, skillIndex: 0 }), dir);
    if (token.behavior === 'stun-pulse') startStunToken(this, unit, token);
    if (token.behavior === 'electric-coil') this.electricCoils.add(unit, token);
    if (token.behavior === 'mushroom-worker') installStageWorker(this, unit, token, dir);
    if (token.behavior === 'interference-mine') installStageMine(this, unit, token);
    if (token.behavior === 'demolition') this.stageDemolition.install(unit, token, dir);
    if (token.behavior === 'roadblock') configureStageObstacle(this, unit, token);
    if (token.behavior === 'range-supply') installRangeSupply(this, unit, token, dir);
    if (token.cooldown) this.stageTokenReadyAt.set(unitId, this.time + token.cooldown);
    spendDp(this, 'arkpedia', token.cost);
    this.mvpStageTokens.set(unitId, (this.mvpStageTokens.get(unitId) ?? 1) - 1);
    return unit;
  }
  // Engine-owned delivery: reuse selected builds, kits and deployment hooks;
  // bypass card cooldown/payment, but retain tile and unit-limit validation.
  redeployOperatorFromSkill(id, row, col, dir) {
    return this._deployOperator(id, row, col, dir, { fromSkill: true });
  }
  _deployOperator(id, row, col, dir, { fromSkill = false, predefined = false } = {}) {
    const error = this._placementError(id, row, col, { fromSkill, predefined });
    if (error) throw new Error(error);
    if (!["UP", "DOWN", "LEFT", "RIGHT"].includes(dir))
      throw new Error("Choose a facing direction.");
    const entry = this.bench[id],
      def = this.data.getChess(id),
      ps = this.getPlayer("arkpedia");
    const unit = this._makeAlly(ps, def, "op", row, col, { dir });
    unit.deploymentSlotCost = this.deploymentSlotCost(id);
    const kit = genericKit(def.skill?.bb ?? {}, def.raw, def);
    customizeRegularOperator({ battle: this, id, def, unit, kit });
    const mechanic = REGULAR_OPERATORS[id].mechanic;
    if (mechanic === "dp")
      kit.skill.onStart = ({ battle, unit }) =>
        this.behaviors.get(id).run("ON_BUFF_START", { battle, unit, blackboard: def.skill.bb });
    if (mechanic === "self-heal")
      kit.skill = {
        id: def.skill.id,
        name: def.skill.name,
        kind: "instant",
        onStart: ({ battle, unit }) =>
          battle.heal(unit, unit, unit.s.maxHp * def.skill.bb.heal_scale, { self: true }),
      };
    if (mechanic === "healing-stance") {
      // Client prefab: BASE_ATTACK_TIME uses ADDITION, not a percentage.
      kit.skill.mods.batPct = def.skill.bb.base_attack_time / unit.base.bat;
      kit.skill.attack = { dmgType: "heal", heal: { mode: "single", count: 1 } };
      const talent = def.talents[0]?.bb;
      if (talent) kit.skill.onHit = ({ battle, unit, target, heal }) => {
        if (heal > 0) battle.addBuff(target, { key: `spot:dodge:${unit.id}`, source: unit,
          duration: talent.duration, mods: { dodgePhys: talent.prob } });
      };
    }
    this._setupUnit(unit, kit);
    installRegularOperator({ battle: this, unit, def });
    if (mechanic === "blast-area")
      unit.skill.spec.attack = { splashRadius: unit.profile.splashRadius * def.skill.bb["attack@range_scale"] };
    if (mechanic === "arts-lord") unit.skill.spec.attack = { dmgType: "arts" };
    if (def.raw.arkpedia.highDef) unit.profile.priority = "highDef";
    if (mechanic === "ranged-priority" && def.talents.length)
      unit.profile.priority = "ranged";
    if (mechanic === "extra-heal" && def.talents.length) {
      const probability = def.talents[0].bb["attack@prob"];
      this.on("beforeAttack", (ctx) => {
        if (ctx.attacker !== unit || !ctx.targets.length || ctx.profile.dmgType !== "heal" || !this.rng.chance(probability)) return;
        const extra = this.injuredAlliesInKeys(unit.rangeKeys, unit)
          .find(ally => !ctx.targets.includes(ally));
        if (extra) ctx.targets.push(extra);
      }, { owner: unit });
    }
    if (mechanic === "anti-air" && def.talents.length) {
      const normalMultiplier = unit.profile.dmgMul;
      const scale = def.talents[0].bb.atk_scale;
      unit.profile.dmgMul = (battle, attacker, target) =>
        (typeof normalMultiplier === "function" ? normalMultiplier(battle, attacker, target) : normalMultiplier ?? 1)
        * (target.isFlying ? scale : 1);
    }
    if (def.raw.arkpedia.critical) {
      const { prob, atk_scale } = def.raw.arkpedia.critical;
      this.on(
        "beforeAttack",
        (ctx) => {
          if (ctx.attacker === unit) unit.mem.critical = this.rng.chance(prob);
        },
        { owner: unit },
      );
      const normalMultiplier = unit.profile.dmgMul;
      unit.profile.dmgMul = (battle, attacker, target) =>
        (typeof normalMultiplier === "function" ? normalMultiplier(battle, attacker, target) : normalMultiplier ?? 1)
        * (unit.mem.critical ? atk_scale : 1);
    }
    this.addBuff(unit, {
      key: "arkpedia:talent",
      mods: def.raw.arkpedia.modifiers,
      persist: true,
      allowDead: true,
    });
    if (mechanic === "centurion") {
      // Centurions select up to their block count, including unblocked enemies
      // in range. Keep ordinary-stage rules separate from mode profiles.
      unit.profile.hitAllBlocked = false;
      Object.defineProperty(unit.profile, "maxTargets", {
        enumerable: true, get: () => Math.max(1, unit.s.blockCnt),
      });
    }
    unit.base.cost = entry.baseCost ?? stageCardBaseCost(this, def);
    if (entry.disableSkill) unit.skill = new SkillRuntime(this, unit, null, null);
    unit.base.respawnTime = stageCardRespawnTime(this, def, unit.base.respawnTime);
    const costAttribute = this.cost(id);
    entry.lastCost = fromSkill ? 0 : costAttribute;
    ps.dp -= entry.lastCost;
    // A free card delivery is a real deployment, not MOVE_LIKE_RESPAWN.
    this._deploy(unit, { tile: [row, col], costAttribute });
    if (mechanic === "starting-sp")
      unit.skill.gainSp(def.talents.reduce((sum, talent) => sum + (talent.bb.sp ?? 0), 0), "talent");
    entry.deployments++;
    entry.unit = unit;
    delete entry.redeployRatios;
    if (fromSkill) entry.readyAt = this.time;
    this.operatorServices.consumeFiveStarVanguardSecondCard(this, id);
    this.operatorServices.consumeSaileachCard(this, id);
    this.operatorServices.consumeFangFireSharpenedCard(this, id);
    return unit;
  }
  retreatOperator(id) {
    if (!canDeployInViewport(this.viewport) || this.finished)
      throw new Error("Battle workspace is inactive.");
    const entry = this.bench[id];
    if (!entry?.unit?.alive) throw new Error("Operator is not deployed.");
    if (entry.unit.s.flags.noRetreat) throw new Error("Operator cannot retreat.");
    const support = REGULAR_OPERATORS[id];
    const refund = support.noRetreatRefund ? 0 : support.mechanic === "fang-fire-sharpened"
      ? this.operatorServices.fangFireSharpenedRefund(entry) : support.mechanic === "charger"
      ? entry.unit.base.cost : Math.floor(entry.lastCost / 2);
    this.addDp("arkpedia", refund);
    this.retreat(entry.unit, { permanent: true });
  }
  activateOperator(id) {
    if (!canDeployInViewport(this.viewport) || this.finished) return false;
    const unit = typeof id === 'string' && id.startsWith('token:')
      ? selectedRegularSummon(this, id)?.unit : this.bench[id]?.unit;
    if (unit?.alive && unit.skill.active && unit.skill.spec.manualCancel) {
      // A skill that puts its own owner to sleep (Titi S2) stays stoppable while that sleep lasts.
      if ((!unit.canAct && !unit.skill.spec.cancelWhileOwnSleep?.()) || unit.skill.silenceBlocked) return false;
      if (unit.skill.spec.canManualCancel?.() === false) return false;
      if (unit.skill.spec.onManualCancel) return !!unit.skill.spec.onManualCancel();
      unit.skill.end('manual');
      return true;
    }
    return !!(
      unit?.alive &&
      (unit.canAct || unit.skill.spec.allowAbnormalCast) && !unit.skill.silenceBlocked &&
      !unit.skill.noSkill &&
      (unit.skill.manual || unit.skill.spec.manualActivation?.() === true) &&
      unit.skill.activate("manual")
    );
  }
  // An owner-declared second field action (e.g. Hadiya's Equipment Adaptation).
  secondaryActionOperator(id) {
    if (!canDeployInViewport(this.viewport) || this.finished) return false;
    const unit = this.bench[id]?.unit, action = unit?.mem.regularSecondaryAction;
    return !!(unit?.alive && action && unit.canAct && !unit.skill.silenceBlocked && action.available() && action.run());
  }
  _remove(unit, reason, killer, permanent) {
    if (unit.side === "ally" && unit.kind === "op") {
      const entry = this.bench[unit.defId];
      if (entry) entry.readyAt = entry.noCard || entry.removedFromDeck ? Infinity
        : this.time + unit.base.respawnTime * unit.s.redeployMul * cardRedeployRatio(entry);
      permanent = true;
    }
    super._remove(unit, reason, killer, permanent);
  }
  _checkRedeploys() {} // Ordinary stages require a new manual placement after the cooldown.
  result() {
    return { ...super.result(), stageOutcomes: readStageOutcomes(this),
      ...(this.stageWaveScheduler?.program.randomChoices ? {
        stageRandomChoices: this.stageWaveScheduler.program.randomChoices.map(choice => ({ ...choice })),
      } : {}) };
  }
  _recordLeak(enemy, timeout) {
    if (enemy.mem.stageWaveUnharmful) return;
    super._recordLeak(enemy, timeout);
    if (!timeout) this.life -= enemy.lpr;
  }
  _checkEnd() {
    if (this.life <= 0) return this._finish("defeated");
    super._checkEnd();
  }
  _installDeepWater(water) {
    if (!water) return;
    this.deepWater = { damage: water.damage ?? 40, aspd: water.aspd ?? 60, speed: water.speed ?? 0.6 };
    this._deepWaterLast = -Infinity;
    this.on('tick', () => {
      if (this.time - this._deepWaterLast < 1) return;
      this._deepWaterLast = this.time;
      for (const e of this.enemies) {
        if (!e.alive || !this._isDeepWater(e.tileR, e.tileC)) continue;
        this.dealDamage(null, e, { amount: this.deepWater.damage, type: 'true', sourceless: true });
        if (e.alive) this.addBuff(e, { key: 'deep-water:enemy', duration: 1.2, mods: { aspd: -this.deepWater.aspd, movePct: -this.deepWater.speed }, visible: true });
      }
    });
  }

  _isDeepWater(r, c) { return !!(this.grid.inRect(r, c) && /water|deep/.test(String(this.grid.tile(r, c)?.key ?? ''))); }

  _installHighTide(tide) {
    if (!tide) return;
    const list = Array.isArray(tide) ? tide : [tide];
    this.highTide = { start: list[0]?.start ?? 0, end: list[0]?.end ?? Infinity, damage: list[0]?.enemyDamage ?? 40,
      aspd: list[0]?.enemyAspd ?? 60, speed: list[0]?.enemySpeed ?? 0.6, allyAspd: list[0]?.allyAspd ?? 60,
      erosion: list[0]?.allyErosion ?? 40, ratio: list[0]?.erosionRatio ?? 0.25, windows: list, active: false };
    this._highTideLast = -Infinity;
    this.on('tick', () => this._highTideTick());
    this.on('damaged', ({ source, target }) => {
      if (!this.highTide?.active || target?.side !== 'ally' || !target.alive) return;
      if (target.mem?.erosionImmune || !this._isFlooded(target.tileR, target.tileC)) return;
      elem(this, source ?? null, target, 'erosion', (source?.s?.atk ?? 0) * this.highTide.ratio);
    });
  }

  _isFlooded(r, c) { return !!(this.highTide?.active && this.grid.inRect(r, c) && this.grid.isLow(r, c)); }

  _highTideTick() {
    const t = this.highTide;
    if (!t) return;
    const win = (t.windows ?? []).find(w => this.time >= (w.start ?? 0) && this.time < (w.end ?? Infinity));
    t.active = !!win;
    if (win) Object.assign(t, { damage: win.enemyDamage ?? t.damage, aspd: win.enemyAspd ?? t.aspd, speed: win.enemySpeed ?? t.speed, allyAspd: win.allyAspd ?? t.allyAspd, erosion: win.allyErosion ?? t.erosion, ratio: win.erosionRatio ?? t.ratio });
    if (!t.active || this.time - this._highTideLast < 1) return;
    this._highTideLast = this.time;
    for (const e of this.enemies) {
      if (!e.alive || !this._isFlooded(e.tileR, e.tileC)) continue;
      this.dealDamage(null, e, { amount: t.damage, type: 'true', sourceless: true });
      if (e.alive) this.addBuff(e, { key: 'high-tide:enemy', duration: 1.2, mods: { aspd: -t.aspd, movePct: -t.speed }, visible: true });
    }
    for (const u of this.units) {
      if (u.side !== 'ally' || !u.alive || u.deployed === false || !this._isFlooded(u.tileR, u.tileC)) continue;
      this.addBuff(u, { key: 'high-tide:ally', duration: 1.2, mods: { aspd: -t.allyAspd }, visible: true });
      if (!u.mem?.erosionImmune) elem(this, null, u, 'erosion', t.erosion);
    }
    this._ev(['highTide', { active: true }]);
  }

  _deploy(u, opts = {}) {
    const r = opts.tile ? opts.tile[0] : u.homeR, c = opts.tile ? opts.tile[1] : u.homeC;
    if (u.kind === 'op' && this._isFlooded(r, c) && !u.mem?.erosionImmune) { this.log(`high tide blocks deployment at ${r},${c}`); return false; }
    return super._deploy(u, opts);
  }

  _installUnitStageDevices(devices) {
    for (const d of devices) {
      const baseSpec = stageDeviceSpec(d)?.unit;
      if (!baseSpec || !Number.isInteger(d.row) || !Number.isInteger(d.col) || baseSpec.tide) continue;
      const spec = stageDeviceAttributes(this.stageCardRules, d.key, baseSpec);
      if (spec.platformDevice) { this.platformTiles ??= new Set(); this.platformTiles.add(`${d.row},${d.col}`); continue; }
      const e = this.spawnEnemy(`device:${d.key ?? d.name}`, { pos: [d.row, d.col], countInTotal: false,
        route: { start: [d.row, d.col], steps: [{ t: 'wait', s: 1e9 }] },
        def: { key: d.key ?? d.name, name: d.name, applyWay: 'NONE', dmgType: 'none',
          stats: { maxHp: spec.hp, hp: spec.hp, atk: spec.atk ?? 0, def: spec.def, res: spec.res ?? 0, moveSpeed: 0, bat: 1, rangeRadius: 0, blockCnt: spec.block, lpr: 0 } } });
      if (!e) continue;
      e.mem.stageUnitDevice = { ...spec, name: d.name, row: d.row, col: d.col, dir: d.dir ?? 'RIGHT', state: spec.pillar ? 'intact' : null };
      // A placed enemy-side object (Ice Crystal, Roadside Emergency Reserves, pillar…) is no enemy: it neither holds a
      // kill-all wave nor the battle's end (12-8's wave 0 waited for its five Reserves forever).
      e.profile.noAttack = true; e.counted = false; e.lpr = 0; e.blockWeight = 0; e.profile.holdsBattle = false;
      e.route = { legs: [{ t: 'wait', time: 1e9 }], legIdx: 0, pts: null, ptIdx: 0, suffix: null, version: -1, waitLeft: null };
      e.s.moveSpeed = 0;
      this.grid.setObstacle(d.row, d.col, true, spec.obstacle);
    }
    this.on('death', ({ unit }) => {
      const d = unit.mem?.stageUnitDevice;
      if (!d) return;
      this.grid.setObstacle(d.row, d.col, false, d.obstacle);
      this.flags.dpMax = Math.min(this.flags.dpMaxCeil ?? Infinity, this.flags.dpMax + d.dpMax);
      this.addDp('arkpedia', d.dp);
    });
  }
  /** Native `modify_sp[start]` on the unit tagged `gunctrl` (the Londinium artillery): adds `amount` SP, capped
   * at the device's cost; it fires on the next device tick. The selectors take one unit, so the first
   * artillery in stage order is charged. Returns false when the stage has no artillery. */
  chargeStageArtillery(amount) {
    if (!(amount >= 0)) throw Error('Invalid artillery charge');
    const d = this.mvpStageDevices?.find(x => stageDeviceSpec(x)?.artillery && x.active !== false);
    if (!d) return false;
    d.sp = Math.min(d.artillery.spCost, d.sp + amount);
    return true;
  }
  _tickMvpStageDevices(dt) {
    for (const d of this.mvpStageDevices) {
      if (d.active === false) continue; // a hidden branch-activated device waits for its alias
      const def = stageDeviceSpec(d);
      if (def.statusPulse) {
        const spec = def.statusPulse;
        const cost = spec.spCost * (this.stageCardRules?.deviceSkillCost?.[d.key] ?? 1);
        d.sp += spec.spPerSecond * dt;
        while (d.sp + 1e-9 >= cost) {
          d.sp = Math.max(0, d.sp - cost);
          const tiles = pulseTiles(d.row, d.col);
          for (const unit of this.allies()) {
            if (unit.hidden || !tiles.some(([r, c]) => r === Math.round(unit.y) && c === Math.round(unit.x))) continue;
            this.applyStatus(unit, spec.status, { duration: spec.duration });
          }
          this.fx('explode', { x: d.col, y: d.row, r: 1, kind: 'cold' });
        }
      } else if (def.pulse) {
        const spec = def.pulse;
        d.sp += spec.spPerSecond * dt;
        while (d.sp >= spec.spCost) {
          d.sp -= spec.spCost;
          const tiles = pulseTiles(d.row, d.col);
          for (const u of this.units) {
            if (!u.alive || !u.deployed || !altarSelectsUnit(u)) continue;
            const r = Math.round(u.y), c = Math.round(u.x);
            if (!tiles.some(([tr, tc]) => tr === r && tc === c)) continue;
            this.emit('stagePulse', { unit: u, device: d });
            if (u.mem?.pulseImmune || u.profile?.pulseImmune) continue;
            this.dealDamage(null, u, { amount: spec.damage, type: 'true', sourceless: true, ignoreSelect: true, tags: ['device', 'pulse'] });
          }
          this.fx('explode', { x: d.col, y: d.row, r: 1.5, kind: 'pulse' });
        }
      } else if (def.kite) {
        const spec = def.kite; d.sp += dt;
        if (d.sp < spec.spCost) continue;
        const dir = d.dir ?? 'RIGHT', dx = dir === 'RIGHT' ? 1 : dir === 'LEFT' ? -1 : 0, dy = dir === 'DOWN' ? 1 : dir === 'UP' ? -1 : 0;
        const target = this.allyUnits.filter(a => a.alive && a.deployed && a.kind !== 'device' && !a.hidden)
          .filter(a => dx ? Math.abs(a.y - d.row) <= 0.5 && (a.x - d.col) * dx > 0 : Math.abs(a.x - d.col) <= 0.5 && (a.y - d.row) * dy > 0)
          .sort((a, b) => Math.hypot(a.y - d.row, a.x - d.col) - Math.hypot(b.y - d.row, b.x - d.col))[0];
        if (!target) continue; d.sp = 0;
        for (const u of this.allyUnits) if (u.alive && u.deployed && Math.hypot(u.y - target.y, u.x - target.x) <= spec.range)
          this.dealDamage(null, u, { amount: 3000, type: 'phys', sourceless: true, tags: ['device', 'kite'] });
      } else if (def.artillery) {
        const spec = d.artillery;
        d.sp = Math.min(spec.spCost, d.sp + spec.spPerSecond * dt);
        if (d.sp < spec.spCost) continue;
        const target = this.allyUnits
          .filter(a => a.alive && a.deployed && a.kind !== 'device' && !a.hidden
            && !a.s.flags.stealth && !a.s.flags.camu && !a.s.flags.liftoff)
          .sort((a, b) => (b.s.blockCnt ?? 0) - (a.s.blockCnt ?? 0) || b.deploySeq - a.deploySeq)[0];
        if (!target) continue;
        d.sp = 0;
        const tiles = artilleryTiles(Math.round(target.y), Math.round(target.x));
        const set = new Set(tiles.map(([r, c]) => `${r},${c}`));
        for (const u of this.units) {
          if (!u.alive || !u.deployed) continue;
          if (!set.has(`${Math.round(u.y)},${Math.round(u.x)}`)) continue;
          this.dealDamage(null, u, { amount: spec.damage, type: 'true', sourceless: true, ignoreSelect: true, tags: ['device', 'artillery'] });
        }
        this.fx('explode', { x: target.x, y: target.y, r: 2, kind: 'artillery' });
      }
    }
  }

}
