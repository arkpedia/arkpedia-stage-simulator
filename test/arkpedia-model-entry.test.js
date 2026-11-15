// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {modelEntry} from '../shared/arkpedia/model-entry.js';

for(const kind of ['enemy','device'])test(`${kind} bodies use one canonical URL across releases without sharing animation roles`,()=>{
 const first='a'.repeat(40),second='b'.repeat(40),main='c'.repeat(40);
 const body={kind,assetsCommit:first,localBase:`/arkpedia-assets/${first}/`,
  skeleton:{path:`models/${kind}/original/body.skel`},atlas:{path:`models/${kind}/original/body.atlas`},
  textures:[{path:`models/${kind}/original/body.png`}],premultipliedAlpha:true,animationRoles:{idle:'Idle'}};
 const alias={...body,assetAlias:'original',assetsCommit:second,localBase:`/arkpedia-assets/${second}/`,animationRoles:{idle:'Idle_B'}};
 const sd={repository:'arkpedia/arkpedia-sd-assets',commit:main,localBase:`/arkpedia-assets/${main}/`,models:{original:body,alias}};
 const a=modelEntry(sd,'original'),b=modelEntry(sd,'alias');
 assert.equal(a.skel,b.skel);assert.deepEqual(a.textures,b.textures);assert.equal(b.anims.idle,'Idle_B');assert.equal(a.anims.idle,'Idle');
 delete body.localBase;
 assert.equal(modelEntry(sd,'alias').skel,`https://raw.githubusercontent.com/arkpedia/arkpedia-sd-assets/${first}/models/${kind}/original/body.skel`);
 for(const edit of [s=>{delete s.models.original;},s=>{s.models.original.assetAlias='alias';},
  s=>{s.models.alias.textures=[{path:'models/enemy/different.png'}];},
  s=>{s.models.alias.kind=kind==='enemy'?'device':'enemy';}]){
  const changed=structuredClone(sd);edit(changed);assert.throws(()=>modelEntry(changed,'alias'),/Invalid shared animation body/);
 }
});
