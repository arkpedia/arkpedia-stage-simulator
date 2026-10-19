// SPDX-License-Identifier: GPL-3.0-or-later
// Original line profiles only; endpoint scripts and game globals remain held.
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createEffectLine} from '../../shared/arkpedia/native-effect-line.js';
const root=new URL('../../',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
const effects=JSON.parse(await readFile(new URL('data/arkpedia-aphrissa-effects.json',root))),raw=await readFile(new URL('.cache/arkpedia/aphrissa-source/effects/native-effects.bin',root));
assert.equal(sha(raw),effects.pack.sha256);
const pack=JSON.parse(gunzipSync(raw)),records=pack.records,roots={},lines={};
const refs=(id,field)=>(records[id].references??[]).filter(r=>r.field===field).map(r=>r.target);
for(const name of ['aphris_attack_01_line_01','aphris_skill_02_line_01','aphris_skill_03_line_01']){
  const found=[],visited=new Set();
  function walk(go){
    assert.ok(!visited.has(go));visited.add(go);
    for(const id of refs(go,'component')){
      if(records[id].type==='LineRenderer'){
        createEffectLine(records[id].data);found.push(id);lines[id]=records[id];
      }
      if(records[id].type==='Transform')for(const child of refs(id,'m_Children')){
        const gos=refs(child,'m_GameObject');assert.equal(gos.length,1);walk(gos[0]);
      }
    }
  }
  walk(pack.roots[name]);assert.equal(found.length,8);roots[name]=found;
}
assert.deepEqual(Object.keys(lines).sort(),Object.keys(records).filter(k=>records[k].type==='LineRenderer').sort());
const fixturePath='test/fixtures/arkpedia-aphrissa-lines.json',bytes=Buffer.from(JSON.stringify(lines)+'\n');
await writeFile(new URL(fixturePath,root),bytes);
await writeFile(new URL('data/arkpedia-aphrissa-lines.json',root),JSON.stringify({schemaVersion:1,operator:pack.operator,
  version:pack.version,sourcePackSha256:sha(raw),scope:{originalProfiles:true,explicitEndpointsRequired:true,
    nativeEndpointDispatchVerified:false,nativeShaderGlobalsVerified:false,compiledFrameParity:false,enabledOperators:[]},
  fixture:{path:fixturePath,bytes:bytes.length,sha256:sha(bytes)},roots,
  lines:Object.fromEntries(Object.entries(lines).map(([id,r])=>[id,{sourceSha256:r.serializedSha256,
    material:refs(id,'m_Materials')[0],worldSpace:r.data.m_UseWorldSpace,textureMode:r.data.m_Parameters.textureMode}]))},null,2)+'\n');
console.log(JSON.stringify({originalLines:Object.keys(lines).length,roots:Object.keys(roots).length,fixtureBytes:bytes.length}));
