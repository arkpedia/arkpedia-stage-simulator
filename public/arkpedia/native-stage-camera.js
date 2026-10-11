// SPDX-License-Identifier: GPL-3.0-or-later
// Board (x=column,y=row,z=height) to original effect (x,y=height,z=row).
// This preserves the stage projection/depth, not the closed game camera.
export function createNativeStageCamera(T){
  const camera=new T.PerspectiveCamera();
  camera.matrixAutoUpdate=false;camera.matrixWorldAutoUpdate=false;
  // Three's current Camera removes reflected scale while computing its view
  // matrix. This camera is a coordinate bridge, not an authored scaled camera:
  // preserve the exact inverse, including the Y/Z reflection, on every call.
  camera.updateMatrixWorld=camera.updateWorldMatrix=()=>{
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  };
  const sourceToBoard=new T.Matrix4().set(1,0,0,0, 0,0,1,0, 0,1,0,0, 0,0,0,1);
  function sync(stageCamera){
    if(!stageCamera?.isCamera)throw Error('Native stage effects require a stage camera');
    stageCamera.updateMatrixWorld(true);
    if([...stageCamera.matrixWorld.elements,...stageCamera.projectionMatrix.elements].some(v=>!Number.isFinite(v))
      ||Math.abs(stageCamera.matrixWorld.determinant())<1e-12)throw Error('Invalid native stage camera');
    camera.matrixWorld.copy(sourceToBoard).multiply(stageCamera.matrixWorld);
    camera.matrix.copy(camera.matrixWorld);camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    camera.projectionMatrix.copy(stageCamera.projectionMatrix);camera.projectionMatrixInverse.copy(stageCamera.projectionMatrixInverse);
    camera.position.setFromMatrixPosition(camera.matrixWorld);
    camera.isPerspectiveCamera=stageCamera.isPerspectiveCamera===true;camera.isOrthographicCamera=stageCamera.isOrthographicCamera===true;
    camera.near=stageCamera.near;camera.far=stageCamera.far;
    return camera;
  }
  return {camera,sync};
}
