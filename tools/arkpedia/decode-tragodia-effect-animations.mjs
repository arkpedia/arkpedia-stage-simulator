// SPDX-License-Identifier: GPL-3.0-or-later
// Original Tragodia material channels and bindings; not Unity Animator dispatch.
import {decodeNativeEffectAnimations} from './native-effect-animation-export.mjs';
await decodeNativeEffectAnimations({operator:'char_1042_phatm2', sourceDirectory:'tragodia-source', clips:9,
  sourceManifest:'data/arkpedia-tragodia-effects.json', manifestPath:'data/arkpedia-tragodia-effect-animations.json',
  fixturePath:'test/fixtures/arkpedia-tragodia-effect-clips.json', unresolvedBindings:8, materialSlotBindings:28,
  missingPaths:['4789322998410703540', '-7713096106645049908'].map(clip =>
    `battle/prefabs/effects/phatm2.ab:5425053024947775554:battle/prefabs/effects/phatm2.ab:${clip}:3711244079`)});
