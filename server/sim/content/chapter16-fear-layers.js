// SPDX-License-Identifier: GPL-3.0-or-later
// Selected targetSide=2, ignoreTargetSide=false native side/layer calculation.
// Runtime named-layer indices must be supplied from the actual scene layout.
export function fearProjectileArrivalLayerMask({sourceSide,layerIndices}){
 if(!Number.isInteger(sourceSide)||sourceSide<-2147483648||sourceSide>2147483647)
  throw new TypeError('Fear arrival requires a native Int32 source-side snapshot');
 const indices={};
 for(const name of ['ALLY','ENEMY','NEUTRAL']){
  const value=layerIndices?.[name];
  if(!Number.isInteger(value)||value<0||value>31)
   throw new TypeError('Fear arrival requires actual named ALLY, ENEMY and NEUTRAL layer indices');
  indices[name]=value;
 }
 // ConvertSideType(0,2) returns the literal2. Otherwise GetOppositeSideMask
 // compares each single side bit for equality, rather than testing membership.
 const sideMask=sourceSide===0?2:sourceSide===1?2:sourceSide===2?5:sourceSide===4?2:0;
 let layerMask=0;
 for(const [side,name]of [[1,'ALLY'],[2,'ENEMY'],[4,'NEUTRAL']])
  if(sideMask&side)layerMask|=1<<indices[name];
 return Object.freeze({sideMask,layerMask});
}
