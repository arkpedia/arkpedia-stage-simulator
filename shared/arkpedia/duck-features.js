// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../data/candidates/arkpedia-reviewed-duck-run.json' with { type: 'json' };
import { familyFeature } from './chapter16-features.js';
export const DUCK_FEATURES = {
  'talent:run': familyFeature(review, 'duckRun', 'nativeDuckRun'),
};
