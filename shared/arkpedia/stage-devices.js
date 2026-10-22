// SPDX-License-Identifier: GPL-3.0-or-later
// Reviewed stage devices. The source data only carries position and name; the
// device parameters live here with their source descriptions.
export const STAGE_DEVICES = Object.freeze({
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
