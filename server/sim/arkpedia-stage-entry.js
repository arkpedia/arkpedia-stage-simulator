// SPDX-License-Identifier: GPL-3.0-or-later
// Dispatch after catalogue resolution. This does not admit or add entries:
// 17-16 remains absent from the production catalogue, including experimental.
import {StandardBattle,createStage17_16MechanicsBattle} from './arkpedia.js';
import {stage17_16Preparation} from './content/arkpedia-stage-17-16-mechanics.js';
export function workspaceStagePreparation(data,entry,{experimental=false}={}){
 if(entry?.id==='17-16'&&data?.stage?.code!=='17-16')throw Error('17-16 workspace entry and stage disagree');
 if(data?.stage?.code!=='17-16')return null;
 if(entry?.id!=='17-16'||entry.testOnly!==true||experimental!==true)throw Error('17-16 workspace requires an explicit experimental test-only entry');
 return stage17_16Preparation(data.stage);
}
export function createWorkspaceBattle(data,selection,{entry,experimental=false,seed=1}={}){
 const preparation=workspaceStagePreparation(data,entry,{experimental});
 // Nonselectable cards are installed solely from the retained level actions.
 // Caller squad/support fields cannot add a player card to this scenario.
 return preparation?createStage17_16MechanicsBattle(data,{seed}):new StandardBattle(data,selection,{seed});
}
