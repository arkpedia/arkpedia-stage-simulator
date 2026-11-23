// SPDX-License-Identifier: GPL-3.0-or-later
import { carapaceNativeReviewed } from './stage-carapaces.js';
import { twigsNativeReviewed } from './stage-twigs.js';
import { powerArmorDeviceNativeReviewed } from './stage-power-armor.js';
import { magicCircuitNativeReviewed, resonatorNativeReviewed, fluxReflectorNativeReviewed } from './stage-magic-circuit.js';
import { altarSelectorReviewed } from './stage-altar.js';
import { mineNativeReviewed } from './stage-mines.js';
import { demolitionNativeReviewed } from './stage-demolition.js';
import { sceneryNativeReviewed } from './stage-scenery.js';
import { rewardDeviceNativeReviewed } from './stage-reward-devices.js';
import { gramophoneNativeReviewed } from './stage-gramophones.js';
import { flowGeneratorNativeReviewed } from './stage-flow-generators.js';
import { turretNativeReviewed } from './stage-turrets.js';
import { electricCoilNativeReviewed } from './stage-electric-coils.js';
import DEVICE_SOURCE from '../../data/arkpedia-device-source.json' with { type: 'json' };
import { manualDeviceNativeReviewed } from './stage-manual-devices.js';
import { capturableDeviceNativeReviewed } from './stage-capturable-devices.js';

// Reviewed stage devices. The source data only carries position and name; the
// device parameters live here with their source descriptions.
export const STAGE_DEVICES = Object.freeze({
  'Excrescent Carapace': Object.freeze({ keys: Object.freeze(['trap_156_dsshell']), carapace: true, staticLevelReview: true, maxLevel: 30 }),
  "'Twigs That Crave'": Object.freeze({keys:Object.freeze(['trap_086_larva']),twigs:true,scheduled:true,staticLevelReview:true,maxLevel:30}),
  'R-31 Heavy Power Armor': Object.freeze({keys:Object.freeze(['trap_075_bgarmn']),powerArmor:true,staticLevelReview:true,maxLevel:30}),
  'R-31a Heavy Power Armor': Object.freeze({keys:Object.freeze(['trap_076_bgarms']),powerArmor:true,staticLevelReview:true,maxLevel:30}),
  'R-11 Assault Power Armor': Object.freeze({keys:Object.freeze(['trap_077_rmtarmn']),powerArmor:true,staticLevelReview:true,maxLevel:30}),
  'R-11a Assault Power Armor': Object.freeze({keys:Object.freeze(['trap_078_rmtarms']),powerArmor:true,staticLevelReview:true,maxLevel:30}),
  'Mire Control': Object.freeze({ keys: Object.freeze(['trap_098_mire']), staticLevelReview: true, mire: true }),
  'Treasure Chest': Object.freeze({ keys: Object.freeze(['trap_757_skzbox']), reward: true,
    scheduled: true, staticLevelReview: true, maxLevel: 30 }),
  'Spines of Epoch': Object.freeze({ keys: Object.freeze(['trap_760_skztzs']), reward: true,
    scheduled: true, staticLevelReview: true, maxLevel: 30, skillIndices: Object.freeze([-1]), spawns: Object.freeze(['enemy_2088_skzdwz']) }),
  'Dying Fowlbeast': Object.freeze({ keys: Object.freeze(['trap_759_skzwyx']), reward: true,
    scheduled: true, staticLevelReview: true, maxLevel: 30 }),
  'Stagnant Contraption': Object.freeze({ keys: Object.freeze(['trap_758_skzmbx']), reward: true, mimic: true,
    scheduled: true, staticLevelReview: true, maxLevel: 30 }),
  'Idle Exquisicart': Object.freeze({ keys: Object.freeze(['trap_758_skzmbx']), reward: true, mimic: true,
    scheduled: true, staticLevelReview: true, maxLevel: 30 }),
  "L-7 'Whisperer'": Object.freeze({ keys: Object.freeze(['trap_063_magicturn']), magicCircuit: true, reflector: true, staticLevelReview: true, maxLevel: 30, skillIndices: Object.freeze([-1]) }),
  "'Resonator'": Object.freeze({ keys: Object.freeze(['trap_064_magiccircle']), magicCircuit: true, resonator: true, staticLevelReview: true, maxLevel: 30, skillIndices: Object.freeze([0]) }),
  "'Tuba'": Object.freeze({ keys: Object.freeze(['trap_062_magicstart']), magicCircuit: true, staticLevelReview: true, maxLevel: 30, skillIndices: Object.freeze([-1]) }),
  'Interference Mine': Object.freeze({ keys: Object.freeze(['trap_012_mine']), mine: true, staticLevelReview: true, maxLevel: 30 }),
  'Roadblock': Object.freeze({ keys: Object.freeze(['trap_001_crate']), scenery: true, staticLevelReview: true, maxLevel: 30 }),
  'Giant Mushroom': Object.freeze({ keys: Object.freeze(['trap_015_tree']), scenery: true, staticLevelReview: true, maxLevel: 30 }),
  "L-44 'Gramophone'": Object.freeze({ keys: Object.freeze(['trap_014_tower']), staticLevelReview: true, gramophone: true, skillLevels: Object.freeze([1, 2, 3]), tile: Object.freeze({ pass: 'FLY', build: 'NONE' }) }),
  'Originium Flow Generator': Object.freeze({ keys: Object.freeze(['trap_013_blower']), staticLevelReview: true, flowGenerator: true, skillLevels: Object.freeze([1, 2]) }),
  'Turret': Object.freeze({ keys: Object.freeze(['trap_007_ballis']), staticLevelReview: true, turret: true,
    tile: Object.freeze({ pass: 'FLY', build: 'NONE' }) }),
  'Mieszko Coil': Object.freeze({ keys: Object.freeze(['trap_019_electric']), staticLevelReview: true, electricCoil: true }),
  "'Gelato Stop'": Object.freeze({ keys: Object.freeze(['trap_057_wpnsts']), staticLevelReview: true,
    capturable: true, skillIndices: Object.freeze([0, 1]), dynamicTile: Object.freeze({ pass: 'FLY', build: 'NONE' }) }),
  'Imprisonment Device': Object.freeze({ keys: Object.freeze(['trap_025_prison']), staticLevelReview: true,
    manual: true, directional: true, maxLevel: 30, dynamicTile: Object.freeze({ pass: 'FLY', build: 'NONE' }) }),
  'Stun Generator': Object.freeze({ keys: Object.freeze(['trap_002_emp']), staticLevelReview: true,
    manual: true }),
  'Detector': Object.freeze({ keys: Object.freeze(['trap_005_sensor']), staticLevelReview: true,
    manual: true, tile: Object.freeze({ pass: 'FLY', build: 'NONE' }) }),
  'Command Terminal': Object.freeze({ keys: Object.freeze(['trap_008_farm']), staticLevelReview: true,
    manual: true, dynamicTile: Object.freeze({ pass: 'FLY', build: 'NONE' }) }),
  'Originium Ice Crystal': Object.freeze({
    keys: Object.freeze(['trap_010_frosts']), staticLevelReview: true,
    tile: Object.freeze({ pass: 'FLY', build: 'NONE' }),
    statusPulse: Object.freeze({ status: 'cold', duration: 10, spCost: 15, spPerSecond: 1, range: 'x-1' }),
  }),
  'EP14 Mechanics Controller': Object.freeze({
    // PRTS: every unit on an Originium pollution tile loses 80% natural SP
    // recovery and takes 50 True environment damage per second (skill 1).
    environment: Object.freeze({ damage: 50, spMul: 0.2, interval: 1 }),
  }),
  'Tattered Pillar': Object.freeze({ keys: Object.freeze(['trap_043_dupilr']), demolition: true, staticLevelReview: true, maxLevel: 30,
    // PRTS: 5000 HP, 12000 ATK, 0 DEF/RES. Only adjacent friendlies can damage it;
    // the first lethal hit leaves it at 1 HP and invulnerable for 2 s; the next
    // destroys it and collapses two tiles away from the damage source.
    unit: Object.freeze({ hp: 5000, atk: 12000, def: 0, res: 0, block: 0, dpMax: 0, dp: 0, obstacle: 'crate', pillar: true }),
  }),
  'Kite': Object.freeze({
    unit: Object.freeze({ hp: 6000, atk: 3000, def: 150, res: 0, block: 0, dpMax: 0, dp: 0, kite: true, range: 1.25, spCost: 7 }),
  }),
  'Custom Floating Platform': Object.freeze({
    unit: Object.freeze({ hp: 100, atk: 0, def: 0, res: 0, block: 0, dpMax: 0, dp: 0, platformDevice: true }),
  }),
  'Tide Controller': Object.freeze({
    keys: Object.freeze(['trap_042_tidectrl']),
    // Hidden static controller for Dossoles High Tide; the tide schedule and
    // erosion values live on the stage's `tide` record.
    unit: Object.freeze({ hp: 100, atk: 0, def: 0, res: 0, block: 0, dpMax: 0, dp: 0, tide: true }),
  }),
  'Static Roadblock': Object.freeze({
    // PRTS: 8000 HP / 200 DEF / 20 RES, enemy-faction obstacle; destroyed by
    // operators, no DP reward.
    unit: Object.freeze({ hp: 8000, def: 200, res: 20, block: 0, dpMax: 0, dp: 0, obstacle: 'crate' }),
  }),
  'Roadside Emergency Reserves': Object.freeze({
    // PRTS: enemy-faction, targetable, 8000 HP / 100 DEF, block 5; blocks the
    // route and restores 5 DP cap + 5 DP when defeated.
    unit: Object.freeze({ hp: 8000, def: 100, block: 5, dpMax: 5, dp: 5, obstacle: 'crate' }),
  }),
  'Londinium Secondary Defense Artillery': Object.freeze({
    // PRTS: 1 meter/s, target = highest-Block visible ally (newest on a tie),
    // 3000 True damage to both sides in the 3x3 core plus 1x3 arms. The cost and starting
    // SP come from the original instance's skill level (stage-artillery.js); 120 is level 1.
    // Original instances are reviewed so that a hidden artillery stays off unless a rune enables it.
    keys: Object.freeze(['trap_058_gunctrl']), staticLevelReview: true, skillLevels: Object.freeze([1, 2, 3]),
    // A hidden artillery switched on by an ACTIVATE_PREDEFINED of its alias (AW-1 Challenge) stays off until then.
    activatable: true,
    artillery: Object.freeze({ damage: 3000, spCost: 120, spPerSecond: 1, area: 'artillery' }),
  }),
  'Originium Altar': Object.freeze({
    // PRTS 源石祭坛: auto-recovery/auto-trigger skill, initial 0, SP cost 7,
    // 500 True damage to allied and enemy characters in the 13-tile x-1 diamond, including
    // air and units normally untargetable; units immune to the pulse take none.
    keys: Object.freeze(['trap_011_ore']), altar: true,
    pulse: Object.freeze({ damage: 500, spCost: 7, spPerSecond: 1, range: 'x-1' }),
  }),
});

export const SUPPORTED_STAGE_DEVICE_NAMES = Object.freeze(Object.keys(STAGE_DEVICES));

/** Display names are not identities: alternate devices may share a translation. */
export function stageDeviceSpec(device) {
  const spec = STAGE_DEVICES[device?.name];
  // A hidden Turret or Ice Crystal is accepted only when an activation branch switches it on (Faust's ballistae).
  if (!spec || spec.keys && !spec.keys.includes(device.key) || spec.staticLevelReview && !spec.scheduled && device.hidden !== false
    && !((spec.turret || spec.statusPulse) && device.hidden === true && device.branchActivated === true && typeof device.alias === 'string'
      || spec.activatable && device.hidden === true && device.scheduledActivation === true && typeof device.alias === 'string')
    || spec.carapace && !carapaceNativeReviewed()
    || spec.twigs && !twigsNativeReviewed()
    || spec.powerArmor && !powerArmorDeviceNativeReviewed(device.key)
    || spec.reward && !rewardDeviceNativeReviewed(device.key)
    || spec.magicCircuit && !(spec.resonator ? resonatorNativeReviewed() : spec.reflector ? fluxReflectorNativeReviewed() : magicCircuitNativeReviewed())
    || spec.altar && !altarSelectorReviewed()
    || spec.mine && !mineNativeReviewed()
    || spec.demolition && !demolitionNativeReviewed()
    || spec.scenery && !sceneryNativeReviewed(device.key)
    || spec.manual && !manualDeviceNativeReviewed(device.key)
    || spec.capturable && !capturableDeviceNativeReviewed(device.key)
    || spec.gramophone && !gramophoneNativeReviewed()
    || spec.flowGenerator && !flowGeneratorNativeReviewed()
    || spec.turret && !turretNativeReviewed()
    || spec.electricCoil && !electricCoilNativeReviewed()) return null;
  return spec;
}

/** Original x-1 grid (13 tiles), shared by altar and ice-crystal pulses. */
export function pulseTiles(row, col) {
  return DEVICE_SOURCE.ranges['x-1'].grids.map(p => [row + p.row, col + p.col]);
}

export { artilleryTiles } from './stage-device-geometry.js';

/** Deployable token behaviors the battle engine can execute. Stats come from data/arkpedia-deployable-tokens.json. */
export const STAGE_TOKEN_UNITS = Object.freeze({
  trap_161_lrcage: Object.freeze({ behavior: 'withered-altar', supplyCard: true, spawns: Object.freeze(['enemy_1421_lrchld']) }),
  trap_016_peon: Object.freeze({ behavior: 'mushroom-worker', supplyCard: true }),
  trap_012_mine: Object.freeze({ behavior: 'interference-mine', supplyCard: true }),
  trap_045_dublst: Object.freeze({ behavior: 'demolition', supplyCard: true }),
  trap_006_antidr: Object.freeze({ behavior: 'range-supply', supplyCard: true }),
  trap_009_battery: Object.freeze({ behavior: 'range-supply', supplyCard: true }),
  trap_019_electric: Object.freeze({ behavior: 'electric-coil', supplyCard: true }),
  trap_018_bomb: Object.freeze({ behavior: 'stun-pulse', supplyCard: true }),
  trap_001_crate: Object.freeze({ behavior: 'roadblock', obstacle: 'crate', supplyCard: true }),
  trap_087_allady: Object.freeze({ behavior: 'barrier' }),
  trap_040_canoe: Object.freeze({ behavior: 'platform', water: true, platform: true }),
});
