// SPDX-License-Identifier: GPL-3.0-or-later
/** Exact ordinary scheduler-owned route summon; variants declare the fields
 * they change, rather than copying a partially checked action descriptor. */
export function nativeRouteSummonAction({source='BUFF_OWNER',enemyKey=null,count=0,delay=0,tryOutside=false,offsetBound=0}={}){
 return{$type:'Torappu.Battle.Action.Nodes+SummonEnemiesFollowMyRoute, Assembly-CSharp',_source:source,_enemyKey:enemyKey,_summonCount:count,_delayTime:delay,
  _managedByScheduler:true,_dontBlockWave:false,_trySummonOutsideWhenInObstacle:tryOutside,_randomOffsetBound:offsetBound,_passableMask:'WALK_ONLY',_onlySummonOneInTheSamePlace:false,
  _useOffsetInBB:false,_offsetXKey:null,_offsetYKey:null,_offset:{x:0,y:0},_useLocalUnharmfulFlag:false,_unharmful:false,_useMapPosition:false,_spawnOnHostRootTile:false,
  _useTargetPosition:false,_targetType:'TARGET',_useRandomDelay:false,_randomDelayRange:.5,_stopSummonIfHostDead:false,_useOffsetForEach:false,_addBuffToEnemy:false,_buffToEnemy:null,_checkMotionMode:'ALL',_skipCheckPoint:false};
}
