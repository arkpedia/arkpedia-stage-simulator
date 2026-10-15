// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/arkpedia-jcinta-runtime-review.json' with { type: 'json' };
import { JCINTA_ID as ID } from './arkpedia-jcinta-source.js';
import { prepareJcinta, JCINTA_CONTRACT } from './arkpedia-jcinta.js';
function reviewed() {
  if (JSON.stringify(review.enabledOperators) !== JSON.stringify([ID]) || review.frameParity !== false
    || review.moduleSupport !== false || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-override-channel-and-flying-sanctuary-v1'
    || review.verification.browser.status !== 'passed')
    throw Error('Missing Jacinta selected runtime review');
}
export function customizePublicJcintaKit({ battle, id, unit, kit }) {
  if (id !== ID) return;
  reviewed(); Object.assign(kit, prepareJcinta(battle, unit, { contract: JCINTA_CONTRACT }).kit);
}
export function installPublicJcinta({ unit, def }) {
  if (def.charId !== ID) return;
  reviewed(); if (!unit.mem.jcinta) throw Error('Missing Jacinta source controller');
  unit.mem.jcinta.install();
}
