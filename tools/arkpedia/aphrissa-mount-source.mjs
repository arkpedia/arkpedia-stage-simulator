// SPDX-License-Identifier: GPL-3.0-or-later
// Recover literal default-skin muzzle pointers and BoneFollower inputs.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const sha=b=>createHash('sha256').update(b).digest('hex'),ID='char_4229_aphris',
  foundation='data/arkpedia-native-operators/'+ID+'.json',models='data/arkpedia-aphrissa-review-models.json';
export async function recoverAphrissaMounts({read=readFile}={}){
  const [raw,modelRaw]=await Promise.all([foundation,models].map(p=>read(new URL('../../'+p,import.meta.url))));
  assert.equal(sha(raw),'77207d3d44737940e6bc4aee4a4a57abea27a1490d3870168e9f1615527ca254');
  const source=JSON.parse(raw),assets=JSON.parse(modelRaw),rows=source.artworkHierarchy[ID],
    controller=source.chararts[ID][0],by=new Map(rows.flatMap(row=>row.components.map(c=>[c.pathId,{...c,object:row.object}]))),bindings={};
  assert.equal(controller.data.m_Enabled,1);assert.equal(source.chararts[ID].length,1);
  for(const face of ['Front','Back']){
    const selected=controller.data['_'+face.toLowerCase()],pointer=selected.muzzlaTransform,
      transform=by.get(pointer.m_PathID),row=rows.find(r=>r.components.some(c=>c.pathId===pointer.m_PathID)),
      followers=row?.components.filter(c=>typeof c.data.boneName==='string'),official=source.officialSkeletonBindings[ID][face],
      modelKey=`operator/${ID}/default/${face.toLowerCase()}`,model=assets.models[modelKey];
    assert.equal(pointer.m_FileID,0);assert.equal(transform?.type,'Transform');assert.equal(followers?.length,1);
    const follower=followers[0];assert.equal(follower.data.m_Enabled,1);
    assert.equal(follower.data.boneName,face==='Front'?'F_Muzzle':'B_Muzzle');
    assert.equal(selected.skeleton.m_PathID,official.skeletonAnimationPathId);assert.equal(selected.skeleton.m_FileID,0);
    assert.equal(follower.data.skeletonRenderer.m_PathID,official.skeletonAnimationPathId);assert.equal(follower.data.skeletonRenderer.m_FileID,0);
    assert.equal(model.skeleton.sha256,official.sha256);assert.equal(model.skeleton.bytes,official.bytes);
    for(const name of ['followXYPosition','followZPosition','followBoneRotation','followSkeletonFlip','followLocalScale','maintainedAxisOrientation','initializeOnAwake'])
      assert.equal(follower.data[name],1);
    assert.equal(follower.data.useAppliedLocalScale,0);
    const ancestors=[],seen=new Set();let current=transform;
    while(current){
      assert.equal(current.type,'Transform');assert.equal(seen.has(current.pathId),false);seen.add(current.pathId);
      ancestors.push({pathId:current.pathId,object:current.object,data:structuredClone(current.data)});
      const p=current.data.m_Father;assert.equal(p.m_FileID,0);current=p.m_PathID==='0'?null:by.get(p.m_PathID);if(p.m_PathID!=='0')assert.ok(current);
    }
    bindings[modelKey]={face,bone:follower.data.boneName,controller:controller.pathId,controllerField:'_'+face.toLowerCase()+'.muzzlaTransform',
      skeletonAnimation:official.skeletonAnimationPathId,skeleton:{bytes:official.bytes,sha256:official.sha256},
      transform:pointer.m_PathID,follower:{pathId:follower.pathId,data:structuredClone(follower.data)},ancestors};
  }
  return {schemaVersion:1,operator:ID,foundation:{path:foundation,sha256:sha(raw)},models:{path:models,sha256:sha(modelRaw),commit:assets.commit},bindings,
    scope:{sourceInputsOnly:true,originalMuzzleBones:true,nativeMountTypeMappingVerified:false,nativeDepthVerified:false,nativeRotationVerified:false,compiledFrameParity:false,enabledOperators:[]}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const path=new URL('../../data/arkpedia-aphrissa-mounts.json',import.meta.url),bytes=JSON.stringify(await recoverAphrissaMounts(),null,2)+'\n';
  if(process.argv.includes('--write'))await writeFile(path,bytes);else assert.equal(await readFile(path,'utf8'),bytes);
  console.log('Original Aphrissa front/back muzzle pointers, follower fields and skeleton identities verified.');
}
