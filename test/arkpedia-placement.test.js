import { test } from "node:test";
import assert from "node:assert/strict";
import { facingAt, regionEdges } from "../shared/arkpedia/placement.js";
import { fitCamera } from "../public/js/render/projection.js";
import { absoluteRangeKeys } from "../server/sim/targeting.js";
test("map aiming uses the projected tile plane for all four facings and has a cancel dead zone", () => {
  const tile = { row: 2, col: 3 };
  const camera = fitCamera(
    { r0: 0, r1: 5, c0: 0, c1: 8 },
    { width: 390, height: 460 },
    { tilt: 28, dist: 20 },
  );
  for (const [x, y, dir] of [
    [4, 2, "RIGHT"],
    [2, 2, "LEFT"],
    [3, 3, "UP"],
    [3, 1, "DOWN"],
  ]) {
    const p = camera.project(x, y, 0.38);
    assert.equal(facingAt(camera.unproject(p.x, p.y, 0.38), tile), dir);
  }
  assert.equal(facingAt({ x: 3.2, y: 2.1 }, tile), null);
  assert.equal(facingAt(null, tile), null);
});
test("attack range outlines omit shared edges and clip cells outside the stage", () => {
  const cells = [2 * 21 + 3, 2 * 21 + 4, 3 * 21 + 3];
  const edges = regionEdges(cells, 6, 9);
  assert.equal(edges.length, 8);
  assert.ok(
    !edges.some(
      (e) => e.a[0] === 3.5 && e.b[0] === 3.5 && e.a[1] < 2.5 && e.b[1] < 2.5,
    ),
  );
  const range = absoluteRangeKeys(
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
    ],
    5,
    8,
    "RIGHT",
  );
  assert.equal(regionEdges(range, 6, 9).length, 4);
});
