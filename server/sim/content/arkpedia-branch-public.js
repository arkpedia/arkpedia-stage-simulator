// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/arkpedia-branch-runtime-review.json' with { type: 'json' };
import { BRANCH_ID as ID } from './arkpedia-branch-source.js';
import { prepareBranch, BRANCH_CONTRACT } from './arkpedia-branch.js';
function reviewed(battle) {
  const approved = JSON.stringify(review.enabledOperators) === JSON.stringify([ID]) && review.verification.browser.status === 'passed';
  const candidate = battle.regularReviewCandidates?.includes(ID) && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !candidate) || review.frameParity !== false || review.moduleSupport !== false
    || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-upstream-unyield-activation-pulse-and-parented-resistance-v1')
    throw Error('Missing Vetochki selected runtime review or explicit held browser candidate');
}
export function customizePublicBranchKit({ battle, id, unit, kit }) {
  if (id !== ID) return;
  reviewed(battle); Object.assign(kit, prepareBranch(battle, unit, { contract: BRANCH_CONTRACT }).kit);
}
export function installPublicBranch({ battle, unit, def }) {
  if (def.charId !== ID) return;
  reviewed(battle); if (!unit.mem.branch) throw Error('Missing Vetochki selected source controller');
  unit.mem.branch.install();
}
