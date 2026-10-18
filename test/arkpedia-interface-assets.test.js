// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import {interfaceAssetUrl} from '../shared/arkpedia/interface-assets.js';
import normal from '../data/arkpedia-mvp.json' with{type:'json'};
import {operatorAssetName,skillIconFile} from '../shared/arkpedia/battle-ui.js';
const IMAGE='arkpedia/arkpedia-image-assets',SKIN='arkpedia/arkpedia-skin-assets',pin='1'.repeat(40),file='skill-icons/Aegis - Orgia Mode.webp';
test('Operator portraits, E0 and skill URLs use the declared per-file revision or their original repository pin',()=>{
 for(const op of Object.values(normal.operators)){
  const folder=['one','two','three','four','five','six'][op.rarity-1];
  for(const[repo,kind]of[[IMAGE,'icons'],[SKIN,'skins']]){
   const path=`${folder}-star-${kind}/${operatorAssetName(op.name)} - Base.webp`;
   assert.equal(interfaceAssetUrl(normal,repo,path),`https://raw.githubusercontent.com/${repo}/${normal.interfaceAssets?.[repo]?.[path]?.commit??normal.sources[repo]}/${folder}-star-${kind}/${encodeURIComponent(operatorAssetName(op.name)+' - Base.webp')}`);
  }
  for(const skill of op.skills){const path=skill.assetIcon??(skillIconFile(op.name,skill.levels.at(-1)?.name)?'skill-icons/'+skillIconFile(op.name,skill.levels.at(-1).name):null);
   if(path)assert.equal(interfaceAssetUrl(normal,IMAGE,path),`https://raw.githubusercontent.com/${IMAGE}/${normal.interfaceAssets?.[IMAGE]?.[path]?.commit??normal.sources[IMAGE]}/${path.split('/').map(encodeURIComponent).join('/')}`);}
 }
});
test('One reviewed file can use a newer immutable revision while all other image/skin paths keep their existing pins',()=>{
 const d={...normal,interfaceAssets:{[IMAGE]:{[file]:{commit:pin,bytes:100,sha256:'2'.repeat(64)}}}};
 assert.ok(interfaceAssetUrl(d,IMAGE,file).includes('/'+pin+'/'));assert.ok(interfaceAssetUrl(d,IMAGE,'five-star-icons/Aegis - Base.webp').includes('/'+normal.sources[IMAGE]+'/'));
 assert.ok(interfaceAssetUrl(d,SKIN,'five-star-skins/Aegis - Base.webp').includes('/'+normal.sources[SKIN]+'/'));
});
for(const path of['','/x','x/','x//y','../x','x/../y','./x','x\\y','x?y','x#y','x%2fy','x\n'])test(`Unsafe path ${JSON.stringify(path)} fails closed`,()=>assert.throws(()=>interfaceAssetUrl(normal,IMAGE,path),/Invalid/));
for(const change of['repo','revision','digest','bytes','missingPin'])test(`Changed ${change} cannot produce an unreviewed interface URL`,()=>{
 const d={sources:{[IMAGE]:pin},interfaceAssets:{[IMAGE]:{[file]:{commit:pin,bytes:100,sha256:'2'.repeat(64)}}}};let repo=IMAGE;
 if(change==='repo')repo='other/host';if(change==='revision')d.interfaceAssets[IMAGE][file].commit='main';if(change==='digest')d.interfaceAssets[IMAGE][file].sha256='unknown';
 if(change==='bytes')d.interfaceAssets[IMAGE][file].bytes=0;if(change==='missingPin'){delete d.interfaceAssets;delete d.sources[IMAGE];}
 assert.throws(()=>interfaceAssetUrl(d,repo,file));
});

for(const entry of[null,undefined,{},false,{bytes:1,sha256:'2'.repeat(64)},{commit:null,bytes:1,sha256:'2'.repeat(64)}])test(`A declared malformed override ${JSON.stringify(entry)} cannot silently fall back to a different revision`,()=>{
 const d={...normal,interfaceAssets:{[IMAGE]:{[file]:entry}}};assert.throws(()=>interfaceAssetUrl(d,IMAGE,file),/Missing immutable/);
});
