// SPDX-License-Identifier: GPL-3.0-or-later
export const REED_TILE_KEYS = Object.freeze(['tile_reed', 'tile_reedf', 'tile_reedw']);
export const REED_PARAMETERS = Object.freeze(['cooldown_duration', 'damage', 'ep_damage', 'extinct_duration', 'ignite_duration']);
export function validateReedParameters(bb) {
  if (Object.keys(bb).sort().join() !== REED_PARAMETERS.join() || !Object.values(bb).every(Number.isFinite)
    || ['ignite_duration', 'extinct_duration', 'cooldown_duration'].some(k => bb[k] < .1 || bb[k] > 3600)
    || bb.damage < 0 || bb.damage > 1e9 || bb.ep_damage < 0 || bb.ep_damage > 1e9)
    throw Error('Unsupported Reeds parameters');
  return bb;
}
export function compileReedTileRule(rune) {
  if (![1023, null].includes(rune.professionMask) || rune.buildableMask !== 'ALL') throw Error('Unsupported Reeds rule targeting');
  const bb = {}, ids = [];
  for (const entry of rune.blackboard ?? []) {
    if (entry.key === 'tile') {
      if (ids.length || entry.value !== 0 || typeof entry.valueStr !== 'string') throw Error('Invalid Reeds tile selector');
      ids.push(...entry.valueStr.split('|'));
    } else {
      if (!REED_PARAMETERS.includes(entry.key) || Object.hasOwn(bb, entry.key) || entry.valueStr != null && entry.valueStr !== '')
        throw Error('Unsupported Reeds rule parameter');
      bb[entry.key] = entry.value;
    }
  }
  if (!ids.length || new Set(ids).size !== ids.length || ids.some(id => !REED_TILE_KEYS.includes(id))) throw Error('Unsupported Reeds tile selector');
  validateReedParameters(bb);
  return Object.fromEntries(ids.map(id => [id, { ...bb }]));
}

/** Native level locations are bottom-origin (row,column), matching the compiled
 * board, unlike the top-to-bottom mapData.map array. Only ignition is reviewed. */
export function compileReedIgnitionRule(rune) {
  if (![1023, null].includes(rune.professionMask) || rune.buildableMask !== 'ALL'
    || rune.blackboard?.length !== 2) throw Error('Unsupported Reeds ignition rule');
  const mode = rune.blackboard.find(b => b.key === 'mode'), location = rune.blackboard.find(b => b.key === 'location');
  if (mode?.value !== 1 || mode.valueStr || location?.value !== 0
    || !/^\(\d+,\d+\)(?:\|\(\d+,\d+\))*$/.test(location.valueStr ?? '')) throw Error('Invalid Reeds ignition location');
  const cells = location.valueStr.split('|').map(s => {
    const [row, col] = s.slice(1, -1).split(',').map(Number);
    if (![row, col].every(Number.isSafeInteger)) throw Error('Invalid Reeds ignition coordinate');
    return { row, col, mode: 1 };
  });
  if (new Set(cells.map(c => `${c.row},${c.col}`)).size !== cells.length) throw Error('Duplicate Reeds ignition coordinate');
  return cells;
}
