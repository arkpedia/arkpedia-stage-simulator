// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/arkpedia-necrass-runtime-review.json' with { type: 'json' };
import { NECRASS_ID as ID } from './arkpedia-necrass-source.js';
import { NECRASS_ACTIVE_SKILLS_CONTRACT, prepareNecrassActiveSkills } from './arkpedia-necrass-skills.js';
import { NECRASS_S3_CONTRACT, prepareNecrassS3 } from './arkpedia-necrass-s3.js';

function reviewed() {
  if (JSON.stringify(review.enabledOperators) !== JSON.stringify([ID]) || review.frameParity !== false
    || review.moduleSupport !== false || review.nativeParticleSupport !== false
    || review.servantPolicy !== 'source-forms-zero-slots-v1'
    || review.s3Policy !== 'selected-six-upgrades-three-stack-range-v1')
    throw Error('Necrass lacks a complete public runtime review');
}
export function customizePublicNecrassKit({ battle, id, unit, kit }) {
  if (id !== ID) return;
  reviewed();
  const selected = unit.def.skill.id;
  const prepared = selected === 'skchr_necras_3'
    ? prepareNecrassS3(battle, unit, { contract: NECRASS_S3_CONTRACT })
    : prepareNecrassActiveSkills(battle, unit, { contract: NECRASS_ACTIVE_SKILLS_CONTRACT });
  Object.assign(kit, prepared.kit);
}
export function installPublicNecrass({ unit, def }) {
  if (def.charId !== ID) return;
  reviewed();
  if (!unit.mem.necrassController) throw Error('Missing selected Necrass controller');
  unit.mem.necrassController.install();
}
