// SPDX-License-Identifier: GPL-3.0-or-later
import runtime from '../../data/arkpedia-device-runtime.json' with { type: 'json' };
export { altarSelectsUnit, artilleryTiles } from './stage-device-geometry.js';
export { traceMagicCircuits, fluxReflectorTurns } from './magic-circuit-routing.js';
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};
freeze(runtime);

/** Definitions are compiled by the original source validators. Runtime accepts
 * only their finite instance domain and returns a fresh, independently owned
 * value. Source evidence and proof evaluation stay in the content build. */
export function compiledDeviceDefinition(name, id, instance) {
  const family = Object.hasOwn(runtime.families, name) && runtime.families[name];
  const variant = family && Object.hasOwn(family, id) && family[id];
  if (!variant || !instance) throw Error(`Unsupported device configuration: ${name}/${id}`);
  for (const [field, allowed] of Object.entries(variant.dimensions))
    if (!allowed.includes(instance[field])) throw Error(`Unsupported device configuration: ${name}/${id}.${field}`);
  const bindings = {};
  for (const field of variant.bindings ?? []) {
    const value = instance[field];
    if (field === 'branchId' ? typeof value !== 'string' || !value : !Number.isSafeInteger(value) || value < 0)
      throw Error(`Unsupported device binding: ${name}/${id}.${field}`);
    bindings[field] = value;
  }
  let node = variant.tree;
  while (typeof node !== 'number') node = node.children[variant.dimensions[node.field].indexOf(instance[node.field])];
  return { ...structuredClone(runtime.values[node]), ...bindings };
}
const single = name => instance => compiledDeviceDefinition(name, '', instance);
const keyed = name => (id, instance) => compiledDeviceDefinition(name, id, instance);
export const capturableDeviceDefinition = keyed('capturableDeviceDefinition');
export const flowGeneratorDefinition = single('flowGeneratorDefinition');
export const gramophoneDefinition = single('gramophoneDefinition');
export const manualDeviceDefinition = keyed('manualDeviceDefinition');
export const powerArmorDeviceDefinition = keyed('powerArmorDeviceDefinition');
export const rewardDeviceDefinition = keyed('rewardDeviceDefinition');
export const carapaceDefinition = single('carapaceDefinition');
export const twigsDefinition = single('twigsDefinition');
export const sceneryDefinition = keyed('sceneryDefinition');
export const turretDefinition = single('turretDefinition');
export const artilleryDefinition = single('artilleryDefinition');
export const flameDefinition = single('flameDefinition');
export const alladyDefinition = single('alladyDefinition');
export const predefinedMineDefinition = single('predefinedMineDefinition');
export const shieldguardDefinition = single('shieldguardDefinition');
export const bloodAltarDefinition = single('bloodAltarDefinition');
export const bombLoaderDefinition = single('bombLoaderDefinition');
export const magicCircuitDefinition = (instance, id = 'trap_062_magicstart') => compiledDeviceDefinition('magicCircuitDefinition', id, instance);
export const electricCoilDefinition = instance => compiledDeviceDefinition('electricCoilDefinition', '', instance && {
  ...instance, elite: instance.elite ?? 0, potential: instance.potential ?? 0, skill_index: instance.skill_index ?? 0,
  skill_level: instance.skill_level ?? instance.skillLevel,
});
export const STAGE_TOKEN_UNITS = runtime.tokens;
export const PILLAR = runtime.pillar;
export const RUINS = runtime.ruins;
export const pulseTiles = (row, col) => runtime.pulse.map(([r, c]) => [row + r, col + c]);
export function stageDeviceSpec(device) {
  const spec = Object.hasOwn(runtime.specs, device?.name) && runtime.specs[device.name];
  return !spec || spec.keys && !spec.keys.includes(device.key)
    || spec.staticLevelReview && !spec.scheduled && device.hidden !== false
      // A hidden Turret or Ice Crystal is accepted only when an activation branch switches it on (as in stage-devices.js).
      && !((spec.turret || spec.statusPulse || spec.flame || spec.guard) && device.hidden === true && device.branchActivated === true && typeof device.alias === 'string'
      || spec.activatable && device.hidden === true && device.scheduledActivation === true && typeof device.alias === 'string') ? null : spec;
}
