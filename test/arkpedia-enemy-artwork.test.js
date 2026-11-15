// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {mergeEnemyArtwork,prepareEnemyArtwork,publishEnemyArtwork} from '../tools/arkpedia/enemy-artwork.mjs';
const key='enemy/enemy_example/default/default';
const model=()=>({kind:'enemy',id:'enemy_example',variant:'default',facing:'default',assetsCommit:'1'.repeat(40),
  spineVersion:'3.8.84',premultipliedAlpha:true,animations:{Idle:1},animationRoles:{idle:'Idle'}});

test('an independent enemy artwork addition preserves other models and is repeatable',()=>{
  const original={operator:{untouched:true}},registry={schemaVersion:1,models:{[key]:model()}};
  const first=mergeEnemyArtwork(original,registry);
  assert.deepEqual(original,{operator:{untouched:true}});assert.equal(first.operator,original.operator);
  assert.deepEqual(mergeEnemyArtwork(first,registry),first);
  assert.throws(()=>mergeEnemyArtwork(first,{...registry,models:{[key]:{...model(),assetsCommit:'2'.repeat(40)}}}),/Existing artwork differs/);
  for(const change of [{kind:'operator'},{assetsCommit:'main'},{spineVersion:'4.0.1'},{premultipliedAlpha:null},{animationRoles:{idle:'Missing'}}])
    assert.throws(()=>mergeEnemyArtwork({}, {...registry,models:{[key]:{...model(),...change}}}),/Unreviewed/);
});

test('adoption rejects changed committed bytes and mutable refs without touching destination data',async()=>{
  const root=await mkdtemp(join(tmpdir(),'enemy-artwork-'));
  try {
    const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();git(['init','-q']);
    const path='models/enemy/enemy_example/default/default/source/model.skel';await mkdir(join(root,path,'..'),{recursive:true});
    await writeFile(join(root,path),'changed skeleton');
    const record={...model(),skeleton:{path,bytes:16,sha256:'0'.repeat(64)},atlas:{path:path.replace('.skel','.atlas')},textures:[]};
    delete record.assetsCommit;
    await writeFile(join(root,'manifest.json'),JSON.stringify({models:{[key]:record}}));git(['add','.']);
    git(['-c','user.name=Artwork Test','-c','user.email=artwork@example.invalid','commit','-qm','Fixture']);
    const args={assetRoot:root,ids:['enemy_example'],commit:git(['rev-parse','HEAD'])};
    await assert.rejects(prepareEnemyArtwork({...args,commit:'HEAD'}),/full immutable/);
    await assert.rejects(prepareEnemyArtwork({...args,ids:['enemy_example','enemy_example']}),/unique explicit/);
    await assert.rejects(prepareEnemyArtwork(args),/Changed shared model file/);
  } finally {await rm(root,{recursive:true,force:true});}
});

test('explicit shared-file reuse permits only unchanged body bytes, roles and provenance',()=>{
 const file=path=>({path,bytes:10,sha256:'a'.repeat(64)});
 const before={...model(),skeleton:file('models/enemy/own/body.skel'),atlas:file('models/enemy/own/body.atlas'),textures:[file('models/enemy/own/body.png')]};
 const after={...before,assetsCommit:'2'.repeat(40),assetAlias:'enemy/enemy_original/default/default',
  skeleton:file('models/enemy/shared/body.skel'),atlas:file('models/enemy/shared/body.atlas'),textures:[file('models/enemy/shared/body.png')]};
 const apply=m=>mergeEnemyArtwork({[key]:before},{schemaVersion:1,models:{[key]:m}},{reuseFiles:true});
 assert.throws(()=>mergeEnemyArtwork({[key]:before},{schemaVersion:1,models:{[key]:after}}),/Existing artwork differs/);
 assert.deepEqual(apply(after)[key],after);
 assert.throws(()=>apply({...after,skeleton:{...after.skeleton,sha256:'b'.repeat(64)}}),/Existing artwork differs/);
 assert.throws(()=>apply({...after,animationRoles:{idle:'Idle',attack:{loop:'Idle'}}}),/Existing artwork differs/);
 assert.throws(()=>apply({...after,source:{different:true}}),/Existing artwork differs/);
});

test('published artwork is discoverable by the lightweight model loader without a separate rebuild', async () => {
 const root=await mkdtemp(join(tmpdir(),'enemy-artwork-client-'));
 try {
  const source=JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json',import.meta.url)));
  await mkdir(join(root,'data'));
  const snapshot={...source,operators:{char_123_fang:source.operators.char_123_fang},tokens:{},sd:{...source.sd,models:{[key]:model()}}};
  await publishEnemyArtwork(snapshot,{schemaVersion:1,models:{[key]:model()}},root);
  const index=JSON.parse(await readFile(join(root,'data/arkpedia-operators.json')));
  const {createOperatorLibrary}=await import('../shared/arkpedia/operator-library.js');
  const loaded=createOperatorLibrary(index,async url=>new Response(await readFile(join(root,url))));
  loaded.data.enemies={enemy_example:{prefabKey:'enemy_example'}};
  assert.deepEqual(loaded.data.sd.models,{}); await loaded.ensureModels([]);
  assert.deepEqual(loaded.data.sd.models[key],model());
 } finally {await rm(root,{recursive:true,force:true});}
});
