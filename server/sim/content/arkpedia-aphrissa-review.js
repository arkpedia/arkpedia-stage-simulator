// SPDX-License-Identifier: GPL-3.0-or-later
// Review-only battle dispatch. Native fidelity and public admission remain held.
import {APHRISSA_ID as ID, APHRISSA_SKILLS} from './arkpedia-aphrissa-source.js';
import {aphrissaReviewSupport} from '../../../shared/arkpedia/aphrissa-review-operator.js';
import {prepareAphrissaS1, APHRISSA_S1_CONTRACT} from './arkpedia-aphrissa-s1.js';
import {prepareAphrissaS2, APHRISSA_S2_CONTRACT} from './arkpedia-aphrissa-s2.js';
import {prepareAphrissaS3, APHRISSA_S3_CONTRACT} from './arkpedia-aphrissa-s3.js';
import {prepareAphrissaLinePresentation} from './arkpedia-aphrissa-line-presentation.js';
import {APHRISSA_BEAM_CONTRACT} from '../../../shared/arkpedia/aphrissa-beam-presentation.js';
const kits = [[prepareAphrissaS1, APHRISSA_S1_CONTRACT],
  [prepareAphrissaS2, APHRISSA_S2_CONTRACT], [prepareAphrissaS3, APHRISSA_S3_CONTRACT]];
function held(b) {
  if (!aphrissaReviewSupport(ID, b.regularReviewCandidates))
    throw Error('Aphrissa requires the explicit isolated review candidate');
}
export function customizeReviewAphrissaKit({battle, id, unit, kit}) {
  if (id !== ID) return;
  held(battle);
  const index = APHRISSA_SKILLS.indexOf(unit.def.skill?.id);
  if (index < 0) throw Error('Missing original selected Aphrissa skill');
  const [prepare, contract] = kits[index], prepared = prepare(battle, unit, {contract});
  Object.assign(kit, prepared.kit); unit.mem.aphrissaOwner = prepared.controller;
}
export function installReviewAphrissa({battle, unit, def}) {
  if (def.charId !== ID) return;
  held(battle);
  if (!unit.mem.aphrissaOwner) throw Error('Missing selected Aphrissa review owner');
  unit.mem.aphrissaOwner.parts.push(prepareAphrissaLinePresentation(battle,unit,{contract:APHRISSA_BEAM_CONTRACT}));
  unit.mem.aphrissaOwner.install();
}
