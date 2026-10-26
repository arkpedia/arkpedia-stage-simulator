// SPDX-License-Identifier: GPL-3.0-or-later
// Controlled empty field in the existing app. This is not a 17-14 constructor
// or a canonical clear: native preset source is installed through its own gate.
import{readFile}from'node:fs/promises';
import{createPublicReviewServer}from'./public-review-server.mjs';
const root=new URL('../../',import.meta.url);
export async function createClosurControlsReviewServer({origin}={}){
 const[rawApp,rawData]=await Promise.all(['public/arkpedia/app.js','data/arkpedia-mvp.json'].map(p=>readFile(new URL(p,root),'utf8')));
 const data=JSON.parse(rawData);let app=rawApp;
 const replace=(from,to,count)=>{if(app.split(from).length-1!==count)throw Error('Closure control review app boot changed');app=app.split(from).join(to);};
 replace('import { StandardBattle } from "/sim/arkpedia.js";',`import { StandardBattle } from "/sim/arkpedia.js";
 import {installClosurPredefined,CLOSUR_PREDEFINED_CONTRACT} from '/sim/content/arkpedia-closur-predefined.js';
 function createClosurControlsReviewBattle(data,selection){
  const b=new StandardBattle(data,{operators:[defaultBuild(data.operators.char_122_beagle)]},{seed:1});b.autoFinish=false;
  b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
  b.closurControlsReview=installClosurPredefined(b,{contract:CLOSUR_PREDEFINED_CONTRACT});return b;
 }`,1);
 replace('({ entry: activeStage } = await applyStage(data, stageIndex, requested, fetch, { experimental }));',"activeStage={id:'closure-controls-review',testOnly:true};",1);
 replace('new StandardBattle(data, selection, { seed: Date.now() })','createClosurControlsReviewBattle(data, selection)',2);
 data.stage.geometry.waves.forEach(w=>w.spawns=[]);data.enemies={};
 data.operators=Object.fromEntries(['char_122_beagle','char_4228_closur'].map(id=>[id,data.operators[id]]));
 data.sd={...data.sd,models:{}};data.skillEffects=null;
 const hook=`\nwindow.__closurControlsReview=Object.freeze({read(){
  const f=battle?.closurControlsReview,p=f?.point.point,u=p?.unit;
  return{time:battle?.time,paused,selected,error:battleError,errors:[...(battle?.errors??[])],
   dp:battle?.dp,slots:battle?.deployedSlots(),bench:Object.keys(battle?.bench??{}),
   owner:f?{id:f.u.id,key:f.entry.key,alive:f.u.alive,sp:f.u.skill.spTotal,active:f.u.skill.active}:null,
   point:p?{id:u.id,alive:u.alive,mode:p.mode,readyAt:p.readyAt,hp:u.hp,maxHp:u.s.maxHp,slots:u.deploymentSlotCost,skill:u.skill.noSkill,tile:[u.tileR,u.tileC]}:null};
 }});`;
 return createPublicReviewServer({origin,app,data,hook});
}
