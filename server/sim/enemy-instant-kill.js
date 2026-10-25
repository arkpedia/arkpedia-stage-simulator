// SPDX-License-Identifier: GPL-3.0-or-later
// Explicit native enemy InstantKill; legacy Battle.kill keeps its semantics.
const receipts=new WeakMap(),fields=['$type','_targetType','_killSource','_noSource','_withdrawIfRallyPoint','_resultIfInRallyPointMode','_skipReborn','_noReason','_markReachExit','_switchState'];
const present=u=>u?.kind==='enemy'&&u.alive&&u.deployed&&!u.removed;
export function verifyEnemyInstantKill(action){
 if(!action||typeof action.$type!=='string'||action.$type.split(',')[0]!=='Torappu.Battle.Action.Nodes+InstantKill'||Object.keys(action).some(k=>!fields.includes(k))
  ||!['TARGET','SOURCE','BUFF_OWNER'].includes(action._targetType)||['_killSource','_noSource','_skipReborn'].some(k=>typeof action[k]!=='boolean')
  ||['_withdrawIfRallyPoint','_resultIfInRallyPointMode','_noReason','_markReachExit','_switchState'].some(k=>action[k]!==false))throw Error('Unreviewed native enemy InstantKill action');
 return Object.freeze({...action});
}
export const currentEnemyInstantKillReceipt=(ctx,battle)=>{
 const receipt=receipts.get(ctx);return receipt?.battle===battle?receipt:null;
};
export function executeEnemyInstantKill(b,{source=null,target=null,buffOwner=null,action}={}){
 const native=verifyEnemyInstantKill(action),unit=native._killSource||native._targetType==='SOURCE'?source:native._targetType==='BUFF_OWNER'?buffOwner:target;
 if(unit&&unit.kind!=='enemy')throw Error('Native enemy InstantKill requires an enemy recipient');
 if(b.finished||b._endReq||!present(unit))return Object.freeze({status:'inactive'});
 const life=unit.deploySeq,before=unit.hp,killer=native._noSource?null:source;
 if(!native._skipReborn&&b.hasHook('enemyInstantKill')){
  const ctx={unit,source:killer,reborn:false},receipt=Object.freeze({battle:b,unit,unitLife:life,source:killer,owner:source,action:native});
  unit.hp=0;receipts.set(ctx,receipt);
  try{b.emit('enemyInstantKill',ctx);}finally{receipts.delete(ctx);}
  if(unit.deploySeq!==life||!present(unit))return Object.freeze({status:'retired',unit,unitLife:life});
  if(b.finished||b._endReq){if(unit.hp===0)unit.hp=before;return Object.freeze({status:'cancelled',unit,unitLife:life});}
  if(ctx.reborn&&unit.hp>0)return Object.freeze({status:'reborn',unit,unitLife:life});
 }
 b.kill(unit,killer);
 return Object.freeze({status:unit.deploySeq!==life?'replaced':unit.alive?'survived':'killed',unit,unitLife:life});
}
