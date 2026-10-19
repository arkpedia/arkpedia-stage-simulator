// SPDX-License-Identifier: GPL-3.0-or-later
// Public delivery of Aphrissa's original beam/hit/aura package from the pinned SD
// commit. Beam endpoints sit at a fixed height above the target tile, hits at a
// fixed height above the hit cell, and both use identity orientation: explicit
// local mappings, not recovered native mount behaviour.
import review from '../../data/arkpedia-aphrissa-runtime-review.json' with {type:'json'};
import effects from '../../data/arkpedia-aphrissa-effects.json' with {type:'json'};
import animationMeta from '../../data/arkpedia-aphrissa-effect-animations.json' with {type:'json'};
import shaderMeta from '../../data/arkpedia-aphrissa-effect-shaders.json' with {type:'json'};
import {APHRISSA_BEAM_CONTRACT} from '../../shared/arkpedia/aphrissa-beam-presentation.js';
import {APHRISSA_STATE_CONTRACT} from '../../shared/arkpedia/aphrissa-state-presentation.js';
import {validateAphrissaPointSources} from '../../shared/arkpedia/aphrissa-point-sources.js';
import {validateAphrissaStateSources} from '../../shared/arkpedia/aphrissa-state-presentation.js';
import {validateAphrissaHitSources} from '../../shared/arkpedia/aphrissa-hit-presentation.js';
import {createNativeEffectLibrary,compileNativeEffectPrograms} from './native-effect-player.js';
import {readPinnedEffectBytes} from './tragodia-assets.js';
import {createAphrissaStageBeams} from './aphrissa-stage-beams.js';
import {createAphrissaActorMounts} from './aphrissa-actor-mounts.js';
import {createAphrissaStateMounts} from './aphrissa-state-mounts.js';
import {APHRISSA_PREPARED_ROOTS} from './aphrissa-roots.js';
export const APHRISSA_BEAM_END_HEIGHT = 0.6499999761581421, APHRISSA_HIT_HEIGHT = 0.4;
const IDENTITY = () => ({rotation: [0, 0, 0, 1], scale: [1, 1, 1]});
const hash = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
export async function loadAphrissaStageEffects({three: T, stage, descriptor}) {
  if (descriptor?.repository !== 'arkpedia/arkpedia-sd-assets' || !/^[a-f0-9]{40}$/.test(descriptor.commit ?? '')
    || JSON.stringify(descriptor.manifest) !== JSON.stringify(review.nativeEffectManifest)) throw Error('Unreviewed Aphrissa effect delivery');
  const local = `/arkpedia-assets/${descriptor.commit}/`;
  if (descriptor.localBase !== undefined && descriptor.localBase !== local) throw Error('Invalid local Aphrissa effect base');
  const base = descriptor.localBase ?? `https://raw.githubusercontent.com/${descriptor.repository}/${descriptor.commit}/`;
  const meta = JSON.parse(new TextDecoder().decode(await readPinnedEffectBytes(base, descriptor.manifest)));
  if (meta.operator !== effects.operator || meta.resourceVersion !== effects.version || JSON.stringify(meta.pack) !== JSON.stringify(effects.pack)
    || JSON.stringify(meta.animations) !== JSON.stringify(animationMeta.artifact) || JSON.stringify(meta.shaders) !== JSON.stringify(shaderMeta.artifact)
    || JSON.stringify(meta.textures) !== JSON.stringify(effects.textures) || JSON.stringify(meta.roots) !== JSON.stringify(effects.roots)
    || meta.scope.publicBattleApproved !== false || meta.scope.nativePixelParity !== false
    || JSON.stringify(meta.scope.preparedRoots) !== JSON.stringify(APHRISSA_PREPARED_ROOTS)) throw Error('Unreviewed Aphrissa effect package');
  const prefix = base + descriptor.manifest.path.slice(0, -'manifest.json'.length);
  const bytes = e => readPinnedEffectBytes(prefix, e), json = async e => JSON.parse(new TextDecoder().decode(await bytes(e)));
  const decoded = await new Response(new Blob([await bytes(meta.pack)]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  if (decoded.byteLength !== meta.pack.decodedBytes || await hash(decoded) !== meta.pack.decodedSha256) throw Error('Changed decoded Aphrissa effect pack');
  const pack = JSON.parse(new TextDecoder().decode(decoded));
  const [animations, shaders, builtinMeshes] = await Promise.all([meta.animations, meta.shaders, meta.builtinMeshes].map(json));
  if (animations.sourcePackSha256 !== meta.pack.sha256 || pack.operator !== meta.operator || pack.version !== meta.resourceVersion
    || shaders.operator !== meta.operator || shaders.version !== meta.resourceVersion || !builtinMeshes.supportedEffectPacks?.[meta.pack.sha256])
    throw Error('Changed Aphrissa effect source bindings');
  validateAphrissaPointSources(pack, animations);
  validateAphrissaHitSources(pack, animations);
  validateAphrissaStateSources(pack, animations);
  compileNativeEffectPrograms(stage.three, shaders);
  const shaderGlobals = {_HG_UV_ROTATION: 0};
  const library = createNativeEffectLibrary({three: T, pack, animations, shaders, builtinMeshes, shaderGlobals, loadTexture: async e => {
    const url = URL.createObjectURL(new Blob([await bytes(e)], {type: 'image/webp'}));
    try { return await new T.TextureLoader().loadAsync(url); } finally { URL.revokeObjectURL(url); }
  }});
  let mounts = null, stateMounts = null;
  try {
    // Fail at preload, not mid-battle, if any prepared root cannot be built.
    // Line roots take their endpoints from the beam pass; the probe owns none.
    for (const root of APHRISSA_PREPARED_ROOTS) {
      const probe = await library.create(root, {linePositions: () => null});
      try { if (probe.inspection !== null || probe.blocked.length) throw Error('Unplayable original Aphrissa root: ' + root); } finally { probe.dispose(); }
    }
    mounts = createAphrissaActorMounts({three: T, renderer: stage, contract: APHRISSA_BEAM_CONTRACT,
      endAt: ({point}) => [point.col, stage.heightAt(point.row, point.col) + APHRISSA_BEAM_END_HEIGHT, point.row], orientationAt: IDENTITY});
    stateMounts = createAphrissaStateMounts({three: T, renderer: stage, contract: APHRISSA_STATE_CONTRACT,
      anchorFor: ({state}) => state.kind.startsWith('charge') ? 'specialPoint1' : state.kind === 'wing' ? 'specialPoint0' : 'actorFoot', orientationAt: IDENTITY});
    const pass = createAphrissaStageBeams({three: T, library, sourcePackSha256: meta.pack.sha256, contract: APHRISSA_BEAM_CONTRACT,
      heightAt: (r, c) => stage.heightAt(r, c), anchorAt: mounts.anchorAt, pointFrameAt: mounts.pointFrameAt, stateFrameAt: stateMounts.stateFrameAt,
      hitFrameAt: ({hit}) => ({position: [hit.x, stage.heightAt(hit.row, hit.col) + APHRISSA_HIT_HEIGHT, hit.y], ...IDENTITY()}), shaderGlobals});
    const dispose = pass.dispose;
    pass.dispose = () => { try { dispose(); } finally { mounts.dispose(); stateMounts.dispose(); library.dispose(); } };
    return pass;
  } catch (error) { mounts?.dispose(); stateMounts?.dispose(); library.dispose(); throw error; }
}
