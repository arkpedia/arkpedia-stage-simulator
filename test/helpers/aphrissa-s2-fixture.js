// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {make as ownerFixture} from './aphrissa-s1-fixture.js';
import {prepareAphrissaS2, APHRISSA_S2_CONTRACT} from '../../server/sim/content/arkpedia-aphrissa-s2.js';
export {near, advance, until, enemy} from './aphrissa-s1-fixture.js';
export const make = options => ownerFixture({skill: 2, prepare: prepareAphrissaS2, contract: APHRISSA_S2_CONTRACT, ...options});
export function cast(f) {
  f.u.skill.setSpTotal(f.u.skill.spCost); assert.equal(f.u.skill.activate(), true);
  assert.ok(f.controller.state); assert.ok(f.controller.beam.phase);
  return f.controller.state;
}
