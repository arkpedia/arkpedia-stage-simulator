// SPDX-License-Identifier: GPL-3.0-or-later
// Original sparse streamed clips only. No Animator/LineRenderer/legacy playback approval.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
const sourcePath='data/arkpedia-aphrissa-effects.json',raw=await readFile(new URL('.cache/arkpedia/aphrissa-source/effects/native-effects.bin',root)),meta=JSON.parse(await readFile(new URL(sourcePath,root))),p=JSON.parse(gunzipSync(raw));
assert.equal(sha(raw),meta.pack.sha256);assert.equal(p.operator,'char_4229_aphris');
const ids=['-3088286371521274073','-8115792472694310859','-8232402816411576581','8827570236896215454','9202160748780865613'];
const clips={};
for(const id of ids){const key='battle/prefabs/effects/aphris.ab:'+id,r=p.records[key];assert.equal(r.type,'AnimationClip');const d=r.data,m=d.m_MuscleClip;
 const data=Object.fromEntries(['m_Name','m_RotationCurves','m_CompressedRotationCurves','m_EulerCurves','m_PositionCurves','m_ScaleCurves','m_FloatCurves','m_PPtrCurves','m_ClipBindingConstant'].map(k=>[k,d[k]]));
 data.m_MuscleClip={m_StartTime:m.m_StartTime,m_StopTime:m.m_StopTime,m_LoopTime:m.m_LoopTime,m_Clip:m.m_Clip,m_ValueArrayDelta:m.m_ValueArrayDelta};clips[key]={sourceSha256:r.serializedSha256,data};}
const fixturePath='test/fixtures/arkpedia-aphrissa-streamed-initial-values.json',bytes=Buffer.from(JSON.stringify(clips)+'\n');await writeFile(new URL(fixturePath,root),bytes);
await writeFile(new URL('data/arkpedia-aphrissa-streamed-initial-values.json',root),JSON.stringify({schemaVersion:1,operator:p.operator,sourceInputsOnly:true,enabledOperators:[],compiledFrameParity:false,rendererVerified:false,sourcePackSha256:sha(raw),fixture:{path:fixturePath,bytes:bytes.length,sha256:sha(bytes)},clips:Object.fromEntries(Object.entries(clips).map(([k,r])=>[k,{name:r.data.m_Name,sourceSha256:r.sourceSha256}]))},null,2)+'\n');console.log(JSON.stringify({originalClips:ids.length,fixtureBytes:bytes.length,rendererVerified:false}));
