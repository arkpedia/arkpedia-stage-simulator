// SPDX-License-Identifier: GPL-3.0-or-later
// Match a rendered sprite bone in the actor's camera-facing depth plane.
// This is a local embedding of the existing Pixi actor, not native game depth.
export function actorBoneAnchor({three:T,spine,boneName,boardPosition,camera,width,height}){
  if(!T||!spine?.skeleton||typeof spine.toGlobal!=='function'||typeof boneName!=='string'||!boneName
    ||!Array.isArray(boardPosition)||boardPosition.length!==3||!Array.from(boardPosition).every(Number.isFinite)
    ||!camera?.isCamera||!Number.isFinite(width)||width<=0||!Number.isFinite(height)||height<=0)
    throw Error('Invalid rendered bone anchor inputs');
  const bone=spine.skeleton.findBone(boneName);
  if(!bone||bone.active===false||![bone.worldX,bone.worldY].every(Number.isFinite))throw Error('Missing active original actor bone');
  // toGlobal updates Pixi's parent/display transforms without advancing Spine.
  const pixel=spine.toGlobal({x:bone.worldX,y:bone.worldY});
  if(!pixel||![pixel.x,pixel.y].every(Number.isFinite))throw Error('Invalid rendered bone position');
  camera.updateMatrixWorld(true);
  if([...camera.matrixWorld.elements,...camera.matrixWorldInverse.elements,...camera.projectionMatrix.elements,...camera.projectionMatrixInverse.elements].some(v=>!Number.isFinite(v))
    ||Math.abs(camera.matrixWorld.determinant())<1e-12||Math.abs(camera.projectionMatrix.determinant())<1e-12)
    throw Error('Invalid rendered bone camera');
  const anchor=new T.Vector3().fromArray(boardPosition),eye=anchor.clone().applyMatrix4(camera.matrixWorldInverse);
  if(eye.z>=0)throw Error('Actor bone anchor is behind its camera');
  const depth=anchor.project(camera).z,board=new T.Vector3(pixel.x/width*2-1,1-pixel.y/height*2,depth).unproject(camera);
  if(!board.toArray().every(Number.isFinite))throw Error('Invalid actor-plane bone projection');
  return {pixel:[pixel.x,pixel.y],position:[board.x,board.z,board.y],depth};
}
