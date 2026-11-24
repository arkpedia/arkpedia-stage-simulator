// SPDX-License-Identifier: GPL-3.0-or-later
import { POWER_ARMOR_DEVICE_KEYS } from '../../shared/arkpedia/stage-power-armor.js';
import { originalRoute } from './stage-waves.mjs';
import { readOriginalLevel } from './original-level.mjs';
import { validateStaticDeviceInstances } from './stage-device-instances.mjs';
import { STAGE_DEVICES } from '../../shared/arkpedia/stage-devices.js';

const near = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= .00101;
const delay = n => Number.isFinite(n) && n >= 0;

/** Explicitly bound, single-phase spawn branches. Never flatten a trigger into
 * the main wave or silently discard an unknown branch/controller. */
export function compileStageBranches(level, input, conditional, bindings) {
  const geometry = structuredClone(input), branches = {}, remaining = conditional.filter(e => e.source === 'branch' || e.branch);
  const names = Object.keys(level.branches ?? {}), bound = new Set(bindings);
  if (bound.has(undefined) || bound.has('') || names.some(key => !bound.has(key)) || [...bound].some(key => !names.includes(key)))
    throw Error('Missing or unsupported stage branch binding');
  for (const key of names) {
    const branch = level.branches[key];
    if (branch.phases?.length !== 1 || Object.keys(branch).some(k => k !== 'phases'))
      throw Error(`Unsupported branch phase selection: ${key}`);
    const phase = branch.phases[0], spawns = [];
    if (!delay(phase.preDelay) || !Array.isArray(phase.actions)) throw Error('Invalid branch phase');
    for (const [order, action] of phase.actions.entries()) {
      if (!['SPAWN', 0].includes(action.actionType) || !action.key || action.managedByScheduler !== true
        || !Number.isSafeInteger(action.count) || action.count < 1 || action.count > 10000
        || !delay(action.preDelay) || !delay(action.interval) || action.hiddenGroup || action.randomSpawnGroupKey
        || action.randomSpawnGroupPackKey || action.extraMeta != null || action.notCountInTotal
        || action.isValid === false || action.isUnharmfulAndAlwaysCountAsKilled || action.forceBlockWaveInBranch
        || ![undefined, 'ALWAYS', 0].includes(action.randomType) || ![undefined, 'ALWAYS', 0].includes(action.refreshType))
        throw Error(`Unsupported branch action: ${key}`);
      for (const flag of ['blockFragment', 'dontBlockWave', 'autoPreviewRoute', 'autoDisplayEnemyInfo'])
        if (![undefined, true, false].includes(action[flag])) throw Error(`Invalid branch flag: ${flag}`);
      const raw = level.extraRoutes?.[action.routeIndex];
      if (!raw || [raw.spawnOffset, raw.spawnRandomRange].some(p => p && (p.x !== 0 || p.y !== 0))
        || raw.checkpoints?.some(cp => !['MOVE', 0, 'WAIT_FOR_SECONDS', 1, 'DISAPPEAR', 5, 'APPEAR_AT_POS', 6].includes(cp.type)
          || cp.randomizeReachOffset || cp.reachOffset && (cp.reachOffset.x!==0||cp.reachOffset.y!==0) || cp.reachDistance) )
        throw Error('Unsupported branch route');
      let hidden=false;
      for(const cp of raw.checkpoints??[]){
        if(['MOVE',0,'APPEAR_AT_POS',6].includes(cp.type)&&(!cp.position
          ||!Number.isInteger(cp.position.row)||!Number.isInteger(cp.position.col)
          ||cp.position.row<0||cp.position.row>=geometry.rows||cp.position.col<0||cp.position.col>=geometry.cols))
          throw Error('Invalid branch checkpoint position');
        if(['WAIT_FOR_SECONDS',1].includes(cp.type)&&!delay(cp.time))throw Error('Invalid branch wait');
        if(['DISAPPEAR',5].includes(cp.type)){if(hidden)throw Error('Nested branch disappearance');hidden=true;}
        else if(['APPEAR_AT_POS',6].includes(cp.type)){if(!hidden)throw Error('Unpaired branch appearance');hidden=false;}
        else if(hidden&&!['WAIT_FOR_SECONDS',1].includes(cp.type))throw Error('Unsupported hidden branch movement');
      }
      if(hidden)throw Error('Unfinished branch tunnel');
      const route = originalRoute(raw, geometry);
      if (!['walk', 'fly'].includes(route.motion) || [route.start, route.end].some(p => !p
        || !Number.isInteger(p.row) || !Number.isInteger(p.col) || p.row < 0 || p.row >= geometry.rows || p.col < 0 || p.col >= geometry.cols))
        throw Error('Invalid branch route position');
      const offset = phase.preDelay + action.preDelay;
      const i = remaining.findIndex(e => e.source === 'branch' && e.branch === key && e.phase === 0
        && !e.condition && e.enemy_id === action.key && e.count === action.count && e.route === action.routeIndex
        && near(e.time, offset) && (action.count === 1 || near(e.interval ?? 0, action.interval)));
      if (i < 0) throw Error('Original/viewer branch spawn mismatch');
      remaining.splice(i, 1);
      let routeIndex = geometry.routes.findIndex(r => JSON.stringify(r) === JSON.stringify(route));
      if (routeIndex < 0) { routeIndex = geometry.routes.length; geometry.routes.push(route); }
      spawns.push({ enemyKey: action.key, routeIndex, count: action.count, offset, interval: action.interval, order });
    }
    branches[key] = { spawns };
  }
  if (remaining.length) throw Error('Unmatched viewer branch spawn');
  return { geometry, branches };
}

const TWIGS = 'trap_086_larva', TWIGS_PAYLOAD = 'enemy_1266_nhapos';
/** Every branch is a single one-seed Twigs payload and the level places no Twigs anywhere. */
export function inertTwigsPayload(level) {
  const branches = Object.values(level.branches ?? {});
  if (!branches.length || !branches.every(b => b.phases?.length === 1 && b.phases[0].actions?.length === 1
    && b.phases[0].actions[0].key === TWIGS_PAYLOAD && b.phases[0].actions[0].count === 1)) return false;
  const placed = [level.predefines, level.hardPredefines].flatMap(p => [...(p?.tokenInsts ?? []), ...(p?.tokenCards ?? []),
    ...(p?.characterInsts ?? []), ...(p?.characterCards ?? [])]);
  return !placed.some(p => p?.inst?.characterKey === TWIGS);
}

export async function prepareStageBranches({ root, rules, compiledRules, geometry, conditional, devices, instances }) {
  const { level, source } = await readOriginalLevel(root, rules);
  // Normal/challenge variants share original branches. A source-hidden armour
  // may remain disabled in this variant, but its branch still needs validation.
  // Validate its complete instance and reject any scheduled activation before
  // accepting that binding; never create a live body for it.
  const inactive = (level.predefines?.tokenInsts ?? []).filter(p => (compiledRules?.predefinedDevices?.[p.alias] ?? !p.hidden) === false
    && POWER_ARMOR_DEVICE_KEYS.includes(p.inst?.characterKey)
    && !devices.some(d => d.key === p.inst.characterKey && d.row === p.position.row && d.col === p.position.col));
  const inactiveDevices = inactive.map(p => ({ key: p.inst.characterKey, ...p.position, hidden: false,
    name: Object.keys(STAGE_DEVICES).find(name => STAGE_DEVICES[name].keys?.includes(p.inst.characterKey)) }));
  const inactiveInstances = {};
  validateStaticDeviceInstances(inactiveDevices, { ...level, predefines: { ...level.predefines,
    tokenInsts: inactive.map(p => ({ ...p, hidden: false })) } }, inactiveInstances);
  const bindings = devices.filter(d => d.key==='trap_758_skzmbx'||d.key==='trap_086_larva'||POWER_ARMOR_DEVICE_KEYS.includes(d.key))
    .map(d => instances[`${d.key}:${d.row}:${d.col}`]?.branchId)
    .concat(Object.values(inactiveInstances).map(i => i.branchId));
  // A level can keep the Twigs payload branches (one Corrupted Seed each) without placing any Twigs (11-20 and its
  // adverse variant): nothing can advance them, and the stage's target count excludes them. Accept exactly that case:
  // validate and consume the viewer's branch entries, then compile each as a no-op (no spawns), like the unreferenced
  // activation branches in stage-branch-noops.mjs. Any other unbound branch still fails.
  if (!bindings.length && inertTwigsPayload(level)) {
    compileStageBranches(level, geometry, conditional, Object.keys(level.branches));
    // The viewer lists the payload among the stage's enemies; the level has no database entry for it (it never spawns).
    const inert = structuredClone(geometry);
    if (!(level.enemyDbRefs ?? []).some(r => r.id === TWIGS_PAYLOAD) && inert.enemyConfigurations)
      inert.enemyConfigurations = inert.enemyConfigurations.filter(c => c.enemy_id !== TWIGS_PAYLOAD);
    return { geometry: inert, branches: Object.fromEntries(Object.keys(level.branches).map(key => [key, { spawns: [] }])), sources: [source] };
  }
  const compiled=compileStageBranches(level, geometry, conditional, bindings);
  for(const d of [...devices.filter(d=>POWER_ARMOR_DEVICE_KEYS.includes(d.key)), ...inactiveDevices]){
    const key=`${d.key}:${d.row}:${d.col}`,instance=instances[key]??inactiveInstances[key],branch=compiled.branches[instance.branchId];
    const action=branch?.spawns.find(a=>a.order===instance.actionIndex),route=compiled.geometry.routes[action?.routeIndex];
    if(branch?.spawns.length!==1||!action||action.count!==1||action.offset!==0||route.start.row!==d.row||route.start.col!==d.col)
      throw Error('Unsupported Power Armor branch binding');
  }
  for (const d of devices.filter(d=>d.key==='trap_086_larva')) {
    const instance=instances[`${d.key}:${d.row}:${d.col}`], branch=compiled.branches[instance.branchId];
    if (!branch?.spawns.some(a=>a.order===instance.actionIndex)) throw Error('Missing Twigs branch action');
  }
  return { ...compiled, sources: [source] };
}
