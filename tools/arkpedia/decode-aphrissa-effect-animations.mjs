// SPDX-License-Identifier: GPL-3.0-or-later
// Every original clip, including legacy wings and LineRenderer width channels.
// Source inspection only; no automatic effect dispatch or public admission.
import {decodeNativeEffectAnimations} from './native-effect-animation-export.mjs';
await decodeNativeEffectAnimations({operator:'char_4229_aphris', sourceDirectory:'aphrissa-source', clips:14,
  sourceManifest:'data/arkpedia-aphrissa-effects.json', manifestPath:'data/arkpedia-aphrissa-effect-animations.json',
  fixturePath:'test/fixtures/arkpedia-aphrissa-effect-clips.json', unboundAmbiguousPaths:1});
