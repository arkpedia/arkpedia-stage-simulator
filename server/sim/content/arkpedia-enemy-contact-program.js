// SPDX-License-Identifier: GPL-3.0-or-later
import {prepareBehaviorProgram,decodeBehaviorParameters} from '../../../shared/arkpedia/behavior-program.js';
import {areaSelectable} from '../targeting.js';
import {ALLY_COLLIDER_RADIUS} from '../constants.js';
/** Source-owned contact trigger. Its data program owns damage and any source
 * destruction; the trigger never invents an ordinary attack or attack clock. */
export function contactBuffProgram(params){
 const compiled=validate(params),{radius,buffKey,damageMissable=false,blackboard={}}=params;
 return{tick(b,e,a){
  if(!e.alive||!e.deployed||e.hidden)return;
  const targets=b.alliesInRadius(e.x,e.y,radius+ALLY_COLLIDER_RADIUS).filter(u=>areaSelectable(e,u))
   .sort((x,y)=>Math.hypot(x.x-e.x,x.y-e.y)-Math.hypot(y.x-e.x,y.y-e.y)||x.id-y.id);
  a.contacts??=new Map();const present=new Set(targets);
  for(const u of a.contacts.keys())if(!present.has(u))a.contacts.delete(u);
  for(const target of targets){
   if(a.contacts.get(target)===target.deploySeq)continue;
   a.contacts.set(target,target.deploySeq);
   compiled.run('ON_BUFF_START',{battle:b,unit:target,source:e,blackboard,buffKey,damageMissable});
   if(!e.alive||!e.deployed)return;
  }
 }};
}
function validate({radius,buffKey,damageMissable=false,program,blackboard={},programComponent}){
 if(programComponent!==undefined)throw Error('Unhydrated behaviour program component');
 if(!Number.isFinite(radius)||radius<0||typeof buffKey!=='string'||!buffKey||typeof damageMissable!=='boolean')throw Error('Invalid contact buff program');
 const p=prepareBehaviorProgram(program);p.validateServices([]);p.validateBlackboard(blackboard);return p;
}
contactBuffProgram.validate=validate;
contactBuffProgram.decodeParameters=decodeBehaviorParameters;
