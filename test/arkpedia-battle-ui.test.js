// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classNames, rangeStripes, skillIconFile } from '../shared/arkpedia/battle-ui.js';

test('skill asset names preserve internal apostrophes and Greek text while resolving source aliases', () => {
  assert.equal(skillIconFile('Ceobe', "'Really Hot Knives'"), 'Ceobe - Really Hot Knives.webp');
  assert.equal(skillIconFile('Insider', "'Don't Invite Trouble'"), "Insider - Don't Invite Trouble.webp");
  assert.equal(skillIconFile('Fang', 'Charge α'), 'Fang - Charge α.webp');
  assert.equal(skillIconFile('Chestnut', 'Little by Little'), 'Chestnut - Little By Little.webp');
  assert.equal(skillIconFile('Dusk', 'Image over Form'), 'Dusk - Image Over Form.webp');
  assert.equal(skillIconFile('Nearl the Radiant Knight', 'Night-Scouring Gleam'), 'Nearl the Radiant Knight - Night-scouring Gleam.webp');
  assert.equal(skillIconFile('Yato', null), null);
  assert.equal(classNames.WARRIOR, 'Guard');
  assert.equal(classNames.PIONEER, 'Vanguard');
});

test('range stripes are clipped to a tile and alternate with visible gaps', () => {
  const stripes = rangeStripes();
  assert.ok(stripes.length >= 4);
  let area = 0;
  for (const points of stripes) {
    assert.ok(points.length >= 3);
    for (const [x,y] of points) assert.ok(Math.abs(x) <= .485001 && Math.abs(y) <= .485001);
    area += Math.abs(points.reduce((sum, [x,y], i) => {
      const [nx,ny] = points[(i+1)%points.length];
      return sum + x*ny-nx*y;
    },0))/2;
  }
  assert.ok(area > .3 && area < .6, 'both stripes and unpainted tile surface remain visible');
  for (let i=1; i<stripes.length; i++) {
    const previousEnd = Math.max(...stripes[i-1].map(([x,y])=>x+y));
    const nextStart = Math.min(...stripes[i].map(([x,y])=>x+y));
    assert.ok(nextStart-previousEnd > .2, 'stripes do not overlap');
  }
});
