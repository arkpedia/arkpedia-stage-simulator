// SPDX-License-Identifier: GPL-3.0-or-later
// Original mesh/view renderer profiles; no native frame or FX dispatch approval.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {createEffectPose} from '../../shared/arkpedia/native-effect-pose.js';
const root=new URL('../../',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
const source=JSON.parse(await readFile(new URL('data/arkpedia-aphrissa-effects.json',root))),
  raw=await readFile(new URL('.cache/arkpedia/aphrissa-source/effects/native-effects.bin',root));
assert.equal(sha(raw),source.pack.sha256);
const pack=JSON.parse(gunzipSync(raw)),animations=JSON.parse(await readFile(new URL('.cache/arkpedia/aphrissa-source/effects/native-animations.json',root)));
assert.equal(animations.sourcePackSha256,source.pack.sha256);
const rows={};
for(const name of Object.keys(pack.roots)){
  const pose=createEffectPose(pack,animations,name);
  for(const [id,r] of pose.renderers){
    const record=pack.records[id];
    if(record.type!=='ParticleSystemRenderer'||!r.enabled||record.data.m_RenderMode!==4||record.data.m_RenderAlignment!==0)continue;
    assert.ok(!rows[id]);
    const particle=pack.records[r.gameObject].references.map(ref=>ref.target).find(key=>pack.records[key]?.type==='ParticleSystem');
    assert.ok(particle);
    rows[id]={root:name,name:pack.records[r.gameObject].data.m_Name,serializedSha256:record.serializedSha256,
      data:record.data,references:record.references,particle,particleSha256:pack.records[particle].serializedSha256};
  }
}
assert.equal(Object.keys(rows).length,82);
const fixturePath='test/fixtures/arkpedia-aphrissa-mesh-alignment.json',bytes=Buffer.from(JSON.stringify(rows)+'\n');
await writeFile(new URL(fixturePath,root),bytes);
const metadata={schemaVersion:1,operator:pack.operator,version:pack.version,sourcePackSha256:sha(raw),
  scope:{originalProfiles:true,meshViewMapping:true,nativeFrameParity:false,fullEffectDispatchVerified:false,enabledOperators:[]},
  reference:{repository:'Unity-Technologies/UnityCsReference',commit:'b052b1fe38b45d5aefa609a115c626ed2e74f3a6',
    files:[{path:'Modules/ParticleSystem/Managed/ParticleSystemEnums.cs',bytes:14635,sha256:'cc34dc3bfc5e8abcf7f2654ac37bbdec2709728bcd604918cf55919b980cdb93'},
      {path:'Modules/ParticleSystemEditor/ParticleSystemModules/RendererModuleUI.cs',bytes:40913,sha256:'389f76cf2d12857f77f855230c847a67e6c2faecc4514177f7bcc59de4b04c01'}]},
  fixture:{path:fixturePath,bytes:bytes.length,sha256:sha(bytes)},counts:{renderers:Object.keys(rows).length,roots:new Set(Object.values(rows).map(r=>r.root)).size}};
await writeFile(new URL('data/arkpedia-aphrissa-mesh-alignment.json',root),JSON.stringify(metadata,null,2)+'\n');
console.log(JSON.stringify(metadata.counts));
