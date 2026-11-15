// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { stageTileView } from '../shared/arkpedia/stage-tile-view.js';
import { readFile } from 'node:fs/promises';

test('palette ordering cannot change the height, color or keyboard access of a source tile', async () => {
  const geometry = JSON.parse(await readFile(new URL('../../arkpedia-data/source/data/stage-geometry/dh-7.json', import.meta.url)));
  const renumbered = Object.fromEntries(Object.entries(geometry.tileLegend).map(([key, tile]) => [Number(key) + 17, tile]));
  for (const row of geometry.tileGrid) for (const type of row)
    assert.deepEqual(stageTileView(geometry.tileLegend[type]), stageTileView(renumbered[type + 17]));
  const sea = Object.values(geometry.tileLegend).find(t => t.key === 'tile_deepsea');
  assert.equal(stageTileView(sea).label, 'Deep water');
  assert.equal(stageTileView(sea).height, 0); assert.equal(stageTileView(sea).focusable, true);
  assert.notEqual(stageTileView(sea).color, stageTileView({ key: 'tile_start' }).color);
  assert.equal(stageTileView({ key: 'tile_wall', height: 'high', deployable: 'ranged' }).height, .38);
  assert.equal(stageTileView({ key: 'tile_forbidden', deployable: 'none' }).focusable, false);
});
