// SPDX-License-Identifier: GPL-3.0-or-later
// Recover every pinned source channel; no public operator or renderer enablement.
import {decodeNativeEffectAnimations} from './native-effect-animation-export.mjs';
await decodeNativeEffectAnimations({operator:'char_1038_whitw2', sourceDirectory:'lappland-alter-source', clips:10,
  sourceManifest:'data/arkpedia-lappland-effects.json', manifestPath:'data/arkpedia-lappland-effect-animations.json',
  fixturePath:'test/fixtures/arkpedia-lappland-effect-clips.json'});
