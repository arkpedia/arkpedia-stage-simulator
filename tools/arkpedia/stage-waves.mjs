// SPDX-License-Identifier: GPL-3.0-or-later
import { PRTS_INTRUSIVE_CALL, prtsGrabTarget, prtsDragTile, prtsControlInert } from '../../shared/arkpedia/stage-prts-control.js';
import { readOriginalLevel } from './original-level.mjs';
import { compilePredefinedOperators } from './stage-predefined-operators.mjs';
import { stageDeviceSpec, STAGE_TOKEN_UNITS } from '../../shared/arkpedia/stage-devices.js';
import { emptyActivationBranches, turretActivationBranches } from './stage-branch-noops.mjs';
import { originalDeviceDirection } from './stage-device-instances.mjs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const actionNames = { 0: 'SPAWN', 1: 'PREVIEW_CURSOR', 2: 'STORY', 4: 'PLAY_BGM', 5: 'DISPLAY_ENEMY_INFO', 6: 'ACTIVATE_PREDEFINED', 8: 'TRIGGER_PREDEFINED' };
const presentation = new Set(['PREVIEW_CURSOR', 'STORY', 'PLAY_BGM', 'DISPLAY_ENEMY_INFO', 'PLAY_OPERA', 'DIALOG']);
const near = (a, b) => Math.abs(a - b) <= 0.00101;
const delay = value => {
  if (!Number.isFinite(value) || value < 0) throw Error('Invalid original wave delay');
  return value;
};
const point = p => p == null ? null : { row: p.row, col: p.col };
const routeShape = route => JSON.stringify([route?.motion, [route?.start?.row, route?.start?.col], [route?.end?.row, route?.end?.col],
  route?.checkpoints?.map(c => [c.type, c.position.row, c.position.col]) ?? [],
  route?.waits?.map(w => [w.after_checkpoint, w.type, w.seconds]) ?? []]);
export function originalRoute(raw, geometry) {
  if (!raw) throw Error('Missing original route');
  const checkpoints = [], waits = [];
  const names = { 0: 'MOVE', 1: 'WAIT_FOR_SECONDS', 3: 'WAIT_CURRENT_FRAGMENT_TIME', 4: 'WAIT_CURRENT_WAVE_TIME',
    5: 'DISAPPEAR', 6: 'APPEAR_AT_POS', 7: 'ALERT', 8: 'PATROL_MOVE' };
  const hasTunnel = raw.checkpoints?.some(cp => ['DISAPPEAR', 5, 'APPEAR_AT_POS', 6].includes(cp.type));
  let hidden = false;
  for (const cp of raw.checkpoints ?? []) {
    const type = names[cp.type] ?? cp.type;
    if (type === 'DISAPPEAR') hidden = true;
    if (type === 'APPEAR_AT_POS') hidden = false;
    if (['MOVE', 'APPEAR_AT_POS', 'PATROL_MOVE', 'MAP_OFFSET_MOVE'].includes(type)) {
      const p = cp.position;
      if (p && p.row >= 0 && p.row < geometry.rows && p.col >= 0 && p.col < geometry.cols)
        checkpoints.push({ type: type.toLowerCase(), position: point(p) });
    } else if (['WAIT_FOR_SECONDS', 'WAIT_CURRENT_FRAGMENT_TIME', 'WAIT_CURRENT_WAVE_TIME', 'WAIT_BOSSRUSH_WAVE'].includes(type))
      waits.push({ after_checkpoint: checkpoints.length - 1, type: type.toLowerCase(), seconds: Math.round(cp.time * 1000) / 1000,
        ...(hasTunnel ? { tunnel: hidden } : {}) });
    else if (!['DISAPPEAR', 'ALERT'].includes(type)) throw Error(`Unsupported original route checkpoint: ${type}`);
  }
  return { motion: ({ WALK: 'walk', FLY: 'fly', 0: 'walk', 1: 'fly' })[raw.motionMode],
    start: point(raw.startPosition), end: point(raw.endPosition), checkpoints, waits };
}

/** Conditional exports retain original route indices, whereas the ordinary
 * viewer export deduplicates its routes. Resolve those identities before using
 * a hidden-group spawn; equal numbers in the two tables are not the same route. */
export function resolveStageWaveRoutes(level, input) {
  const geometry = structuredClone(input);
  for (const wave of geometry.waves) for (const row of wave.spawns) {
    if (row.source !== 'wave') continue;
    if (row.enemy_id === '' && row.random) continue;
    const route = originalRoute(level.routes?.[row.route], geometry), shape = routeShape(route);
    let index = geometry.routes.findIndex(candidate => routeShape(candidate) === shape);
    if (index < 0) { index = geometry.routes.length; geometry.routes.push(route); }
    row.route = index;
    for (const [list, position, key] of [['spawnTiles', route.start, 'tile_start'], ['objectiveTiles', route.end, 'tile_end']]) {
      const entries = geometry[list] ??= [];
      let entry = entries.find(e => e.row === position.row && e.col === position.col);
      if (!entry) { entry = { key, ...position, routes: [] }; entries.push(entry); }
      entry.routes ??= [];
      if (!entry.routes.includes(index)) entry.routes.push(index);
    }
  }
  return geometry;
}

/** Original fragments own execution clocks and blocking flags. The viewer's
 * flattened spawn rows supply deduplicated route indices, never wave timing.
 * Match every row before admitting a program; changed source exports fail closed. */
export function compileStageWaves(level, geometry, rules = {}, predefined = null, deviceAliases = []) {
  if (new Set(deviceAliases).size !== deviceAliases.length || deviceAliases.some(key => typeof key !== 'string' || !key
    || predefined?.entries.some(e => e.key === key)))
    throw Error('Ambiguous predefined device alias');
  if (!Array.isArray(level.waves) || level.waves.length !== geometry.waves.length)
    throw Error('Original/viewer wave count mismatch');
  // Chapter 15 (stage-prts-control.js): the first Intrusive Call action is the hand; each later one is a grab order
  // for the action right after it, which is carried from the drag tile to its route's start.
  const prts = rules?.prtsControl && !prtsControlInert(level) ? { hand: false, drag: prtsDragTile(level) } : null;
  const waves = level.waves.map((wave, wi) => {
    const view = geometry.waves[wi], remaining = [...view.spawns];
    // The source uses -1 for no closing delay on a terminal wave. The viewer
    // preserves that sentinel in its flattened duration; runtime time never
    // moves backwards. Other negative delays remain invalid.
    const terminalSentinel = wi === level.waves.length - 1 && wave.postDelay === -1;
    const preDelay = delay(wave.preDelay), postDelay = terminalSentinel ? 0 : delay(wave.postDelay);
    const maxWait = wave.maxTimeWaitingForNextWave;
    if (!Number.isFinite(maxWait) || maxWait !== -1 && maxWait < 0 || wave.advancedWaveTag != null
      || !near(preDelay, view.pre_delay ?? 0) || !near(wave.postDelay, view.post_delay ?? 0)
      || (maxWait === -1 ? view.max_wait_for_next_wave != null : !near(maxWait, view.max_wait_for_next_wave)))
      throw Error('Original/viewer wave control mismatch');
    let clock = preDelay;
    const fragments = wave.fragments.map((fragment, fi) => {
      const preDelay = delay(fragment.preDelay), start = clock + preDelay;
      let exportedSpan = 0, duration = 0, actionCount = 0, fixedDuration = 0, fixedActionCount = 0;
      const spawns = [], activations = [], emptyChoices = [];
      let grabOrder = null; // the pending grab order: { order, group }
      for (const [order, action] of fragment.actions.entries()) {
        const type = actionNames[action.actionType] ?? action.actionType;
        const offset = delay(action.preDelay), interval = delay(action.interval);
        if (!Number.isSafeInteger(action.count) || action.count < 1 || action.count > 10000)
          throw Error('Invalid original action count');
        const span = offset + (action.count - 1) * interval;
        exportedSpan = Math.max(exportedSpan, span);
        // A group no rune names is off, like one a rune enables only on another difficulty.
        if (action.hiddenGroup && rules?.hiddenGroups?.[action.hiddenGroup] !== true) continue;
        const random = action.randomSpawnGroupKey;
        if (action.managedByScheduler !== true || action.useExtraRoute || action.forceBlockWaveInBranch
          || action.randomSpawnGroupPackKey
          || random && (!['SPAWN', 'ACTIVATE_PREDEFINED'].includes(type) || typeof random !== 'string' || action.hiddenGroup
            || !Number.isSafeInteger(action.weight) || action.weight < 0)
          || ![undefined, 'ALWAYS', 0].includes(action.randomType) || ![undefined, 'ALWAYS', 0].includes(action.refreshType)
          || action.hiddenGroup && rules?.hiddenGroups?.[action.hiddenGroup] !== true)
          throw Error('Unsupported original wave action condition');
        for (const field of ['blockFragment', 'dontBlockWave', 'isUnharmfulAndAlwaysCountAsKilled'])
          if (![undefined, false, true].includes(action[field])) throw Error(`Invalid original action flag: ${field}`);
        if (type === 'SPAWN' && random && action.key === '') {
          const index = remaining.findIndex(row => row.fragment === fi && row.enemy_id === '' && row.random?.group === random
            && row.random.weight === action.weight && row.count === action.count && near(row.time, start + offset)
            && (action.count === 1 || near(row.interval ?? 0, interval)));
          if (index < 0) throw Error('Original/viewer empty spawn mismatch');
          remaining.splice(index, 1);
          emptyChoices.push({ key: '', offset, interval, count: action.count, order, random: { group: random, weight: action.weight } });
          actionCount += action.count; duration = Math.max(duration, span);
          continue;
        }
        if (type === 'ACTIVATE_PREDEFINED') {
          if (random && action.count !== 1) throw Error('Unsupported random activation count');
          const empty = random && action.key === '';
          if (!empty && !predefined?.entries.some(e => e.key === action.key) && !deviceAliases.includes(action.key))
            throw Error(`Unsupported scheduled predefined target: ${action.key}`);
          (empty ? emptyChoices : activations).push({ key: action.key, offset, interval, count: action.count, order,
            ...(random ? { random: { group: random, weight: action.weight } } : {}) });
        } else if (type === 'WITHDRAW_PREDEFINED') {
          // 14-10: a preset operator is retreated by the script (no refund; the successor that follows redeploys it).
          if (random || action.count !== 1 || !predefined?.entries.some(e => e.key === action.key && e.kind === 'actor'))
            throw Error(`Unsupported scheduled withdrawal: ${action.key}`);
          activations.push({ key: action.key, offset, interval, count: 1, order, withdraw: true });
        } else if (type !== 'SPAWN' && !presentation.has(type)) throw Error(`Unsupported scheduled action: ${type}`);
        actionCount += action.count;
        duration = Math.max(duration, span);
        if (!random) { fixedDuration = Math.max(fixedDuration, span); fixedActionCount += action.count; }
        if (type !== 'SPAWN') continue;
        let matches = remaining.filter(row => row.fragment === fi && row.enemy_id === action.key
          && (random ? row.random?.group === random && row.random.weight === action.weight : !row.random)
          && row.count === action.count && near(row.time, start + offset)
          && (action.count === 1 || near(row.interval ?? 0, interval)));
        if (level.routes) {
          const original = routeShape(originalRoute(level.routes[action.routeIndex], geometry));
          matches = matches.filter(row => routeShape(geometry.routes[row.route]) === original);
        }
        if (!matches.length || new Set(matches.map(row => row.route)).size > 1)
          throw Error('Original/viewer spawn mismatch or ambiguous route', { cause: { wave: wi, fragment: fi,
            enemy: action.key, time: start + offset, count: action.count, route: action.routeIndex,
            viewerRows: remaining.filter(row => row.enemy_id === action.key).slice(0, 5) } });
        const row = matches[0]; remaining.splice(remaining.indexOf(row), 1);
        if (!Number.isSafeInteger(row.route) || !geometry.routes[row.route] || geometry.routes[row.route].placeholder)
          throw Error('Missing original spawn route');
        const group = action.hiddenGroup ?? null;
        if (action.key === PRTS_INTRUSIVE_CALL) {
          if (!prts || grabOrder || random || action.count !== 1) throw Error('Unsupported Intrusive Call action');
          // A later hand action spawns nothing: it turns the next action into a grab.
          if (prts.hand) { grabOrder = { order, group }; continue; }
          prts.hand = true;
        }
        const grabbed = grabOrder && grabOrder.order === order - 1 && grabOrder.group === group;
        if (grabOrder && !grabbed) throw Error('Intrusive Call grab without its enemy');
        if (grabbed) {
          if (random || action.count !== 1) throw Error('Unsupported Intrusive Call grab (a squad or a random spawn)');
          prtsGrabTarget(level, action); // refuses the Weakening Node and the static forms until they are modelled
          grabOrder = null;
        }
        spawns.push({ enemyKey: action.key, routeIndex: row.route, count: action.count, offset, interval,
          ...(random ? { random: { group: random, weight: action.weight } } : {}),
          blockFragment: !!action.blockFragment, dontBlockWave: !!action.dontBlockWave, ...(predefined || random ? { order } : {}),
          ...(action.key === PRTS_INTRUSIVE_CALL ? { prtsHand: true } : {}), ...(grabbed ? { prtsGrab: true } : {}),
          ...(action.isUnharmfulAndAlwaysCountAsKilled ? { unharmful: true } : {}) });
      }
      if (grabOrder) throw Error('Intrusive Call grab without its enemy');
      clock = start + exportedSpan;
      const randomGroups = new Map();
      for (const s of [...spawns, ...activations, ...emptyChoices]) if (s.random)
        randomGroups.set(s.random.group, (randomGroups.get(s.random.group) ?? 0) + s.random.weight);
      if ([...randomGroups.values()].some(total => !Number.isSafeInteger(total) || total <= 0)) throw Error('Invalid original random group weight');
      return { preDelay, duration, spawns, ...(randomGroups.size ? { fixedDuration, fixedActionCount } : {}),
        ...(activations.length ? { activations } : {}), ...(emptyChoices.length ? { emptyChoices } : {}),
        ...(actionCount === 0 ? { empty: true } : {}) };
    });
    if (remaining.length || !near(clock + wave.postDelay, view.duration)) throw Error('Original/viewer wave duration or spawn mismatch');
    return { preDelay, postDelay, maxWait, fragments };
  });
  if (prts && !prts.hand) throw Error('PRTS control level without its Intrusive Call');
  return { schemaVersion: 1, waves, ...(predefined ? { predefined } : {}), ...(prts ? { prts: { drag: prts.drag } } : {}) };
}

export async function prepareStageWaves({ root, rules, compiledRules, geometry, operators, devices = [], branches }) {
  const { level, source } = await readOriginalLevel(root, rules);
  const turrets = turretActivationBranches(level, originalDeviceDirection);
  for (const d of turrets.devices) if (devices.some(x => x.alias === d.alias || (x.row === d.row && x.col === d.col
    && !(d.key === 'trap_087_allady' && x.key === d.key))))
    throw Error(`Hidden Turret collides with a compiled device: ${d.alias}`);
  const compiledBranches = { ...emptyActivationBranches(level), ...turrets.branches, ...branches };
  if (Object.keys(level.branches ?? {}).some(key => !Object.hasOwn(compiledBranches, key)))
    throw Error('Missing original branch program');
  const resolved = resolveStageWaveRoutes(level, geometry);
  const predefined = compilePredefinedOperators(level, resolved, operators, compiledRules);
  if (predefined?.squadMode === 'player') {
    // Our ordinary bench is keyed by operator identity. The reviewed source
    // excludes these trial identities from the player's squad, preventing an
    // ambiguous collision between two different builds of the same operator.
    const excluded = new Set(compiledRules?.battle?.excluded_operator_ids ?? []);
    for (const e of predefined.entries) if (!excluded.has(e.build.id))
      throw Error(`Preplaced operator lacks a reviewed squad exclusion: ${e.build.id}`);
  }
  const sources = [source];
  if (predefined) {
    const path = 'data/arkpedia-favor-source.json';
    sources.push({ path, sha256: createHash('sha256').update(await readFile(join(root, path))).digest('hex') });
  }
  // A hidden supply card is revealed by its own key (validated in stage-supply-cards.mjs).
  const hiddenCards = (resolved.suppliedUnits?.deployable_tokens ?? []).filter(t => t.hidden === true && STAGE_TOKEN_UNITS[t.unit_id]?.supplyCard).map(t => t.unit_id);
  const deviceAliases = [...devices.filter(d => stageDeviceSpec(d)?.scheduled || d.scheduledActivation && stageDeviceSpec(d)?.activatable).map(d => d.alias), ...turrets.devices.map(d => d.alias), ...hiddenCards];
  const waveProgram = compileStageWaves(level, resolved, compiledRules, predefined, deviceAliases);
  if (Object.keys(compiledBranches).length) waveProgram.branches = compiledBranches;
  return { waveProgram, geometry: resolved, sources, hiddenTurrets: turrets };
}
