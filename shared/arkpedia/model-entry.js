// SPDX-License-Identifier: GPL-3.0-or-later
import {artBase} from './stage-art.js';

/** Same-kind body aliases share transport/cache identity and keep their own roles. */
export function modelEntry(sd,key) {
  const model=sd.models[key];if(!model)throw Error('Missing animation model '+key);
  const body=model.assetAlias?sd.models[model.assetAlias]:model;
  if(!body||body.assetAlias||model.assetAlias&&(!['enemy','device'].includes(model.kind)||body.kind!==model.kind
    ||JSON.stringify([model.skeleton,model.atlas,model.textures])!==JSON.stringify([body.skeleton,body.atlas,body.textures])))
    throw Error('Invalid shared animation body '+key);
  const base=artBase(body.assetsCommit?{...sd,commit:body.assetsCommit,localBase:body.localBase ?? sd.localModelBases?.[body.assetsCommit]}:sd);
  return {skel:base+body.skeleton.path,atlas:base+body.atlas.path,textures:body.textures.map(t=>base+t.path),
    pma:model.premultipliedAlpha,anims:model.animationRoles??{},animations:model.animations??{},hits:model.hits,bounds:model.bounds};
}
