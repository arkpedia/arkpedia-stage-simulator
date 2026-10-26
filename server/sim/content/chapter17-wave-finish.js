// SPDX-License-Identifier: GPL-3.0-or-later
// Literal wave-finish flags mapped to an owned reservation. Room dispatch,
// native scheduler/counter parity and canonical stage admission are separate.
import terminal from '../../../data/candidates/arkpedia-ch17-snake-terminal-contract.json' with {type:'json'};
import {jsonSourceDigest} from '../../../shared/arkpedia/source-digest.js';
import {currentChapter17SnakeWaveFinishReceipt} from './chapter17-snake-terminal.js';
import {isChapter17BossBranchSnake} from './chapter17-boss-branch.js';
const receivers=new WeakMap(),sourceAction=terminal.finish.find(a=>a.$type.endsWith('+FinishCurrentWave'));
const actionDigest='04661d2d91c7a5a9e3c4a3a9331d9a3c82647569d4294eb5ca34b9fb06d06207';
export function installChapter17WaveFinish(b,{stage,waveIndex,owner,reservation,advance}={}){
 if(stage!=='17-18'||!Number.isInteger(waveIndex)||waveIndex<0||waveIndex>2||typeof advance!=='function'
  ||b.finished||b._endReq||b.rect.r0!==0||b.rect.r1!==16||b.rect.c0!==0||b.rect.c1!==10
  ||b.enemySpawnReservationState(reservation,owner)!=='active'||jsonSourceDigest(sourceAction)!==actionDigest)
  throw Error('Wave finish requires an active owned 17-18 wave and its advance receiver');
 if(receivers.has(reservation))throw Error('A wave reservation can have only one finish receiver');
 let active=true,committed=false;const end=b.on('battleEnd',()=>stop());
 function stop(){if(!active)return;active=false;b.off(end);}
 const controller=Object.freeze({
  state:()=>Object.freeze({active,committed,waveIndex}),stop,
  receive(intent){
   if(!active||committed||b.finished||b._endReq||b.enemySpawnReservationState(reservation,owner)!=='active')return false;
   const receipt=currentChapter17SnakeWaveFinishReceipt(intent,b);
   if(!receipt||jsonSourceDigest(receipt.action)!==actionDigest||!isChapter17BossBranchSnake(b,receipt.source,receipt.sourceLife))return false;
   const cancelledSpawns=reservation.pendingCount;
   // finishAndSkip cancels only this wave's unborn work. Both tracking flags
   // are false: no source/body transfer and no rewrite of later reservations.
   committed=true;if(!reservation.cancel()){stop();throw Error('Owned current wave could not be cancelled');}
   stop();advance(Object.freeze({waveIndex,source:receipt.source,sourceLife:receipt.sourceLife,action:receipt.action,cancelledSpawns}));return true;
  },
 });
 receivers.set(reservation,controller);return controller;
}
