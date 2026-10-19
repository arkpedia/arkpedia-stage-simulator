// SPDX-License-Identifier: GPL-3.0-or-later
// Bind literal native effect keys to recovered roots, without enabling any renderer.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const foundationPath='data/arkpedia-native-operators/char_4229_aphris.json',effectPath='data/arkpedia-aphrissa-effects.json',
 foundation=await readFile(new URL(foundationPath,root)),raw=await readFile(new URL(effectPath,root)),source=JSON.parse(foundation),effects=JSON.parse(raw);
assert.equal(sha(foundation),'77207d3d44737940e6bc4aee4a4a57abea27a1490d3870168e9f1615527ca254');
assert.equal(effects.operator,source.operatorId);assert.equal(effects.version,source.source.nativeClient);
assert.equal(effects.scope.sourceInputsOnly,true);assert.deepEqual(effects.scope.enabledOperators,[]);assert.equal(effects.scope.rendererVerified,false);
const references=[],audio=[];
function walk(value,path){
 if(Array.isArray(value)){value.forEach((v,i)=>walk(v,[...path,i]));return;}
 if(!value||typeof value!=='object')return;
 for(const [key,v] of Object.entries(value)){
  if(typeof v==='string'&&v){
   if(key.toLowerCase().includes('effect')){assert.ok(Object.hasOwn(effects.roots,v),'Missing original effect root: '+v);references.push({path:[...path,key],key:v,root:effects.roots[v]});}
   else if(key.toLowerCase().includes('audio'))audio.push({path:[...path,key],key:v});
  }
  walk(v,[...path,key]);
 }
}
for(const section of ['characters','skills','tokens','templates','originalTemplates','chararts'])walk(source[section],[section]);
const referred=new Set(references.map(r=>r.key));
const proof={schemaVersion:1,operator:source.operatorId,sourceInputsOnly:true,enabledOperators:[],rendererVerified:false,compiledFrameParity:false,
 foundation:{path:foundationPath,sha256:sha(foundation)},effects:{path:effectPath,sha256:sha(raw),packSha256:effects.pack.sha256},
 scope:'Literal nonempty effect-string references in retained native owner, skill, token, buff and art graphs. This is name/pointer closure only; it does not decode compiled dispatch, recover audio, certify rendering or omit other roots not represented by those string fields.',
 references,audioReferences:audio,otherRecoveredRoots:Object.keys(effects.roots).filter(k=>!referred.has(k)),unresolvedResources:effects.unresolvedReferences};
await writeFile(new URL('data/arkpedia-aphrissa-effect-bindings.json',root),JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify({literalReferences:references.length,distinctVisualKeys:referred.size,originalRoots:Object.keys(effects.roots).length,audioReferences:audio.length,unresolvedResources:Object.keys(effects.unresolvedReferences).length,rendererVerified:false}));
