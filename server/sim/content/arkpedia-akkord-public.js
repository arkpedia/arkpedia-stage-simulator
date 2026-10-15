// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/arkpedia-akkord-runtime-review.json' with { type: 'json' };
import { AKKORD_ID as ID } from './arkpedia-akkord-source.js';
import { prepareAkkord, AKKORD_CONTRACT } from './arkpedia-akkord.js';
function reviewed() {
  if (JSON.stringify(review.enabledOperators) !== JSON.stringify([ID]) || review.frameParity !== false
    || review.moduleSupport !== false || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-line-and-ally-bursts-v1'
    || review.verification.browser.status !== 'passed') throw Error('Missing Akkord selected runtime review');
}
export function customizePublicAkkordKit({ battle, id, unit, kit }) {
  if (id !== ID) return;
  reviewed(); Object.assign(kit, prepareAkkord(battle, unit, { contract: AKKORD_CONTRACT }).kit);
}
export function installPublicAkkord({ unit, def }) {
  if (def.charId !== ID) return;
  reviewed(); if (!unit.mem.akkord) throw Error('Missing Akkord source controller');
  unit.mem.akkord.install();
}
