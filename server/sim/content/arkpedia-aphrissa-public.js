// SPDX-License-Identifier: GPL-3.0-or-later
// Public battle dispatch, gated on the runtime review. Native effect/FSM fidelity stays unapproved.
import review from '../../../data/arkpedia-aphrissa-runtime-review.json' with {type: 'json'};
import {prepareAphrissaStatePresentation} from './arkpedia-aphrissa-state-presentation.js';
import {APHRISSA_STATE_CONTRACT} from '../../../shared/arkpedia/aphrissa-state-presentation.js';
import {prepareAphrissaHitPresentation} from './arkpedia-aphrissa-hit-presentation.js';
import {APHRISSA_HIT_CONTRACT} from '../../../shared/arkpedia/aphrissa-hit-presentation.js';
import {APHRISSA_ID as ID, APHRISSA_SKILLS} from './arkpedia-aphrissa-source.js';
import {prepareAphrissaS1, APHRISSA_S1_CONTRACT} from './arkpedia-aphrissa-s1.js';
import {prepareAphrissaS2, APHRISSA_S2_CONTRACT} from './arkpedia-aphrissa-s2.js';
import {prepareAphrissaS3, APHRISSA_S3_CONTRACT} from './arkpedia-aphrissa-s3.js';
import {prepareAphrissaLinePresentation} from './arkpedia-aphrissa-line-presentation.js';
import {APHRISSA_BEAM_CONTRACT} from '../../../shared/arkpedia/aphrissa-beam-presentation.js';
const kits = [[prepareAphrissaS1, APHRISSA_S1_CONTRACT],
  [prepareAphrissaS2, APHRISSA_S2_CONTRACT], [prepareAphrissaS3, APHRISSA_S3_CONTRACT]];
function reviewed(b) {
  const approved = JSON.stringify(review.enabledOperators) === JSON.stringify([ID]) && review.verification.browser.status === 'passed';
  const candidate = b.regularReviewCandidates?.includes(ID) && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !candidate) || review.frameParity !== false || review.moduleSupport !== false
    || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-aphrissa-relay-rays-owned-skills-v1')
    throw Error('Missing Aphrissa runtime review or explicit held browser candidate');
}
export function customizePublicAphrissaKit({battle, id, unit, kit}) {
  if (id !== ID) return;
  reviewed(battle);
  const index = APHRISSA_SKILLS.indexOf(unit.def.skill?.id);
  if (index < 0) throw Error('Missing original selected Aphrissa skill');
  const [prepare, contract] = kits[index], prepared = prepare(battle, unit, {contract});
  Object.assign(kit, prepared.kit); unit.mem.aphrissaOwner = prepared.controller;
}
export function installPublicAphrissa({battle, unit, def}) {
  if (def.charId !== ID) return;
  reviewed(battle);
  if (!unit.mem.aphrissaOwner) throw Error('Missing selected Aphrissa owner');
  unit.mem.aphrissaOwner.parts.push(prepareAphrissaLinePresentation(battle,unit,{contract:APHRISSA_BEAM_CONTRACT}));
  unit.mem.aphrissaOwner.parts.push(prepareAphrissaHitPresentation(battle,unit,{contract:APHRISSA_HIT_CONTRACT}));
  unit.mem.aphrissaOwner.parts.push(prepareAphrissaStatePresentation(battle,unit,{contract:APHRISSA_STATE_CONTRACT}));
  unit.mem.aphrissaOwner.install();
}
