// SPDX-License-Identifier: GPL-3.0-or-later
// Public interaction geometry. Coordinates follow the simulator: row zero is the bottom.
export function facingAt(point, tile, deadZone = 0.55) {
  if (!point) return null;
  const row = point.y - tile.row,
    col = point.x - tile.col;
  return Math.hypot(row, col) < deadZone
    ? null
    : Math.abs(col) >= Math.abs(row)
      ? col > 0
        ? "RIGHT"
        : "LEFT"
      : row > 0
        ? "UP"
        : "DOWN";
}
// Screen-space swipe from the actual handle, including a clamped picker at map edges.
// Releasing back inside the dead zone leaves placement pending and spends no DP.
export function swipeFacing(point, origin, deadZone = 24) {
  if (!point || !origin) return null;
  return facingAt(
    { x: point.x - origin.x, y: origin.y - point.y },
    { row: 0, col: 0 },
    deadZone,
  );
}
// Move the complete picker at screen edges. Clamping each direction separately
// can put an arrow underneath its central drag handle on short phone screens.
export function facingPickerLayout(point,{width,height,shelfTop}) {
  const left=24,right=Math.max(left,width-24),top=76,bottom=Math.max(top,shelfTop-26);
  const wanted=Math.max(85,Math.min(210,height*.32,point.s*2.15));
  const spread=Math.max(0,Math.min(wanted*.68,(right-left)/2,(bottom-top)/2)),radius=spread/.68;
  const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
  return {radius,spread,handleSize:Math.min(72,Math.max(44,2*(spread-28))),
    center:{x:clamp(point.x,left+spread,right-spread),y:clamp(point.y,top+spread,bottom-spread)}};
}
// Only the perimeter is stroked; adjacent range cells never get a dividing border.
export function regionEdges(keys, rows, cols, stride = 21) {
  const cells = new Set(
    keys.filter(
      (k) => k >= 0 && Math.floor(k / stride) < rows && k % stride < cols,
    ),
  );
  const edges = [];
  for (const key of cells) {
    const r = Math.floor(key / stride),
      c = key % stride;
    for (const [dr, dc, a, b] of [
      [-1, 0, [-0.5, -0.5], [0.5, -0.5]],
      [0, 1, [0.5, -0.5], [0.5, 0.5]],
      [1, 0, [0.5, 0.5], [-0.5, 0.5]],
      [0, -1, [-0.5, 0.5], [-0.5, -0.5]],
    ]) {
      if (
        r + dr >= 0 &&
        r + dr < rows &&
        c + dc >= 0 &&
        c + dc < cols &&
        cells.has((r + dr) * stride + c + dc)
      )
        continue;
      edges.push({
        row: r,
        col: c,
        a: [c + a[0], r + a[1]],
        b: [c + b[0], r + b[1]],
      });
    }
  }
  return edges;
}
