// SPDX-License-Identifier: GPL-3.0-or-later
import { compileTwigsInstance } from './stage-twigs.mjs';
import { stageDeviceSpec } from '../../shared/arkpedia/stage-devices.js';
import { readOriginalLevel } from './original-level.mjs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

/** Older original levels serialize the same Direction enum as integers. */
export function originalDeviceDirection(value) {
  const names = ['UP', 'RIGHT', 'DOWN', 'LEFT'];
  if (Number.isSafeInteger(value) && value >= 0 && value < names.length) return names[value];
  if (names.includes(value)) return value;
  throw Error('Missing original device direction');
}

/** Resolve original initial activation before matching instances at shared coordinates.
 * Scheduled activation still requires a runtime controller and is rejected. */
export function selectStaticDeviceInstances(devices, level, rules = {}) {
  const toggles = rules?.predefinedDevices ?? {}, source = level.predefines?.tokenInsts ?? [];
  if (rules?.excludePredefinedTraps) {
    // Reviewed use: 3-6 Challenge removes its two static Detectors. Other trap
    // lifecycles and supplied cards require their own exclusion semantics.
    if (!source.length || source.some(p => p.inst?.characterKey !== 'trap_005_sensor')
      || !devices.length || devices.length !== source.length || devices.some(d => d.key !== 'trap_005_sensor')
      || new Set(devices.map(d => `${d.row}:${d.col}`)).size !== devices.length
      || level.predefines?.tokenCards?.length || Object.keys(toggles).length)
      throw Error('Unsupported predefined trap exclusion instances');
    validateStaticDeviceInstances(devices, level);
    return { devices: [], level: { ...level, predefines: { ...level.predefines, tokenInsts: [] } } };
  }
  // Actions in a hidden group the stage leaves off (or no rune names) never run (AW-1's `raid` artillery activation).
  const off = a => a.hiddenGroup && rules?.hiddenGroups?.[a.hiddenGroup] !== true;
  level = { ...level, waves: (level.waves ?? []).map(w => ({ ...w, fragments: (w.fragments ?? []).map(f => ({ ...f, actions: (f.actions ?? []).filter(a => !off(a)) })) })) };
  const actions = level.waves.flatMap(w => w.fragments.flatMap(f => f.actions));
  const known = d => stageDeviceSpec({ ...d, hidden: false })?.staticLevelReview;
  const reviewedKeys = new Set(devices.filter(known).map(d => d.key));
  const original = source.filter(p => reviewedKeys.has(p.inst?.characterKey));
  for (const alias of Object.keys(toggles))
    if (original.filter(p => p.alias === alias).length !== 1) throw Error(`Unknown or ambiguous predefined-device alias: ${alias}`);
  const matched = new Set(), selected = [], retained = [];
  for (const d of devices) {
    if (!known(d)) { selected.push(d); continue; }
    const candidates = original.filter(p => p.inst.characterKey === d.key && p.position?.row === d.row
      && p.position?.col === d.col && p.hidden === d.hidden);
    if (candidates.length !== 1 || matched.has(candidates[0])) throw Error(`Missing or ambiguous original device instance: ${d.key}`);
    const p = candidates[0]; matched.add(p);
    const base = stageDeviceSpec({ ...d, hidden: false }), scheduled = base?.scheduled;
    const activations = actions.filter(a => (p.alias && a.key === p.alias) || a.key === d.key);
    const active = Object.hasOwn(toggles, p.alias) ? toggles[p.alias] : p.hidden === false;
    // An activatable device (the artillery) that starts hidden may be switched on by its own alias; the battle
    // keeps it off until that action runs. Any other activation still needs a device-specific controller.
    const switchedOn = base?.activatable && !active && !!p.alias && activations.length > 0 && activations.every(a => a.key === p.alias)
      && original.filter(e => e.alias === p.alias).length === 1;
    if (!scheduled && activations.length && !switchedOn)
      throw Error(`Scheduled device activation requires a controller: ${d.key}`);
    if (active || scheduled) { selected.push({ ...d, hidden: !active, alias: p.alias }); retained.push({ ...p, hidden: !active }); }
    else if (switchedOn) { selected.push({ ...d, hidden: true, alias: p.alias, scheduledActivation: true }); retained.push({ ...p, hidden: true, scheduledActivation: true }); }
  }
  if (matched.size !== original.length) throw Error('Original device omitted from viewer geometry');
  const selectedLevel = { ...level, predefines: { ...level.predefines,
    tokenInsts: [...source.filter(p => !reviewedKeys.has(p.inst?.characterKey)), ...retained] } };
  return { devices: selected, level: selectedLevel };
}

/** Static devices need original instances: viewer names omit skill overrides and activation. */
export function validateStaticDeviceInstances(devices, level, instances = {}) {
  const reviewed = devices.filter(d => stageDeviceSpec(d)?.staticLevelReview);
  const all = level.predefines?.tokenInsts ?? [];
  for (const d of reviewed) {
    const matching = all.filter(p => p.inst?.characterKey === d.key && p.position?.row === d.row && p.position?.col === d.col);
    if (matching.length !== 1) throw Error(`Missing or ambiguous original device instance: ${d.key}`);
    const p = matching[0];
    const spec = stageDeviceSpec(d), instanced = spec.carapace || spec.powerArmor || spec.reward || spec.magicCircuit || spec.manual || spec.capturable || spec.electricCoil || spec.turret || spec.flowGenerator || spec.gramophone || spec.demolition || spec.scenery || spec.mine || spec.artillery || spec.flame;
    if (spec.twigs) {
      instances[`${d.key}:${d.row}:${d.col}`] = compileTwigsInstance(p, level);
      continue;
    }
    const bb = p.overrideSkillBlackboard;
    const branchRow=Array.isArray(bb)?bb.find(row=>row.key==='branch_id'):null;
    const branchId=(spec.mimic||spec.powerArmor)&&Array.isArray(bb)&&bb.length===(spec.powerArmor?2:1)
      &&new Set(bb.map(row=>row.key)).size===bb.length&&branchRow?.value===0&&typeof branchRow.valueStr==='string'&&branchRow.valueStr;
    const actionRow=spec.powerArmor&&Array.isArray(bb)?bb.find(row=>row.key==='action_index'):null;
    const actionIndex=actionRow&&(actionRow.valueStr==null||actionRow.valueStr==='')?actionRow.value:null;
    if (spec.powerArmor && (!Number.isSafeInteger(actionIndex)||actionIndex<0)) throw Error('Unsupported Power Armor action index');
    const switched = spec.activatable && p.scheduledActivation === true && p.hidden === true;
    if ((spec.scheduled || switched ? typeof p.hidden !== 'boolean' || !p.alias || all.filter(e => e.alias === p.alias).length !== 1 : p.hidden !== false)
      || !(spec.skillIndices ?? [0]).includes(p.skillIndex) || !(spec.skillLevels ?? [1]).includes(p.mainSkillLvl) || ![0, 'PHASE_0'].includes(p.inst.phase)
      || (instanced ? !Number.isSafeInteger(p.inst.level) || p.inst.level < 1 || p.inst.level > (spec.maxLevel ?? 90) : p.inst.level !== 1)
      || (spec.mimic || spec.powerArmor ? !branchId || !level.branches?.[branchId] : !spec.mire && p.overrideSkillBlackboard != null) || p.overrideTalents != null
      || (spec.mine || spec.reward || spec.powerArmor) && (p.inst.potentialRank !== 0 || p.inst.favorPoint !== 0)
      || p.uniEquipIds?.length || p.masterInfos?.length)
      throw Error(`Unimplemented device instance override: ${d.key}`);
    const actions = (level.waves ?? []).flatMap(w => (w.fragments ?? []).flatMap(f => f.actions ?? []));
    if (!spec.scheduled && !switched && actions.some(a => p.alias && a.key === p.alias || a.key === d.key)) throw Error(`Scheduled device activation requires a controller: ${d.key}`);
    if (instanced) instances[`${d.key}:${d.row}:${d.col}`] = { level: p.inst.level, skillLevel: p.mainSkillLvl,
      ...(spec.mimic || spec.powerArmor ? { branchId } : {}),
      ...(spec.powerArmor ? { actionIndex } : {}),
      ...(spec.directional || spec.turret || spec.flowGenerator || spec.magicCircuit ? { direction: originalDeviceDirection(p.direction) } : {}),
      ...(spec.capturable ? { skillIndex: p.skillIndex } : {}) };
  }
  for (const p of all) if (reviewed.some(d => d.key === p.inst?.characterKey)
    && !reviewed.some(d => d.key === p.inst.characterKey && p.position?.row === d.row && p.position?.col === d.col))
    throw Error(`Original device omitted from viewer geometry: ${p.inst.characterKey}`);
}
export async function prepareStageDeviceInstances({ root, rules, compiledRules, devices, instances = {} }) {
  if (!devices.some(d => stageDeviceSpec({ ...d, hidden: false })?.staticLevelReview)) {
    if (compiledRules?.excludePredefinedTraps) throw Error('Missing reviewed predefined trap exclusion instances');
    if (Object.keys(compiledRules?.predefinedDevices ?? {}).length) throw Error('Unknown predefined-device aliases');
    return { devices, sources: [] };
  }
  const { level, source } = await readOriginalLevel(root, rules);
  const selected = selectStaticDeviceInstances(devices, level, compiledRules);
  validateStaticDeviceInstances(selected.devices, selected.level, instances);
  const path = 'data/arkpedia-device-source.json', bytes = await readFile(join(root, path));
  const sources = [source, { path, sha256: createHash('sha256').update(bytes).digest('hex') }];
  if (devices.some(d => stageDeviceSpec(d)?.reflector)) {
    const path = 'data/arkpedia-flux-reflector-source.json', bytes = await readFile(join(root, path));
    sources.push({ path, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  if (devices.some(d => stageDeviceSpec(d)?.carapace || stageDeviceSpec(d)?.twigs || stageDeviceSpec(d)?.powerArmor || stageDeviceSpec(d)?.reward || stageDeviceSpec(d)?.magicCircuit || stageDeviceSpec(d)?.manual || stageDeviceSpec(d)?.capturable || stageDeviceSpec(d)?.electricCoil || stageDeviceSpec(d)?.turret || stageDeviceSpec(d)?.flowGenerator || stageDeviceSpec(d)?.gramophone || stageDeviceSpec(d)?.demolition || stageDeviceSpec(d)?.scenery || stageDeviceSpec(d)?.mine)) {
    const path = 'data/arkpedia-device-native-source.json', bytes = await readFile(join(root, path));
    sources.push({ path, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  if (devices.some(d => stageDeviceSpec(d)?.artillery) && !sources.some(x => x.path === 'data/arkpedia-device-source.json')) throw Error('Missing artillery skill source');
  if (devices.some(d => stageDeviceSpec(d)?.gramophone)) {
    const path = 'data/arkpedia-gramophone-animations.json', bytes = await readFile(join(root, path));
    sources.push({ path, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  if (devices.some(d => stageDeviceSpec({ ...d, hidden: false })?.powerArmor)) {
    const path = 'data/arkpedia-dormant-power-armor-animations.json', bytes = await readFile(join(root, path));
    sources.push({ path, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  if (devices.some(d => stageDeviceSpec(d)?.twigs)) {
    const path = 'data/arkpedia-twigs-animations.json', bytes = await readFile(join(root, path));
    sources.push({ path, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  return { devices: selected.devices, sources };
}
