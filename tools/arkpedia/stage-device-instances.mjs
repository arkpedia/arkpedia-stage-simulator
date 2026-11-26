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
    // Allerdale's Guards may share a tile (11-19); the viewer lists them in original order without aliases.
    if (stageDeviceSpec({ ...d, hidden: false })?.guard) {
      const free = candidates.filter(p => !matched.has(p));
      if (!free.length || free.some(p => !p.alias)) throw Error(`Missing or ambiguous original device instance: ${d.key}`);
      candidates.splice(0, candidates.length, free[0]);
    }
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
    else if (base?.bombLoader && p.hidden === true && !activations.length && altarRevealsLoader(p, source)) {
      selected.push({ ...d, hidden: true, alias: p.alias, altarActivated: true }); retained.push(p);
    }
  }
  if (matched.size !== original.length) throw Error('Original device omitted from viewer geometry');
  const selectedLevel = { ...level, predefines: { ...level.predefines,
    tokenInsts: [...source.filter(p => !reviewedKeys.has(p.inst?.characterKey)), ...retained] } };
  return { devices: selected, level: selectedLevel };
}

const strRow = row => row?.value === 0 && typeof row.valueStr === 'string' && row.valueStr ? row.valueStr : null;
/** A Bloodcalling Altar's instance blackboard. Accepted keys: `branch_id` (required; 13-8 gives it twice, read as the
 * last one winning [inference], and the shadowed branch is still bound), `SummonSpilot.branch_id` (its pilot branch;
 * then the Amber talent's branch, `talent@branch_id` or the skill's `bonore_dfello`, must be `branch_id`), and
 * `ActiveOutset.alias` (a hidden Loading Point on the Altar's own tile, revealed when a bomb destroys it). A branch the
 * level lacks (13-19) is marked `branchMissing`; the stage checks then refuse any Amber, Collector or pilot. */
function compileAltarBlackboard(bb, p, level, all) {
  if (!Array.isArray(bb) || !bb.length || bb.some(row => !['branch_id', 'SummonSpilot.branch_id', 'talent@branch_id', 'ActiveOutset.alias'].includes(row?.key)))
    return null;
  const rows = key => bb.filter(row => row.key === key), one = key => rows(key).length <= 1;
  const branches = rows('branch_id').map(strRow);
  if (!branches.length || branches.length > 2 || branches.some(v => !v) || !one('SummonSpilot.branch_id') || !one('talent@branch_id') || !one('ActiveOutset.alias'))
    return null;
  const branchId = branches.at(-1), shadowedBranchIds = branches.slice(0, -1).filter(v => v !== branchId);
  if (shadowedBranchIds.some(v => !level.branches?.[v])) return null;
  const pilotRow = rows('SummonSpilot.branch_id')[0], amberRow = rows('talent@branch_id')[0], outsetRow = rows('ActiveOutset.alias')[0];
  const pilotBranchId = pilotRow ? strRow(pilotRow) : null, outsetAlias = outsetRow ? strRow(outsetRow) : null;
  if (pilotRow && (!pilotBranchId || !level.branches?.[pilotBranchId] || (amberRow ? strRow(amberRow) : 'bonore_dfello') !== branchId)) return null;
  if (amberRow && !pilotRow) return null;
  if (outsetRow) {
    const loader = all.filter(e => e.alias === outsetAlias);
    if (!outsetAlias || loader.length !== 1 || loader[0].inst?.characterKey !== 'trap_126_outset' || loader[0].hidden !== true
      || loader[0].position?.row !== p.position?.row || loader[0].position?.col !== p.position?.col) return null;
  }
  return { branchId, pilotBranchId, outsetAlias, shadowedBranchIds, branchMissing: !level.branches?.[branchId] };
}
/** The Loading Point `p` is named by exactly one Altar's `ActiveOutset.alias` on its own tile. */
function altarRevealsLoader(p, all) {
  return all.filter(e => e.inst?.characterKey === 'trap_125_bonore' && e.position?.row === p.position?.row && e.position?.col === p.position?.col
    && (e.overrideSkillBlackboard ?? []).some(row => row.key === 'ActiveOutset.alias' && strRow(row) === p.alias)).length === 1;
}

/** Static devices need original instances: viewer names omit skill overrides and activation. */
export function validateStaticDeviceInstances(devices, level, instances = {}) {
  const reviewed = devices.filter(d => stageDeviceSpec(d)?.staticLevelReview);
  const all = level.predefines?.tokenInsts ?? [];
  for (const d of reviewed) {
    const matching = all.filter(p => p.inst?.characterKey === d.key && p.position?.row === d.row && p.position?.col === d.col
      && (!stageDeviceSpec(d)?.guard || p.alias === d.alias));
    if (matching.length !== 1) throw Error(`Missing or ambiguous original device instance: ${d.key}`);
    const p = matching[0];
    const spec = stageDeviceSpec(d), instanced = spec.carapace || spec.powerArmor || spec.reward || spec.magicCircuit || spec.manual || spec.capturable || spec.electricCoil || spec.turret || spec.flowGenerator || spec.gramophone || spec.demolition || spec.scenery || spec.mine || spec.artillery || spec.flame || spec.guard || spec.shieldguard || spec.bloodAltar || spec.bombLoader;
    if (spec.twigs) {
      instances[`${d.key}:${d.row}:${d.col}`] = compileTwigsInstance(p, level);
      continue;
    }
    const bb = p.overrideSkillBlackboard;
    const branchRow=Array.isArray(bb)?bb.find(row=>row.key==='branch_id'):null;
    const altar=spec.bloodAltar?compileAltarBlackboard(bb,p,level,all):null;
    const branchId=spec.bloodAltar?altar?.branchId:(spec.mimic||spec.powerArmor||spec.bombLoader)&&Array.isArray(bb)
      &&bb.length===(spec.powerArmor?2:1)
      &&new Set(bb.map(row=>row.key)).size===bb.length&&branchRow?.value===0&&typeof branchRow.valueStr==='string'&&branchRow.valueStr;
    const pilotBranchId=altar?.pilotBranchId??null;
    const actionRow=spec.powerArmor&&Array.isArray(bb)?bb.find(row=>row.key==='action_index'):null;
    const actionIndex=actionRow&&(actionRow.valueStr==null||actionRow.valueStr==='')?actionRow.value:null;
    if (spec.powerArmor && (!Number.isSafeInteger(actionIndex)||actionIndex<0)) throw Error('Unsupported Power Armor action index');
    const switched = spec.activatable && p.scheduledActivation === true && p.hidden === true;
    // A hidden Loading Point an Altar's ActiveOutset reveals where that Altar stood (13-11, 13-15, 13-16).
    const revealed = spec.bombLoader && p.hidden === true && d.altarActivated === true && altarRevealsLoader(p, all);
    if ((spec.scheduled || switched || revealed ? typeof p.hidden !== 'boolean' || !p.alias || all.filter(e => e.alias === p.alias).length !== 1 : p.hidden !== false)
      || !(spec.skillIndices ?? [0]).includes(p.skillIndex) || !(spec.skillLevels ?? [1]).includes(p.mainSkillLvl) || ![0, 'PHASE_0'].includes(p.inst.phase)
      || (instanced ? !Number.isSafeInteger(p.inst.level) || p.inst.level < 1 || p.inst.level > (spec.maxLevel ?? 90) : p.inst.level !== 1)
      || (spec.mimic || spec.powerArmor || spec.bombLoader ? !branchId || !level.branches?.[branchId] : spec.bloodAltar ? !altar : !spec.mire && p.overrideSkillBlackboard != null) || p.overrideTalents != null
      || (spec.mine || spec.reward || spec.powerArmor) && (p.inst.potentialRank !== 0 || p.inst.favorPoint !== 0)
      || p.uniEquipIds?.length || p.masterInfos?.length)
      throw Error(`Unimplemented device instance override: ${d.key}`);
    const actions = (level.waves ?? []).flatMap(w => (w.fragments ?? []).flatMap(f => f.actions ?? []));
    if (!spec.scheduled && !switched && actions.some(a => p.alias && a.key === p.alias || a.key === d.key)) throw Error(`Scheduled device activation requires a controller: ${d.key}`);
    if (spec.guard) { instances[`${d.key}:${d.alias}`] = { level: p.inst.level, skillLevel: p.mainSkillLvl, skillIndex: p.skillIndex,
      direction: originalDeviceDirection(p.direction) }; continue; }
    if (instanced) instances[`${d.key}:${d.row}:${d.col}`] = { level: p.inst.level, skillLevel: p.mainSkillLvl,
      ...(spec.mimic || spec.powerArmor || spec.bloodAltar || spec.bombLoader ? { branchId } : {}),
      ...(pilotBranchId ? { pilotBranchId } : {}),
      ...(altar?.outsetAlias ? { outsetAlias: altar.outsetAlias } : {}),
      // Compile-time facts for the stage checks only (no runtime binding): branches the level lacks or never runs.
      ...(altar?.branchMissing ? { branchMissing: true } : {}),
      ...(altar?.shadowedBranchIds.length ? { shadowedBranchIds: altar.shadowedBranchIds } : {}),
      ...(spec.powerArmor ? { actionIndex } : {}),
      ...(spec.directional || spec.turret || spec.flowGenerator || spec.magicCircuit || spec.shieldguard || spec.bloodAltar || spec.bombLoader ? { direction: originalDeviceDirection(p.direction) } : {}),
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
