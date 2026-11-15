// SPDX-License-Identifier: GPL-3.0-or-later
import native from '../../data/arkpedia-device-native-source.json' with { type: 'json' };

/** The original pulse selects characters on both sides, including air and
 * target-free characters. Category-2 stage objects are outside that selector. */
export function altarSelectorReviewed(source = native) {
  const selector = source.prefabs.sktok_ore?.components.find(c => '_targetCategory' in c.data)?.data;
  return selector?._targetSide === 3 && selector._targetMotion === 3 && selector._targetCategory === 1
    && selector._postFilter === 0 && selector._ignoreTargetFree === 1 && selector._limitTargetNum === 0;
}
export { altarSelectsUnit } from './stage-device-geometry.js';
