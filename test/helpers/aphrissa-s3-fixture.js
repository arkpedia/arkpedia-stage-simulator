// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {make as ownerFixture, until} from './aphrissa-s1-fixture.js';
import {prepareAphrissaS3, APHRISSA_S3_CONTRACT} from '../../server/sim/content/arkpedia-aphrissa-s3.js';
export {near, advance, until, enemy} from './aphrissa-s1-fixture.js';
export const make = options => ownerFixture({skill: 3, prepare: prepareAphrissaS3, contract: APHRISSA_S3_CONTRACT, ...options});
export function cast(f) {
  until(f, () => f.b.time + 1e-7 >= f.controller.ordinary.bornUntil, 2);
  f.u.skill.setSpTotal(f.u.skill.spCost); assert.equal(f.u.skill.activate(), true);
  assert.equal(f.controller.state.stage, 'charge'); return f.controller.state;
}
export function ready(f) { cast(f); until(f, () => f.controller.state?.stage === 'active', 4); }
