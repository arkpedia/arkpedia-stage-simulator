// SPDX-License-Identifier: GPL-3.0-or-later
// Reviewed stage devices. The source data only carries position and name; the
// device parameters live here with their source descriptions.
export const STAGE_DEVICES = Object.freeze({
  'Leak Marker': Object.freeze({ chapter17Marker: true }),
  'EP14 Mechanics Controller': Object.freeze({
    // PRTS: every unit on an Originium pollution tile loses 80% natural SP
    // recovery and takes 50 True environment damage per second (skill 1).
    environment: Object.freeze({ damage: 50, spMul: 0.2, interval: 1 }),
  }),
  'Tattered Pillar': Object.freeze({
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
    // PRTS: 1 meter/s, cap 120, target = highest-Block visible ally (newest on a tie),
    // 3000 True damage to both sides in the 3x3 core plus 1x3 arms.
    artillery: Object.freeze({ damage: 3000, spCost: 120, spPerSecond: 1, area: 'artillery' }),
  }),
  'Originium Altar': Object.freeze({
    // PRTS 源石祭坛: auto-recovery/auto-trigger skill, initial 0, SP cost 7,
    // 500 True damage to every allied and enemy unit in the x-1 cross, including
    // air and units normally untargetable; units immune to the pulse take none.
    pulse: Object.freeze({ damage: 500, spCost: 7, spPerSecond: 1, range: 'x-1' }),
  }),
});

export const SUPPORTED_STAGE_DEVICE_NAMES = Object.freeze(Object.keys(STAGE_DEVICES));

/** Tiles in the x-1 cross around a device (its own tile plus four orthogonal neighbours). */
export function pulseTiles(row, col) {
  return [[row, col], [row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]];
}

/** Tiles hit by the Londinium artillery: a 3x3 core with one 1x3 extension on each side. */
export function artilleryTiles(row, col) {
  const out = [];
  for (let r = row - 2; r <= row + 2; r++) for (let c = col - 2; c <= col + 2; c++) {
    const dr = Math.abs(r - row), dc = Math.abs(c - col);
    if (dr <= 1 && dc <= 1) out.push([r, c]);
    else if (dr === 2 && dc <= 1) out.push([r, c]);
    else if (dc === 2 && dr <= 1) out.push([r, c]);
  }
  return out;
}

/** Deployable token behaviors the battle engine can execute. Stats come from data/arkpedia-deployable-tokens.json. */
export const STAGE_TOKEN_UNITS = Object.freeze({
  trap_001_crate: Object.freeze({ behavior: 'roadblock', obstacle: 'crate' }),
  trap_087_allady: Object.freeze({ behavior: 'barrier' }),
  trap_040_canoe: Object.freeze({ behavior: 'platform', water: true, platform: true }),
});
