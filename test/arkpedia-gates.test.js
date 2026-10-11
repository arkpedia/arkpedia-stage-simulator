import { test } from "node:test";
import assert from "node:assert/strict";
import data from "../data/arkpedia-mvp.json" with { type: "json" };
import pack from "./fixtures/arkpedia-standard-gates.json" with { type: "json" };
import { gateTiles, validateGatePack } from "../shared/arkpedia/gates.js";

test("entry/defence boxes use tile identities and the original stage surface height", () => {
  assert.deepEqual(gateTiles(data.stage.geometry, (r,c) => r/10+c/100), [
    { row:2,col:8,kind:"start",height:0.28 },
    { row:3,col:0,kind:"end",height:0.3 },
  ]);
  // Tile legend order is not a marker identity contract.
  const geometry = { tileLegend:[{key:"tile_end"},{key:"tile_start"}],tileGrid:[[1,0]] };
  assert.deepEqual(gateTiles(geometry, () => 1.5).map(t => [t.kind,t.height]), [["start",1.5],["end",1.5]]);
});

test("original box pack requires all five distinct parts, the correct blend modes and bounded geometry", () => {
  validateGatePack(pack);
  for (const mutate of [
    p => p.parts.pop(),
    p => p.parts[0].key = p.parts[1].key,
    p => p.parts.at(-1).blend = "additive",
    p => p.parts[0].attributes.position.byteOffset = p.buffer.bytes,
    p => p.parts[0].attributes.uv.count++,
  ]) {
    const bad = structuredClone(pack); mutate(bad);
    assert.throws(() => validateGatePack(bad), /gate/i);
  }
});
