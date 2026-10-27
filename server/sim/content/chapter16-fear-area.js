// SPDX-License-Identifier: GPL-3.0-or-later
// Internal arrival dispatch over supplied native collider overlaps. Physics,
// layer masks, body geometry and target-option admission remain explicit callers.
const limit=128;
export function fearProjectileAreaDelivery(b,{queryOverlaps,resolveEntity,readUid,isCandidate,verifyTarget,
 deterministic,resolveSource,onSelected,hitTarget}){
 if([queryOverlaps,resolveEntity,readUid,isCandidate,verifyTarget,resolveSource,onSelected,hitTarget].some(fn=>typeof fn!=='function')
  ||typeof deterministic!=='boolean')throw new TypeError('Fear area requires explicit native-query, filter, UID and dispatch callers');
 let used=false,ended=false,endHandle=null;
 const release=()=>{ended=true;if(endHandle)b.off(endHandle);endHandle=null;};
 const active=()=>{if(!ended&&(b.finished||b._endReq))release();return!ended;};
 const stable=row=>{
  if(row.target.deploySeq!==row.life)return false;
  const uid=readUid(row.target);
  return active()&&row.target.deploySeq===row.life&&uid===row.uid;
 };
 if(active())endHandle=b.on('battleEnd',release);
 return Object.freeze({
  deliver(){
   if(used||!active())return null;
   used=true;
   try{
    const overlaps=queryOverlaps();if(!active())return null;
    if(!Array.isArray(overlaps))throw new TypeError('Fear overlap query must provide an ordered collider array');
    const rows=[],seen=new Set();
    for(const collider of overlaps.slice()){
     const target=resolveEntity(collider);if(!active())return null;
     const life=target?.deploySeq;if(!Number.isInteger(life))continue;
     const candidate=isCandidate(target);if(!active())return null;
     if(!candidate||target.deploySeq!==life)continue;
     const uid=readUid(target);if(!active())return null;
     if(target.deploySeq!==life||uid==null||uid===0)continue;
     if(!Number.isInteger(uid)||uid<0||uid>0xffffffff)throw new TypeError('Fear query requires a native uint32 entity UID');
     if(seen.has(uid))continue;
     const verified=verifyTarget(target);if(!active())return null;
     const row={target,life,uid};
     const unchanged=verified&&stable(row);if(!active())return null;
     if(!unchanged)continue;
     seen.add(uid);rows.push(row);
     // Native query truncates its physics result before deterministic sorting.
     if(rows.length===limit)break;
    }
    if(deterministic)rows.sort((a,b)=>a.uid-b.uid);
    if(rows.length){
     const source=resolveSource();if(!active())return null;
     if(source)onSelected({source,count:rows.length});
    }
    let attempted=0,hits=0;
    for(const row of rows){
     if(!active())break;
     if(!stable(row))continue;
     attempted++;if(hitTarget(row.target)===true)hits++;
    }
    return{selected:rows.length,attempted,hits};
   }finally{release();}
  },
  release,
 });
}
