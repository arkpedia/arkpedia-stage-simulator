// SPDX-License-Identifier: GPL-3.0-or-later
// Dispatch after catalogue resolution. This does not admit or add entries:
// Both internal stages remain absent from the production catalogue.
import {StandardBattle,createStage17_14MechanicsBattle,createStage17_16MechanicsBattle} from './arkpedia.js';
import {stage17_16Preparation} from './content/arkpedia-stage-17-16-mechanics.js';
import {stage17_14Preparation} from './content/arkpedia-stage-17-14-mechanics.js';
export function workspaceStagePreparation(data,entry,{experimental=false}={}){
 const code=data?.stage?.code;
 for(const id of ['17-14','17-16'])if(entry?.id===id&&code!==id)throw Error(id+' workspace entry and stage disagree');
 if(!['17-14','17-16'].includes(code))return null;
 if(entry?.id!==code||entry.testOnly!==true||experimental!==true)throw Error(code+' workspace requires an explicit experimental test-only entry');
 return code==='17-14'?stage17_14Preparation(data.stage):stage17_16Preparation(data.stage);
}
export function createWorkspaceBattle(data,selection,{entry,experimental=false,seed=1}={}){
 const preparation=workspaceStagePreparation(data,entry,{experimental});
 // Nonselectable cards are installed solely from the retained level actions.
 // Caller squad/support fields cannot add a player card to this scenario.
 if(preparation?.code==='17-14')return createStage17_14MechanicsBattle(data,selection,{seed});
 return preparation?createStage17_16MechanicsBattle(data,{seed}):new StandardBattle(data,selection,{seed});
}
