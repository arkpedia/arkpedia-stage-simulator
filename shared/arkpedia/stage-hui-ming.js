// SPDX-License-Identifier: GPL-3.0-or-later
// Stage-side Hui-Ming (yin/yang) tiles: pure compilation from a stage's geometry
// into the battle controller's program. Source review lives in the build tool.
export const HUI_MING_MARK_TILE_KEYS = Object.freeze(['tile_yinyang_road', 'tile_yinyang_wall']);
export const HUI_MING_SWITCH_TILE_KEY = 'tile_yinyang_switch';
export const HUI_MING_TILE_KEYS = Object.freeze([...HUI_MING_MARK_TILE_KEYS, HUI_MING_SWITCH_TILE_KEY]);
const MARK_BLACKBOARD = ['buff_yinyang[diff].atk_scale', 'buff_yinyang[same].atk_scale', 'dynamic'];
export const hasHuiMingTiles = geometry => !!geometry?.tileLegend?.some(t => HUI_MING_TILE_KEYS.includes(t.key));

/** A mark tile's own blackboard: its starting mode and the two output scales
 * handed to its occupant. Anything else is refused, not ignored. */
export function huiMingMarkParameters(blackboard) {
  if (!blackboard || typeof blackboard !== 'object' || Array.isArray(blackboard)
    || Object.keys(blackboard).sort().join() !== MARK_BLACKBOARD.join()) throw Error('Unsupported Hui-Ming mark tile blackboard');
  const mode = blackboard.dynamic, same = blackboard['buff_yinyang[same].atk_scale'], diff = blackboard['buff_yinyang[diff].atk_scale'];
  if (![0, 1].includes(mode) || ![same, diff].every(v => Number.isFinite(v) && v >= 0 && v <= 1000)) throw Error('Unsupported Hui-Ming mark tile parameters');
  return { mode, same, diff };
}

/** Rows and columns are the compiled board's own, as for every other stage tile program. */
export function compileHuiMingTiles(geometry) {
  if (!hasHuiMingTiles(geometry)) return null;
  const { rows, cols, tileLegend, tileGrid } = geometry;
  if (!Number.isSafeInteger(rows) || !Number.isSafeInteger(cols) || tileGrid?.length !== rows || tileGrid.some(r => r?.length !== cols))
    throw Error('Hui-Ming map dimensions differ');
  const marks = [], switches = [];
  for (const [row, cells] of tileGrid.entries()) for (const [col, type] of cells.entries()) {
    const tile = tileLegend[type];
    if (!tile) throw Error('Unknown stage tile type');
    if (HUI_MING_MARK_TILE_KEYS.includes(tile.key)) {
      // The road form is a low melee tile and the wall form a high ranged one; the mark never changes placement rules.
      const road = tile.key === 'tile_yinyang_road';
      if (tile.height !== (road ? 'low' : 'high') || tile.deployable !== (road ? 'melee' : 'ranged') || tile.walkable !== road || tile.effects?.length)
        throw Error('Unsupported Hui-Ming mark tile shape');
      marks.push({ row, col, ...huiMingMarkParameters(tile.blackboard) });
    } else if (tile.key === HUI_MING_SWITCH_TILE_KEY) {
      if (tile.height !== 'low' || tile.deployable !== 'none' || tile.walkable !== true || tile.effects?.length
        || tile.blackboard && Object.keys(tile.blackboard).length) throw Error('Unsupported Hui-Ming switch tile shape');
      switches.push({ row, col });
    }
  }
  return { kind: 'huiMing', marks, switches, scanInterval: .1 };
}

/** Runtime-side validation of a compiled program before a battle installs it. */
export function validateHuiMingProgram(program) {
  if (!program || program.kind !== 'huiMing' || Object.keys(program).sort().join() !== 'kind,marks,scanInterval,switches'
    || !Array.isArray(program.marks) || !Array.isArray(program.switches) || !(program.marks.length + program.switches.length)
    || !Number.isFinite(program.scanInterval) || program.scanInterval <= 0) throw Error('Unsupported Hui-Ming tile program');
  return program;
}
