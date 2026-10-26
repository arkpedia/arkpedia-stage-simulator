// SPDX-License-Identifier: GPL-3.0-or-later
// Closed internal stage composition. No public enemy/Closure admission.
import contract from '../../data/candidates/arkpedia-17-14-mechanics-contract.json' with {type:'json'};
import {jsonSourceDigest} from './source-digest.js';
export function stage17_14MechanicsPlan(input=contract){
 if(jsonSourceDigest(input)!=='d02c3f75f58296a44ac6d3661f677cc1abef8ea7f43815d79419818cb696fa94')throw Error('Unreviewed 17-14 mechanics source');
 return structuredClone(input);
}
export function assertStage17_14ClosurEnemies(data){
 const plan=stage17_14MechanicsPlan();
 if(!data?.enemies||jsonSourceDigest(data.enemies)!==jsonSourceDigest(plan.records))throw Error('Unreviewed exact 17-14 Closure enemy scope');
}
