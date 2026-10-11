import { test } from "node:test";
import assert from "node:assert/strict";
import { requiresLandscape } from "../shared/arkpedia/viewport.js";

test("phones require landscape, including narrow windows without touch emulation", () => {
  for (const coarsePointer of [true, false]) {
    assert.equal(requiresLandscape({ width: 390, height: 844, coarsePointer }), true);
    assert.equal(requiresLandscape({ width: 844, height: 390, coarsePointer }), false);
  }
});

test("portrait tablets require rotation, while tall desktop windows remain usable", () => {
  assert.equal(requiresLandscape({ width: 820, height: 1180, coarsePointer: true }), true);
  assert.equal(requiresLandscape({ width: 820, height: 1180, coarsePointer: false }), false);
  assert.equal(requiresLandscape({ width: 1180, height: 820, coarsePointer: true }), false);
  assert.equal(requiresLandscape({ width: 820, height: 820, coarsePointer: true }), false);
});
